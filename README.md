# TipTapEditor for MODX Revolution 3

A rich text editor for the MODX 3 manager built on [Tiptap 3](https://tiptap.dev/) / ProseMirror.
It registers as **TipTapEditor** in the `which_editor` system setting and replaces the resource
content field and RichText template variables.

> Status: **0.1.0-alpha20, stage 12b of 14** (menus, paste, embeds, autocomplete, uploads).
> Documentation: https://exitossu.github.io/TipTapEditorModx3/ (sources in `docs/`, `npm run docs:dev`).

## Requirements

- MODX Revolution 3.0+
- PHP 8.0+
- For development: Node.js 20.19+ (or 22.12+), npm

Everything is bundled locally: no CDN, no Tiptap Cloud, no API keys, no paid extensions.

## Project layout

```
_build/                      transport package builder (ModExtra3-based)
  build.php  config.inc.php
  elements/  plugins.php settings.php
  resolvers/ uninstall.php
assets/components/tiptapeditor/ shipped assets: connector.php, dist/ (built bundle)
assets-src/                  editor sources (ES modules, SCSS), not shipped
core/components/tiptapeditor/   PHP: bootstrap.php, src/ (PSR-4, namespace TipTapEditor), lexicon/, elements/
scripts/                     dev helper scripts
```

PHP classes are autoloaded through `core/components/tiptapeditor/bootstrap.php`, which MODX runs for
every registered namespace; the package needs no `vendor/` directory.

## Development setup

```bash
npm install
npm run build      # -> assets/components/tiptapeditor/dist/tiptapeditor.js + tiptapeditor.css
npm run watch      # rebuild on change
npm run check:tiptap-versions   # all @tiptap/* pinned to one exact version
```

## Building the transport package

`npm run build` must run first: the builder refuses to package without `dist/` or when the PHP
version constant differs from `package.json`.

```bash
# CLI, against any MODX 3 site
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php            # build only
MODX_CORE_PATH=/path/to/site/core/ php _build/build.php --install  # build and install
```

The ModExtra3 layout also works: put the project into `{site}/Extras/TipTapEditor/` and open
`/Extras/TipTapEditor/_build/build.php` (add `?install=1` to install, `?download=1` to download the zip).
The package is written to `core/packages/tiptapeditor-<version>.transport.zip`.

## Install, upgrade, uninstall

- **Install** adds the namespace, the `TipTapEditor` plugin (events `OnRichTextEditorRegister`,
  `OnRichTextEditorInit`, `OnRichTextBrowserInit`, `OnManagerPageBeforeRender`) and the
  `tiptapeditor.*` system settings, and sets the system settings `which_editor` to **TipTapEditor**
  and `use_editor` to 1 (the previous values are in the install log). Context and user settings
  keep their values, except an old "Tiptap RTE" value, which install and upgrade rename.
- **Upgrade** never resets existing system settings, external config or content.
- **From TiptapRTE (0.1.0-alpha15 and older)**: the extra was renamed to TipTapEditor (namespace,
  settings `tiptapeditor.*`, folders, plugin). Uninstall the old TiptapRTE package first, then
  install TipTapEditor and set your settings again under the new prefix. Galleries saved with
  `data-tiptaprte-gallery` still open as galleries and get `data-gallery` when saved again.
- **Uninstall** removes files, plugin, settings and namespace. Wherever `which_editor` pointed to TipTapEditor (system, context,
  user group or user settings) it is reset to empty (plain textarea). Resource content and TV values are never modified.

## System settings

All settings use the `tiptapeditor.` prefix and have English and Russian descriptions.

| Area | Settings |
|---|---|
| Interface | `toolbar`, `profiles`, `default_profile`, `content_profile`, `tv_profiles`, `heading_levels`, `bubble_menu`, `floating_menu`, `slash_commands`, `statusbar`, `sticky_toolbar`, `enable_fullscreen`, `min_height`, `max_height`, `default_height`, `autogrow`, `content_css` |
| Content | `enable_tables`, `enable_images`, `enable_gallery`, `gallery_template`, `gallery_templates_path`, `lightbox`, `lightbox_attribute`, `lightbox_label`, `enable_iframe`, `iframe_allowed_attributes`, `iframe_allowed_hosts`, `paste_as_text`, `image_classes`, `link_classes`, `paragraph_classes`, `table_classes`, `preserve_style_attribute` |
| MODX integration | `protect_modx_syntax`, `protect_fenom_syntax`, `fenom_tags`, `modx_autocomplete`, `fenom_autocomplete`, `links_across_contexts`, `resource_link_format`, `media_source`, `media_url_mode`, `upload_enabled`, `upload_path` |
| System | `external_config`, `debug` |

Configuration is applied in this order (later wins): defaults → system settings → external config
→ profile → runtime options of `TipTapEditor.create()`. Invalid values are skipped and logged in the
MODX error log (level WARN); the editor then runs with the rest.

### Profiles

`tiptapeditor.profiles` is a JSON object of named configurations; a field uses one of them:

```json
{
    "simple":  { "toolbar": "bold italic link" },
    "article": { "toolbar": "undo redo | heading paragraphClass | bold italic | link image table | source",
                 "minHeight": 400, "paragraphClasses": {"lead": "Lead"} }
}
```

- `tiptapeditor.content_profile`: profile of the resource content field (and other non-TV fields).
- `tiptapeditor.tv_profiles`: profile per richtext TV, `intro=simple, article_body=article` (one per
  line or comma separated) or JSON `{"intro": "simple"}`; the TV name or `tv<ID>`.
- `tiptapeditor.default_profile`: everything else (`default`: no profile, just the settings).
- At runtime: `TipTapEditor.create(textarea, { profile: 'simple' })`.

A profile may set: `toolbar` (string or list), `headingLevels`, `colors`, `highlightColors`,
`stickyToolbar`, `features` (`{"tables": false, "images": false, "fullscreen": false}`),
`minHeight`, `maxHeight`, `defaultHeight`, `autogrow`, `linkClasses`, `imageClasses`,
`tableClasses`, `paragraphClasses`, `imageAlignClasses`, `resourceLinkFormat`, `contentCss`,
`preserveStyleAttribute`, `extensions`, `editorProps`. Other keys are ignored.

### External config

`tiptapeditor.external_config` points to a JSON file, e.g. `{core_path}config/tiptapeditor.json`
(placeholders `{core_path}`, `{base_path}`, `{assets_path}`; relative paths start at base_path):

```json
{
    "toolbar": ["undo", "redo", "|", "bold", "italic", "|", "link", "source"],
    "features": { "tables": false },
    "extensions": { "highlight": false },
    "editorProps": { "attributes": { "spellcheck": "false", "lang": "ru" } },
    "profiles": { "simple": { "toolbar": "bold italic link" } }
}
```

- Only a `.json` file inside core_path or base_path is read (checked with `realpath`), at most
  256 KB. It is data: nothing in it is executed, there is no way to pass functions.
- The same keys as a profile, plus `profiles` (added to, and overriding, `tiptapeditor.profiles`).
- `extensions`: switch built-in or registered extensions off (`false`) or pass options (plain
  data) by name. The extensions content depends on (raw HTML blocks, MODX/Fenom tokens, implicit
  paragraphs, preserved attributes) cannot be switched off.
- `editorProps`: only `attributes` of the editing area, and only `spellcheck`, `lang`, `dir`,
  `class`, `autocorrect`, `autocapitalize`, `data-*` and `aria-*`.
- Upgrades never touch this file.

### Content CSS

`tiptapeditor.content_css`: stylesheets of the site shown in the editor, comma or newline separated
(`{assets_url}css/content.css, /assets/css/article.css`). Every rule is scoped to the editing area
(`body`/`html` stand for the editing area itself), so the manager is never restyled; relative
`url()` references are resolved against the stylesheet; `@import` is not followed. The files are
fetched by the browser of the manager user (same origin, or with CORS).

### Attributes and class presets

- Paragraphs, headings, quotes, lists, list items, code blocks, horizontal rules, links and inline
  marks keep every attribute the editor has no field for (`id`, `class`, `title`, `lang`, `dir`,
  `role`, `data-*`, `aria-*`, `style`, …): `<p class="lead">` or `<h2 class="title" id="x">` stay
  editable and are saved as written. Event handler attributes are never kept (that block stays an
  HTML block).
- `tiptapeditor.paragraph_classes`: class presets for paragraphs and headings (`{"lead": "Lead"}` or
  `lead, note`), offered by the `paragraphClass` toolbar menu; other classes of the element stay.
- `tiptapeditor.preserve_style_attribute` (on by default): inline `style` attributes are kept verbatim.
  Off: they may be dropped when the content is edited (content with styles still opens).

## Toolbar configuration

`tiptapeditor.toolbar` lists toolbar items separated by spaces; `|` starts a new group. Names are
case-insensitive, unknown names are skipped. Changing the setting needs no rebuild.

Default:

```
undo redo | heading | bold italic underline strike code | color highlight | superscript subscript
| align | bulletList orderedList | blockquote horizontalRule | link modxLink anchor | image gallery file table embed
| codeBlock | clearFormatting | source fullscreen
```

| Item | Does |
|---|---|
| `undo` `redo` | history |
| `heading` | menu: paragraph and the levels from `tiptapeditor.heading_levels` |
| `paragraph` `h1` ... `h6` | single block types |
| `bold` `italic` `underline` `strike` `code` `superscript` `subscript` | inline formatting |
| `color` `highlight` | palettes, with "remove color" |
| `align` | menu; or `alignLeft` `alignCenter` `alignRight` `alignJustify` |
| `bulletList` `orderedList` `blockquote` `horizontalRule` `codeBlock` | blocks |
| `clearFormatting` | removes marks and block formatting |
| `fullscreen` | fullscreen mode, Esc leaves it (`tiptapeditor.enable_fullscreen`) |
| `link` | link dialog (Ctrl/Cmd+K) |
| `modxLink` | link dialog opened on the MODX resource search |
| `unlink` | removes the link under the cursor |
| `anchor` | sets the anchor (`id`) of the current heading |
| `paragraphClass` | menu of the classes from `tiptapeditor.paragraph_classes` |
| `image` | image dialog: Media Browser, upload from computer, copy by link |
| `imageUpload` `imageUrl` | optional direct buttons: image from computer / by link (need `upload_enabled`) |
| `gallery` | gallery dialog (`enable_gallery`) |
| `file` | Media Browser: link to a file |
| `embed` | video or iframe (`enable_iframe`) |
| `source` | HTML source mode |
| `table` | insert a table (dialog); in a table: table properties |
| `addRowBefore` `addRowAfter` `deleteRow` `addColumnBefore` `addColumnAfter` `deleteColumn` `toggleHeaderRow` `toggleHeaderColumn` `mergeCells` `splitCell` `tableProperties` `deleteTable` | table commands; they are on the table toolbar anyway, but can also be placed in the main toolbar |

Keyboard: Tab reaches the toolbar once, arrow keys move between controls, Home/End jump, Enter/Space
or Arrow Down open menus, Escape closes a menu or returns to the text. Standard shortcuts: Ctrl/Cmd+B,
I, U, K, Z, Shift+Z; Ctrl/Cmd+S is MODX's own save shortcut.

## JS API

```js
TipTapEditor.version            // e.g. "0.1.0-alpha17", same as the MODX package version
TipTapEditor.config             // configuration passed by OnRichTextEditorInit (null before init)
TipTapEditor.instances          // Map<textarea, { editor, root, textarea, config }>

TipTapEditor.init()             // reads the MODX config and mounts editors; called automatically
TipTapEditor.mount(targets?)    // idempotent; targets: id, element, selector or an array of them
TipTapEditor.unmount(targets?)  // destroys editors (all when omitted), textareas become visible
TipTapEditor.refresh()          // drops editors whose textarea left the DOM, mounts new fields
TipTapEditor.create(element, options?)  // one editor right away; options override the config
TipTapEditor.destroy(element)
TipTapEditor.destroyAll()
TipTapEditor.getInstance(element)
TipTapEditor.sync(element?)     // write pending changes into the textarea(s)
TipTapEditor.syncAll()          // synchronous write of every editor, e.g. before an AJAX save
TipTapEditor.registerExtension(extension)   // Tiptap Extension/Node/Mark for editors created afterwards
TipTapEditor.registerToolbarItem(item)      // a toolbar control usable by name in tiptapeditor.toolbar
TipTapEditor.registerEmbedProvider({ name, match(input) })  // typed text -> iframe src for the embed dialog
TipTapEditor.getInstance(el).source.toggle()  // HTML source mode
```

Custom extensions: load a script on manager pages (e.g. a plugin on `OnManagerPageBeforeRender`
calling `$modx->controller->addJavascript()`), and register before the editors start:

```js
// Your extension, built with your own bundler against the same @tiptap/* version.
TipTapEditor.registerExtension(MyExtension.configure({ option: 1 }));
TipTapEditor.registerToolbarItem({
    name: 'myButton', label: 'my_button', icon: 'bold',
    command: (chain) => chain.myCommand(), active: (editor) => editor.isActive('myMark'),
});
```

`label` is a lexicon key of the `tiptapeditor` namespace (missing keys show as is). A registered
extension can be switched off or configured by its name in the external config or a profile.

Events on `document`: `tiptapeditor:init`, `tiptapeditor:ready`, `tiptapeditor:update` (`event.detail`
holds `{ editor, element }`, update also `value`) and `tiptapeditor:destroy` (`{ element }` only).

## How the textarea and the editor stay in sync

- The original `<textarea>` stays in the DOM and in the form. It is visually hidden only after the
  editor started successfully; if anything fails, the textarea stays visible and editable.
- The textarea is written only after the document really changed. Opening a resource and saving
  it without edits submits exactly the original value.
- While typing, writes are debounced (150 ms). Before every MODX form panel submit, on any form
  `submit` and on `TipTapEditor.syncAll()` all editors are written synchronously.
- Each write fires `input` and `change` on the textarea and marks the MODX form dirty
  (`MODx.triggerRTEOnChange()` for the content field; richtext TVs react to `change`).
- An empty editor is stored as an empty string.
- Before the editor takes over, it checks that loading the content loses nothing (elements,
  attributes, comments, text). Parts the editor cannot represent become HTML blocks (see
  "MODX and Fenom syntax"); only when the whole check still fails (or the content contains the
  private use characters U+E000/U+E001 the editor uses internally) the field stays a plain
  textarea with a short notice.

Note: browsers submit textarea values with CRLF line breaks; MODX stores them as received. This is
standard browser behaviour and happens with or without an editor.

## How the editor is loaded

- `OnRichTextEditorRegister` adds **TipTapEditor** to the `which_editor` list.
- `OnRichTextEditorInit` (manager only, and only when TipTapEditor is the active editor) adds
  `dist/tiptapeditor.js`, `dist/tiptapeditor.css` and a `<script type="application/json" data-tiptapeditor-config>`
  block with the elements MODX asked to replace, the resource ID, its context and the mode (`new`/`upd`).
- `OnManagerPageBeforeRender` adds the `tiptapeditor:default` lexicon topic while TipTapEditor is active.
- With another editor selected, or `use_editor` off, nothing is loaded.

## Richtext TVs

- Every `textarea.modx-richtext` on the resource page gets its own editor (MODX passes only `ta`
  to `OnRichTextEditorInit`, so TVs are found in the page). The plugin adds the ID, name and caption
  of the richtext TVs to the config; an instance exposes them as `instance.config.field`.
- TVs are mounted after the resource panel has built its tabs (`MODx.afterTVLoad`). Fields on a
  hidden tab or in a collapsed category start when they become visible.
- TVs added or removed later (template switch, Form Customization, extras) are picked up by a
  MutationObserver; editors of removed fields are destroyed.
- Read-only TVs get a read-only editor, disabled ones stay plain textareas. Each TV is synced and
  marked changed on its own; the "Rich text" option of the resource only affects the content field.

## Links

The link dialog (`link`, Ctrl/Cmd+K) has: URL, **MODX resource** search, **File…** (Media
Browser), anchors of the current text, link text (when nothing is selected), title, "open in" (same
or new window), rel and CSS class.

- Nothing is added to a URL: `[[~12]]`, `#anchor`, `/path/`, `mailto:`, `tel:` and plain domains
  are written as typed. `javascript:`, `vbscript:`, `data:` and `file:` URLs are refused.
- Links get no `target`/`rel` of their own. Choosing "new window" adds `noopener noreferrer` to
  rel (other tokens stay); going back to the same window removes those two again.
- CSS class: a list of presets from `tiptapeditor.link_classes` (`{"button": "Button"}` or
  `button, more`), or a text field when the setting is empty. An unknown existing class is kept.
- MODX resource: the search runs through `connector.php` and the processor
  `TipTapEditor\Processors\Resource\Search` (title, long title, alias, ID; at least 2 characters or
  an ID; 300 ms debounce; at most 50 results). It needs the `view_document` permission, uses the
  model layer so resource group ACL applies, checks `list` on every result, and searches only the
  resource's context unless `tiptapeditor.links_across_contexts` is on (then all contexts the user may
  load, never `mgr`). The picked resource is written with `tiptapeditor.resource_link_format`
  (default `[[~{id}]]`; `{context}` and `{uri}` are also available). Editing such a link shows the
  resource title.
