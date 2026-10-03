<?php
/**
 * Test helper: php read-resource.php <id> -> JSON {content, tvs: {name: value}} straight from the database.
 */
define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');

$resource = $modx->getObject(MODX\Revolution\modResource::class, (int)$argv[1]);
if (!$resource) {
    exit(json_encode(null));
}
$tvs = [];
foreach ($modx->getIterator(MODX\Revolution\modTemplateVarResource::class, ['contentid' => $resource->get('id')]) as $row) {
    $tv = $modx->getObject(MODX\Revolution\modTemplateVar::class, $row->get('tmplvarid'));
    $tvs[$tv->get('name')] = $row->get('value');
}
echo json_encode(['content' => $resource->get('content'), 'template' => $resource->get('template'), 'tvs' => $tvs]);
