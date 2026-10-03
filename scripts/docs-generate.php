<?php

/**
 * Writes the generated pages of the documentation site: the changelog (from
 * core/components/tiptapeditor/docs/changelog.txt) and the system settings reference, from
 * _build/elements/settings.php (keys, types, defaults) and the setting lexicons (names and
 * descriptions), so the site never drifts from what the package installs.
 *
 *   php scripts/docs-generate.php   (npm run docs:generate, also run by docs:build)
 */

$root = dirname(__DIR__);
$settings = require $root . '/_build/elements/settings.php';

$pages = [
    'ru' => [
        'file' => '/docs/guide/settings.md',
        'title' => 'Системные настройки',
        'intro' => "Все настройки находятся в разделе «Системные настройки», пространство имён `tiptapeditor`. "
            . "Их можно переопределить в настройках контекста, группы пользователей или пользователя. "
            . "При обновлении пакета значения не сбрасываются.\n\n"
            . "::: tip\nСтраница собирается автоматически из исходников пакета (`npm run docs:generate`).\n:::",
        'head' => ['Ключ', 'Описание', 'По умолчанию'],
        'yes' => 'Да', 'no' => 'Нет', 'empty' => '(пусто)',
    ],
    'en' => [
        'file' => '/docs/en/guide/settings.md',
        'title' => 'System settings',
        'intro' => "All settings are under System Settings, namespace `tiptapeditor`. They can be overridden "
            . "in context, user group or user settings. Upgrades never reset their values.\n\n"
            . "::: tip\nThis page is generated from the package sources (`npm run docs:generate`).\n:::",
        'head' => ['Key', 'Description', 'Default'],
        'yes' => 'Yes', 'no' => 'No', 'empty' => '(empty)',
    ],
];

function cell(string $text): string
{
    $text = str_replace(["\r\n", "\n"], ' ', trim($text));
    $text = htmlspecialchars($text, ENT_NOQUOTES);
    // Keep {placeholders} literal for Vue, pipes inside the table.
    return str_replace(['|', '{{', '}}'], ['\\|', '&#123;&#123;', '&#125;&#125;'], $text);
}

foreach ($pages as $language => $page) {
    $_lang = [];
    include $root . "/core/components/tiptapeditor/lexicon/{$language}/setting.inc.php";
    $areas = [];
    foreach ($settings as $key => $setting) {
        $areas[$setting['area']][$key] = $setting;
    }
    $out = "---\noutline: [2, 2]\n---\n\n# {$page['title']}\n\n{$page['intro']}\n";
    foreach ($areas as $area => $items) {
        $out .= "\n## " . ($_lang['area_' . $area] ?? $area) . "\n\n";
        $out .= '| ' . implode(' | ', $page['head']) . " |\n|---|---|---|\n";
        foreach ($items as $key => $setting) {
            $value = $setting['value'];
            if (is_bool($value)) {
                $default = $value ? $page['yes'] : $page['no'];
            } elseif ((string)$value === '') {
                $default = $page['empty'];
            } else {
                $default = '<code>' . cell((string)$value) . '</code>';
            }
            $name = $_lang["setting_tiptapeditor.{$key}"] ?? '';
            $desc = $_lang["setting_tiptapeditor.{$key}_desc"] ?? '';
            $out .= "| <code>tiptapeditor.{$key}</code> | **" . cell($name) . '** ' . cell($desc) . " | {$default} |\n";
        }
    }
    file_put_contents($root . $page['file'], $out);
    echo "Wrote {$page['file']}\n";
}

// Changelog: "0.1.0-alpha16" lines become headings, list lines stay Markdown.
$lines = preg_split('/\R/', trim((string)file_get_contents($root . '/core/components/tiptapeditor/docs/changelog.txt')));
array_shift($lines); // "Changelog for TipTapEditor"
$body = '';
foreach ($lines as $line) {
    if (preg_match('/^\d+\.\d+\.\d+\S*$/', trim($line))) {
        $body .= "\n## " . trim($line) . "\n\n";
    } elseif (trim($line) !== '') {
        $body .= str_replace(['{{', '}}', '<'], ['&#123;&#123;', '&#125;&#125;', '&lt;'], rtrim($line)) . "\n";
    }
}
$changelogs = [
    ['/docs/changelog.md', 'История изменений', "\n::: info\nЖурнал изменений ведётся на английском, как в пакете.\n:::\n"],
    ['/docs/en/changelog.md', 'Changelog', ''],
];
foreach ($changelogs as [$file, $title, $note]) {
    file_put_contents($root . $file, "---\noutline: false\n---\n\n# {$title}\n{$note}{$body}");
    echo "Wrote {$file}\n";
}
