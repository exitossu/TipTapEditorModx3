<?php

namespace TipTapEditor;

use MODX\Revolution\modContext;
use MODX\Revolution\modResource;
use MODX\Revolution\modTemplateVar;
use MODX\Revolution\Sources\modMediaSource;
use MODX\Revolution\modX;
use TipTapEditor\Config\ExternalConfig;
use TipTapEditor\Config\SettingParser;

/**
 * TipTapEditor service: paths, URLs, version, options and editor activation rules.
 * Editor configuration for JS is assembled here: system settings, the external JSON config
 * (tiptapeditor.external_config) and profiles. The JS side applies them in the order defaults →
 * settings → external config → profile → runtime options.
 */
class TipTapEditor
{
    /** Must match package.json "version" + "modx.release"; _build/build.php enforces it. */
    public const VERSION = '0.1.0-alpha17';

    public const NAMESPACE = 'tiptapeditor';

    /** Name shown in the which_editor list and stored in the setting value. */
    public const EDITOR_NAME = 'TipTapEditor';

    public modX $modx;

    /** @var array<string, mixed> */
    protected array $config;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(modX $modx, array $config = [])
    {
        $this->modx = $modx;

        $corePath = $this->modx->getOption(
            self::NAMESPACE . '.core_path',
            $config,
            $this->modx->getOption('core_path', null, MODX_CORE_PATH) . 'components/' . self::NAMESPACE . '/'
        );
        $assetsUrl = $this->modx->getOption(
            self::NAMESPACE . '.assets_url',
            $config,
            $this->modx->getOption('assets_url', null, MODX_ASSETS_URL) . 'components/' . self::NAMESPACE . '/'
        );

        $this->config = array_merge([
            'namespace' => self::NAMESPACE,
            'corePath' => $corePath,
            'srcPath' => $corePath . 'src/',
            'processorsPath' => $corePath . 'src/Processors/',
            'assetsUrl' => $assetsUrl,
            'distUrl' => $assetsUrl . 'dist/',
            'connectorUrl' => $assetsUrl . 'connector.php',
        ], $config);
    }

    public function getVersion(): string
    {
        return self::VERSION;
    }

    public function getEditorName(): string
    {
        return self::EDITOR_NAME;
    }

    public function getAssetsUrl(): string
    {
        return $this->config['assetsUrl'];
    }

    public function getDistUrl(): string
    {
        return $this->config['distUrl'];
    }

    public function getConnectorUrl(): string
    {
        return $this->config['connectorUrl'];
    }

    public function getCorePath(): string
    {
        return $this->config['corePath'];
    }

    /**
     * Read an option: service config first, then the namespaced system/context/user
     * setting "tiptapeditor.{key}", then $default.
     *
     * @param array<string, mixed> $options Extra source checked before settings (e.g. event properties).
     */
    public function getOption(string $key, array $options = [], mixed $default = null): mixed
    {
        if (array_key_exists($key, $options)) {
            return $options[$key];
        }
        if (array_key_exists($key, $this->config)) {
            return $this->config[$key];
        }

        return $this->modx->getOption(self::NAMESPACE . '.' . $key, null, $default, true);
    }

    public function getBoolOption(string $key, array $options = [], bool $default = false): bool
    {
        $value = $this->getOption($key, $options, $default);
        if (is_string($value)) {
            $value = strtolower(trim($value));

            return !in_array($value, ['', '0', 'false', 'no', 'off'], true);
        }

        return (bool)$value;
    }

