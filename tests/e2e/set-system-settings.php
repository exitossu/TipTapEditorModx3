<?php
/**
 * Test helper: php set-system-settings.php key value [key value ...]
 * Updates system settings of the MODX site in $M (site root) and refreshes the cache.
 */
define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');
for ($i = 1; $i + 1 < $argc; $i += 2) {
    $s = $modx->getObject(MODX\Revolution\modSystemSetting::class, $argv[$i]);
    $s->set('value', $argv[$i + 1]); $s->save();
}
$modx->getCacheManager()->refresh();
