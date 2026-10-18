---
outline: [2, 2]
---

# System settings

All settings are under System Settings, namespace `tiptapeditor`. They can be overridden in context, user group or user settings. Upgrades never reset their values.

Only what almost every site adjusts is a system setting. Menus, the status bar, heading levels, features, MODX tag protection and more are set in [profiles and the external JSON config](./profiles#what-a-profile-may-set). Rarely needed settings are in the Advanced area.

::: tip
This page is generated from the package sources (`npm run docs:generate`).
:::

## Interface

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.toolbar</code> | **Toolbar** Toolbar buttons separated by spaces, groups separated by "\|", e.g. undo redo \| heading \| bold italic \| link image. Empty: the package's toolbar, which gets new buttons with updates. A button not listed here is not shown. | (empty) |
| <code>tiptapeditor.profiles</code> | **Profiles** JSON object of named profiles, e.g. {"simple": {"toolbar": "bold italic link"&#125;&#125;. The profile "default" applies to every field, "content" to the resource content. A profile can set the toolbar, menus, heading levels, features and more (see the documentation, "Profiles"). | (empty) |
| <code>tiptapeditor.tv_profiles</code> | **TV profiles** TV name → profile: a JSON object such as {"introtext": "simple"}, or name=profile pairs, one per line or comma separated. | (empty) |
| <code>tiptapeditor.content_css</code> | **Content CSS** Comma separated list of site stylesheets applied to the content inside the editor, e.g. /assets/css/content.css,/assets/css/article.css. | (empty) |
| <code>tiptapeditor.min_height</code> | **Minimum height** Minimum height of the editing area in pixels. The editor grows with its content up to the maximum height. | <code>200</code> |
| <code>tiptapeditor.max_height</code> | **Maximum height** Maximum height of the editing area in pixels; longer content scrolls. 0: no limit. The same value as the minimum height gives a fixed height. | <code>700</code> |

## Content

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.iframe_allowed_hosts</code> | **Allowed iframe hosts** Comma separated list of hosts allowed in iframe src (embeds, videos in galleries). Empty allows any host. | (empty) |
| <code>tiptapeditor.image_classes</code> | **Image class presets** Classes offered for images: a JSON object {"css-class": "Label"} or a comma separated list of classes. | (empty) |
| <code>tiptapeditor.link_classes</code> | **Link class presets** CSS classes offered in the link dialog: a JSON object {"css-class": "Label"} or a comma separated list of classes. Empty: free text field. | (empty) |
| <code>tiptapeditor.paragraph_classes</code> | **Paragraph class presets** Classes offered for paragraphs and headings (toolbar button paragraphClass): a JSON object {"css-class": "Label"} or a comma separated list of classes. | (empty) |
| <code>tiptapeditor.table_classes</code> | **Table class presets** CSS classes offered in the table dialog: JSON object {"css-class": "Label"} (several classes per entry are allowed) or a comma separated list. | (empty) |
| <code>tiptapeditor.gallery_template</code> | **Gallery template** Template of new galleries: grid, slider (Swiper markup), images, or the name of your own template (a file name in the gallery template folder, without .html). | <code>grid</code> |
| <code>tiptapeditor.lightbox</code> | **Open images larger on click** New images and galleries get a link to the image around the picture (&lt;figure&gt;&lt;a href="…"&gt;&lt;img&gt;&lt;/a&gt;&lt;/figure&gt;) for a lightbox script on the site. Can be switched per image and gallery in the dialog. | No |
| <code>tiptapeditor.lightbox_attribute</code> | **Lightbox attribute** Attribute your lightbox script looks for, e.g. data-fancybox (Fancybox), data-lightbox. A single image gets it without a value, a gallery with its group name (data-fancybox="gallery-3fa9c1"). Empty: a plain link. | (empty) |

## MODX integration

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.fenom</code> | **Fenom** auto (default): Fenom constructs like {$var} and {if}…{/if} are kept exactly as written; variable suggestions are on when pdoTools parses Fenom. 1: protection and suggestions always. 0: Fenom is ordinary text. | <code>auto</code> |
| <code>tiptapeditor.upload_enabled</code> | **Upload dropped and pasted images** Upload images dropped or pasted into the editor into the field's Media Source, folder tiptapeditor.upload_path. Uploads go through the MODX file upload (permission file_upload, the source's policies, allowed file types and upload_maxsize apply). Images are never stored as base64. | No |
| <code>tiptapeditor.upload_path</code> | **Upload folder** Folder in the field's Media Source for uploaded images, e.g. assets/uploads/ or assets/uploads/{y}/{m}/{id}/. Placeholders such as {id}, {alias}, {y}, {m}, {rand} or {rand:8} are listed in the documentation ("Images, galleries, files"). | <code>assets/uploads/</code> |

## System

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.external_config</code> | **External config** Path to a JSON file with further configuration and profiles, e.g. {core_path}config/tiptapeditor.json. Only data is read, no code is executed. | (empty) |
| <code>tiptapeditor.debug</code> | **Debug mode** Write diagnostic messages to the browser console and the MODX error log. | No |

## Advanced

| Key | Description | Default |
|---|---|---|
| <code>tiptapeditor.gallery_templates_path</code> | **Gallery template folder** Folder with gallery template files, one .html file per template; the file name is the template name. Inside core_path or base_path. The package adds its templates once and never overwrites or deletes files here. | <code>{core_path}elements/tiptapeditor/gallery/</code> |
| <code>tiptapeditor.fenom_tags</code> | **Extra Fenom tags** Comma separated names of your own Fenom tags or functions (myTag, other) to protect in addition to the built-in keywords (if, foreach, set, include, ...). | (empty) |
| <code>tiptapeditor.links_across_contexts</code> | **Links across contexts** No (default): the MODX resource search in the link dialog finds resources in the context of the edited resource only. Yes: in all contexts the user may load (never mgr). | No |
| <code>tiptapeditor.resource_link_format</code> | **Resource link format** href written for a MODX resource chosen in the link dialog. {id} is the resource ID (required); {context} and {uri} are also replaced. Default: [[~{id}]]. | <code>[[~{id}]]</code> |
| <code>tiptapeditor.media_source</code> | **Media source** Media source ID for the resource content. Empty: the context's default_media_source. TVs always use their own source. | (empty) |
| <code>tiptapeditor.media_url_mode</code> | **Media URL mode** relative (default): the URL exactly as the MODX Media Browser returns it, like the Image TV. root: relative URLs get the site base URL (/assets/img/a.jpg). Absolute URLs (S3 and other remote sources) always stay as they are. | <code>relative</code> |
| <code>tiptapeditor.upload_file_prefix</code> | **Upload file name** Name for uploaded images, e.g. {id} gives 15.jpg (the extension stays). Empty: the file keeps its own name. A name already in the folder gets -1, -2 …. Same placeholders as the upload folder. | (empty) |
