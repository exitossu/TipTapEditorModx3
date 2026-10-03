<?php

/**
 * Namespace bootstrap: loaded by MODX for every request.
 * Registers PSR-4 autoloading and the TipTapEditor service. Nothing else happens here,
 * so the extra costs nothing on pages where the editor is not used.
 *
 * @var \MODX\Revolution\modX $modx
 * @var array $namespace
 */

$modx::getLoader()->addPsr4('TipTapEditor\\', $namespace['path'] . 'src/');

if (!$modx->services->has('tiptapeditor')) {
    $modx->services->add('tiptapeditor', function () use ($modx) {
        return new \TipTapEditor\TipTapEditor($modx);
    });
}
