<?php

/**
 * System settings. Keys are prefixed with "tiptapeditor." by build.php.
 * On upgrade existing values are never overwritten (see config.inc.php "update").
 */

$toolbar = 'undo redo | heading | bold italic underline strike code | color highlight | superscript subscript'
    . ' | align | bulletList orderedList | blockquote horizontalRule | link modxLink anchor | image gallery file table embed'
    . ' | codeBlock | clearFormatting | source fullscreen';

return [
    // Interface
    'toolbar' => ['xtype' => 'textarea', 'value' => $toolbar, 'area' => 'tiptapeditor.main'],
    'profiles' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.main'],
    'default_profile' => ['xtype' => 'textfield', 'value' => 'default', 'area' => 'tiptapeditor.main'],
    'content_profile' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.main'],
    'tv_profiles' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.main'],
    'heading_levels' => ['xtype' => 'textfield', 'value' => '1,2,3,4,5,6', 'area' => 'tiptapeditor.main'],
    'bubble_menu' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'floating_menu' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'slash_commands' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'statusbar' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.main'],
    'sticky_toolbar' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'enable_fullscreen' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'min_height' => ['xtype' => 'numberfield', 'value' => 200, 'area' => 'tiptapeditor.main'],
    'max_height' => ['xtype' => 'numberfield', 'value' => 700, 'area' => 'tiptapeditor.main'],
    'default_height' => ['xtype' => 'numberfield', 'value' => 300, 'area' => 'tiptapeditor.main'],
    'autogrow' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.main'],
    'content_css' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.main'],

    // Content
    'enable_tables' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.content'],
    'enable_images' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.content'],
    'enable_iframe' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.content'],
    'iframe_allowed_attributes' => [
        'xtype' => 'textfield',
        'value' => 'src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style',
        'area' => 'tiptapeditor.content',
    ],
    'iframe_allowed_hosts' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.content'],
    'paste_as_text' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.content'],
    'image_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.content'],
    'enable_gallery' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.content'],
    'gallery_template' => ['xtype' => 'textfield', 'value' => 'grid', 'area' => 'tiptapeditor.content'],
    'gallery_templates' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.content'],
    'lightbox' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.content'],
    'lightbox_attribute' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.content'],
    'lightbox_label' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.content'],
    'link_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.content'],
    'paragraph_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.content'],
    'table_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => 'tiptapeditor.content'],
    'preserve_style_attribute' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.content'],

    // MODX integration
    'protect_modx_syntax' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.modx'],
    'protect_fenom_syntax' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.modx'],
    'fenom_tags' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.modx'],
    'modx_autocomplete' => ['xtype' => 'combo-boolean', 'value' => true, 'area' => 'tiptapeditor.modx'],
    'fenom_autocomplete' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.modx'],
    'links_across_contexts' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.modx'],
    'resource_link_format' => ['xtype' => 'textfield', 'value' => '[[~{id}]]', 'area' => 'tiptapeditor.modx'],
    'media_source' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.modx'],
    'media_url_mode' => ['xtype' => 'textfield', 'value' => 'relative', 'area' => 'tiptapeditor.modx'],
    'upload_enabled' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.modx'],
    'upload_path' => ['xtype' => 'textfield', 'value' => 'assets/uploads/', 'area' => 'tiptapeditor.modx'],
    'upload_file_prefix' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.modx'],
    'upload_rand_length' => ['xtype' => 'numberfield', 'value' => 6, 'area' => 'tiptapeditor.modx'],

    // System
    'external_config' => ['xtype' => 'textfield', 'value' => '', 'area' => 'tiptapeditor.system'],
    'debug' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => 'tiptapeditor.system'],
];
