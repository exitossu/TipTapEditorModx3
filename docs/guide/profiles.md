# Профили и конфигурация

Системных настроек хватает, когда редактор везде одинаковый. Если полям нужны разные панели — полный набор для статьи, три кнопки для анонса — используйте **профили**. Для тонкой настройки, которой нет в системных настройках, есть **внешний JSON-файл**.

## Порядок применения

Конфигурация собирается слоями, каждый следующий перекрывает предыдущий:

1. значения по умолчанию;
2. системные настройки `tiptapeditor.*` (с учётом настроек контекста, группы и пользователя);
3. внешний JSON-файл (`tiptapeditor.external_config`);
4. профиль поля;
5. параметры `TipTapEditor.create()` из JavaScript (для разработчиков).

Неверные значения пропускаются и записываются в журнал ошибок MODX (уровень WARN), а редактор работает с остальными.

## Профили

Профили описываются JSON-объектом в `tiptapeditor.profiles`: имя профиля → его настройки.

```json
{
    "simple": { "toolbar": "bold italic link" },
    "article": {
        "toolbar": "undo redo | heading paragraphClass | bold italic | link image table | source",
        "minHeight": 400,
        "paragraphClasses": { "lead": "Вводный абзац" }
    }
}
```

### Какой профиль у поля

| Настройка | Для чего |
|---|---|
| `tiptapeditor.content_profile` | Поле «Содержимое» ресурса (и другие поля, которые не TV). Пусто — профиль по умолчанию. |
| `tiptapeditor.tv_profiles` | Профили для отдельных TV. |
| `tiptapeditor.default_profile` | Всё остальное. Значение `default` означает «без профиля, только настройки». |

`tiptapeditor.tv_profiles` записывается по строке на TV или через запятую:

```text
intro=simple
article_body=article
```

или JSON-объектом:

```json
{ "intro": "simple", "tv12": "article" }
```

TV указывается по имени или как `tv<ID>` (`tv12`).

Разработчик может выбрать профиль и при создании редактора: `TipTapEditor.create(textarea, { profile: 'simple' })`.

### Что можно задать в профиле {#profile-keys}

| Ключ | Что задаёт | Аналог в системных настройках |
|---|---|---|
| `toolbar` | Панель: строка или список (см. [Панель инструментов](./toolbar)) | `toolbar` |
| `headingLevels` | Уровни заголовков, например `[2, 3]` | `heading_levels` |
| `colors`, `highlightColors` | Палитры цвета текста и выделения, список цветов `["#000000", "#c00000"]` | — |
| `stickyToolbar` | Закреплённая панель | `sticky_toolbar` |
| `features` | Включение функций: `{"tables": false, "images": false, "gallery": false, "iframe": false, "fullscreen": false}` | `enable_*` |
| `minHeight`, `maxHeight`, `defaultHeight`, `autogrow` | Высота редактора | `min_height` и др. |
| `bubbleMenu`, `floatingMenu`, `slashCommands` | Меню: `true`, `false` или список кнопок | `bubble_menu` и др. |
| `statusbar` | Строка состояния | `statusbar` |
| `pasteAsText` | Вставка только текстом | `paste_as_text` |
| `linkClasses`, `imageClasses`, `tableClasses`, `paragraphClasses` | Пресеты классов (см. ниже) | `*_classes` |
| `imageAlignClasses` | Классы выравнивания картинок: `{"left": "float-start", "center": "mx-auto", "right": "float-end"}` | — |
| `resourceLinkFormat` | Формат ссылки на ресурс | `resource_link_format` |
| `contentCss` | CSS сайта в редакторе (строка или список) | `content_css` |
| `preserveStyleAttribute` | Сохранять атрибуты `style` | `preserve_style_attribute` |
| `iframeAllowedAttributes`, `iframeAllowedHosts` | Правила для iframe | `iframe_allowed_*` |
| `modxAutocomplete`, `fenomAutocomplete` | Подсказки тегов | `*_autocomplete` |
| `lightbox`, `lightboxAttribute`, `lightboxLabel` | «Увеличение по клику» | `lightbox*` |
| `galleryTemplate`, `galleryTemplates` | Шаблоны галерей | `gallery_template*` |
| `extensions` | Выключить или настроить расширения по имени (см. ниже) | — |
| `editorProps` | Атрибуты области редактирования (см. ниже) | — |

Другие ключи игнорируются.

### Меню в профиле {#menus}

`bubbleMenu`, `floatingMenu` и `slashCommands` принимают `true` (набор по умолчанию), `false` (выключено) или строку с именами кнопок, как в панели:

```json
{
    "simple": {
        "toolbar": "bold italic link",
        "bubbleMenu": "bold italic link",
        "floatingMenu": false,
        "slashCommands": "h2 h3 bulletList image"
    }
}
```

Кнопки выключенных функций в меню не показываются.

## Внешняя конфигурация

`tiptapeditor.external_config` указывает путь к JSON-файлу, например `{core_path}config/tiptapeditor.json`. Можно использовать `{core_path}`, `{base_path}` и `{assets_path}`; относительный путь отсчитывается от `base_path`.

