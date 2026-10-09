<?php

namespace TipTapEditor\Gallery;

/**
 * Gallery templates as files: one .html file per template in tiptapeditor.gallery_templates_path
 * (by default {core_path}elements/tiptapeditor/gallery/), the file name is the template name.
 *
 *   <!-- label: Cards -->                       optional, otherwise the lexicon or the file name
 *   <ul class="cards">{items}</ul>              outer markup, {items} once
 *   <!-- item -->
 *   <li>{image}{caption}</li>                   one picture, {image} once, {caption} at most once
 *
 * Other HTML comments are left out. The folder sits outside the component on purpose: the package
 * never writes or deletes anything there, so edited templates survive upgrades and uninstalls
 * (the install resolver only adds the default files that are missing).
 *
 * Only *.html files with a template name (latin letters, digits, "_" and "-") inside core_path or
 * base_path are read, at most 50 of them and 64 KB each. The markup is data for the editor, which
 * removes scripts and event handlers from it like from any template.
 */
class TemplateFiles
{
    public const DEFAULT_PATH = '{core_path}elements/tiptapeditor/gallery/';

    private const MAX_FILES = 50;
    private const MAX_BYTES = 65536;

    /** @var string[] */
    public array $errors = [];

    /**
     * @param string[] $roots allowed directories (core_path, base_path)
     * @param array<string, string> $placeholders {core_path}, {base_path}, {assets_path}
     */
    public function __construct(private array $roots, private array $placeholders)
    {
    }

    /** The folder of a setting value: placeholders filled in, relative paths from base_path. */
    public function folder(string $setting): string
    {
        $path = strtr(trim($setting), $this->placeholders);
        if ($path !== '' && !preg_match('~^(/|[A-Za-z]:[\\\\/])~', $path)) {
            $path = rtrim($this->placeholders['{base_path}'] ?? '', '/\\') . '/' . $path;
        }

        return $path === '' ? '' : rtrim($path, '/\\') . '/';
    }

    /**
     * Templates of the folder, by name. A missing folder is no error: there are just no files.
     *
     * @param callable(string): string $label label of a file without "<!-- label: … -->"
     * @return array<string, array{label: string, wrapper: string, item: string}>
     */
    public function load(string $setting, callable $label): array
    {
        $folder = $this->folder($setting);
        $real = $folder === '' ? false : realpath($folder);
        if ($real === false || !is_dir($real)) {
            return [];
        }
        if (!$this->isInsideRoots($real)) {
            $this->errors[] = 'gallery_templates_path: the folder must be inside core_path or base_path';

            return [];
        }
        $files = glob($real . DIRECTORY_SEPARATOR . '*.html') ?: [];
        sort($files);
        $templates = [];
        foreach (array_slice($files, 0, self::MAX_FILES) as $file) {
            $name = basename($file, '.html');
            if (!preg_match('/^[a-z][a-z0-9_-]*$/i', $name) || !is_file($file) || !is_readable($file)) {
                continue;
            }
            if (filesize($file) > self::MAX_BYTES) {
                $this->errors[] = "gallery template file $name.html skipped: larger than 64 KB";
                continue;
            }
            $template = self::parse((string)file_get_contents($file));
            if ($template === null) {
                $this->errors[] = "gallery template file $name.html skipped: needs <!-- item --> between the outer markup and the item";
                continue;
            }
            $templates[$name] = [
                'label' => $template['label'] !== '' ? $template['label'] : $label($name),
                'wrapper' => $template['wrapper'],
                'item' => $template['item'],
            ];
        }
        if (count($files) > self::MAX_FILES) {
            $this->errors[] = 'gallery_templates_path: only the first ' . self::MAX_FILES . ' files are read';
        }

        return $templates;
    }

    /**
     * One template file: label, outer markup and item markup, or null without "<!-- item -->".
     *
     * @return array{label: string, wrapper: string, item: string}|null
     */
    public static function parse(string $html): ?array
    {
        $html = preg_replace('/^\xEF\xBB\xBF/', '', $html) ?? $html;
        $label = preg_match('/<!--\s*label:\s*(.*?)\s*-->/su', $html, $match) ? trim($match[1]) : '';
        $parts = preg_split('/<!--\s*item\b.*?-->/isu', $html);
        if (!is_array($parts) || count($parts) !== 2) {
            return null;
        }
        [$wrapper, $item] = array_map(
            static fn (string $part): string => trim(preg_replace('/<!--.*?-->/su', '', $part) ?? ''),
            $parts,
        );

        return $wrapper === '' || $item === '' ? null : ['label' => $label, 'wrapper' => $wrapper, 'item' => $item];
    }

    private function isInsideRoots(string $real): bool
    {
        foreach ($this->roots as $root) {
            $rootReal = realpath($root);
            if ($rootReal !== false && str_starts_with($real . DIRECTORY_SEPARATOR, rtrim($rootReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)) {
                return true;
            }
        }

        return false;
    }
}