- Links with MODX tags in `href` (`[[~12]]`, `[[~5? &scheme=`abs`]]`) are shown and edited as
  written and saved byte for byte (see "MODX and Fenom syntax").
- Headings keep their `id`; the `anchor` button sets one, and the link dialog lists them as `#id`.

## Media Browser

- **Image** (`image` in the toolbar) opens the image dialog. "Choose in Media Browser…" opens the
  standard MODX Media Browser (in the folder of the current file) and puts the chosen file into
  the URL field; with uploads on, the dialog can also upload from the computer or copy a picture
  from a link (see Image upload). Non-image files are refused with a message. Without a Media
  Source the dialog takes a URL only. "Replace file" in the image menu replaces only the file of
  a selected image; alt, title, size and other attributes stay.
- **Link to a file** (`file`) opens the browser without a type filter: the selected text becomes a
  link to the file, or the file name is inserted as the link text.
- The URL is the one MODX returns (`fullRelativeUrl`), never built by the editor, so any Media
  Source works (filesystem, S3, custom). `tiptapeditor.media_url_mode = root` prefixes relative URLs
  with the site base URL. In the editor, relative image URLs are shown resolved against the site;
  the stored `src` is unchanged.
- Media Source per field: richtext TVs use the source assigned to the TV for the resource's
  context; the content field uses `tiptapeditor.media_source` or the context's `default_media_source`.
  The plugin passes only the source ID, name and base URL, and only when the user has the
  `file_manager` permission and the source allows `list`; otherwise the file button is disabled
  and the image dialog has no browse button.
  The browser itself checks the same permissions on every request.