```json
{
    "toolbar": ["undo", "redo", "|", "bold", "italic", "|", "link", "source"],
    "features": { "tables": false },
    "headingLevels": [2, 3],
    "extensions": { "highlight": false },
    "editorProps": { "attributes": { "spellcheck": "false", "lang": "ru" } },
    "profiles": { "simple": { "toolbar": "bold italic link" } }
}
```

- В файле те же ключи, что в профиле, плюс `profiles` — они добавляются к `tiptapeditor.profiles` и перекрывают профили с теми же именами.
- Читается только файл `.json` внутри `core_path` или `base_path` размером до 256 КБ. Путь проверяется после раскрытия `../` и символьных ссылок.
- Это **данные**: из файла ничего не выполняется, передать функции нельзя.
- Обновление пакета файл не трогает. Удобно держать его в `core/config/`, вне публичной папки.

### `extensions`

Встроенные и зарегистрированные расширения Tiptap можно выключить (`false`) или передать им параметры (простые данные) по имени:

```json
{
    "extensions": {
        "highlight": false,
        "superscript": false,
        "subscript": false,
        "strike": false
    }
}
```

Кнопки выключенных расширений пропадают с панели. Расширения, от которых зависит сохранность содержимого (HTML-блоки, теги MODX/Fenom, абзацы без `<p>`, сохранение атрибутов), выключить нельзя — такие ключи игнорируются.

::: tip
Уровни заголовков задавайте ключом `headingLevels` (или настройкой `tiptapeditor.heading_levels`), а не параметром `levels` расширения `heading` — он всегда берётся из `headingLevels`.
:::

### `editorProps`

Можно задать только атрибуты области редактирования (`attributes`) и только безопасные: `spellcheck`, `lang`, `dir`, `class`, `autocorrect`, `autocapitalize`, `data-*` и `aria-*`.

## CSS сайта в редакторе {#content-css}

Чтобы текст в редакторе выглядел как на сайте, укажите стили в `tiptapeditor.content_css` — через запятую или с новой строки:

```text
{assets_url}css/content.css, /assets/css/article.css
```

Можно использовать `{assets_url}` и `{base_url}`.

- Каждое правило ограничивается областью редактирования, поэтому сам менеджер не перекрашивается. Селекторы `body` и `html` относятся к области редактирования.
- Относительные `url()` (шрифты, фоны) считаются от адреса самого CSS-файла.
- `@import` не загружается — перечислите нужные файлы явно.
- Файлы загружает браузер пользователя менеджера: с того же домена или с разрешённым CORS.

## Атрибуты и пресеты классов {#classes}

### Атрибуты сохраняются

Абзацы, заголовки, цитаты, списки, пункты списков, блоки кода, горизонтальные линии, ссылки и строчные элементы сохраняют все атрибуты, для которых у редактора нет поля: `id`, `class`, `title`, `lang`, `dir`, `role`, `data-*`, `aria-*`, `style`. Поэтому `<p class="lead">` или `<h2 class="title" id="x">` остаются обычным редактируемым текстом и сохраняются как написаны. Атрибуты-обработчики событий (`onclick` и т. п.) не сохраняются никогда — такой элемент становится [HTML-блоком](./modx-syntax#raw-html).

`tiptapeditor.preserve_style_attribute` (включена по умолчанию) сохраняет inline-атрибуты `style` как есть. Если выключить, при правке они могут пропасть; содержимое со стилями при этом всё равно открывается.

### Пресеты классов

Пресет — это CSS-класс с понятным названием, который редактор выбирает из списка. Все четыре настройки принимают JSON-объект `{"класс": "Название"}` или просто список классов через запятую:

```json
{ "lead": "Вводный абзац", "note": "Примечание" }
```

```text
lead, note
```

| Настройка | Где появляется |
|---|---|
| `tiptapeditor.paragraph_classes` | Меню **Стиль абзаца** (кнопка `paragraphClass`) — для абзацев и заголовков. Другие классы элемента остаются. |
| `tiptapeditor.image_classes` | Поле **Стиль** в диалоге изображения. |
| `tiptapeditor.table_classes` | Поле **Стиль** в диалоге таблицы. В одной записи может быть несколько классов: `{"table table--striped": "Полосатая"}`. |
| `tiptapeditor.link_classes` | Поле **CSS-класс** в диалоге ссылки: `{"button": "Кнопка"}`. Без пресетов — свободное текстовое поле. |

Классы, которых нет в пресетах, при выборе стиля не удаляются. Не забудьте описать эти классы в CSS сайта (и подключить его через `tiptapeditor.content_css`, чтобы видеть их в редакторе).

Пример профиля для статьи со всеми пресетами:

```json
{
    "article": {
        "toolbar": "undo redo | heading paragraphClass | bold italic | link modxLink | image gallery table | source",
        "headingLevels": [2, 3, 4],
        "paragraphClasses": { "lead": "Вводный абзац", "note": "Примечание" },
        "imageClasses": { "article-image": "В статье", "rounded": "Скруглённое" },
        "tableClasses": { "table table--striped": "Полосатая" },
        "linkClasses": { "button": "Кнопка" },
        "contentCss": "/assets/css/article.css"
    }
}
```
