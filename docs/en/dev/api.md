# JS API

The editor bundle sets one global object, `window.TipTapEditor`. Other extras can use it to create editors, read their state, and add extensions, toolbar buttons and video providers.

## How the editor is loaded

The `TipTapEditor` plugin listens to four MODX events:

| Event | What the plugin does |
|---|---|
| `OnRichTextEditorRegister` | Adds **TipTapEditor** to the list of the `which_editor` setting. |
| `OnRichTextEditorInit` | Manager only, and only when TipTapEditor is the active editor: adds `dist/tiptapeditor.js`, `dist/tiptapeditor.css` and a `<script type="application/json" data-tiptapeditor-config>` block with the configuration: the elements MODX asked to replace, the resource ID, its context, the mode (`new`/`upd`), and the richtext TVs (ID, name, caption, Media Source). |
| `OnManagerPageBeforeRender` | Adds the `tiptapeditor:default` lexicon topic while TipTapEditor is active. |
| `OnRichTextBrowserInit` | On the standalone browser page `?a=browser&tiptapeditor=1` only: adds `js/browser.js`, which sends the chosen file back to the editor. |

With another editor selected, or with `use_editor` off, nothing is loaded.

On DOM ready the bundle calls `TipTapEditor.init()`. It reads the configuration block, hooks into the manager and mounts the editors:

- `MODx.loadRTE` / `MODx.unloadRTE` are replaced by `mount()` / `unmount()`. The resource panel calls them after setup and when the **Rich text** option is toggled.
- `MODx.afterTVLoad` is wrapped to call `refresh()` once the TVs and Form Customization rules are in place.
- Every `textarea.modx-richtext` (richtext TV) gets its own editor. Fields that are not visible yet (hidden tab, collapsed category) start when they become visible.
- A `MutationObserver` picks up fields added or removed later.

## Global API

```js
TipTapEditor.version            // package version, e.g. "0.1.0-alpha17"
TipTapEditor.config             // configuration from OnRichTextEditorInit (null before init)
TipTapEditor.instances          // Map<HTMLTextAreaElement, instance>

TipTapEditor.init(config?)      // read the config and mount editors; called automatically
TipTapEditor.mount(targets?)    // mount editors; idempotent
TipTapEditor.unmount(targets?)  // destroy editors (all when omitted); textareas become visible
TipTapEditor.refresh()          // drop editors whose textarea left the DOM, mount new fields
TipTapEditor.create(element, options?)  // one editor right away; returns the instance or null
TipTapEditor.destroy(element)
TipTapEditor.destroyAll()
TipTapEditor.getInstance(element)
TipTapEditor.sync(element?)     // write pending changes into the textarea(s)
TipTapEditor.syncAll()          // write every editor synchronously, e.g. before an AJAX save
TipTapEditor.registerExtension(extension)
TipTapEditor.registerToolbarItem(item)
TipTapEditor.registerEmbedProvider(provider)
```

**Targets** are a textarea element, an element ID, a CSS selector (its first match) or an array of these.

### create(element, options)

Creates an editor for one textarea now, visible or not. If the textarea already has an editor, that instance is returned. It returns `null` when the field stays a plain textarea (the content could not be loaded without loss, or the editor failed to start; a notice is shown in both cases).