- The in-page browser window is the main path. If it is not available, the editor opens the
  standalone page `?a=browser&tiptapeditor=1` in a popup; `OnRichTextBrowserInit` adds
  `assets/components/tiptapeditor/js/browser.js` there, which posts the chosen file back to the editor
  with an explicit origin. The browser page without the `tiptapeditor` flag is left alone.
- Dropped or pasted image files are never stored as base64. Without an upload handler the editor
  shows a hint to use the Image button. Extras can pass an upload handler at runtime:
  `TipTapEditor.create(el, { uploadHandler: async (file, { editor }) => url })`; it must upload
  through MODX (a connector/processor that checks the Media Source) and return the URL.

Existing installs keep their `tiptapeditor.toolbar` value on upgrade; add `file` next to `image` to
get the file link button.

## Images

- **Image dialog**: URL (with *Choose in Media Browser* and a preview), alt, title, width,
  height, alignment, style preset and other CSS classes. It opens for a newly inserted image, on
  double click or Enter on a selected image, and from the image menu.
- **Image menu** over a selected image: Edit, Replace file (only with a Media Source), Remove.
- Width and height take whole pixels (`640`) or percent (`100%`); the original size of the
  picture is offered as a button and is never applied by itself.
- Alignment writes a class: `align-left`, `align-center`, `align-right` (styled in the editor; add
  the same rules to the site CSS). Style presets come from `tiptapeditor.image_classes`, a JSON
  object `{"article-image": "Article"}`. Classes the dialog does not know stay as they are.
