<?php

/**
 * install: TipTapEditor becomes the editor of the site.
 *   The system setting which_editor is set to TipTapEditor and use_editor to 1, so the editor
 *   works right after installation. The previous values are written to the install log.
 *   Context, user group and user settings are left alone: they were chosen on purpose.
 *
 * Nothing else is changed: tiptapeditor.* settings are created with their defaults on install
 * and kept on upgrade, resource content and TV values are never touched.
 *
 * @var xPDOTransport $transport
 * @var array $options
 */

use MODX\Revolution\modSystemSetting;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

$action = $options[xPDOTransport::PACKAGE_ACTION] ?? null;
if (!$transport->xpdo || $action !== xPDOTransport::ACTION_INSTALL) {
    return true;
}

$modx = $transport->xpdo;
$editorName = 'TipTapEditor';
foreach (['which_editor' => $editorName, 'use_editor' => '1'] as $key => $value) {
    $setting = $modx->getObject(modSystemSetting::class, $key);
    if (!$setting) {
        $setting = $modx->newObject(modSystemSetting::class);
        $setting->fromArray(['key' => $key, 'namespace' => 'core', 'area' => 'editor', 'xtype' => $key === 'use_editor' ? 'combo-boolean' : 'modx-combo-rte'], '', true);
    }
    $previous = (string)$setting->get('value');
    if ($previous === $value) {
        continue;
    }
    $setting->set('value', $value);
    if ($setting->save()) {
        $modx->log(xPDO::LOG_LEVEL_INFO, "TipTapEditor: system setting {$key} changed from \"{$previous}\" to \"{$value}\".");
    }
}

$modx->getCacheManager()->refresh();

return true;
