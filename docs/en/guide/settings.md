---
outline: [2, 2]
---

# System settings

All settings are under System Settings, namespace `tiptapeditor`. They can be overridden in context, user group or user settings. Upgrades never reset their values.

::: tip
This page is generated from the package sources (`npm run docs:generate`).
:::

## Interface

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.toolbar</code> | **Toolbar** Toolbar buttons separated by spaces, groups separated by "\|". Example: undo redo \| heading \| bold italic \| link image. | <code>undo redo \| heading \| bold italic underline strike code \| color highlight \| superscript subscript \| align \| bulletList orderedList \| blockquote horizontalRule \| link modxLink anchor \| image gallery file table embed \| codeBlock \| clearFormatting \| source fullscreen</code> |
| <code>tiptapeditor.profiles</code> | **Profiles** JSON object of named editor profiles, e.g. {"simple": {"toolbar": "bold italic link"&#125;&#125;. A profile overrides the toolbar and features. | (empty) |
| <code>tiptapeditor.default_profile</code> | **Default profile** Profile used when no other profile applies. | <code>default</code> |
| <code>tiptapeditor.content_profile</code> | **Content profile** Profile for the resource content field. Empty means the default profile. | (empty) |
| <code>tiptapeditor.tv_profiles</code> | **TV profiles** TV name → profile: a JSON object such as {"introtext": "simple"}, or name=profile pairs, one per line or comma separated. | (empty) |
| <code>tiptapeditor.heading_levels</code> | **Heading levels** Comma separated heading levels available in the editor. | <code>1,2,3,4,5,6</code> |
| <code>tiptapeditor.bubble_menu</code> | **Bubble menu** Show a formatting menu above selected text. | Yes |
| <code>tiptapeditor.floating_menu</code> | **Floating menu** Show an insert menu on an empty paragraph. | Yes |
| <code>tiptapeditor.slash_commands</code> | **Slash commands** Typing "/" on an empty line opens the block menu. | Yes |
| <code>tiptapeditor.statusbar</code> | **Status bar** Show word and character count and the current element path. | No |
| <code>tiptapeditor.sticky_toolbar</code> | **Sticky toolbar** Keep the toolbar visible while scrolling long content. | Yes |
| <code>tiptapeditor.enable_fullscreen</code> | **Fullscreen** Allow the fullscreen mode button (Esc exits). | Yes |
| <code>tiptapeditor.min_height</code> | **Minimum height** Minimum editor height in pixels. | <code>200</code> |
| <code>tiptapeditor.max_height</code> | **Maximum height** Maximum editor height in pixels when autogrow is on. 0 means unlimited. | <code>700</code> |
| <code>tiptapeditor.default_height</code> | **Default height** Editor height in pixels when autogrow is off. | <code>300</code> |
| <code>tiptapeditor.autogrow</code> | **Autogrow** Grow the editor with its content up to the maximum height. | Yes |
| <code>tiptapeditor.content_css</code> | **Content CSS** Comma separated list of site stylesheets applied to the content inside the editor, e.g. /assets/css/content.css,/assets/css/article.css. | (empty) |

## Content

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.enable_tables</code> | **Tables** Tables in the editor: table button, table toolbar. When off, content with tables stays in the plain text field. | Yes |
| <code>tiptapeditor.enable_images</code> | **Images** Enable images. | Yes |
| <code>tiptapeditor.enable_iframe</code> | **Iframes and embeds** Enable iframe and video embeds. | Yes |
| <code>tiptapeditor.iframe_allowed_attributes</code> | **Allowed iframe attributes** Comma separated whitelist of iframe attributes. Event handler attributes (on*) are always removed. | <code>src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style</code> |
| <code>tiptapeditor.iframe_allowed_hosts</code> | **Allowed iframe hosts** Comma separated list of hosts allowed in iframe src. Empty allows any host. | (empty) |
| <code>tiptapeditor.paste_as_text</code> | **Paste as text** Paste clipboard content as plain text. | No |
| <code>tiptapeditor.image_classes</code> | **Image class presets** Classes offered for images: a JSON object {"css-class": "Label"} or a comma separated list of classes. | (empty) |
| <code>tiptapeditor.enable_gallery</code> | **Galleries** Enable the gallery button: several images with a template (grid, slider, …). | Yes |
| <code>tiptapeditor.gallery_template</code> | **Gallery template** Template of new galleries: grid, slider (Swiper markup), images, or a name from tiptapeditor.gallery_templates. | <code>grid</code> |
| <code>tiptapeditor.gallery_templates</code> | **Own gallery templates** JSON with more templates, e.g. {"cards": {"label": "Cards", "wrapper": "&lt;ul class=\"cards\"&gt;{items}&lt;/ul&gt;", "item": "&lt;li&gt;{image}{caption}&lt;/li&gt;"&#125;&#125;. {items} = the pictures, {image} = the image (with its link when "open larger" is on), {caption} = &lt;figcaption&gt; with the caption. Scripts and on* attributes are removed. | (empty) |
| <code>tiptapeditor.lightbox</code> | **Open images larger on click** New images and galleries get a link to the image around the picture (&lt;figure&gt;&lt;a href="…"&gt;&lt;img&gt;&lt;/a&gt;&lt;/figure&gt;) for a lightbox script on the site. Can be switched per image and gallery in the dialog. | No |
| <code>tiptapeditor.lightbox_attribute</code> | **Lightbox attribute** Attribute your lightbox script looks for, e.g. data-fancybox (Fancybox), data-lightbox, data-gallery. A single image gets it without a value, a gallery with its group name (data-fancybox="gallery-3fa9c1"). Empty: a plain link. | (empty) |
| <code>tiptapeditor.lightbox_label</code> | **Lightbox link label** aria-label of the link, {alt} = the alt text or caption. Empty: "Open image: {alt}" in the manager language. | (empty) |
| <code>tiptapeditor.link_classes</code> | **Link class presets** CSS classes offered in the link dialog: a JSON object {"css-class": "Label"} or a comma separated list of classes. Empty: free text field. | (empty) |
| <code>tiptapeditor.paragraph_classes</code> | **Paragraph class presets** Classes offered for paragraphs: a JSON object {"css-class": "Label"} or a comma separated list of classes. | (empty) |
| <code>tiptapeditor.table_classes</code> | **Table class presets** CSS classes offered in the table dialog: JSON object {"css-class": "Label"} (several classes per entry are allowed) or a comma separated list. | (empty) |
| <code>tiptapeditor.preserve_style_attribute</code> | **Preserve style attributes** Keep existing style attributes unchanged. Turn off to drop inline styles. | Yes |

## MODX integration

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.protect_modx_syntax</code> | **Protect MODX tags** Keep MODX tags like [[*pagetitle]] and [[!snippet? ...]] exactly as written: shown as protected badges, never escaped or split, also when the text around them is edited. | Yes |
| <code>tiptapeditor.protect_fenom_syntax</code> | **Protect Fenom** Keep Fenom constructs like {$var}, {if}...{/if} and {foreach} exactly as written: shown as protected badges or cards, never escaped. "{ " with a space stays text (CSS, JSON). | Yes |
| <code>tiptapeditor.fenom_tags</code> | **Extra Fenom tags** Comma separated names of your own Fenom tags or functions (myTag, other) to protect in addition to the built-in keywords (if, foreach, set, include, ...). | (empty) |
| <code>tiptapeditor.modx_autocomplete</code> | **MODX autocomplete** Suggest fields, snippets, chunks and settings while typing MODX tags. | Yes |
| <code>tiptapeditor.fenom_autocomplete</code> | **Fenom autocomplete** Suggest common Fenom variables while typing. | No |
| <code>tiptapeditor.links_across_contexts</code> | **Links across contexts** No (default): the MODX resource search in the link dialog finds resources in the context of the edited resource only. Yes: in all contexts the user may load (never mgr). | No |
| <code>tiptapeditor.resource_link_format</code> | **Resource link format** href written for a MODX resource chosen in the link dialog. {id} is the resource ID (required); {context} and {uri} are also replaced. Default: [[~{id}]]. | <code>[[~{id}]]</code> |
| <code>tiptapeditor.media_source</code> | **Media source** Media source ID for the file browser. Empty uses the context default or the TV source. | (empty) |
| <code>tiptapeditor.media_url_mode</code> | **Media URL mode** "relative" (default) stores the URL exactly as the MODX Media Browser returns it, like the Image TV; "root" prefixes relative URLs with the site base URL (e.g. /assets/img/a.jpg). Absolute URLs (S3 and other remote sources) are always kept as they are. | <code>relative</code> |
| <code>tiptapeditor.upload_enabled</code> | **Upload dropped and pasted images** Upload images dropped or pasted into the editor into the field's Media Source, folder tiptapeditor.upload_path. Uploads go through the MODX file upload (permission file_upload, the source's policies, allowed file types and upload_maxsize apply). Images are never stored as base64. | No |
| <code>tiptapeditor.upload_path</code> | **Upload folder** Folder in the field's Media Source for uploaded images, e.g. assets/uploads/ or assets/uploads/{y}/{m}/{id}/. Placeholders: {id}, {pid} (parent ID), {alias}, {palias} (parent alias), {context}, {tid} (TV ID, empty for the content field), {uid} (user ID), {rand} (random string), {t} (timestamp), {y}, {m}, {d}, {h}, {i}, {s}. {id} and {alias} need a saved resource. | <code>assets/uploads/</code> |
| <code>tiptapeditor.upload_file_prefix</code> | **Upload file name prefix** Added before the name of uploaded images, e.g. {id}- gives 15-photo-x7k2q9.jpg. Same placeholders as the upload folder. | (empty) |
| <code>tiptapeditor.upload_rand_length</code> | **Length of {rand}** Number of characters of the {rand} placeholder (1–32). | <code>6</code> |

## System

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.external_config</code> | **External config** Path to a JSON file with additional configuration, e.g. {core_path}config/tiptapeditor.json. Only data is read, no code is executed. | (empty) |
| <code>tiptapeditor.debug</code> | **Debug mode** Write diagnostic messages to the browser console and the MODX error log. | No |
