<?php

namespace TipTapEditor\Config;

/**
 * Reads tiptapeditor.external_config: a JSON file with editor configuration, e.g.
 *
 *     {"toolbar": "bold italic | link", "features": {"tables": false},
 *      "extensions": {"highlight": false}, "editorProps": {"attributes": {"spellcheck": "true"}},
 *      "profiles": {"simple": {"toolbar": "bold italic link"}}}
 *
 * The path may use {core_path}, {base_path} and {assets_path}; relative paths are relative to
 * base_path. The file must be a .json file inside core_path or base_path (checked with
 * realpath, so "../" and symlinks cannot leave them) and at most 256 KB. It is parsed as JSON
 * only: nothing in it is executed. Unknown keys are ignored and logged.
 */
class ExternalConfig
{
    private const MAX_BYTES = 262144;

    /** @var string[] */
    public array $errors = [];

    /**
     * @param string[] $roots allowed directories (core_path, base_path)
     * @param array<string, string> $placeholders
     */
    public function __construct(private array $roots, private array $placeholders, private SettingParser $parser)
    {
    }

    /**
     * @return array{config: array<string, mixed>, profiles: array<string, array<string, mixed>>}
     */
    public function load(string $setting): array
    {
        $empty = ['config' => [], 'profiles' => []];
        $setting = trim($setting);
        if ($setting === '') {
            return $empty;
        }
        $path = strtr($setting, $this->placeholders);
        if (!preg_match('~^(/|[A-Za-z]:[\\\\/])~', $path)) {
            $path = rtrim($this->placeholders['{base_path}'] ?? '', '/\\') . '/' . $path;
        }
        $real = realpath($path);
        if ($real === false || !is_file($real) || !is_readable($real)) {
            $this->errors[] = "external_config: file not found or not readable ($setting)";

            return $empty;
        }
        if (strtolower(pathinfo($real, PATHINFO_EXTENSION)) !== 'json') {
            $this->errors[] = 'external_config: only .json files are read';

            return $empty;
        }
        if (!$this->isInsideRoots($real)) {
            $this->errors[] = 'external_config: the file must be inside core_path or base_path';

            return $empty;
        }
        if (filesize($real) > self::MAX_BYTES) {
            $this->errors[] = 'external_config: file larger than 256 KB';

            return $empty;
        }
        $data = json_decode((string)file_get_contents($real), true);
        if (!is_array($data) || SettingParser::isList($data)) {
            $this->errors[] = 'external_config: not a JSON object' . (json_last_error() ? ' (' . json_last_error_msg() . ')' : '');

            return $empty;
        }

        $profiles = [];
        if (array_key_exists('profiles', $data)) {
            $profiles = $this->parser->profiles($data['profiles'], 'external_config.profiles');
            unset($data['profiles']);
        }

        return ['config' => $this->parser->configData($data, 'external_config'), 'profiles' => $profiles];
    }

    private function isInsideRoots(string $real): bool
    {
        foreach ($this->roots as $root) {
            $rootReal = realpath($root);
            if ($rootReal !== false && str_starts_with($real, rtrim($rootReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
                return true;
            }
        }

        return false;
    }
}
