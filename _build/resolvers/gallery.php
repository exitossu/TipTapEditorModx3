<?php

/**
 * install and upgrade: the folder of the gallery template files (tiptapeditor.gallery_templates_path,
 * by default {core_path}elements/tiptapeditor/gallery/) is created when missing, and the default
 * templates (grid.html, slider.html, images.html from core/components/tiptapeditor/elements/gallery/)
 * are copied there only when a file of that name is not there yet. Files in the folder are never
 * overwritten or deleted, also not on uninstall: they are the site's own templates.
 *
 * upgrade from 0.1.0-alpha20 and older: templates of the removed system setting
 * tiptapeditor.gallery_templates (JSON) are moved into the folder first, one <name>.html each, so
 * they keep working and win over the default files. A name that already has a file there is saved
 * as <name>.from-setting.html instead (not loaded, nothing overwritten). The setting's whole value
 * is kept in gallery_templates-setting.json in the folder, then the setting is removed.
 *
 * @var xPDOTransport $transport
 * @var array $options
 */

use MODX\Revolution\modSystemSetting;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

$action = $options[xPDOTransport::PACKAGE_ACTION] ?? null;
if (!$transport->xpdo || !in_array($action, [xPDOTransport::ACTION_INSTALL, xPDOTransport::ACTION_UPGRADE], true)) {
    return true;
}

$modx = $transport->xpdo;
$corePath = (string)$modx->getOption('core_path', null, MODX_CORE_PATH);
$basePath = (string)$modx->getOption('base_path', null, MODX_BASE_PATH);
$setting = $modx->getObject(modSystemSetting::class, 'tiptapeditor.gallery_templates_path');
$value = trim($setting ? (string)$setting->get('value') : '{core_path}elements/tiptapeditor/gallery/');
if ($value === '') {
    return true;
}
$folder = strtr($value, [
    '{core_path}' => $corePath,
    '{base_path}' => $basePath,
    '{assets_path}' => (string)$modx->getOption('assets_path', null, MODX_ASSETS_PATH),
]);
if (!preg_match('~^(/|[A-Za-z]:[\\\\/])~', $folder)) {
    $folder = rtrim($basePath, '/\\') . '/' . $folder;
}
$folder = rtrim($folder, '/\\') . '/';
$defaults = $corePath . 'components/tiptapeditor/elements/gallery/';

if (!is_dir($folder) && !@mkdir($folder, 0755, true) && !is_dir($folder)) {
    $modx->log(xPDO::LOG_LEVEL_WARN, "TipTapEditor: could not create the gallery template folder {$value}. The built-in templates are used.");

    return true;
}
$old = $modx->getObject(modSystemSetting::class, 'tiptapeditor.gallery_templates');
if ($old) {
    $json = trim((string)$old->get('value'));
    $moved = [];
    if ($json !== '') {
        file_put_contents($folder . 'gallery_templates-setting.json', $json . "\n");
        $templates = json_decode($json, true);
        foreach (is_array($templates) ? $templates : [] as $name => $template) {
            if (!is_string($name) || !preg_match('/^[a-z][a-z0-9_-]*$/i', $name) || !is_array($template)
                || !is_string($template['wrapper'] ?? null) || !is_string($template['item'] ?? null)) {
                continue;
            }
            $label = trim(str_replace('--', '-', (string)($template['label'] ?? '')));
            $file = $folder . $name . (file_exists($folder . $name . '.html') ? '.from-setting.html' : '.html');
            $html = ($label !== '' ? "<!-- label: {$label} -->\n" : '')
                . "<!-- Moved from the system setting tiptapeditor.gallery_templates. -->\n"
                . $template['wrapper'] . "\n<!-- item -->\n" . $template['item'] . "\n";
            if (!file_exists($file) && file_put_contents($file, $html) !== false) {
                $moved[] = basename($file);
            }
        }
    }
    $old->remove();
    $modx->log(xPDO::LOG_LEVEL_INFO, 'TipTapEditor: the setting tiptapeditor.gallery_templates was removed'
        . ($moved ? '; its templates are now files in ' . $value . ': ' . implode(', ', $moved) : '')
        . ($json !== '' ? '; its value is kept in gallery_templates-setting.json there' : '') . '.');
}

$added = [];
foreach (glob($defaults . '*.html') ?: [] as $file) {
    $target = $folder . basename($file);
    if (!file_exists($target) && @copy($file, $target)) {
        $added[] = basename($file);
    }
}
if ($added) {
    $modx->log(xPDO::LOG_LEVEL_INFO, 'TipTapEditor: gallery templates added to ' . $value . ': ' . implode(', ', $added) . '.');
}

return true;
