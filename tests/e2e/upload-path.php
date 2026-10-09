<?php
/**
 * Test helper for placeholders in tiptapeditor.upload_path / upload_file_prefix:
 *   php upload-path.php
 * Checks TipTapEditor\Media\UploadPath and the Image/UploadFolder processor against the MODX
 * site in $M (a parent and a child resource are created and removed again). Prints "ok"/"FAIL".
 */

use MODX\Revolution\modResource;
use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modX;
use TipTapEditor\Media\UploadPath;
use TipTapEditor\Processors\Image\UploadFolder;

define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');
$modx->user = $modx->getObject(\MODX\Revolution\modUser::class, ['username' => getenv('MODX_USER') ?: 'admin']);
$modx->user->addSessionContext('mgr');
$modx->setLogLevel(modX::LOG_LEVEL_FATAL);

$failed = 0;
function check(string $name, bool $ok, string $details = ''): void
{
    global $failed;
    echo ($ok ? 'ok  ' : 'FAIL') . ' ' . $name . ($ok || $details === '' ? '' : ' -> ' . $details) . "\n";
    $failed += $ok ? 0 : 1;
}

// UploadPath on its own.
$time = mktime(14, 5, 9, 3, 7, 2026);
$paths = new UploadPath(['id' => 15, 'pid' => 3, 'alias' => 'my-page', 'palias' => 'news', 'context' => 'web', 'tid' => '', 'uid' => 1], 8, $time);
check('every placeholder is filled in', $paths->folder('a/{context}/{palias}/{pid}/{alias}-{id}/{uid}/{y}/{m}/{d}/{h}{i}{s}/{t}/') === "a/web/news/3/my-page-15/1/2026/03/07/140509/{$time}/",
    $paths->folder('a/{context}/{palias}/{pid}/{alias}-{id}/{uid}/{y}/{m}/{d}/{h}{i}{s}/{t}/'));
check('an empty value removes its folder level ({tid} of the content field)', $paths->folder('assets/uploads/{tid}/') === 'assets/uploads/');
check('{rand} has the configured length', (bool)preg_match('#^r/[a-z0-9]{8}/$#', $paths->folder('r/{rand}/')), $paths->folder('r/{rand}/'));
check('literal ".." and leading slashes are dropped', $paths->folder('/../assets/./x/') === 'assets/x/', $paths->folder('/../assets/./x/'));
$evil = new UploadPath(['id' => 1, 'alias' => '../../core/config', 'palias' => 'a/b\\c'], 6, $time);
check('a value cannot add or leave folders', $evil->folder('assets/{alias}/{palias}/') === 'assets/.-.-core-config/a-b-c/', $evil->folder('assets/{alias}/{palias}/'));
check('the name prefix has no slashes and keeps its own dashes', $evil->prefix('{alias}_') === '-.-core-config_' && $paths->prefix('{id}-') === '15-', $evil->prefix('{alias}_'));
$new = new UploadPath(['id' => 0, 'pid' => 3], 6, $time);
$error = '';
try {
    $new->folder('assets/{id}/');
} catch (RuntimeException $e) {
    $error = $e->getMessage();
}
check('{id} of a new resource asks to save first', $error === UploadPath::ERR_SAVE_FIRST, $error);
check('{pid} works for a new resource', $new->folder('assets/{pid}/') === 'assets/3/');

// The processor, with real resources.
$set = function (string $key, string $value) use ($modx) {
    $setting = $modx->getObject(modSystemSetting::class, $key);
    $setting->set('value', $value);
    $setting->save();
    $modx->config[$key] = $value;
};
$parent = $modx->newObject(modResource::class);
$parent->fromArray(['pagetitle' => 'E2E upload parent', 'alias' => 'e2e-upload-parent', 'context_key' => 'web', 'published' => 0]);
$parent->save();
$child = $modx->newObject(modResource::class);
$child->fromArray(['pagetitle' => 'E2E upload child', 'alias' => 'e2e-upload-child', 'parent' => $parent->get('id'), 'context_key' => 'web', 'published' => 0]);
$child->save();

$set('tiptapeditor.upload_enabled', '1');
$set('tiptapeditor.upload_path', 'assets/e2e-uploads/{palias}/{alias}/{y}/');
$set('tiptapeditor.upload_file_prefix', '{id}-');
$run = fn (array $props) => $modx->runProcessor(UploadFolder::class, $props + ['source' => 1, 'wctx' => 'web']);

$response = $run(['resource' => $child->get('id'), 'tv' => '']);
$object = $response->getObject();
check('UploadFolder fills in the saved resource', !$response->isError() && $object['path'] === 'assets/e2e-uploads/e2e-upload-parent/e2e-upload-child/' . date('Y') . '/'
    && $object['prefix'] === $child->get('id') . '-', json_encode($response->getResponse()));
$response = $run(['resource' => 0, 'parent' => $parent->get('id')]);
check('UploadFolder refuses {alias}/{id} for a new resource', $response->isError() && str_contains((string)$response->getMessage(), 'Save'), json_encode($response->getResponse()));
$set('tiptapeditor.upload_enabled', '0');
check('UploadFolder needs upload_enabled', $run(['resource' => $child->get('id')])->isError());

$set('tiptapeditor.upload_path', 'assets/uploads/');
$set('tiptapeditor.upload_file_prefix', '');
$child->remove();
$parent->remove();
exit($failed ? 1 : 0);
