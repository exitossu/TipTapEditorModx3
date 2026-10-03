<?php

/**
 * install: TipTapEditor becomes the editor of the site.
 *   The system setting which_editor is set to TipTapEditor and use_editor to 1, so the editor
 *   works right after installation. The previous values are written to the install log.
 *   Context, user group and user settings are left alone: they were chosen on purpose.
 *
 * install and upgrade: which_editor values that still name the editor by its old name
 *   ("Tiptap RTE", the extra was called TiptapRTE before 0.1.0-alpha16) are switched to
 *   TipTapEditor, in system, context, user group and user settings.
 *
 * Nothing else is changed: tiptapeditor.* settings are created with their defaults on install
 * and kept on upgrade, resource content and TV values are never touched.
 *
 * @var xPDOTransport $transport
 * @var array $options
 */

use MODX\Revolution\modContextSetting;
use MODX\Revolution\modNamespace;
use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modUserGroupSetting;
use MODX\Revolution\modUserSetting;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

$action = $options[xPDOTransport::PACKAGE_ACTION] ?? null;
if (!$transport->xpdo || !in_array($action, [xPDOTransport::ACTION_INSTALL, xPDOTransport::ACTION_UPGRADE], true)) {
    return true;
}

$modx = $transport->xpdo;
$editorName = 'TipTapEditor';
$oldName = 'Tiptap RTE';

$renamed = 0;
foreach ([modSystemSetting::class, modContextSetting::class, modUserGroupSetting::class, modUserSetting::class] as $class) {
    foreach ($modx->getIterator($class, ['key' => 'which_editor', 'value' => $oldName]) as $setting) {
        $setting->set('value', $editorName);
        $setting->save();
        $renamed++;
    }
}
if ($renamed) {
    $modx->log(xPDO::LOG_LEVEL_INFO, "TipTapEditor: which_editor \"{$oldName}\" renamed to \"{$editorName}\" in {$renamed} place(s).");
}

if ($action === xPDOTransport::ACTION_INSTALL) {
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
}

if ($modx->getObject(modNamespace::class, 'tiptaprte')) {
    $modx->log(xPDO::LOG_LEVEL_WARN, 'TipTapEditor: the old TiptapRTE package is still installed. It is not used any more: uninstall it in the package manager.');
}

$modx->getCacheManager()->refresh();

return true;
