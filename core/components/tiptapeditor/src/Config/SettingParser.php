<?php

namespace TipTapEditor\Config;

/**
 * Parses structured system setting values (JSON objects, name=profile lists, URL lists).
 * Values are data only: nothing here is executed, and invalid input yields an empty result
 * plus an error message for the MODX log.
 */
class SettingParser
{
    /** Configuration keys a profile or the external config may set (data only). */
    public const CONFIG_KEYS = [
        'toolbar', 'headingLevels', 'colors', 'highlightColors', 'stickyToolbar', 'features',
        'minHeight', 'maxHeight', 'defaultHeight', 'autogrow', 'linkClasses', 'imageClasses',
        'tableClasses', 'paragraphClasses', 'imageAlignClasses', 'resourceLinkFormat', 'contentCss',
        'preserveStyleAttribute', 'extensions', 'editorProps', 'bubbleMenu', 'floatingMenu', 'slashCommands',
        'statusbar', 'pasteAsText', 'iframeAllowedAttributes', 'iframeAllowedHosts', 'modxAutocomplete', 'fenomAutocomplete',
        'lightbox', 'lightboxAttribute', 'lightboxLabel', 'galleryTemplate', 'galleryTemplates',
    ];

    /** @var string[] */
    public array $errors = [];

    /** A non-empty JSON array (not an object); array_is_list() needs PHP 8.1. */
    public static function isList(array $value): bool
    {
        return $value !== [] && array_keys($value) === range(0, count($value) - 1);
    }

    /**
     * A JSON object setting ("{...}"); '' is an empty object.
     *
     * @return array<string, mixed>
     */
    public function jsonObject(string $value, string $setting): array
    {
        $value = trim($value);
        if ($value === '') {
            return [];
        }
        $data = json_decode($value, true);
        if (!is_array($data) || self::isList($data)) {
            $this->errors[] = "$setting: not a JSON object" . (json_last_error() ? ' (' . json_last_error_msg() . ')' : '');

            return [];
        }

        return $data;
    }

    /**
     * Profiles: {"name": {config…}}. Only known configuration keys are kept.
     *
     * @return array<string, array<string, mixed>>
     */
    public function profiles(mixed $value, string $setting): array
    {
        $data = is_array($value) ? $value : $this->jsonObject((string)$value, $setting);
        $profiles = [];
        foreach ($data as $name => $config) {
            if (!is_string($name) || !preg_match('/^[\w.-]{1,64}$/', $name) || !is_array($config)) {
                $this->errors[] = "$setting: profile \"$name\" ignored (name or value invalid)";
                continue;
            }
            $profiles[$name] = $this->configData($config, "$setting.$name");
        }

        return $profiles;
    }

    /**
     * Profile per TV name: JSON {"intro": "simple"} or lines/commas "intro=simple".
     *
     * @return array<string, string>
     */
    public function tvProfiles(string $value, string $setting): array
    {
        $value = trim($value);
        if ($value === '') {
            return [];
        }
        $pairs = [];
        if (str_starts_with($value, '{')) {
            $pairs = $this->jsonObject($value, $setting);
        } else {
            foreach (preg_split('/[\r\n,]+/', $value) as $line) {
                if (trim($line) === '') {
                    continue;
                }
                $parts = preg_split('/\s*[=:]\s*/', trim($line), 2);
                if (count($parts) === 2) {
                    $pairs[$parts[0]] = $parts[1];
                } else {
                    $this->errors[] = "$setting: \"$line\" is not name=profile";
                }
            }
        }
        $result = [];
        foreach ($pairs as $tv => $profile) {
            if (is_string($tv) && is_string($profile) && preg_match('/^[\w.-]{1,64}$/', $profile) && $tv !== '') {
                $result[$tv] = $profile;
            }
        }

        return $result;
    }

