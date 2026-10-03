# Toolbar

The toolbar is set in the system setting `tiptapeditor.toolbar`. A change takes effect the next time a resource is opened; nothing needs to be rebuilt. A [profile](./profiles) can set its own toolbar for some fields.

## Syntax

- Item names are separated by spaces (line breaks also work).
- `|` starts a new group. Groups are shown with a separator between them.
- Names are case-insensitive: `bulletlist` works like `bulletList`.
- Unknown names are skipped, so a typo never breaks the editor. With `tiptapeditor.debug` on, they are reported in the browser console.
- An item listed twice is shown once.

```text
undo redo | heading | bold italic underline | link image | source fullscreen
```

In a profile or the external config, the toolbar can also be a JSON list. Nested lists are groups:

```json
{ "toolbar": ["undo", "redo", "|", "bold", "italic", "|", "link", "source"] }
```

```json
{ "toolbar": [["undo", "redo"], ["bold", "italic"], ["link", "source"]] }
```

## Default toolbar

```text
undo redo | heading | bold italic underline strike code | color highlight | superscript subscript | align | bulletList orderedList | blockquote horizontalRule | link modxLink anchor | image gallery file table embed | codeBlock | clearFormatting | source fullscreen
```

::: warning After an upgrade
An upgrade keeps your current value of `tiptapeditor.toolbar`. Buttons added in a newer version appear only after you add them to the setting yourself.
:::

## All toolbar items

The **Button** column shows the name you see in the manager (English lexicon).

### History and text style

| Item | Button | What it does |
|---|---|---|
| `undo` | Undo | Undoes the last change (Ctrl/Cmd+Z). |
| `redo` | Redo | Redoes it (Ctrl/Cmd+Shift+Z). |
| `heading` | Text style | Menu: Paragraph and the heading levels from `tiptapeditor.heading_levels`. |
| `paragraph` | Paragraph | Turns the block into a paragraph. |
| `h1` … `h6` | Heading 1 … Heading 6 | Turns the block into that heading level (or back into a paragraph). |
| `paragraphClass` | Paragraph style | Menu of class presets for paragraphs and headings from `tiptapeditor.paragraph_classes`. Shown only when presets are set. Other classes of the element stay. |

### Inline formatting

| Item | Button | What it does |
|---|---|---|
| `bold` | Bold | `<strong>` (Ctrl/Cmd+B). |
| `italic` | Italic | `<em>` (Ctrl/Cmd+I). |
| `underline` | Underline | `<u>` (Ctrl/Cmd+U). |
| `strike` | Strikethrough | `<s>` (Ctrl/Cmd+Shift+S). |
| `code` | Inline code | `<code>` (Ctrl/Cmd+E). |
| `superscript` | Superscript | `<sup>` (Ctrl/Cmd+.). |
| `subscript` | Subscript | `<sub>` (Ctrl/Cmd+,). |
| `color` | Text color | Color palette, with **Remove color**. |
| `highlight` | Highlight | Background color palette (`<mark>`), with **Remove color**. |
| `clearFormatting` | Clear formatting | Removes inline formatting and turns blocks back into paragraphs. |

### Alignment

| Item | Button | What it does |
|---|---|---|
| `align` | Alignment | Menu with the four options below. |
| `alignLeft` | Align left | Aligns the paragraph or heading left. |
| `alignCenter` | Align center | Centers it. |
| `alignRight` | Align right | Aligns it right. |
| `alignJustify` | Justify | Justifies it. |

### Blocks

| Item | Button | What it does |
|---|---|---|
| `bulletList` | Bullet list | `<ul>` (Ctrl/Cmd+Shift+8). |
| `orderedList` | Numbered list | `<ol>` (Ctrl/Cmd+Shift+7). |
| `blockquote` | Quote | `<blockquote>` (Ctrl/Cmd+Shift+B). |
| `horizontalRule` | Horizontal line | Inserts `<hr>`. |
| `codeBlock` | Code block | `<pre><code>` (Ctrl/Cmd+Alt+C). MODX tags inside stay plain text. |