- Every other attribute of an existing `<img>` is kept as written: `id`, `data-*`, `loading`,
  `srcset`, `sizes`, `style`, …. The editor shows the picture without `srcset` (relative entries
  would load from the manager directory) but saves it unchanged. Saving the dialog without changes
  does not touch the image at all.
- Not accepted: `data:` URLs (no base64 in content), `javascript:` and other unsafe URLs, event
  handler attributes. A paragraph with `<img onerror="…">` is kept as an HTML block (shown as
  text, the handler never runs in the manager).

## Tables

- **Insert**: the `table` button opens a dialog for rows, columns, header row and CSS classes
  (presets from `tiptapeditor.table_classes`, a JSON object `{"table table--striped": "Striped"}`).
- **Table toolbar**: while the cursor is in a table, a second toolbar appears under the main one:
  insert row above/below, delete row, insert column left/right, delete column, header row and
  header column on/off, merge and split cells, table properties (classes), delete table. Drag
  across cells to select them for merging. Tab and Shift+Tab move between cells.
- **Existing tables are kept as written**: `<thead>`, `<tbody>` and `<tfoot>` sections, the
  classes and other attributes of tables, rows and cells (`id`, `data-*`, `style`, `align`,
  `valign`, `colspan`, `rowspan`, …), and cells written without paragraphs (`<td>Price</td>`
  stays as it is instead of becoming `<td><p>Price</p></td>`). Nothing is added: no `<colgroup>`,
  no `min-width` style, no wrapper `<div>`; a table written without `<tbody>` stays without it.
