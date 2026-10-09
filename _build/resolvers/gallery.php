<?php

/**
 * install and upgrade: the folder of the gallery template files (tiptapeditor.gallery_templates_path,
 * by default {core_path}elements/tiptapeditor/gallery/) is created when missing, and the default
 * templates (grid.html, slider.html, images.html from core/components/tiptapeditor/elements/gallery/)
 * are copied there only when a file of that name is not there yet. Files in the folder are never
 * overwritten or deleted, also not on uninstall: they are the site's own templates.
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
