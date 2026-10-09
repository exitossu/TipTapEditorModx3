---
outline: false
---

# История изменений

::: info
Журнал изменений ведётся на английском, как в пакете.
:::

## 0.1.0-alpha18

- Placeholders in tiptapeditor.upload_path and the new tiptapeditor.upload_file_prefix: {id}, {pid},
  {alias}, {palias}, {context}, {tid}, {uid}, {rand}, {t}, {y}, {m}, {d}, {h}, {i}, {s}, e.g.
  assets/uploads/{y}/{m}/{id}/. Filled in on the server for each upload from the computer, by
  link and by drag and drop (new processor Image/UploadFolder). {id} and {alias} need a saved
  resource; values cannot add or leave folder levels. New setting upload_rand_length.

## 0.1.0-alpha17

- Checkboxes in dialogs ("Open larger on click" in the image and gallery dialogs) sit next to
  their label in the dialog style instead of looking like a text field.

## 0.1.0-alpha16

- Renamed from TiptapRTE to TipTapEditor: namespace and settings tiptapeditor.*, folders
  core|assets/components/tiptapeditor, plugin, category, package and editor name (which_editor
  value "TipTapEditor"), JS API window.TipTapEditor. Uninstall the old TiptapRTE package first and
  set the settings again. Galleries saved with data-tiptaprte-gallery still open as galleries.
- Installation sets the system settings which_editor to TipTapEditor and use_editor to 1
  (logged; upgrade does not change them). which_editor values "Tiptap RTE" are renamed.
- One "Image" button: its dialog takes a file from the Media Browser, uploads one from the
  computer or copies one from a link into upload_path. imageUpload and imageUrl stay available
  for the toolbar setting but are no longer in the default toolbar and slash commands.
- Gallery dialog: images by link (copied into upload_path when uploads are on); the Media
  Browser is no longer opened right away.

## 0.1.0-alpha15

- Captions: &lt;figure> with one image (optionally in a link) and &lt;figcaption> is editable, with all
  attributes kept; the image dialog has Caption and "Open larger on click".
- "Open larger": a link to the image around it for the site's lightbox script. New settings
  tiptapeditor.lightbox, lightbox_attribute (e.g. data-fancybox; empty = plain link) and
  lightbox_label. Single image: attribute without a value; gallery: one group name.
- Galleries: "gallery" toolbar button, several images from the Media Browser at once or uploaded
  from the computer, order, alt text and caption per image. Templates grid, slider (Swiper) and
  images; own templates in tiptapeditor.gallery_templates (JSON); tiptapeditor.gallery_template and
  enable_gallery. Saved galleries open again as galleries.

## 0.1.0-alpha14

- Toolbar buttons "imageUpload" (image from computer) and "imageUrl" (image by URL). Both store
  the file in tiptapeditor.upload_path of the field's Media Source and then open the same image
  dialog as the Media Browser; with an image selected only its file is replaced. Shown only with
  tiptapeditor.upload_enabled. Added to the default toolbar and the slash commands (an existing
  tiptapeditor.toolbar value is not changed on upgrade).
- New processor Image/Import: downloads public http(s) images only (internal, private and
  reserved addresses refused, DNS pinned, redirects re-checked, upload_maxsize, content checked
  as JPEG/PNG/GIF/WebP/AVIF), with the file_upload permission and the source's create policy.

## 0.1.0-alpha13

- Bubble menu over selected text, floating menu on empty paragraphs and "/" slash commands
  (tiptapeditor.bubble_menu, floating_menu, slash_commands; true/false or a list of toolbar items
  in a profile or the external config).
- Status bar with element path, word and character count (tiptapeditor.statusbar).
- Paste cleaning for Word and Google Docs (Office markup, wrapper spans, styles to tags, Word
  lists to real lists); clipboard-only pictures are left out with a message. paste_as_text works.
- Embeds: "embed" toolbar button and dialog for YouTube, VK Video, Rutube or &lt;iframe> code.
  Iframes are cards in the editor and never loaded in the manager; enable_iframe,
  iframe_allowed_hosts and iframe_allowed_attributes apply. TipTapEditor.registerEmbedProvider().