    /**
     * Content CSS: comma or newline separated URLs. Placeholders {assets_url}, {base_url}.
     * Only http(s) URLs and paths are accepted.
     *
     * @param array<string, string> $placeholders
     * @return string[]
     */
    public function urlList(mixed $value, array $placeholders, string $setting): array
    {
        $items = is_array($value) ? $value : preg_split('/[\r\n,]+/', (string)$value);
        $urls = [];
        foreach ($items as $item) {
            if (!is_string($item) || trim($item) === '') {
                continue;
            }
            $url = strtr(trim($item), $placeholders);
            if (!preg_match('#^(https?://[^\s"\'<>]+|/?[\w.~%-][^\s"\'<>:]*)$#', $url)) {
                $this->errors[] = "$setting: \"$item\" is not a URL or path";
                continue;
            }
            $urls[] = $url;
        }

        return array_values(array_unique($urls));
    }

    /**
     * Keeps the known configuration keys with plain data values.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function configData(array $data, string $source): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            if (!in_array($key, self::CONFIG_KEYS, true)) {
                $this->errors[] = "$source: unknown key \"$key\" ignored";
                continue;
            }
            if ($key === 'toolbar' && is_array($value)) {
                $value = $this->toolbarString($value);
            }
            if ($key === 'editorProps') {
                $value = $this->editorProps($value, $source);
            }
            if ($key === 'extensions') {
                $value = $this->extensions($value, $source);
            }
            if ($value !== null) {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    /**
     * Toolbar given as a list: ["undo", "redo", "|", "bold"] or [["undo", "redo"], ["bold"]]
     * (nested lists are groups) → "undo redo | bold".
     *
     * @param array<mixed> $list
     */
    private function toolbarString(array $list): string
    {
        $parts = [];
        foreach ($list as $entry) {
            if (is_array($entry)) {
                $parts[] = implode(' ', array_filter($entry, 'is_string')) . ' |';
            } elseif (is_string($entry)) {
                $parts[] = $entry;
            }
        }
        $toolbar = preg_replace(['/\s+/', '/(\|\s*)+\|/'], [' ', '|'], implode(' ', $parts)) ?? '';

        return trim($toolbar, " |");
    }

    /**
     * Only editorProps.attributes with plain string values on safe names (no event handlers,
     * no contenteditable): spellcheck, lang, dir, class, autocorrect, autocapitalize, data-*, aria-*.
     *
     * @return array<string, mixed>|null
     */
    private function editorProps(mixed $value, string $source): ?array
    {
        if (!is_array($value)) {
            return null;
        }
        $attributes = [];
        foreach ((array)($value['attributes'] ?? []) as $name => $attr) {
            $name = strtolower((string)$name);
            $safe = in_array($name, ['spellcheck', 'lang', 'dir', 'class', 'autocorrect', 'autocapitalize'], true)
                || preg_match('/^(data|aria)-[a-z0-9-]+$/', $name);
            if (!$safe || !is_scalar($attr)) {
                $this->errors[] = "$source: editorProps attribute \"$name\" ignored";
                continue;
            }
            $attributes[$name] = (string)$attr;
        }
        foreach (array_keys($value) as $key) {
            if ($key !== 'attributes') {
                $this->errors[] = "$source: editorProps \"$key\" ignored (only attributes are supported)";
            }
        }

        return ['attributes' => $attributes];
    }

    /**
     * Extensions by name: false switches one off, an object configures it (plain data).
     *
     * @return array<string, mixed>|null
     */
    private function extensions(mixed $value, string $source): ?array
    {
        if (!is_array($value) || self::isList($value)) {
            $this->errors[] = "$source: extensions must be an object {\"name\": false|{options}}";

            return null;
        }
        $result = [];
        foreach ($value as $name => $options) {
            if (!is_string($name) || !preg_match('/^[A-Za-z][\w-]{0,63}$/', $name) || !(is_bool($options) || is_array($options))) {
                $this->errors[] = "$source: extension \"$name\" ignored";
                continue;
            }
            $result[$name] = $options;
        }

        return $result;
    }
}
