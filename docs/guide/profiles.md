# Профили и конфигурация

В системных настройках только то, что почти каждый сайт меняет под себя: панель, CSS, классы, загрузка, галерея. Всё остальное (меню, строка состояния, уровни заголовков, включение функций, защита тегов и т. д.) задаётся **профилями** и **внешним JSON-файлом** — ключи перечислены [ниже](#profile-keys).

Профили нужны и тогда, когда полям нужны разные панели: полный набор для статьи, три кнопки для анонса.

## Порядок применения

Конфигурация собирается слоями, каждый следующий перекрывает предыдущий:

1. значения по умолчанию;
2. системные настройки `tiptapeditor.*` (с учётом настроек контекста, группы и пользователя);
3. внешний JSON-файл (`tiptapeditor.external_config`);
4. профиль поля;
5. параметры `TipTapEditor.create()` из JavaScript (для разработчиков).

Неверные значения пропускаются и записываются в журнал ошибок MODX (уровень WARN), а редактор работает с остальными. Пользователи с правом `settings` (кто может менять системные настройки) видят эти ошибки и над первым редактором на странице.

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

Профиль выбирается по имени, отдельных настроек для этого нет:

| Профиль | Для чего |
|---|---|
| из `tiptapeditor.tv_profiles` | Отдельные TV (см. ниже). |
| `content` | Поле «Содержимое» ресурса и другие поля, которые не TV. Если такого профиля нет — `default`. |
| `default` | Все остальные поля. Если такого профиля нет — только настройки. |

```json
{
    "default": { "statusbar": true },
    "content": { "toolbar": "undo redo | heading paragraphClass | bold italic | link image gallery table | source" },
    "simple": { "toolbar": "bold italic link", "floatingMenu": false, "slashCommands": false }
}
```

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

Те же ключи принимает внешний JSON-файл. Ключи без системной настройки задаются только здесь.

| Ключ | Что задаёт | По умолчанию | Системная настройка |
|---|---|---|---|
| `toolbar` | Панель: строка или список (см. [Панель инструментов](./toolbar)) | панель пакета | `toolbar` |
| `headingLevels` | Уровни заголовков, например `[2, 3]` | `[1, 2, 3, 4, 5, 6]` | — |
| `colors`, `highlightColors` | Палитры цвета текста и выделения, список цветов `["#000000", "#c00000"]` | встроенные | — |
| `stickyToolbar` | Закреплённая панель при прокрутке | `true` | — |
| `features` | Какое содержимое понимает редактор: `{"tables": false, "images": false, "gallery": false, "iframe": false}`. Выключенное остаётся в тексте HTML-блоком и не теряется | всё `true` | — |
| `minHeight`, `maxHeight` | Высота области редактирования; `maxHeight: 0` — без ограничения, равные значения — фиксированная высота | `200`, `700` | `min_height`, `max_height` |
| `bubbleMenu`, `floatingMenu`, `slashCommands` | Меню: `true`, `false` или список кнопок (см. ниже) | `true` | — |
| `statusbar` | Строка состояния (слова, символы, путь элемента) | `false` | — |
| `pasteAsText` | Вставка только текстом | `false` | — |
| `linkClasses`, `imageClasses`, `tableClasses`, `paragraphClasses` | Пресеты классов (см. ниже) | — | `*_classes` |
| `imageAlignClasses` | Классы выравнивания картинок: `{"left": "float-start", "center": "mx-auto", "right": "float-end"}` | `align-left` и т. д. | — |
| `resourceLinkFormat` | Формат ссылки на ресурс | `[[~{id}]]` | `resource_link_format` |
| `contentCss` | CSS сайта в редакторе (строка или список) | — | `content_css` |
| `preserveStyleAttribute` | Сохранять атрибуты `style` без изменений | `true` | — |
| `iframeAllowedAttributes` | Разрешённые атрибуты iframe через запятую (`on*` удаляются всегда) | `src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style` | — |
| `iframeAllowedHosts` | Разрешённые хосты iframe | любой | `iframe_allowed_hosts` |
| `protectModxSyntax` | Защита тегов MODX (см. [Теги MODX и Fenom](./modx-syntax)) | `true` | — |
| `protectFenomSyntax`, `fenomAutocomplete` | Защита Fenom и подсказки переменных | по `fenom` | `fenom` |
| `fenomTags` | Свои теги Fenom | — | `fenom_tags` |
| `modxAutocomplete` | Подсказки тегов MODX | `true` | — |
| `mediaUrlMode` | `relative` или `root` для URL файлов | `relative` | `media_url_mode` |
| `lightbox`, `lightboxAttribute` | «Увеличение по клику» | `false`, — | `lightbox`, `lightbox_attribute` |
| `lightboxLabel` | `aria-label` ссылки увеличения, `{alt}` — текст картинки | «Открыть изображение: {alt}» | — |
| `galleryTemplate` | Шаблон новых галерей | `grid` | `gallery_template` |
| `extensions` | Выключить или настроить расширения по имени (см. ниже) | — | — |
| `editorProps` | Атрибуты области редактирования (см. ниже) | — | — |

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
Уровни заголовков задавайте ключом `headingLevels`, а не параметром `levels` расширения `heading` — он всегда берётся из `headingLevels`.
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

Ключ `preserveStyleAttribute` (по умолчанию `true`) сохраняет inline-атрибуты `style` как есть. Если задать `false`, при правке они могут пропасть; содержимое со стилями при этом всё равно открывается.

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