- MODX ([[*, [[!, [[$, [[++, [[~) and Fenom ({$, {$_modx->) autocomplete. New connector
  processors Element/SearchChunks|SearchSnippets|SearchTemplates|SearchTvs and Setting/Search
  check view_* / settings permissions and element ACL and return names only (no setting values).
- tiptapeditor.upload_enabled: dropped or pasted image files are uploaded through MODX into the new
  setting tiptapeditor.upload_path of the field's Media Source, with transliterated safe names.
- Fixed: a field holding only an empty paragraph (&lt;p>&lt;/p>) opened as a plain textarea.
- Image menu is placed above the manager navigation.

## 0.1.0-alpha12

- Profiles (tiptapeditor.profiles, content_profile, tv_profiles, default_profile, runtime
  {profile}) and the external JSON config (tiptapeditor.external_config): toolbar, features,
  heights, class presets, content CSS, extensions by name (off or options), safe editor
  attributes. Data only, path restricted to core_path/base_path, invalid values logged.
- tiptapeditor.content_css: site stylesheets scoped to the editing area; the manager is not restyled.
- Paragraphs, headings, quotes, lists, list items, code blocks, rules, links and inline marks keep
  their id, class, data-*, aria-*, style and other attributes: &lt;p class="lead">, &lt;h2 class="title">
  and &lt;a data-fancybox> are editable now instead of HTML blocks.
- tiptapeditor.paragraph_classes: "paragraphClass" toolbar menu for paragraphs and headings.
- tiptapeditor.preserve_style_attribute works (off: inline styles may be dropped on edit).
- TipTapEditor.registerExtension() and registerToolbarItem() on the public API.
- Toolbar buttons of marks are hidden when their extension is switched off.
- Localization: every UI string and setting checked in en and ru by a unit test.

## 0.1.0-alpha11

- HTML source mode (toolbar "source"): a plain textarea with the field value exactly as stored
  (HTML, MODX, Fenom literally). Typing goes straight into the MODX field; saving in source mode
  saves the source as typed. Back to the visual editor: unchanged source keeps the document and
  undo history; changed source is protected (tokens, HTML blocks) and checked, with a choice when
  something would still be lost. Works for richtext TVs, in fullscreen and read-only.
- Fullscreen now really covers the manager window (a later rule kept the editor in place), and
  Escape leaves fullscreen also while the cursor is in the text.

## 0.1.0-alpha10

- MODX/Fenom syntax protection: content with MODX tags and Fenom now opens in the editor. Tags
  are kept byte for byte (no escaping of &, &lt;, quotes), also after editing the text around them.
  In text they are badges, on a line of their own cards; double click or Enter edits the source.
- Tags in attribute values (href="[[~12]]", src="[[+img]]") stay plain text in the dialogs and
  are written back unescaped.
- HTML the editor cannot represent (div, section, span with class, script, iframe, custom
  elements, Fenom loops between table rows, onerror attributes, ...) is kept as an HTML block with
  a text-only preview instead of sending the whole field back to the textarea.
- Typing or pasting a complete tag turns it into a protected token; backticks inside a MODX tag
  no longer start inline code. tiptapeditor.fenom_tags adds custom Fenom tag names.
- Text without paragraphs (top level, list items, cells, quotes) and tables without tbody keep
  their form; style attributes of images and other elements are saved exactly as written.

## 0.1.0-alpha9

- Tables: "table" button with an insert dialog (rows, columns, header row, class presets from
  tiptapeditor.table_classes); table toolbar while the cursor is in a table: rows, columns, header
  row/column, merge and split cells, table properties, delete table.
- Existing tables are kept as written: thead/tbody/tfoot sections, all attributes of tables,
  rows and cells, cells without paragraphs. No colgroup, min-width style or wrapper is added.
  Tables with caption or colgroup stay in the textarea with a notice.
- tiptapeditor.enable_tables switches tables off (table content then stays in the textarea).
- Toolbar icons with rectangles (image, table, blockquote, ...) were drawn incompletely; fixed.
- A document holding only an empty table is no longer saved as empty.

## 0.1.0-alpha8

- Image dialog: URL with Media Browser and preview, alt, title, width/height (pixels or percent,
  original size offered), alignment classes (align-left/center/right), style presets from
  tiptapeditor.image_classes, other classes. Opens after inserting an image, on double click or Enter.
- Image menu over a selected image: Edit, Replace file, Remove.
- Images keep every attribute as written (id, data-*, loading, srcset, sizes, style, ...); only
  event handlers are refused, and such content stays in the textarea. Saving the dialog without
  changes leaves the image untouched.
- The image button works without a Media Source (URL in the dialog).
- Loss check compares style attributes as CSS ("border: 0" equals "border: 0px;"), so content with
  inline styles no longer falls back to the textarea needlessly; declarations the browser would
  drop are still reported.
- Focus stays in the image dialog after the Media Browser closes.

## 0.1.0-alpha7

- Link dialog (toolbar "link", Ctrl/Cmd+K): URL, MODX resource search, file from the Media
  Browser, anchors of the text, link text, title, target (same/new window), rel, CSS class with
  presets from tiptapeditor.link_classes. Accessible modal: labelled, focus trap, Escape, focus return.
- New window adds rel="noopener noreferrer"; links get no target/rel by default. Nothing is
  prepended to URLs; javascript:, vbscript:, data: and file: URLs are refused.
- MODX resource links: processor TipTapEditor\Processors\Resource\Search (view_document permission,
  model-level ACL plus "list" per result, current context unless tiptapeditor.links_across_contexts),
  href from tiptapeditor.resource_link_format (default [[~{id}]]). Toolbar "modxLink" opens the
  dialog on the search; "unlink" removes a link.
- Heading anchors: headings keep their id; toolbar "anchor" sets it; the link dialog lists #ids.
- Content whose only MODX tags are href="[[~id]]" links now opens in the editor unchanged.
- "&" inside MODX tags is no longer written as "&amp;".
- Fullscreen editor z-index lowered below ExtJS windows so the Media Browser opens on top of it.

## 0.1.0-alpha6

- MODX Media Browser: "image" toolbar button inserts an image from the in-page MODX browser, or
  replaces the file of the selected image (opens its folder, keeps alt/title/size).
- New "file" toolbar item: link the selection (or the file name) to a file from the browser.
- URLs are taken from MODX (fullRelativeUrl); tiptapeditor.media_url_mode "root" prefixes the site
  base URL. Relative image URLs are previewed against the site, stored unchanged.
- Media Source per field: the TV's source for the context, or tiptapeditor.media_source / the
  context's default_media_source for the content. Sent only with file_manager permission and the
  source's "list" policy; otherwise the file buttons are disabled.
- OnRichTextBrowserInit: fallback popup ?a=browser&tiptapeditor=1 with js/browser.js, which posts the
  chosen file back with an explicit origin.
- Image node (inline, no data: URLs). Dropped/pasted image files are never embedded as base64;
  a hint is shown unless an uploadHandler is passed at runtime.
- Non-image files are refused for the image button.

## 0.1.0-alpha5

- Richtext TVs: the plugin passes the richtext TVs of the resource (id, name, caption) to the
  editor config; each TV editor gets its metadata as instance.config.field.
- TVs added or removed after page load (template switch, Form Customization, extras) are mounted
  or destroyed automatically.
- TVs are mounted after the resource panel built its tabs, so fields on hidden tabs (ExtJS
  x-hide-offsets) start only when shown.
- Read-only TVs open a read-only editor; disabled TVs stay plain textareas.
- Fix: MODx.afterTVLoad no longer mounts the content field when the resource's "Rich text" option is off.

## 0.1.0-alpha4

- Toolbar built from tiptapeditor.toolbar ("|" separates groups): undo, redo, paragraph, heading menu,
  h1-h6, bold, italic, underline, strike, code, color, highlight, superscript, subscript, align menu,
  alignLeft/Center/Right/Justify, bulletList, orderedList, blockquote, horizontalRule, codeBlock,
  clearFormatting, fullscreen. Unknown names are skipped (listed in the console with debug on).
- Active state via editor.isActive(), disabled state via editor.can().
- Accessible: role="toolbar" with roving tabindex and arrow keys, aria-label, aria-pressed,
  tooltips with shortcuts, keyboard-operable menus and palettes, visible focus.
- Lucide SVG icons bundled locally; responsive wrapping; sticky toolbar (tiptapeditor.sticky_toolbar);
  fullscreen mode with Esc (tiptapeditor.enable_fullscreen); heading levels from tiptapeditor.heading_levels.
- Extensions: TextAlign, TextStyle + Color, Highlight (multicolor), Subscript, Superscript.
- TrailingNode is disabled so no empty paragraph is appended to the saved HTML.
- Ctrl/Cmd+S in the editor saves through the standard MODX save button.

## 0.1.0-alpha3

- Tiptap 3 editor (StarterKit) replaces the resource content field and richtext TVs.
- The original textarea stays in the form; it is hidden only after the editor started and is
  written only after the document really changed (open + save without edits keeps the content).
- Debounced sync while typing, synchronous sync before every form panel submit and on
  TipTapEditor.syncAll(); input/change events and MODX dirty state (unsaved changes warning).
- MODx.loadRTE / MODx.unloadRTE / MODx.afterTVLoad hooks; hidden TVs start when shown.
- Content the editor cannot show without changes (unsupported elements, lost attributes,
  comments) and content with MODX/Fenom tags stays in the plain textarea with a notice.
- A failing editor leaves its textarea visible and editable; other editors keep working.
- JS API: init, mount, unmount, refresh, create, destroy, destroyAll, getInstance, sync,
  syncAll, instances, version, config; events tiptapeditor:init/ready/update/destroy.

## 0.1.0-alpha2

- TipTapEditor is offered in which_editor (OnRichTextEditorRegister).
- When TipTapEditor is the active editor, resource create/update pages load the bundle, the stylesheet
  and a JSON configuration with the elements passed by MODX; the lexicon topic is added to manager pages.
- Nothing is loaded when another editor is selected or on pages without an editor.

## 0.1.0-alpha1

- Package skeleton: namespace, plugin with RTE events, system settings, lexicons (en, ru), Vite build.
