# JS API

На страницах менеджера, где работает редактор, доступен глобальный объект `window.TipTapEditor`. Через него дополнения управляют редакторами, добавляют свои расширения Tiptap, кнопки панели и сервисы встраивания видео.

## Как загружается редактор

Плагин **TipTapEditor** работает только в менеджере и только когда TipTapEditor выбран в `which_editor`, а `use_editor` включён.

| Событие | Что делает плагин |
|---|---|
| `OnRichTextEditorRegister` | Добавляет **TipTapEditor** в список редакторов настройки `which_editor`. |
| `OnRichTextEditorInit` | Подключает `assets/components/tiptapeditor/dist/tiptapeditor.js` и `tiptapeditor.css` и выводит блок `<script type="application/json" data-tiptapeditor-config>` с конфигурацией: какие поля заменить, ID ресурса, его контекст, режим (`new`/`upd`), сведения о richtext-TV (ID, имя, подпись, источник файлов), настройки, профили и тексты интерфейса. |
| `OnManagerPageBeforeRender` | Загружает лексикон `tiptapeditor:default`, пока TipTapEditor активен. |
| `OnRichTextBrowserInit` | На отдельной странице файлового менеджера с флагом `tiptapeditor=1` (запасной путь во всплывающем окне) подключает скрипт, который возвращает выбранный файл в редактор. Без флага страница не меняется. |

Конфигурация передаётся как JSON-данные и никогда не выполняется как код. Для фронтенд-вывода richtext-TV плагин ничего не делает.

Скрипт `tiptapeditor.js` — один самодостаточный файл без внешних зависимостей. Он создаёт `window.TipTapEditor` и после загрузки DOM вызывает `TipTapEditor.init()`:

- читает все блоки `data-tiptapeditor-config` на странице;
- подменяет `MODx.loadRTE` и `MODx.unloadRTE` — их вызывает панель ресурса при открытии и при переключении флажка визуального редактора, — а также `MODx.afterTVLoad`;
- перед каждой отправкой `MODx.FormPanel` и на любом событии `submit` синхронно записывает все редакторы в их поля;
- через MutationObserver подхватывает richtext-TV, которые появились или исчезли позже (смена шаблона, Form Customization, вкладки).

## Справочник

```js
TipTapEditor.version            // "0.1.0-alpha17" — совпадает с версией пакета MODX
TipTapEditor.config             // конфигурация из OnRichTextEditorInit (null до init())
TipTapEditor.instances          // Map<textarea, instance>

TipTapEditor.init(config?)      // прочитать конфигурацию и запустить редакторы; вызывается сам
TipTapEditor.mount(targets?)    // создать редакторы (все запрошенные MODX, если без аргумента)
TipTapEditor.unmount(targets?)  // убрать редакторы (все, если без аргумента), поля снова видимы
TipTapEditor.refresh()          // убрать редакторы удалённых полей, создать для новых
TipTapEditor.create(element, options?)  // создать один редактор сейчас; options перекрывают конфигурацию
TipTapEditor.destroy(element)
TipTapEditor.destroyAll()
TipTapEditor.getInstance(element)       // instance или null

TipTapEditor.sync(element?)     // записать отложенные изменения в поле (во все, если без аргумента)
TipTapEditor.syncAll()          // синхронно записать все редакторы, например перед AJAX-сохранением

TipTapEditor.registerExtension(extension)   // расширение Tiptap для редакторов, созданных после вызова
TipTapEditor.registerToolbarItem(item)      // кнопка, доступная по имени в tiptapeditor.toolbar
TipTapEditor.registerEmbedProvider(provider) // сервис видео для диалога встраивания
```

`targets` — ID поля, сам элемент `<textarea>`, CSS-селектор или массив из них. `mount()` идемпотентен: повторный вызов не создаёт второй редактор.

### Экземпляр редактора

`TipTapEditor.getInstance('ta')` и `TipTapEditor.create()` возвращают объект:

| Свойство | Что это |
|---|---|
| `editor` | Экземпляр Tiptap `Editor` — полный API Tiptap: `editor.commands`, `editor.chain()`, `editor.getHTML()` и т. д. |
| `root` | Корневой элемент редактора на странице. |
| `textarea` | Исходное поле MODX. |
| `config` | Итоговая конфигурация этого поля (с профилем). `config.field` — сведения о TV или `null`. |
| `field` | То же, что `config.field`: `{ id, name, caption, … }` для richtext-TV. |
| `source` | Режим HTML-кода: `source.active`, `source.toggle()`, `source.toggle(true)` / `source.toggle(false)`. |

