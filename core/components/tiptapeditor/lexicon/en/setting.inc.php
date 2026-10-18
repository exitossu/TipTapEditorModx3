<?php

/**
 * TipTapEditor system settings lexicon (en).
 */

$_lang['area_tiptapeditor.main'] = 'Interface';
$_lang['area_tiptapeditor.content'] = 'Content';
$_lang['area_tiptapeditor.modx'] = 'MODX integration';
$_lang['area_tiptapeditor.system'] = 'System';
$_lang['area_tiptapeditor.tuning'] = 'Advanced';

$_lang['setting_tiptapeditor.toolbar'] = 'Toolbar';
$_lang['setting_tiptapeditor.toolbar_desc'] = 'Toolbar buttons separated by spaces, groups separated by "|", e.g. undo redo | heading | bold italic | link image. Empty: the package\'s toolbar, which gets new buttons with updates. A button not listed here is not shown.';
$_lang['setting_tiptapeditor.profiles'] = 'Profiles';
$_lang['setting_tiptapeditor.profiles_desc'] = 'JSON object of named profiles, e.g. {"simple": {"toolbar": "bold italic link"}}. The profile "default" applies to every field, "content" to the resource content. A profile can set the toolbar, menus, heading levels, features and more (see the documentation, "Profiles").';
$_lang['setting_tiptapeditor.tv_profiles'] = 'TV profiles';
$_lang['setting_tiptapeditor.tv_profiles_desc'] = 'TV name → profile: a JSON object such as {"introtext": "simple"}, or name=profile pairs, one per line or comma separated.';
$_lang['setting_tiptapeditor.content_css'] = 'Content CSS';
$_lang['setting_tiptapeditor.content_css_desc'] = 'Comma separated list of site stylesheets applied to the content inside the editor, e.g. /assets/css/content.css,/assets/css/article.css.';
$_lang['setting_tiptapeditor.min_height'] = 'Minimum height';
$_lang['setting_tiptapeditor.min_height_desc'] = 'Minimum height of the editing area in pixels. The editor grows with its content up to the maximum height.';
$_lang['setting_tiptapeditor.max_height'] = 'Maximum height';
$_lang['setting_tiptapeditor.max_height_desc'] = 'Maximum height of the editing area in pixels; longer content scrolls. 0: no limit. The same value as the minimum height gives a fixed height.';

$_lang['setting_tiptapeditor.iframe_allowed_hosts'] = 'Allowed iframe hosts';
$_lang['setting_tiptapeditor.iframe_allowed_hosts_desc'] = 'Comma separated list of hosts allowed in iframe src (embeds, videos in galleries). Empty allows any host.';
$_lang['setting_tiptapeditor.image_classes'] = 'Image class presets';
$_lang['setting_tiptapeditor.image_classes_desc'] = 'Classes offered for images: a JSON object {"css-class": "Label"} or a comma separated list of classes.';
$_lang['setting_tiptapeditor.link_classes'] = 'Link class presets';
$_lang['setting_tiptapeditor.link_classes_desc'] = 'CSS classes offered in the link dialog: a JSON object {"css-class": "Label"} or a comma separated list of classes. Empty: free text field.';
$_lang['setting_tiptapeditor.paragraph_classes'] = 'Paragraph class presets';
$_lang['setting_tiptapeditor.paragraph_classes_desc'] = 'Classes offered for paragraphs and headings (toolbar button paragraphClass): a JSON object {"css-class": "Label"} or a comma separated list of classes.';
$_lang['setting_tiptapeditor.table_classes'] = 'Table class presets';
$_lang['setting_tiptapeditor.table_classes_desc'] = 'CSS classes offered in the table dialog: JSON object {"css-class": "Label"} (several classes per entry are allowed) or a comma separated list.';
$_lang['setting_tiptapeditor.gallery_template'] = 'Gallery template';
$_lang['setting_tiptapeditor.gallery_template_desc'] = 'Template of new galleries: grid, slider (Swiper markup), images, or the name of your own template (a file name in the gallery template folder, without .html).';
$_lang['setting_tiptapeditor.lightbox'] = 'Open images larger on click';
$_lang['setting_tiptapeditor.lightbox_desc'] = 'New images and galleries get a link to the image around the picture (<figure><a href="…"><img></a></figure>) for a lightbox script on the site. Can be switched per image and gallery in the dialog.';
$_lang['setting_tiptapeditor.lightbox_attribute'] = 'Lightbox attribute';
$_lang['setting_tiptapeditor.lightbox_attribute_desc'] = 'Attribute your lightbox script looks for, e.g. data-fancybox (Fancybox), data-lightbox. A single image gets it without a value, a gallery with its group name (data-fancybox="gallery-3fa9c1"). Empty: a plain link.';

