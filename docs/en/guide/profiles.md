# Profiles and configuration

Most sites need only the [system settings](./settings). Profiles and the external config are for sites where different fields need different editors, or where the configuration should live in a file.

## Order of configuration

The configuration of an editor is built in this order; a later step wins:

1. built-in defaults;
2. system settings (`tiptapeditor.*`; they can be overridden per context, user group or user as usual in MODX);
3. the external config file (`tiptapeditor.external_config`);
4. the profile of the field;
5. runtime options of `TipTapEditor.create()` (for developers).

Invalid values are skipped and logged in the MODX error log (level WARN). The editor then runs with the rest.

## Profiles

A profile is a named set of options. Define profiles in `tiptapeditor.profiles` as a JSON object:

```json
{
    "simple": {
        "toolbar": "bold italic link",
        "bubbleMenu": false,
        "minHeight": 120
    },
    "article": {
        "toolbar": "undo redo | heading paragraphClass | bold italic | link image table | source",
        "minHeight": 400,
        "paragraphClasses": { "lead": "Lead" }
    }
}
```

### Which field uses which profile

| Setting | Applies to |
|---|---|
| `tiptapeditor.content_profile` | The resource content field (and other fields that are not TVs). Empty: the default profile. |
| `tiptapeditor.tv_profiles` | Richtext TVs, by TV name or by `tv<ID>`. |
| `tiptapeditor.default_profile` | Every other field. The default value `default` means: no profile, just the settings, unless you define a profile named `default`. |

`tiptapeditor.tv_profiles` accepts a JSON object:

```json
{ "intro": "simple", "article_body": "article", "tv12": "simple" }
```

or pairs, one per line or comma separated:

```text
intro=simple
article_body=article
```

### What a profile may set