### Links

| Item | Button | What it does |
|---|---|---|
| `link` | Link | Opens the link dialog (Ctrl/Cmd+K). |
| `modxLink` | MODX resource | Opens the link dialog on the MODX resource search. |
| `unlink` | Remove link | Removes the link under the cursor and keeps the text. |
| `anchor` | Anchor | Sets the anchor (`id`) of the current heading. Active only in a heading. |

### Media and embeds

| Item | Button | What it does |
|---|---|---|
| `image` | Image | Opens the image dialog: Media Browser, upload from the computer or copy by link. With an image selected: edits it. |
| `gallery` | Gallery | Opens the gallery dialog. Hidden when the field has neither a Media Source you may browse nor uploads. |
| `file` | Link to a file | Media Browser: the selected text becomes a link to the file, or the file name is inserted as the link text. Disabled without access to the Media Source. |
| `embed` | Video or embed | Opens the dialog for a YouTube, VK Video or Rutube link, an embed URL or `<iframe>` code. |
| `imageUpload` | Image from computer | Optional. Picks a file, uploads it, then opens the image dialog. With an image selected, replaces only its file. Shown only when uploads are enabled. |
| `imageUrl` | Image by URL | Optional. Copies a picture from a web address to the site, then opens the image dialog. Shown only when uploads are enabled. |

### Tables

| Item | Button | What it does |
|---|---|---|
| `table` | Table | Inserts a table (dialog). In a table: opens its properties. |
| `addRowBefore` | Insert row above | |
| `addRowAfter` | Insert row below | |
| `deleteRow` | Delete row | |
| `addColumnBefore` | Insert column left | |
| `addColumnAfter` | Insert column right | |
| `deleteColumn` | Delete column | |
| `toggleHeaderRow` | Header row on/off | |
| `toggleHeaderColumn` | Header column on/off | |
| `mergeCells` | Merge cells | Merges the selected cells. |
| `splitCell` | Split cell | Splits a merged cell. |
| `tableProperties` | Table properties | CSS classes of the table. |
| `deleteTable` | Delete table | |

The table commands appear anyway on the table toolbar while the cursor is in a table. You can also put them into the main toolbar.

### View

| Item | Button | What it does |
|---|---|---|
| `source` | HTML source | Switches to the HTML source and back. |
| `fullscreen` | Fullscreen | Fullscreen mode; Escape leaves it. |

## When a button is hidden or disabled

| Condition | Effect |
|---|---|
| `tiptapeditor.enable_tables` off | `table` and all table commands are hidden. |
| `tiptapeditor.enable_images` off | `image`, `imageUpload`, `imageUrl` and `gallery` are hidden. |
| `tiptapeditor.enable_gallery` off | `gallery` is hidden. |
| `tiptapeditor.enable_iframe` off | `embed` is hidden. |
| `tiptapeditor.enable_fullscreen` off | `fullscreen` is hidden. |
| A level missing from `tiptapeditor.heading_levels` | That `h1` … `h6` item is hidden and the level is not in the `heading` menu. |
| `tiptapeditor.upload_enabled` off, or no Media Source | `imageUpload` and `imageUrl` are hidden. |
| No access to the field's Media Source | `file` is disabled; the image dialog has no **Choose in Media Browser…** button. |
| An extension switched off in a profile or the external config (for example `"highlight": false`) | Its buttons are hidden. |
| Button cannot act here (for example `unlink` outside a link) | Disabled. |

## Examples

A short toolbar for an introduction TV:

```text
bold italic link | bulletList | source
```

An article toolbar with paragraph styles and the optional upload buttons:

```text
undo redo | heading paragraphClass | bold italic underline | align | bulletList orderedList blockquote | link modxLink anchor | image imageUpload imageUrl gallery file | table embed | source fullscreen
```

Buttons added by other extras with `TipTapEditor.registerToolbarItem()` are used by name in the same way (see [JS API](../dev/api)).