- Column resizing by mouse is off, because it would write pixel widths into the content.
- Kept as HTML blocks, because the editor cannot show them unchanged: tables with `<caption>`,
  `<colgroup>`, attributes on `<thead>`/`<tbody>`/`<tfoot>`, event handler attributes, or MODX/Fenom
  constructs between rows (`{foreach}` around `<tr>`). All tables are HTML blocks when
  `tiptapeditor.enable_tables` is off.

## MODX and Fenom syntax

Template code in the content is kept exactly as written, character for character, also when the
text around it is edited (`tiptapeditor.protect_modx_syntax`, `tiptapeditor.protect_fenom_syntax`).

- **MODX tags** `[[…]]` with every prefix (`*`, `++`, `~`, `$`, `%`, `+`, `-`, `!`, `#`), output
  filters, properties and nested tags: `[[!pdoResources? &tpl=`@INLINE <li>[[+pagetitle]]</li>`]]`
  is one tag. An unclosed `[[` is text.
- **Fenom**: `{` directly followed by `$`, `/`, `*`, a quote or a Fenom keyword (`if`, `foreach`,
  `set`, `include`, …) up to the matching `}`, with quoted strings and nested braces skipped.
  `{* … *}` comments and `{ignore}…{/ignore}` are one construct each. `{ ` with a space is plain
  text (Fenom's own rule), so CSS and JSON stay text. Names of your own Fenom tags or functions go
  into `tiptapeditor.fenom_tags` (`myTag, other`).
- **In text** a tag is a badge: it cannot be split, typed into or formatted apart, and `&`, `<` and
  quotes in it are never escaped. Double click or Enter on a selected badge opens its source in a
  dialog (Ctrl+Enter saves; an empty value removes it).
- **On a line of its own** between blocks (`[[!pdoResources? …]]`, `{if …}`, `{/foreach}`) a tag is
  a card showing the full source.
- **In attributes** (`href="[[~12]]"`, `src="[[+image]]"`, `class="{$cls}"`) tags are plain text the
  link and image dialogs show; they are written back without escaping. A tag that sits in a tag
  itself (`<li[[+attr]]>`) or holds a double quote inside an attribute keeps its element as an HTML
  block.
- **Typing or pasting** a complete tag turns it into a badge (`[[*pagetitle` stays text until `]]`
  is typed). Backticks inside a MODX tag being typed do not start inline code. Code blocks and
  inline code are never converted.
- **HTML blocks**: HTML the editor has no node for (`<div>`, `<section>`, `<span class>`,
  `<script>`, `<iframe>`, custom elements, Fenom loops between table rows or list items, tags in
  `<pre>`, …) is kept byte for byte as a block. The editor shows a card with the element name and a
  text-only preview (nothing of it is rendered in the manager); double click or Enter opens the
  source. Everything around it stays editable.
- Text written without a paragraph (at the top level, in list items, cells and quotes) keeps that
  form; a `<table>` without `<tbody>` too.

What changes when content is edited (saving without edits never changes anything): line breaks and
spaces between blocks, attribute order on some elements, `style` values only where the editor sets
them (alignment), and a bare `&` in text is written as `&amp;` (the same HTML). The acceptance
fixtures in `tests/fixtures/` (spec section 99) are checked for this in `tests/unit/Fixtures.test.js`.

## HTML source mode

The `source` toolbar button switches the editor to the HTML source and back.

- The source is a plain `<textarea>` (no contenteditable, no code editor dependency) in place of
  the editing area. It shows the field value exactly as it is stored: HTML, MODX tags and Fenom
  literally, with the original line breaks and indentation.
- What is typed in the source goes straight into the MODX field (with `input`/`change` and the
  dirty state). Saving the resource while the source is shown saves exactly what was typed.
- Switching back without changes leaves the document and its undo history untouched. Changed
  source is read like content on load: MODX/Fenom become protected tokens, HTML the editor has no
  node for becomes an HTML block. If the editor would still lose something, a dialog lists it and
  offers "Back to the source" or "Apply anyway". The field keeps the source as typed until the
  document is edited again; applying is one undo step.
- Source containing U+E000/U+E001 (used by the editor internally) cannot be shown visually; the
  editor stays in source mode with a message, and the source is saved as it is.
- Works for richtext TVs (each editor has its own source mode), in fullscreen, and read-only for
  read-only fields. Ctrl/Cmd+S saves through the MODX save button as usual.
- API: `TipTapEditor.getInstance(el).source.toggle(true|false)`, `.source.active`.

## Menus, slash commands, status bar

- **Bubble menu** (`bubble_menu`): bold, italic, underline, strike, code and link over selected
  text. Not shown in code, source mode or dialogs.
- **Floating menu** (`floating_menu`): headings, lists, quote, code block, image, table and embed
  next to an empty paragraph.
- **Slash commands** (`slash_commands`): `/` at the start of an empty paragraph opens a list
  (paragraph, H2, H3, lists, quote, image, table, code block, rule, embed), filtered by typing.
- In a profile or the external config each of the three can be `true`/`false` or its own list of
  toolbar items, e.g. `"bubbleMenu": "bold italic link"`. Items whose feature is off are hidden.
- **Status bar** (`statusbar`): element path (`p > strong`), words and characters.
- Menus are placed on `<body>` above the manager panels; the editor itself stays scoped.

## Paste

- Pasted HTML is cleaned before it reaches the editor: Word and Google Docs markup (`mso-*`,
  `o:p`, conditional comments, wrapper spans, fonts, inline styles) is removed; bold, italic,
  underline, strike, sub/superscript expressed as styles become tags; Word list paragraphs become
  real nested lists; `text-align` of paragraphs and headings is kept.
- Pictures that exist only on the clipboard (`data:`, `blob:`, `file:`, `cid:`) are left out with a
  message: content never gets base64 images.
- Copy/paste inside the editor is not cleaned (it keeps classes and attributes).
- `paste_as_text`: every paste is inserted as plain text.

## Embeds (iframe)

- `enable_iframe` adds the `embed` toolbar button. The dialog takes a URL or `<iframe>` code plus
  width, height, title and fullscreen. YouTube, VK Video and Rutube links are converted to their
  player URL (`youtu.be/ID?t=30` → `https://www.youtube.com/embed/ID?start=30`).
- Iframes are shown as cards with the host and size and are **never loaded in the manager**.
  Double click or Enter edits; unchanged iframes are saved exactly as they were.
- `iframe_allowed_hosts`: comma-separated hosts (subdomains included); empty = any http(s) host.
  `iframe_allowed_attributes`: attributes kept on an iframe; event handlers (`on*`) never are.
  An iframe outside these rules is kept as an HTML block instead of being dropped.
- More providers: `match` gets the typed text (a string) and returns the iframe `src` or null:
  `TipTapEditor.registerEmbedProvider({ name: 'example', match: (input) => {
  const m = /example\.com\/v\/(\w+)/.exec(input); return m ? `https://example.com/embed/${m[1]}` : null; } })`.

## MODX and Fenom autocomplete

`modx_autocomplete` / `fenom_autocomplete` suggest while typing in the text:

| Typed | Suggestions |
|---|---|
| `[[` | tag types |
| `[[*` | resource fields and TVs → `[[*pagetitle]]` |
| `[[!name` / `[[name` | snippets |
| `[[$name` | chunks |
| `[[++key` | system setting keys (never values) |
| `[[~title` | resources → `[[~12]]` |
| `{$` | resource fields as Fenom variables, `$_modx` |
| `{$_modx->` | members of pdoTools' `$_modx`; `resource.` fields, `config.` setting keys |

Elements and settings are searched through the TipTapEditor connector (`Element/Search*`,
`Setting/Search`) with the user's `view_chunk`/`view_snippet`/`view_tv`/`settings` permissions
and element category ACL; only names and short descriptions are returned. Lexicon tags (`[[%`)
are not suggested. Arrows move, Enter/Tab pick, Escape closes.

## Image upload

With `upload_enabled` (and the user's `file_upload` permission) images can be added without the
Media Browser. They are stored in `upload_path` of the field's Media Source under their own name,
made safe (`Скриншот 1.png` → `skrinshot-1.png`), or under `upload_file_prefix` when it is set
(`{id}` → `15.png`). A taken name gets `-1`, `-2` …, so no file is overwritten. The Media Source decides allowed file types and
folders; `upload_maxsize` applies.

`upload_path` and `upload_file_prefix` may use placeholders, filled in on the server for each
upload (`Image/UploadFolder`, `Media\UploadPath`): `{id}` `{pid}` `{alias}` `{palias}` `{context}`
`{tid}` `{uid}` `{rand}` (`upload_rand_length` characters) `{t}` `{y}` `{m}` `{d}` `{h}` `{i}` `{s}`.
`{id}` and `{alias}` need a saved resource. Values cannot add or leave folder levels.

- **Drag and drop or paste** image files into the text: uploaded through MODX
  (`Browser/File/Upload`) and inserted with the source's URL. Without `upload_enabled` dropped
  files are refused with a message pointing to the Media Browser.
- **Upload from computer…** in the image dialog (and the gallery dialog): a file picker, then the
  upload; the stored file fills the URL field.
- **Copy to site** in the image dialog (and the gallery's link row): the server downloads the picture
  (`Image/Import` processor) and stores it in `upload_path`, so the page does not depend on the
  other site. Only public `http(s)` addresses on ports 80/443; every address the host resolves
  to must be public (no localhost, private, link-local or reserved ranges), the connection is
  pinned to the checked address, redirects are checked again (at most 3), the download stops at
  `upload_maxsize`, and only real JPEG, PNG, GIF, WebP or AVIF content is accepted (no SVG).
- Both are hidden while uploads are off. The optional toolbar items `imageUpload` ("Image from
  computer") and `imageUrl` ("Image by URL") do the same in one click; they are not in the default
  toolbar.

## Captions, "open larger" and galleries

- **Caption:** the image dialog has a Caption field. An image with a caption becomes
  `<figure><img …><figcaption>…</figcaption></figure>`; the caption can also be edited right in
  the text. Existing figures with one image (optionally inside a link) and a caption open as
  editable figures with all attributes kept (srcset, sizes, loading, aria-label, …); other
  figures stay HTML blocks.
- **Open larger on click** (`lightbox`, per image in the dialog): a link to the image around it,
  `<figure><a href="img.jpg" data-fancybox aria-label="Open image: …"><img …></a></figure>`.
  The attribute is whatever the site's lightbox script needs, set in `lightbox_attribute`
  (`data-fancybox`, `data-lightbox`, …; empty = a plain link). A single image gets it without a
  value, a gallery with one group name for all its pictures (`data-fancybox="gallery-3fa9c1"`).
  `lightbox_label` sets the aria-label (`{alt}` = alt text or caption).
- **Gallery** (`gallery` toolbar button): pick several images in the Media Browser at once
  (Ctrl/Shift+click) or upload them from the computer, order them, give each an alt text and
  caption, choose the template and "open larger". In the editor a gallery is a card with
  thumbnails; double click or Enter edits it.
- **Templates:** `grid` (figures in a `div.gallery`), `slider` (Swiper markup), `images` (only the
  pictures); `gallery_template` is the default. Each template is a file in `gallery_templates_path`
  (default `core/elements/tiptapeditor/gallery/`, `grid.html`, `slider.html` …): the outer markup
  with `{items}`, a `<!-- item -->` line, then one picture with `{image}` and `{caption}`. Install
  adds the default files once; updates never overwrite or delete them. The outer element carries
  `data-gallery="<template>"` so the gallery can be edited again; a changed template applies to
  saved galleries when their resource is opened and saved. Scripts and `on*` attributes in templates are removed.

## Saving

Ctrl/Cmd+S saves through the MODX save button, also with the cursor in the editor.

## Tests

```bash
npm test           # unit tests (vitest + happy-dom)

# Browser checks against a running MODX 3 *test* site (M = site root). They change
# which_editor and create test TVs/resources, so never point them at a production site.
M=/path/to/site MODX_URL=http://127.0.0.1:8080 MODX_USER=admin MODX_PASS=secret npm run test:e2e
```

## License

MIT
