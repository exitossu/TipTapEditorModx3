<?php

/**
 * Build configuration.
 *
 * MODX_CORE_PATH is taken from the environment when set (CLI builds against any site),
 * otherwise found by walking up from this folder (ModExtra3 layout: {site}/Extras/TipTapEditor).
 * The version comes from package.json so the PHP service, the JS bundle and the transport
 * package always carry the same version.
 */

if (!defined('MODX_CORE_PATH')) {
    $corePath = getenv('MODX_CORE_PATH') ?: '';
    if ($corePath === '') {
        $path = __DIR__;
        while (!file_exists($path . '/core/config/config.inc.php') && strlen($path) > 1) {
            $path = dirname($path);
        }
        $corePath = $path . '/core/';
    }
    define('MODX_CORE_PATH', rtrim($corePath, '/\\') . '/');
}

$package = json_decode((string)file_get_contents(dirname(__DIR__) . '/package.json'), true);

return [
    'name' => 'TipTapEditor',
    'name_lower' => 'tiptapeditor',
    'version' => $package['version'],
    'release' => $package['modx']['release'] ?? 'pl',
    // Install the package into the site right after the build
    'install' => !empty($_REQUEST['install']) || in_array('--install', $GLOBALS['argv'] ?? [], true),
    // What an upgrade may overwrite. User settings are never reset.
    'update' => [
        'plugins' => true,
        'settings' => false,
    ],
    'static' => [
        'plugins' => false,
    ],
    'log_level' => !empty($_REQUEST['download']) ? 0 : 3,
    'log_target' => php_sapi_name() === 'cli' ? 'ECHO' : 'HTML',
    'download' => !empty($_REQUEST['download']),
];
