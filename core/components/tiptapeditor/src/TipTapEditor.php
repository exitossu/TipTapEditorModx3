<?php

namespace TipTapEditor;

use MODX\Revolution\modContext;
use MODX\Revolution\modResource;
use MODX\Revolution\modTemplateVar;
use MODX\Revolution\Sources\modMediaSource;
use MODX\Revolution\modX;
use TipTapEditor\Config\ExternalConfig;
use TipTapEditor\Config\SettingParser;
use TipTapEditor\Config\Settings;
use TipTapEditor\Gallery\TemplateFiles;

/**
 * TipTapEditor service: paths, URLs, version, options and editor activation rules.
 * Editor configuration for JS is assembled here: system settings, the external JSON config
 * (tiptapeditor.external_config) and profiles. The JS side applies them in the order defaults →
 * settings → external config → profile → runtime options.
 */
class TipTapEditor
{
    /** Must match package.json "version" + "modx.release"; _build/build.php enforces it. */
    public const VERSION = '0.1.0-alpha22';

    public const NAMESPACE = 'tiptapeditor';

    /** Name shown in the which_editor list and stored in the setting value. */
    public const EDITOR_NAME = 'TipTapEditor';

    public modX $modx;

    /** @var array<string, mixed> */
    protected array $config;

    /** @var string[] Configuration errors of the last getConfig() call. */
    protected array $configErrors = [];

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
     * Base configuration handed to the JS bundle: every setting of Config\Settings with a "js"
     * key, plus the few that need work on the server. Editor-specific options are merged in by
     * the OnRichTextEditorInit handler.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): array
    {
        $this->configErrors = [];
        $config = [
            'version' => $this->getVersion(),
            'editorName' => $this->getEditorName(),
            'connectorUrl' => $this->getConnectorUrl(),
            'assetsUrl' => $this->getAssetsUrl(),
        ];
        foreach (Settings::all() as $key => $setting) {
            if (!isset($setting['js'])) {
                continue;
            }
            $default = $setting['value'];
            $config[$setting['js']] = match (true) {
                is_bool($default) => $this->getBoolOption($key, [], $default),
                is_int($default) => (int)$this->getOption($key, [], $default),
                default => trim((string)$this->getOption($key, [], $default)),
            };
        }
        if ($config['toolbar'] === '') {
            // Empty: the package's toolbar (DEFAULT_TOOLBAR in the bundle).
            unset($config['toolbar']);
        }
        $fenom = $this->getFenomMode();

        $config += [
            'protectFenomSyntax' => $fenom !== 'off',
            'fenomAutocomplete' => $fenom === 'on',
            // Uploads go through MODX's own Browser/File/Upload processor, which checks
            // file_upload and the Media Source policies again on every request.
            'uploadEnabled' => $this->getBoolOption('upload_enabled', [], false) && $this->modx->hasPermission('file_upload'),
            'mediaUrlMode' => $this->getOption('media_url_mode', [], 'relative') === 'root' ? 'root' : 'relative',
            'siteBaseUrl' => (string)$this->modx->getOption('base_url', null, '/'),
            'galleryTemplateFiles' => (object)$this->getGalleryTemplateFiles(),
            'lexicon' => $this->getLexiconForJs(),
        ] + $this->getLayeredConfig();

        // Users who may change system settings see configuration errors in the editor too.
        if ($this->configErrors && $this->modx->hasPermission('settings')) {
            $config['configErrors'] = array_values(array_unique($this->configErrors));
        }

        return $config;
    }

    /**
     * tiptapeditor.fenom: "off" (0, no) leaves Fenom alone, "on" (1, yes) protects it and offers
     * autocomplete, "auto" (default) always protects it and offers autocomplete when pdoTools parses
     * Fenom (pdotools_fenom_default or pdotools_fenom_parser).
     *
     * @return 'on'|'protect'|'off'
     */
    public function getFenomMode(): string
    {
        $value = strtolower(trim((string)$this->getOption('fenom', [], 'auto')));
        if (in_array($value, ['0', 'off', 'no', 'false'], true)) {
            return 'off';
        }
        if (in_array($value, ['1', 'on', 'yes', 'true'], true)) {
            return 'on';
        }
        foreach (['pdotools_fenom_default', 'pdotools_fenom_parser'] as $key) {
            $flag = $this->modx->getOption($key, null, false);
            if ($flag && !in_array(strtolower((string)$flag), ['0', 'false', 'no'], true)) {
                return 'on';
            }
        }

        return 'protect';
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
            'tvProfiles' => (object)$parser->tvProfiles((string)$this->getOption('tv_profiles', [], ''), 'tiptapeditor.tv_profiles'),
            'external' => (object)$externalConfig,
        ];

        foreach (array_merge($external->errors, $parser->errors) as $error) {
            $this->modx->log(modX::LOG_LEVEL_WARN, $error, '', 'TipTapEditor');
            $this->configErrors[] = $error;
        }

        return $result;
    }

    /**
     * Gallery templates from the files in tiptapeditor.gallery_templates_path (Gallery\TemplateFiles).
     * A file without its own label gets the lexicon name of a built-in template ("grid" → "Grid"),
     * otherwise its file name.
     *
     * @return array<string, array{label: string, wrapper: string, item: string}>
     */
    public function getGalleryTemplateFiles(): array
    {
        $placeholders = [
            '{core_path}' => (string)$this->modx->getOption('core_path', null, MODX_CORE_PATH),
            '{base_path}' => (string)$this->modx->getOption('base_path', null, MODX_BASE_PATH),
            '{assets_path}' => (string)$this->modx->getOption('assets_path', null, MODX_ASSETS_PATH),
        ];
        $files = new TemplateFiles([$placeholders['{core_path}'], $placeholders['{base_path}']], $placeholders);
        $this->loadLexicon();
        $templates = $files->load(
            (string)$this->getOption('gallery_templates_path', [], Settings::default('gallery_templates_path')),
            fn (string $name): string => $this->modx->lexicon->exists(self::NAMESPACE . '.gallery_template_' . $name)
                ? 'gallery_template_' . $name : $name,
        );
        foreach ($files->errors as $error) {
            $this->modx->log(modX::LOG_LEVEL_WARN, $error, '', 'TipTapEditor');
            $this->configErrors[] = $error;
        }

        return $templates;
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
