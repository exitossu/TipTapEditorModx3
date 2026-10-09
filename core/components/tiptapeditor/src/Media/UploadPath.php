<?php

namespace TipTapEditor\Media;

use RuntimeException;

/**
 * Placeholders in tiptapeditor.upload_path and tiptapeditor.upload_file_prefix:
 *
 *   {id} {pid} {alias} {palias}   resource and parent resource
 *   {context} {tid} {uid}         context key, TV id (empty for the content field), user id
 *   {rand}                        random string, tiptapeditor.upload_rand_length characters
 *   {t} {y} {m} {d} {h} {i} {s}   timestamp, year, month, day, hour, minute, second
 *
 * The template comes from a system setting; the values may come from content (an alias), so a
 * value can never add a folder level or leave the upload folder: "/", "\" and other unsafe
 * characters in a value become "-", "." and ".." segments are dropped, empty segments vanish.
 * {id} and {alias} need a saved resource (ERR_SAVE_FIRST otherwise).
 */
class UploadPath
{
    public const ERR_SAVE_FIRST = 'upload_save_first';

    /** Placeholders that only exist once the resource is saved. */
    private const NEED_SAVED = ['{id}', '{alias}'];

    /**
     * @param array{id?: int, pid?: int, alias?: string, palias?: string, context?: string, tid?: int, uid?: int} $values
     */
    public function __construct(private array $values, private int $randLength = 6, private ?int $time = null)
    {
        $this->randLength = max(1, min(32, $randLength));
    }

    public static function needsSavedResource(string ...$templates): bool
    {
        foreach ($templates as $template) {
            foreach (self::NEED_SAVED as $placeholder) {
                if (str_contains($template, $placeholder)) {
                    return true;
                }
            }
        }

        return false;
    }

    /** The upload folder inside the Media Source: "a/b/" or "/" (no "..", no leading slash). */
    public function folder(string $template): string
    {
        $this->check($template);
        $parts = [];
        foreach (preg_split('#[\\\\/]+#', $template) ?: [] as $segment) {
            $segment = $this->replace($segment);
            if ($segment !== '' && $segment !== '.' && $segment !== '..') {
                $parts[] = $segment;
            }
        }

        return $parts ? implode('/', $parts) . '/' : '/';
    }

    /** File name prefix: letters, digits, "-", "_" and "." only, no slashes. */
    public function prefix(string $template): string
    {
        $this->check($template);

        $prefix = preg_replace('/[^\p{L}\p{N}_.-]+/u', '-', $this->replace($template)) ?? '';

        return ltrim(preg_replace('/\.{2,}/', '.', $prefix) ?? '', '.');
    }

    private function check(string $template): void
    {
        if (empty($this->values['id']) && self::needsSavedResource($template)) {
            throw new RuntimeException(self::ERR_SAVE_FIRST);
        }
    }

    private function replace(string $text): string
    {
        if (!str_contains($text, '{')) {
            return $text;
        }
        $time = $this->time ?? time();
        $map = [
            '{id}' => $this->values['id'] ?? '',
            '{pid}' => $this->values['pid'] ?? '',
            '{alias}' => $this->values['alias'] ?? '',
            '{palias}' => $this->values['palias'] ?? '',
            '{context}' => $this->values['context'] ?? '',
            '{tid}' => $this->values['tid'] ?? '',
            '{uid}' => $this->values['uid'] ?? '',
            '{rand}' => $this->random(),
            '{t}' => $time,
            '{y}' => date('Y', $time),
            '{m}' => date('m', $time),
            '{d}' => date('d', $time),
            '{h}' => date('H', $time),
            '{i}' => date('i', $time),
            '{s}' => date('s', $time),
        ];
        $safe = [];
        foreach ($map as $key => $value) {
            $safe[$key] = self::clean((string)($value === 0 || $value === '0' ? '0' : ($value ?: '')));
        }

        return strtr($text, $safe);
    }

    /** One value: letters, digits, "-", "_", "."; anything else (slashes included) becomes "-". */
    private static function clean(string $value): string
    {
        $value = preg_replace('/[^\p{L}\p{N}_.-]+/u', '-', $value) ?? '';

        return trim(preg_replace('/\.{2,}/', '.', $value) ?? '', '-');
    }

    private function random(): string
    {
        $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $out = '';
        for ($i = 0; $i < $this->randLength; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $out;
    }
}