    /**
     * Base configuration handed to the JS bundle. Editor-specific options are merged
     * in by the OnRichTextEditorInit handler.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        return [
            'version' => $this->getVersion(),
            'editorName' => $this->getEditorName(),
            'connectorUrl' => $this->getConnectorUrl(),
            'assetsUrl' => $this->getAssetsUrl(),
            'debug' => $this->getBoolOption('debug'),
            'toolbar' => (string)$this->getOption('toolbar', [], ''),
            'headingLevels' => (string)$this->getOption('heading_levels', [], '1,2,3,4,5,6'),
            'stickyToolbar' => $this->getBoolOption('sticky_toolbar', [], true),
            'minHeight' => (int)$this->getOption('min_height', [], 200),
            'maxHeight' => (int)$this->getOption('max_height', [], 700),
            'defaultHeight' => (int)$this->getOption('default_height', [], 300),
            'autogrow' => $this->getBoolOption('autogrow', [], true),
            'protectModxSyntax' => $this->getBoolOption('protect_modx_syntax', [], true),
            'protectFenomSyntax' => $this->getBoolOption('protect_fenom_syntax', [], true),
            'fenomTags' => (string)$this->getOption('fenom_tags', [], ''),
            'features' => [
                'fullscreen' => $this->getBoolOption('enable_fullscreen', [], true),
                'images' => $this->getBoolOption('enable_images', [], true),
                'tables' => $this->getBoolOption('enable_tables', [], true),
                'iframe' => $this->getBoolOption('enable_iframe', [], true),
                'gallery' => $this->getBoolOption('enable_gallery', [], true),
            ],
            'bubbleMenu' => $this->getBoolOption('bubble_menu', [], true),
            'floatingMenu' => $this->getBoolOption('floating_menu', [], true),
            'slashCommands' => $this->getBoolOption('slash_commands', [], true),
            'statusbar' => $this->getBoolOption('statusbar', [], false),
            'pasteAsText' => $this->getBoolOption('paste_as_text', [], false),
            'iframeAllowedAttributes' => (string)$this->getOption('iframe_allowed_attributes', [], ''),
            'iframeAllowedHosts' => (string)$this->getOption('iframe_allowed_hosts', [], ''),
            'modxAutocomplete' => $this->getBoolOption('modx_autocomplete', [], true),
            'fenomAutocomplete' => $this->getBoolOption('fenom_autocomplete', [], false),
            // Uploads go through MODX's own Browser/File/Upload processor, which checks
            // file_upload and the Media Source policies again on every request.
            'uploadEnabled' => $this->getBoolOption('upload_enabled', [], false) && $this->modx->hasPermission('file_upload'),
            'uploadPath' => (string)$this->getOption('upload_path', [], 'assets/uploads/'),
            'mediaUrlMode' => $this->getOption('media_url_mode', [], 'relative') === 'root' ? 'root' : 'relative',
            'siteBaseUrl' => (string)$this->modx->getOption('base_url', null, '/'),
            'resourceLinkFormat' => (string)$this->getOption('resource_link_format', [], '[[~{id}]]'),
            'linkClasses' => (string)$this->getOption('link_classes', [], ''),
            'imageClasses' => (string)$this->getOption('image_classes', [], ''),
            'lightbox' => $this->getBoolOption('lightbox', [], false),
            'lightboxAttribute' => (string)$this->getOption('lightbox_attribute', [], ''),
            'lightboxLabel' => (string)$this->getOption('lightbox_label', [], ''),
            'galleryTemplate' => (string)$this->getOption('gallery_template', [], 'grid'),
            'galleryTemplates' => (string)$this->getOption('gallery_templates', [], ''),
            'tableClasses' => (string)$this->getOption('table_classes', [], ''),
            'paragraphClasses' => (string)$this->getOption('paragraph_classes', [], ''),
            'preserveStyleAttribute' => $this->getBoolOption('preserve_style_attribute', [], true),
            'lexicon' => $this->getLexiconForJs(),
        ] + $this->getLayeredConfig();
    }

    /**
     * Content CSS, profiles and the external config. Invalid values are logged and skipped,
     * never fatal: the editor then runs with the remaining configuration.
     *
     * @return array<string, mixed>
     */
    public function getLayeredConfig(): array
    {
        $parser = new SettingParser();
        $placeholders = [
            '{core_path}' => (string)$this->modx->getOption('core_path', null, MODX_CORE_PATH),
            '{base_path}' => (string)$this->modx->getOption('base_path', null, MODX_BASE_PATH),
            '{assets_path}' => (string)$this->modx->getOption('assets_path', null, MODX_ASSETS_PATH),
        ];
        $urls = [
            '{assets_url}' => (string)$this->modx->getOption('assets_url', null, MODX_ASSETS_URL),
            '{base_url}' => (string)$this->modx->getOption('base_url', null, MODX_BASE_URL),
        ];

        $external = new ExternalConfig([$placeholders['{core_path}'], $placeholders['{base_path}']], $placeholders, $parser);
        $loaded = $external->load((string)$this->getOption('external_config', [], ''));
        $externalConfig = $loaded['config'];
        if (isset($externalConfig['contentCss'])) {
            $externalConfig['contentCss'] = $parser->urlList($externalConfig['contentCss'], $urls, 'external_config.contentCss');
        }

        $profiles = $parser->profiles((string)$this->getOption('profiles', [], ''), 'tiptapeditor.profiles');
        // Profiles of the external config add to (and override) those of the setting.
        $profiles = array_merge($profiles, $loaded['profiles']);
        foreach ($profiles as $name => $profile) {
            if (isset($profile['contentCss'])) {
                $profiles[$name]['contentCss'] = $parser->urlList($profile['contentCss'], $urls, "profiles.$name.contentCss");
            }
        }

        $result = [
            'contentCss' => $parser->urlList((string)$this->getOption('content_css', [], ''), $urls, 'tiptapeditor.content_css'),
            'profiles' => (object)$profiles,
            'defaultProfile' => (string)$this->getOption('default_profile', [], 'default'),
            'contentProfile' => (string)$this->getOption('content_profile', [], ''),
            'tvProfiles' => (object)$parser->tvProfiles((string)$this->getOption('tv_profiles', [], ''), 'tiptapeditor.tv_profiles'),
            'external' => (object)$externalConfig,
        ];

        foreach (array_merge($parser->errors, $external->errors) as $error) {
            $this->modx->log(modX::LOG_LEVEL_WARN, $error, '', 'TipTapEditor');
        }

        return $result;
    }