`options` override the configuration (see the order in [Profiles and configuration](../guide/profiles#order-of-configuration)). Use the same keys as a profile, plus:

| Option | Meaning |
|---|---|
| `profile` | Name of a profile from `tiptapeditor.profiles`. |
| `uploadHandler` | `async (file, { editor }) => url` for dropped, pasted and uploaded images. It must upload through MODX (a connector/processor that checks the Media Source) and return the URL. Images are never embedded as base64. |

```js
const instance = TipTapEditor.create('my-textarea', { profile: 'simple' });
```

### Instances

`getInstance(element)` returns the instance of a textarea, or `null`:

| Property | Meaning |
|---|---|
| `editor` | The Tiptap `Editor`. |
| `textarea` | The original textarea. |
| `root` | The editor's wrapper element. |
| `config` | The resolved configuration of this editor. |
| `field` | For a richtext TV: `{ id, name, caption, … }`; otherwise `null`. |
| `source` | HTML source mode: `source.toggle(true \| false)` switches it, `source.active` tells whether it is on. |

```js
const instance = TipTapEditor.getInstance(document.getElementById('ta'));
instance.editor.chain().focus().toggleBold().run();
instance.source.toggle(true);   // show the HTML source
```

## Events

Events are dispatched on `document`. `event.detail` holds the textarea as `element` and, except for `destroy`, the Tiptap `editor`.

| Event | When | `detail` |
|---|---|---|
| `tiptapeditor:init` | An editor was created. | `{ editor, element }` |
| `tiptapeditor:ready` | Right after `init`. | `{ editor, element }` |
| `tiptapeditor:update` | The textarea was written (also from source mode). | `{ editor, element, value }` |
| `tiptapeditor:destroy` | An editor was destroyed. | `{ element }` |

```js
document.addEventListener('tiptapeditor:update', (event) => {
    const { element, value } = event.detail;
    console.log(element.id, value.length);
});
```

## Extending the editor

Load your script on manager pages, for example with a plugin on `OnManagerPageBeforeRender` that calls `$modx->controller->addJavascript()`. Register before the editors start: they start on DOM ready. An extension registered later applies only to editors created afterwards; call `TipTapEditor.unmount()` and `TipTapEditor.mount()` to rebuild them.

### registerExtension

Adds a Tiptap `Extension`, `Node` or `Mark` to every editor created afterwards. The bundle does not export Tiptap itself: build your extension with your own bundler against the same `@tiptap/*` version as the editor (see `package.json`). An extension with the same name as an earlier one replaces it.

```js
TipTapEditor.registerExtension(MyExtension.configure({ option: 1 }));
```

A registered extension can be switched off or configured by its name in a profile or the external config: `"extensions": { "myExtension": false }`.

### registerToolbarItem

Adds a control that can be used by name in `tiptapeditor.toolbar`, in profiles and in the menu lists.

```js
TipTapEditor.registerToolbarItem({
    name: 'myButton',
    label: 'my_button',
    icon: 'bold',
    requires: 'myMark',
    command: (chain) => chain.toggleMark('myMark'),
    active: (editor) => editor.isActive('myMark'),
});
```

| Field | Meaning |
|---|---|
| `name` | Required. The name used in the toolbar setting. |
| `type` | `button` (default), `menu` (with `options`) or `color`. |
| `label` | Lexicon key of the `tiptapeditor` namespace without the `tiptapeditor.` prefix. A missing key is shown as is, so plain text works too. |
| `icon` | Name of a built-in icon (for example `bold`, `link`, `image`, `table`, `hash`, `paperclip`). Without a known icon the button shows its label. |
| `shortcut` | Shown in the tooltip, `Mod` = Ctrl or Cmd (for example `Mod+Shift+M`). It does not bind the key. |
| `requires` | Name of the extension the item needs; the item is hidden when it is not loaded. |
| `command(chain, editor)` | Returns the chain to run. It is also used to check whether the button is enabled. |
| `action(editor, context)` | Instead of `command`, for dialogs and other non-command actions. |
| `active(editor, context)` | Pressed state. |
| `enabled(editor, context)` | Enabled state, when `command` cannot tell. |
| `available(config)` | Return `false` to hide the item for this configuration. |
| `options(editor, config)` | For `type: 'menu'`: a list of `{ label, icon, command, active }` (or `text` instead of `label` for literal text). |

An item name that already exists replaces the built-in item.

### registerEmbedProvider

Adds a video provider to the embed dialog. `match` receives what the user typed, **as a string**, and returns the embed `src`, an object `{ src, width, height }`, or `null`. Later registrations are tried first; a provider that throws is skipped.

```js
TipTapEditor.registerEmbedProvider({
    name: 'example',
    match: (input) => {
        const id = /example\.com\/watch\/(\w+)/.exec(input)?.[1];
        return id ? `https://example.com/embed/${id}` : null;
    },
});
```

The returned address is still subject to `tiptapeditor.iframe_allowed_hosts`.

## How the textarea stays in sync

- The original `<textarea>` stays in the DOM and in the form. It is visually hidden only after the editor started successfully. If anything fails, it stays visible and editable.
- The textarea is written only after the document really changed. Opening a resource and saving it without edits submits exactly the original value.
- While typing, writes are debounced (150 ms). All editors are written synchronously before every MODX form panel submit (`MODx.FormPanel#submit`), on any form `submit` (capture phase) and on `TipTapEditor.syncAll()`.
- Each write fires `input` and `change` on the textarea and marks the MODX form as changed (`MODx.triggerRTEOnChange()` for the content field; richtext TVs react to `change`).
- An empty editor is stored as an empty string.
- Before the editor takes over, it checks that loading the content loses nothing (elements, attributes, comments, text). Parts the editor cannot represent become HTML blocks. If the check still fails, or the content contains U+E000/U+E001, the field stays a plain textarea with a notice.

::: tip Saving from your own code
If your extra saves the form with its own AJAX request, call `TipTapEditor.syncAll()` first, so the textareas hold the latest content.
:::
