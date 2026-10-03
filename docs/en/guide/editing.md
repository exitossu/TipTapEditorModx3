# Editing

This page is for content managers: what you see in the editor and how to use it. The buttons available depend on how your administrator set up the toolbar (see [Toolbar](./toolbar)).

## Toolbar

The toolbar sits above the text. With the **Sticky toolbar** setting on (the default), it stays visible while you scroll long content. Hover over a button to see its name and keyboard shortcut.

Keyboard use:

- **Tab** moves the focus to the toolbar once; **arrow keys** move between buttons; **Home**/**End** jump to the first/last button.
- **Enter**, **Space** or **Arrow Down** opens a menu (for example **Text style** or **Alignment**).
- **Escape** closes a menu or returns to the text.

Common shortcuts (Ctrl on Windows/Linux, Cmd on macOS):

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+B, I, U | Bold, Italic, Underline |
| Ctrl/Cmd+Shift+S | Strikethrough |
| Ctrl/Cmd+E | Inline code |
| Ctrl/Cmd+K | Link dialog |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo, Redo |
| Ctrl/Cmd+Alt+0 | Paragraph |
| Ctrl/Cmd+Alt+1 … 6 | Heading 1 … Heading 6 |
| Ctrl/Cmd+Shift+8, Ctrl/Cmd+Shift+7 | Bullet list, Numbered list |
| Ctrl/Cmd+Shift+B | Quote |
| Ctrl/Cmd+Alt+C | Code block |
| Ctrl/Cmd+S | Save the resource (the MODX **Save** button), also while the cursor is in the text |

## Bubble menu, floating menu and slash commands

- **Bubble menu**: when you select text, a small menu appears above it with Bold, Italic, Underline, Strikethrough, Inline code and Link. It does not appear inside code, in source mode or while a dialog is open.
- **Floating menu**: next to an empty paragraph, a menu offers Heading 2, Heading 3, lists, Quote, Code block, Image, Gallery, Table and Video or embed.
- **Slash commands**: type `/` at the start of an empty paragraph to open a list of blocks: Paragraph, Heading 2, Heading 3, lists, Quote, Image, Gallery, Table, Code block, Horizontal line, Video or embed. Keep typing to filter the list (`/tab` finds Table). Arrow keys move, Enter picks, Escape closes.

Entries for features that are switched off (or that need a Media Source you have no access to) are hidden. Administrators can switch each of the three menus off or give it its own list of items. See [Profiles and configuration](./profiles#menus).

## Status bar

If the **Status bar** setting is on, a line under the text shows the element path at the cursor (for example `p > strong`), and the number of words and characters.

## Pasting

- Text pasted from Word or Google Docs is cleaned: Office markup, fonts, wrapper spans and inline styles are removed. Bold, italic, underline, strikethrough, superscript and subscript written as styles become real formatting. Word list paragraphs become real (nested) lists. The alignment of paragraphs and headings is kept.
- Pictures that exist only on the clipboard (not on a web site) are left out, and a message tells you so. Insert them with the **Image** button, or drop the image files into the editor if uploads are enabled. The content never gets base64 images.
- Copying and pasting inside the editor keeps classes and attributes.
- If the administrator turned on **Paste as text**, every paste is inserted as plain text.
- A pasted MODX tag or Fenom expression becomes a protected badge (see [MODX and Fenom tags](./modx-syntax)).

## Links

Select text and click **Link** (or press Ctrl/Cmd+K). The **Insert link** / **Edit link** dialog has:

| Field | What it does |
|---|---|
| **URL** | Any address, written exactly as you type it: `https://…`, `/path/`, `#anchor`, `mailto:`, `tel:`, or a MODX tag such as `[[~12]]`. Nothing is added to it. |
| **MODX resource** | Search by title, long title, alias or ID (at least 2 characters, or an ID; up to 50 results). Unpublished resources are marked "unpublished". The chosen resource is written as `[[~12]]` (see `tiptapeditor.resource_link_format`). |
| **File…** | Choose a file in the Media Browser. Shown only when you may browse the field's Media Source. |
| **Anchor in this text…** | A list of the anchors (`#id`) in the current text; shown when the text has any. |
| **Link text** | Shown when no text is selected: the text of the new link. |
| **Title** | The `title` attribute. |
| **Open in** | **Same window** or **New window**. A new window always gets `rel="noopener noreferrer"`; switching back to the same window removes these two values again. |
| **Rel** | The `rel` attribute. |
| **CSS class** | A list of presets (from `tiptapeditor.link_classes`), or a free text field if no presets are set. An unknown class already on the link is kept. |

- **Remove link** in the dialog, or the **Remove link** toolbar button (`unlink`), removes the link and keeps the text.
- The **MODX resource** toolbar button (`modxLink`) opens the same dialog directly on the resource search.
- Editing a link to a resource shows its title, for example "Resource: About us (ID 12, web)".
- Addresses starting with `javascript:`, `vbscript:`, `data:` or `file:` are refused.
- New links get no `target` or `rel` of their own. Existing links keep exactly their attributes.
- The resource search looks only in the context of the edited resource, unless the administrator turned on `tiptapeditor.links_across_contexts`. It respects resource group permissions.

### Anchors

Put the cursor in a heading and click **Anchor**. Enter the **Anchor name (id)**: it starts with a letter and may contain letters, digits, `-`, `_`, `:` and `.`. The heading gets this `id`, and you can link to it as `#name`: it then appears in the link dialog under **Anchor in this text…**.

## Tables

- **Table** opens the **Insert table** dialog: **Rows** (1–100), **Columns** (1–30), **Header row**, and the CSS class: **Style** (presets from `tiptapeditor.table_classes`) plus **Other CSS classes**, or a single **CSS class** field when no presets are set.
- While the cursor is in a table, a second toolbar appears under the main one: **Insert row above**, **Insert row below**, **Delete row**, **Insert column left**, **Insert column right**, **Delete column**, **Header row on/off**, **Header column on/off**, **Merge cells**, **Split cell**, **Table properties**, **Delete table**.
- Drag across cells to select them, then click **Merge cells**. **Tab** and **Shift+Tab** move between cells.
- Column widths cannot be changed with the mouse, because that would write pixel widths into the content.
- Existing tables are kept as written: `<thead>`, `<tbody>`, `<tfoot>`, all attributes, and cells without paragraphs. A table the editor cannot show unchanged (for example one with `<caption>` or `<colgroup>`) is kept as an HTML block.

## HTML source mode

The **HTML source** button switches between the visual editor and the HTML code.

- The source is a plain text field. It shows the field value exactly as it is stored, with MODX tags, Fenom, line breaks and indentation as they are.
- What you type in the source goes straight into the field. If you save the resource while the source is shown, exactly what you typed is saved.
- When you switch back without changes, nothing happens to the document or its undo history.
- When you switch back after changes, the editor reads the new source like content on load. If it would lose or change something, a dialog lists what, and you choose **Back to the source** or **Apply anyway**.
- Source mode works for every field (each TV has its own), in fullscreen, and read-only for read-only fields.

## Fullscreen

**Fullscreen** makes the editor cover the manager window. Press **Escape** or click the button again to leave fullscreen. The Media Browser and other MODX windows still open on top of it.

## Saving: how the editor and the field stay in sync

Behind the editor is the normal MODX field (a textarea). The editor writes your text into it, and MODX saves the field as usual.

- The editor writes to the field only after you change something. Open and save without edits: the content stays exactly as it was.
- While you type, the field is updated a moment later (after 150 ms). Right before saving, all editors on the page are written into their fields, so the last keystroke is never lost.
- Each change marks the resource as changed in MODX, just like typing in a plain field.
- An empty editor is saved as an empty value.
- If something in the content cannot be shown without changes, the field stays a plain textarea with a short notice, and you edit the HTML directly.

::: details Line breaks in saved content
Browsers send textarea values with CRLF line breaks and MODX stores them as received. This is standard browser behaviour and happens with or without an editor.
:::
