<?php
/**
 * Test helper for gallery template files:
 *   php gallery-templates.php
 * Checks TipTapEditor\Gallery\TemplateFiles and the install resolver (_build/resolvers/gallery.php)
 * against the MODX site in $M: the default templates are in the folder of
 * tiptapeditor.gallery_templates_path, an upgrade adds missing files and never overwrites edited
 * ones. The site's template files are restored at the end. Prints "ok"/"FAIL".
 */

use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modX;
use TipTapEditor\Gallery\TemplateFiles;
use TipTapEditor\TipTapEditor;
use xPDO\Transport\xPDOTransport;

define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');
$modx->setLogLevel(modX::LOG_LEVEL_FATAL);

$failed = 0;
function check(string $name, bool $ok, string $details = ''): void
{
    global $failed;
    echo ($ok ? 'ok  ' : 'FAIL') . ' ' . $name . ($ok || $details === '' ? '' : ' -> ' . $details) . "\n";
    $failed += $ok ? 0 : 1;
}

$core = $modx->getOption('core_path');
$placeholders = ['{core_path}' => $core, '{base_path}' => $modx->getOption('base_path'), '{assets_path}' => $modx->getOption('assets_path')];
$files = new TemplateFiles([$core, $modx->getOption('base_path')], $placeholders);
$folder = $files->folder((string)$modx->getOption('tiptapeditor.gallery_templates_path'));

check('the setting points to core/elements/tiptapeditor/gallery/', $folder === $core . 'elements/tiptapeditor/gallery/', $folder);
check('installation put the default templates there', is_file($folder . 'grid.html') && is_file($folder . 'slider.html') && is_file($folder . 'images.html'));

$parsed = TemplateFiles::parse("<!-- notes {items} -->\n<!-- label: Карточки -->\n<ul class=\"cards\">{items}</ul>\n<!-- item: one card -->\n<li>{image}{caption}</li>\n");
check('a template file is read: label, outer markup, item; other comments left out',
    $parsed === ['label' => 'Карточки', 'wrapper' => '<ul class="cards">{items}</ul>', 'item' => '<li>{image}{caption}</li>'], json_encode($parsed, JSON_UNESCAPED_UNICODE));
check('a file without <!-- item --> is no template', TemplateFiles::parse('<div class="x">{items}</div>') === null);

$label = fn (string $name): string => $name;
$loaded = $files->load('{core_path}elements/tiptapeditor/gallery/', $label);
check('the default templates load', isset($loaded['grid'], $loaded['slider'], $loaded['images'])
    && $loaded['grid']['wrapper'] === '<div class="gallery">{items}</div>', json_encode(array_keys($loaded)));
$outside = new TemplateFiles([$core . 'components/'], $placeholders);
check('a folder outside the allowed roots is not read', $outside->load('{core_path}elements/tiptapeditor/gallery/', $label) === [] && $outside->errors);
check('a missing folder is no error', $files->load('{core_path}elements/tiptapeditor/missing/', $label) === []);

$service = new TipTapEditor($modx);
$config = $service->getGalleryTemplateFiles();
check('the editor config carries the files, built-in names with their lexicon label',
    ($config['grid']['label'] ?? '') === 'gallery_template_grid', json_encode($config['grid'] ?? null));

// The resolver: missing files are added, edited ones stay.
$backup = [];
foreach (glob($folder . '*.html') as $file) {
    $backup[$file] = file_get_contents($file);
}
file_put_contents($folder . 'grid.html', "<div class=\"my-grid\">{items}</div>\n<!-- item -->\n<p>{image}</p>\n");
unlink($folder . 'images.html');
$transport = new stdClass();
$transport->xpdo = $modx;
$options = [xPDOTransport::PACKAGE_ACTION => xPDOTransport::ACTION_UPGRADE];
(function () use ($transport, $options) {
    return include dirname(__DIR__, 2) . '/_build/resolvers/gallery.php';
})();
check('an upgrade keeps an edited template', str_contains((string)file_get_contents($folder . 'grid.html'), 'my-grid'));
check('an upgrade adds a missing default template', is_file($folder . 'images.html'));

// Upgrade from 0.1.0-alpha20: the JSON setting becomes files, then goes away.
$old = $modx->newObject(modSystemSetting::class);
$old->fromArray(['key' => 'tiptapeditor.gallery_templates', 'namespace' => 'tiptapeditor', 'xtype' => 'textarea', 'area' => 'tiptapeditor.content',
    'value' => json_encode(['cards' => ['label' => 'Карточки', 'wrapper' => '<ul class="cards">{items}</ul>', 'item' => '<li>{image}</li>'],
        'grid' => ['wrapper' => '<div class="old-grid">{items}</div>', 'item' => '{image}']], JSON_UNESCAPED_UNICODE)], '', true);
$old->save();
(function () use ($transport, $options) {
    return include dirname(__DIR__, 2) . '/_build/resolvers/gallery.php';
})();
$cards = TemplateFiles::parse((string)@file_get_contents($folder . 'cards.html'));
check('templates of the old JSON setting become files', ($cards['label'] ?? '') === 'Карточки' && ($cards['wrapper'] ?? '') === '<ul class="cards">{items}</ul>', json_encode($cards, JSON_UNESCAPED_UNICODE));
check('an existing file is not overwritten by a moved template', str_contains((string)file_get_contents($folder . 'grid.html'), 'my-grid')
    && str_contains((string)@file_get_contents($folder . 'grid.from-setting.html'), 'old-grid'));
check('the old setting value is kept as a file and the setting is removed', is_file($folder . 'gallery_templates-setting.json')
    && !$modx->getObject(modSystemSetting::class, 'tiptapeditor.gallery_templates'));
foreach (['cards.html', 'grid.from-setting.html', 'gallery_templates-setting.json'] as $file) {
    @unlink($folder . $file);
}

foreach ($backup as $file => $content) {
    file_put_contents($file, $content);
}

echo $failed ? "\n{$failed} check(s) failed\n" : "\nall checks passed\n";
exit($failed ? 1 : 0);