| Key | Value |
|---|---|
| `toolbar` | Toolbar string or JSON list (see [Toolbar](./toolbar)). |
| `headingLevels` | `[2, 3, 4]` or `"2,3,4"`. |
| `colors`, `highlightColors` | Lists of colors for the **Text color** and **Highlight** palettes, for example `["#000000", "#c00000"]`. |
| `stickyToolbar`, `autogrow`, `statusbar`, `pasteAsText`, `preserveStyleAttribute` | `true` / `false`. |
| `minHeight`, `maxHeight`, `defaultHeight` | Pixels. |
| `features` | Switch features off: `{"tables": false, "images": false, "gallery": false, "iframe": false, "fullscreen": false}`. |
| `bubbleMenu`, `floatingMenu`, `slashCommands` | See [Menus](#menus). |
| `linkClasses`, `imageClasses`, `tableClasses`, `paragraphClasses` | Class presets (see [below](#attributes-and-class-presets)). |
| `imageAlignClasses` | Classes written for image alignment, default `{"left": "align-left", "center": "align-center", "right": "align-right"}`. |
| `resourceLinkFormat` | The `href` for a MODX resource in the link dialog, default `[[~{id}]]`; `{context}` and `{uri}` are also replaced. |
| `contentCss` | Stylesheets for the editing area (see [Content CSS](#content-css)). |
| `iframeAllowedHosts`, `iframeAllowedAttributes` | As the settings of the same name. |
| `modxAutocomplete`, `fenomAutocomplete` | `true` / `false`. |
| `lightbox`, `lightboxAttribute`, `lightboxLabel`, `galleryTemplate`, `galleryTemplates` | As the settings of the same name (see [Images, galleries, files](./media)). |
| `extensions`, `editorProps` | See [External config](#external-config). |

Other keys are ignored (and logged).

### Menus

`bubbleMenu`, `floatingMenu` and `slashCommands` can each be `true` (the default items), `false` (off), or a string of toolbar item names:

```json
{
    "article": {
        "bubbleMenu": "bold italic link",
        "floatingMenu": "h2 h3 image table",
        "slashCommands": "paragraph h2 h3 bulletList image gallery table"
    }
}
```

The default items:

| Menu | Default items |
|---|---|
| Bubble menu | `bold italic underline strike code link` |
| Floating menu | `h2 h3 bulletList orderedList blockquote codeBlock image gallery table embed` |
| Slash commands | `paragraph h2 h3 bulletList orderedList blockquote image gallery table codeBlock horizontalRule embed` |

Items whose feature is off are hidden. The system settings `tiptapeditor.bubble_menu`, `floating_menu` and `slash_commands` only switch the menus on or off.

## External config

`tiptapeditor.external_config` points to a JSON file, for example `{core_path}config/tiptapeditor.json`. You can use the placeholders `{core_path}`, `{base_path}` and `{assets_path}`; a relative path starts at the site root (base_path).

```json
{
    "toolbar": ["undo", "redo", "|", "bold", "italic", "|", "link", "source"],
    "features": { "tables": false },
    "headingLevels": [2, 3],
    "extensions": { "highlight": false, "subscript": false },
    "editorProps": { "attributes": { "spellcheck": "false", "lang": "en" } },
    "profiles": { "simple": { "toolbar": "bold italic link" } }
}
```

- The file must be a `.json` file inside the core folder or the site folder (checked after resolving `..` and symlinks), and at most 256 KB.
- It is data only. Nothing in it is executed, and there is no way to pass functions.
- It takes the same keys as a profile, plus `profiles`: these are added to `tiptapeditor.profiles`, and a profile with the same name replaces the one from the setting.
- Upgrades never touch this file.

### extensions

Switch an editor extension off (`false`) or pass it options (plain data) by its name. This also works for extensions that other extras register. Examples of names: `highlight`, `color`, `subscript`, `superscript`, `bold`, `italic`, `strike`, `underline`, `heading`, `link`, `blockquote`, `codeBlock`, `horizontalRule`.

Heading levels always come from `headingLevels` (or `tiptapeditor.heading_levels`), not from the options of `heading`.

The extensions your content depends on cannot be switched off: HTML blocks, MODX/Fenom tokens, paragraphs written without `<p>`, preserved attributes, paste cleanup and the file drop guard.

### editorProps

Only `editorProps.attributes` is read: extra attributes of the editing area. Allowed names are `spellcheck`, `lang`, `dir`, `class`, `autocorrect`, `autocapitalize`, `data-*` and `aria-*`.

## Content CSS

`tiptapeditor.content_css` lists your site's stylesheets, comma or newline separated, so the text in the editor looks like on the site:

```text
{assets_url}css/content.css, /assets/css/article.css
```

- Every rule is limited to the editing area. `body` and `html` in your CSS stand for the editing area itself. The manager is never restyled.
- Relative `url()` references are resolved against the stylesheet. `@import` is not followed.
- The browser of the manager user loads the files, so they must be on the same site or allow CORS.
- Placeholders `{assets_url}` and `{base_url}` are replaced. Only `http(s)` URLs and paths are accepted.
- A profile can set its own `contentCss` (a list or a comma separated string).

## Attributes and class presets

Paragraphs, headings, quotes, lists, list items, code blocks, horizontal rules, links and inline formatting keep every attribute the editor has no field for: `id`, `class`, `title`, `lang`, `dir`, `role`, `data-*`, `aria-*`, `style`, and so on. So `<p class="lead">` or `<h2 class="title" id="x">` stay editable and are saved as written. Event handler attributes (`onclick`, …) are never kept; such an element stays an HTML block.

`tiptapeditor.preserve_style_attribute` (on by default) keeps inline `style` attributes unchanged. When it is off, inline styles may be dropped when the content is edited; content with styles still opens.

Class presets give content managers a list of approved classes:

| Setting | Offered in | Format |
|---|---|---|
| `tiptapeditor.paragraph_classes` | **Paragraph style** toolbar menu (`paragraphClass`) for paragraphs and headings | JSON object or comma separated list |
| `tiptapeditor.link_classes` | **CSS class** in the link dialog | JSON object or comma separated list |
| `tiptapeditor.image_classes` | **Style** in the image dialog | JSON object or comma separated list |
| `tiptapeditor.table_classes` | **Style** in the table dialog (several classes per entry allowed) | JSON object or comma separated list |

A JSON object maps the class to the label shown in the list:

```json
{ "lead": "Lead paragraph", "note": "Note" }
```

```json
{ "table table--striped": "Striped", "table table--compact": "Compact" }
```

A plain list uses the class names as labels:

```text
lead, note
```

Choosing a preset replaces only the preset classes; other classes on the element stay.
