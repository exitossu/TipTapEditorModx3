<?php

/**
 * TipTapEditor connector. Requests go through the standard MODX connector bootstrap,
 * which validates the manager session and the modAuth token; each processor checks
 * its own permissions.
 *
 * @var \MODX\Revolution\modX $modx
 */

if (file_exists(dirname(__FILE__, 4) . '/config.core.php')) {
    require_once dirname(__FILE__, 4) . '/config.core.php';
} else {
    require_once dirname(__FILE__, 5) . '/config.core.php';
}
require_once MODX_CORE_PATH . 'config/' . MODX_CONFIG_KEY . '.inc.php';
require_once MODX_CONNECTORS_PATH . 'index.php';

/** @var \TipTapEditor\TipTapEditor $tiptapeditor */
$tiptapeditor = $modx->services->get('tiptapeditor');
$tiptapeditor->loadLexicon();

$modx->getRequest();
$modx->request->handleRequest([
    'processors_path' => $tiptapeditor->getOption('processorsPath'),
    'location' => '',
]);