    /**
     * UI strings for JS: every "tiptapeditor.*" key of the default topic, without the prefix.
     * Strings are data; the bundle only ever assigns them as text.
     *
     * @return array<string, string>
     */
    public function getLexiconForJs(): array
    {
        $this->loadLexicon();

        return $this->modx->lexicon->fetch(self::NAMESPACE . '.', true);
    }

    /**
     * Whether TipTapEditor is the active editor for the current request.
     *
     * The resource controller resolves use_editor/which_editor with context and user
     * settings and passes the result as the "editor" event property, so that value wins
     * when present. Without it (manager pages that fire no RTE event) the context-aware
     * option of the current context is used.
     *
     * @param array<string, mixed> $eventProperties
     */
    public function isActive(array $eventProperties = []): bool
    {
        if (!$this->modx->getOption('use_editor', null, false)) {
            return false;
        }
        $editor = $eventProperties['editor'] ?? $this->modx->getOption('which_editor', null, '');

        return $editor === self::EDITOR_NAME;
    }

    /**
     * Context key of the resource being edited, falling back to the default context.
     */
    public function getResourceContext(?modResource $resource = null): string
    {
        if ($resource && $resource->get('context_key')) {
            return (string)$resource->get('context_key');
        }

        return (string)$this->modx->getOption('default_context', null, 'web');
    }

    /**
     * Media Source a field browses: the source assigned to the TV for the context, or for the
     * resource content tiptapeditor.media_source / the context's default_media_source.
     *
     * Returns null when the user may not browse files at all (file_manager) or the source
     * denies "list"; the editor then disables its file buttons. Only id, name and base URL go
     * to JS, never filesystem paths.
     *
     * @return array{id: int, name: string, baseUrl: string}|null
     */
    public function getMediaSourceFor(?modTemplateVar $tv, string $contextKey): ?array
    {
        if (!$this->modx->hasPermission('file_manager')) {
            return null;
        }
        if ($tv) {
            $source = $tv->getSource($contextKey, true);
        } else {
            $id = (int)$this->getOption('media_source', [], 0);
            if ($id <= 0) {
                $context = $this->modx->getContext($contextKey);
                $id = (int)($context instanceof modContext
                    ? $context->getOption('default_media_source', 1)
                    : $this->modx->getOption('default_media_source', null, 1));
            }
            // getObject applies the source's ACL ("load"), so a hidden source is never returned.
            $source = modMediaSource::getDefaultSource($this->modx, $id);
        }
        if (!$source instanceof modMediaSource || !$source->checkPolicy('list')) {
            return null;
        }
        $source->initialize();
        $baseUrl = (string)($source->getBaseUrl() ?: '');

        return [
            'id' => (int)$source->get('id'),
            'name' => (string)$source->get('name'),
            'baseUrl' => $baseUrl,
        ];
    }

    /**
     * Load a lexicon topic of this namespace (default: "default").
     */
    public function loadLexicon(string $topic = 'default'): void
    {
        $this->modx->lexicon->load(self::NAMESPACE . ':' . $topic);
    }

    /**
     * Debug logging, only when tiptapeditor.debug is on. Never pass sensitive data here.
     */
    public function debug(string $message): void
    {
        if ($this->getBoolOption('debug')) {
            $this->modx->log(modX::LOG_LEVEL_ERROR, '[TipTapEditor] ' . $message, '', 'TipTapEditor');
        }
    }
}