$_lang['setting_tiptapeditor.fenom'] = 'Fenom';
$_lang['setting_tiptapeditor.fenom_desc'] = 'auto (default): Fenom constructs like {$var} and {if}…{/if} are kept exactly as written; variable suggestions are on when pdoTools parses Fenom. 1: protection and suggestions always. 0: Fenom is ordinary text.';
$_lang['setting_tiptapeditor.upload_enabled'] = 'Upload dropped and pasted images';
$_lang['setting_tiptapeditor.upload_enabled_desc'] = 'Upload images dropped or pasted into the editor into the field\'s Media Source, folder tiptapeditor.upload_path. Uploads go through the MODX file upload (permission file_upload, the source\'s policies, allowed file types and upload_maxsize apply). Images are never stored as base64.';
$_lang['setting_tiptapeditor.upload_path'] = 'Upload folder';
$_lang['setting_tiptapeditor.upload_path_desc'] = 'Folder in the field\'s Media Source for uploaded images, e.g. assets/uploads/ or assets/uploads/{y}/{m}/{id}/. Placeholders such as {id}, {alias}, {y}, {m}, {rand} or {rand:8} are listed in the documentation ("Images, galleries, files").';

$_lang['setting_tiptapeditor.external_config'] = 'External config';
$_lang['setting_tiptapeditor.external_config_desc'] = 'Path to a JSON file with further configuration and profiles, e.g. {core_path}config/tiptapeditor.json. Only data is read, no code is executed.';
$_lang['setting_tiptapeditor.debug'] = 'Debug mode';
$_lang['setting_tiptapeditor.debug_desc'] = 'Write diagnostic messages to the browser console and the MODX error log.';

$_lang['setting_tiptapeditor.gallery_templates_path'] = 'Gallery template folder';
$_lang['setting_tiptapeditor.gallery_templates_path_desc'] = 'Folder with gallery template files, one .html file per template; the file name is the template name. Inside core_path or base_path. The package adds its templates once and never overwrites or deletes files here.';
$_lang['setting_tiptapeditor.fenom_tags'] = 'Extra Fenom tags';
$_lang['setting_tiptapeditor.fenom_tags_desc'] = 'Comma separated names of your own Fenom tags or functions (myTag, other) to protect in addition to the built-in keywords (if, foreach, set, include, ...).';
$_lang['setting_tiptapeditor.links_across_contexts'] = 'Links across contexts';
$_lang['setting_tiptapeditor.links_across_contexts_desc'] = 'No (default): the MODX resource search in the link dialog finds resources in the context of the edited resource only. Yes: in all contexts the user may load (never mgr).';
$_lang['setting_tiptapeditor.resource_link_format'] = 'Resource link format';
$_lang['setting_tiptapeditor.resource_link_format_desc'] = 'href written for a MODX resource chosen in the link dialog. {id} is the resource ID (required); {context} and {uri} are also replaced. Default: [[~{id}]].';
$_lang['setting_tiptapeditor.media_source'] = 'Media source';
$_lang['setting_tiptapeditor.media_source_desc'] = 'Media source ID for the resource content. Empty: the context\'s default_media_source. TVs always use their own source.';
$_lang['setting_tiptapeditor.media_url_mode'] = 'Media URL mode';
$_lang['setting_tiptapeditor.media_url_mode_desc'] = 'relative (default): the URL exactly as the MODX Media Browser returns it, like the Image TV. root: relative URLs get the site base URL (/assets/img/a.jpg). Absolute URLs (S3 and other remote sources) always stay as they are.';
$_lang['setting_tiptapeditor.upload_file_prefix'] = 'Upload file name';
$_lang['setting_tiptapeditor.upload_file_prefix_desc'] = 'Name for uploaded images, e.g. {id} gives 15.jpg (the extension stays). Empty: the file keeps its own name. A name already in the folder gets -1, -2 …. Same placeholders as the upload folder.';
