<?php

/**
 * install/upgrade: see install.php (which_editor is set to TipTapEditor on install).
 *
 * uninstall:
 *   1. wherever which_editor points to TipTapEditor (system, context, user group or user
 *      settings) it is reset to an empty value, so the manager falls back to the plain
 *      textarea instead of trying to load a missing editor;
 *   2. the plugin with its events, the tiptapeditor.* system settings and the namespace are
 *      removed explicitly (xPDO keeps objects that pre-existed the last install, which would
 *      leave a plugin pointing to deleted files after any reinstall). When the package manager
 *      reverts to a previous version (restore mode) nothing is removed.
 *   Resource content and TV values are never touched.
 *
 * @var xPDOTransport $transport
 * @var array $options
 */

use MODX\Revolution\modCategory;
use MODX\Revolution\modContextSetting;
use MODX\Revolution\modNamespace;
use MODX\Revolution\modPlugin;
use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modUserGroupSetting;
use MODX\Revolution\modUserSetting;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

if (!$transport->xpdo || ($options[xPDOTransport::PACKAGE_ACTION] ?? null) !== xPDOTransport::ACTION_UNINSTALL) {
    return true;
}

$modx = $transport->xpdo;
$editorName = 'TipTapEditor';
$namespace = 'tiptapeditor';

$reset = 0;
foreach ([modSystemSetting::class, modContextSetting::class, modUserGroupSetting::class, modUserSetting::class] as $class) {
    foreach ($modx->getIterator($class, ['key' => 'which_editor', 'value' => $editorName]) as $setting) {
        $setting->set('value', '');
        $setting->save();
        $reset++;
    }
}
if ($reset) {
    $modx->log(xPDO::LOG_LEVEL_WARN, "TipTapEditor: which_editor was set to {$editorName} in {$reset} place(s) and has been reset to the plain textarea.");
}

$restoring = (int)($options[xPDOTransport::PREEXISTING_MODE] ?? xPDOTransport::PRESERVE_PREEXISTING) === xPDOTransport::RESTORE_PREEXISTING;
if (!$restoring) {
    if ($plugin = $modx->getObject(modPlugin::class, ['name' => 'TipTapEditor'])) {
        $plugin->remove(); // removes its modPluginEvent rows too
    }
    $settings = $modx->removeCollection(modSystemSetting::class, ['namespace' => $namespace]);
    if ($ns = $modx->getObject(modNamespace::class, $namespace)) {
        $ns->remove();
    }
    $category = $modx->getObject(modCategory::class, ['category' => 'TipTapEditor']);
    if ($category && !$modx->getCount(modPlugin::class, ['category' => $category->get('id')])) {
        $category->remove();
    }
    $modx->log(xPDO::LOG_LEVEL_INFO, "TipTapEditor: removed plugin, {$settings} system settings and namespace.");
}

$modx->getCacheManager()->refresh();

return true;
