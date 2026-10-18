<?php

namespace TipTapEditor\Config;

/**
 * The system settings of the package, in one place: the build installs them
 * (_build/elements/settings.php), TipTapEditor::getConfig() hands them to JS and the
 * documentation lists them (scripts/docs-generate.php).
 *
 * Each entry: xtype, default value (its PHP type is the setting's type: bool, int or string),
 * area, and "js", the configuration key the value is passed to JS under. Entries without "js"
 * are read on the server only (or need special handling in getConfig()).
 *
 * Everything else about the editor (menus, status bar, heading levels, features, …) is set in a
 * profile or the external JSON config, see SettingParser::CONFIG_KEYS.
 */
final class Settings
{
    // Areas are listed in the manager sorted by key; "tuning" comes after "system" on purpose.
    public const AREA_MAIN = 'tiptapeditor.main';
    public const AREA_CONTENT = 'tiptapeditor.content';
    public const AREA_MODX = 'tiptapeditor.modx';
    public const AREA_SYSTEM = 'tiptapeditor.system';
    public const AREA_ADVANCED = 'tiptapeditor.tuning';

    /**
     * @return array<string, array{xtype: string, value: bool|int|string, area: string, js?: string}>
     */
    public static function all(): array
    {
        return [
            // Interface. An empty toolbar is the package's toolbar, so upgrades bring new buttons.
            'toolbar' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_MAIN, 'js' => 'toolbar'],
            'profiles' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_MAIN],
            'tv_profiles' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_MAIN],
            'content_css' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_MAIN],
            'min_height' => ['xtype' => 'numberfield', 'value' => 200, 'area' => self::AREA_MAIN, 'js' => 'minHeight'],
            'max_height' => ['xtype' => 'numberfield', 'value' => 700, 'area' => self::AREA_MAIN, 'js' => 'maxHeight'],

            // Content
            'iframe_allowed_hosts' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'iframeAllowedHosts'],
            'image_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'imageClasses'],
            'link_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'linkClasses'],
            'paragraph_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'paragraphClasses'],
            'table_classes' => ['xtype' => 'textarea', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'tableClasses'],
            'gallery_template' => ['xtype' => 'textfield', 'value' => 'grid', 'area' => self::AREA_CONTENT, 'js' => 'galleryTemplate'],
            'lightbox' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => self::AREA_CONTENT, 'js' => 'lightbox'],
            'lightbox_attribute' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_CONTENT, 'js' => 'lightboxAttribute'],

            // MODX integration
            'fenom' => ['xtype' => 'textfield', 'value' => 'auto', 'area' => self::AREA_MODX],
            'upload_enabled' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => self::AREA_MODX],
            'upload_path' => ['xtype' => 'textfield', 'value' => 'assets/uploads/', 'area' => self::AREA_MODX, 'js' => 'uploadPath'],

            // System
            'external_config' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_SYSTEM],
            'debug' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => self::AREA_SYSTEM, 'js' => 'debug'],

            // Advanced: rarely changed
            'gallery_templates_path' => ['xtype' => 'textfield', 'value' => '{core_path}elements/tiptapeditor/gallery/', 'area' => self::AREA_ADVANCED],
            'fenom_tags' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_ADVANCED, 'js' => 'fenomTags'],
            'links_across_contexts' => ['xtype' => 'combo-boolean', 'value' => false, 'area' => self::AREA_ADVANCED],
            'resource_link_format' => ['xtype' => 'textfield', 'value' => '[[~{id}]]', 'area' => self::AREA_ADVANCED, 'js' => 'resourceLinkFormat'],
            'media_source' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_ADVANCED],
            'media_url_mode' => ['xtype' => 'textfield', 'value' => 'relative', 'area' => self::AREA_ADVANCED],
            'upload_file_prefix' => ['xtype' => 'textfield', 'value' => '', 'area' => self::AREA_ADVANCED, 'js' => 'uploadFilePrefix'],
        ];
    }

    /**
     * The default value of a setting, or $fallback for unknown keys.
     */
    public static function default(string $key, mixed $fallback = null): mixed
    {
        return self::all()[$key]['value'] ?? $fallback;
    }
}
