<?php

/**
 * TipTapEditor plugin: dispatches the current event to its handler class.
 * No business logic here; see core/components/tiptapeditor/src/Plugins/Events/.
 *
 * @var \MODX\Revolution\modX $modx
 * @var array $scriptProperties
 */

$event = $modx->event->name;
$class = 'TipTapEditor\\Plugins\\Events\\' . $event;

if (!$modx->services->has('tiptapeditor') || !class_exists($class) || !is_subclass_of($class, \TipTapEditor\Plugins\Plugin::class)) {
    $modx->log(\MODX\Revolution\modX::LOG_LEVEL_ERROR, 'No handler for event ' . $event, '', 'TipTapEditor');

    return;
}

try {
    (new $class($modx, $modx->services->get('tiptapeditor'), $scriptProperties))->run();
} catch (\Throwable $e) {
    // An editor failure must never break the manager page: MODX falls back to the textarea.
    $modx->log(\MODX\Revolution\modX::LOG_LEVEL_ERROR, $event . ': ' . $e->getMessage(), '', 'TipTapEditor');
}

return;