`create()` возвращает `null`, если поле осталось обычным текстовым: содержимое нельзя показать без потерь или при запуске произошла ошибка. В этом случае над полем уже показано сообщение.

```js
const instance = TipTapEditor.getInstance('ta');
instance?.editor.chain().focus().insertContent('<p>Привет</p>').run();
instance?.source.toggle(true);   // показать HTML-код
```

::: warning Значение читайте из поля
Чтобы получить содержимое для сохранения, вызовите `TipTapEditor.sync(element)` и читайте `textarea.value`, а не `editor.getHTML()`. Только `textarea.value` содержит теги MODX, HTML-блоки и исходную разметку в точности.
:::

### Параметры `create()`

Второй аргумент `create(element, options)` перекрывает всю остальную конфигурацию. Принимаются те же ключи, что в [профиле](../guide/profiles#profile-keys), а также:

| Ключ | Что делает |
|---|---|
| `profile` | Имя профиля из `tiptapeditor.profiles`. |
| `extensions` | Массив объектов расширений Tiptap только для этого редактора. |
| `uploadHandler` | `async (file, { editor }) => url` — свой обработчик загрузки картинок (см. ниже). |

```js
TipTapEditor.create(document.getElementById('my-field'), {
    profile: 'simple',
    minHeight: 150,
    features: { tables: false },
});
```

### Свой обработчик загрузки

Если задан `uploadHandler`, перетащенные и вставленные картинки, кнопка **Загрузить с компьютера…** и загрузка в галерее идут через него. Он получает `File` и должен вернуть URL сохранённого файла.

```js
TipTapEditor.create(textarea, {
    uploadHandler: async (file, { editor }) => {
        const body = new FormData();
        body.append('file', file);
        body.append('HTTP_MODAUTH', MODx.siteId);
        const response = await fetch('/assets/components/myextra/connector.php?action=upload', {
            method: 'POST', body, credentials: 'same-origin',
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        return data.url;
    },
});
```

::: danger Загрузка только через MODX
Обработчик должен загружать файл через ваш коннектор или процессор MODX, который проверяет права пользователя и политики источника файлов. Никогда не возвращайте `data:`-URL: такие адреса редактор отклоняет.
:::

## События

События отправляются на `document`, данные — в `event.detail`:

| Событие | `detail` | Когда |
|---|---|---|
| `tiptapeditor:init` | `{ editor, element }` | Редактор создан. |
| `tiptapeditor:ready` | `{ editor, element }` | Редактор готов к работе (сразу после `init`). |
| `tiptapeditor:update` | `{ editor, element, value }` | Новое значение записано в поле (`value` — то, что записано). |
| `tiptapeditor:destroy` | `{ element }` | Редактор убран, поле снова видимо. |

`element` — исходный `<textarea>`.

```js
document.addEventListener('tiptapeditor:update', (event) => {
    const { element, value } = event.detail;
    console.log(element.name, value.length);
});
```

## Свои расширения и кнопки

Скрипт дополнения подключается на страницах менеджера, например плагином на событии `OnManagerPageBeforeRender`:

```php
<?php
// Плагин MyExtra, событие OnManagerPageBeforeRender
if ($modx->controller) {
    $modx->controller->addJavascript($modx->getOption('assets_url') . 'components/myextra/tiptap-extra.js');
}
```

Регистрируйте расширения и кнопки **до того, как запустятся редакторы**: `registerExtension()` действует на редакторы, созданные после вызова. Надёжный вариант — дождаться загрузки страницы и, если редакторы уже созданы, пересоздать их:

```js
function registerMyExtra() {
    const api = window.TipTapEditor;
    if (!api) {
        return;
    }
    api.registerExtension(MyExtension.configure({ option: 1 }));
    api.registerToolbarItem({ /* … */ });
    if (api.instances.size) {
        api.unmount();
        api.mount();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerMyExtra);
} else {
    registerMyExtra();
}
```

### `registerExtension()`

```js
// MyExtension собран вашим сборщиком против той же версии @tiptap/*, что и TipTapEditor.
TipTapEditor.registerExtension(MyExtension.configure({ option: 1 }));
```

- Принимает объект Tiptap `Extension`, `Node` или `Mark`.
- Пакет TipTapEditor не экспортирует классы Tiptap: соберите расширение сами против **той же версии** `@tiptap/*` (она указана в `package.json` проекта; все пакеты `@tiptap/*` закреплены на одной версии).
- Зарегистрированное расширение можно выключить или настроить по имени в профиле или внешней конфигурации: `"extensions": {"myExtension": false}` или `{"myExtension": {"option": 2}}`.

### `registerToolbarItem()` {#toolbar-item}

```js
TipTapEditor.registerToolbarItem({
    name: 'myButton',
    label: 'my_button',
    icon: 'bold',
    command: (chain) => chain.myCommand(),
    active: (editor) => editor.isActive('myMark'),
});
```

После этого `myButton` можно вписать в `tiptapeditor.toolbar`, в профили и в списки меню (`bubbleMenu`, `floatingMenu`, `slashCommands`).

| Поле | Что задаёт |
|---|---|
| `name` | Уникальное имя для настройки панели. Обязательно. |
| `type` | `'button'` (по умолчанию), `'menu'` (выпадающий список) или `'color'` (палитра). |
| `label` | Ключ лексикона без префикса `tiptapeditor.`: ищется среди загруженных записей `tiptapeditor.*`; если не найден, показывается как есть. |
| `icon` | Имя иконки из встроенного набора (`assets-src/js/ui/icons.js`, иконки Lucide), например `bold`, `link`, `image`, `code`. |
| `shortcut` | Подсказка о сочетании клавиш, `Mod` = Ctrl или Cmd. Только для подсказки — само сочетание задаёт расширение. |
| `requires` | Имя расширения; без него кнопка скрыта. |
| `command` | `(chain, editor) => chain` — команда; по ней же проверяется, доступна ли кнопка (`editor.can()`). |
| `action` | `(editor, context) => void` — для кнопок, которые открывают диалоги и т. п. (вместо `command`). |
| `active` | `(editor) => boolean` — подсветка нажатой кнопки. |
| `enabled` | `(editor, context) => boolean` — активна ли кнопка. |
| `available` | `(config) => boolean` — показывать ли кнопку при этой конфигурации. |
| `options` | Для `type: 'menu'`: `(editor, config) => [{ label, icon, command, active }]`. |

### `registerEmbedProvider()` {#embed-provider}

Добавляет сервис видео для диалога **Видео или встраивание**: функция `match` получает то, что ввёл пользователь (строку), и возвращает адрес плеера, объект `{ src, width, height }` или `null`, если ссылка не её.

```js
TipTapEditor.registerEmbedProvider({
    name: 'example',
    match: (value) => {
        let url;
        try {
            url = new URL(value);
        } catch {
            return null;
        }
        return url.hostname === 'video.example.com'
            ? 'https://video.example.com/embed' + url.pathname
            : null;
    },
});
```

Зарегистрированные позже сервисы проверяются раньше встроенных (YouTube, VK Видео, Rutube). Ошибка внутри `match` не ломает диалог: такой сервис просто пропускается. Итоговый адрес всё равно проверяется по `tiptapeditor.iframe_allowed_hosts`.

## Синхронизация с полем MODX {#sync}

- Исходный `<textarea>` остаётся в DOM и в форме. Он визуально скрывается только после успешного запуска редактора; при любой ошибке поле остаётся видимым и редактируемым.
- Поле записывается только после настоящего изменения документа. Открыли и сохранили без правок — отправится ровно исходное значение.
- Во время набора запись откладывается на 150 мс. Перед каждой отправкой `MODx.FormPanel`, на любом событии `submit` и при вызове `TipTapEditor.syncAll()` все редакторы записываются синхронно.
- Каждая запись вызывает события `input` и `change` на поле и помечает форму MODX изменённой (`MODx.triggerRTEOnChange()` для поля содержимого; richtext-TV реагируют на `change`).
- Пустой редактор сохраняется как пустая строка.
- Перед запуском редактор проверяет, что загрузка содержимого ничего не теряет (элементы, атрибуты, комментарии, текст). Части без визуального аналога становятся HTML-блоками. Если проверка всё равно не проходит или в содержимом есть символы U+E000/U+E001, поле остаётся обычным текстовым с короткой пометкой.
- В режиме HTML-кода всё набранное сразу записывается в поле, с теми же событиями.

::: tip Своё AJAX-сохранение
Если дополнение сохраняет форму в обход `MODx.FormPanel` и без события `submit`, вызовите `TipTapEditor.syncAll()` перед чтением значений полей.
:::
