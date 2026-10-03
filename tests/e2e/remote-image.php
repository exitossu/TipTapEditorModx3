<?php
/**
 * Test helper for "image by URL": php remote-image.php <base URL of the test site>
 * Checks TipTapEditor\Media\RemoteImage (address rules, type and size checks) and the
 * Image/Import processor against the MODX site in $M. The test site runs on 127.0.0.1, which
 * the real downloader refuses, so the download checks use a subclass that only lifts the
 * address rule. Prints "ok"/"FAIL" lines like the browser checks.
 */

use MODX\Revolution\modX;
use TipTapEditor\Media\RemoteImage;
use TipTapEditor\Processors\Image\Import;

define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');
$modx->user = $modx->getObject(\MODX\Revolution\modUser::class, ['username' => getenv('MODX_USER') ?: 'admin']);
$modx->user->addSessionContext('mgr');
$modx->setLogLevel(modX::LOG_LEVEL_FATAL);
$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');

$failed = 0;
function check(string $name, bool $ok, string $details = ''): void
{
    global $failed;
    echo ($ok ? 'ok  ' : 'FAIL') . ' ' . $name . ($ok || $details === '' ? '' : ' -> ' . $details) . "\n";
    $failed += $ok ? 0 : 1;
}

function error(RemoteImage $remote, string $url): string
{
    try {
        $remote->fetch($url);

        return 'downloaded';
    } catch (RuntimeException $e) {
        return $e->getMessage();
    }
}

/** Lets the test site on 127.0.0.1:8080 through; every other rule stays. */
class LoopbackImage extends RemoteImage
{
    protected function check(string $url): array
    {
        $parts = parse_url($url);
        if (($parts['host'] ?? '') === '127.0.0.1') {
            return ['127.0.0.1', (int)($parts['port'] ?? 80), '127.0.0.1'];
        }

        return parent::check($url);
    }
}

$remote = new RemoteImage(1048576);
$private = ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1',
    'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '224.0.0.1', '255.255.255.255'];
$blocked = array_filter($private, fn ($ip) => $remote->isPublicAddress($ip));
check('internal, private and reserved addresses are refused', !$blocked, implode(', ', $blocked));
check('public addresses are allowed', $remote->isPublicAddress('93.184.215.14') && $remote->isPublicAddress('2606:2800:21f:cb07:6820:80da:af6b:8b2c'));

$cases = [
    'http://127.0.0.1/a.png' => RemoteImage::ERR_HOST,
    'http://localhost/a.png' => RemoteImage::ERR_HOST,
    'http://[::1]/a.png' => RemoteImage::ERR_HOST,
    'http://169.254.169.254/latest/meta-data/' => RemoteImage::ERR_HOST,
    'http://2130706433/a.png' => RemoteImage::ERR_HOST,
    'https://example.com:8443/a.png' => RemoteImage::ERR_HOST,
    'ftp://example.com/a.png' => RemoteImage::ERR_URL,
    'file:///etc/passwd' => RemoteImage::ERR_URL,
    'https://user:pass@example.com/a.png' => RemoteImage::ERR_URL,
    "https://example.com/a\nb.png" => RemoteImage::ERR_URL,
    'javascript:alert(1)' => RemoteImage::ERR_URL,
];
foreach ($cases as $url => $expected) {
    $got = error($remote, $url);
    check('refused before any request: ' . json_encode($url), $got === $expected, $got);
}

// A redirect endpoint on the test site for the duration of the checks.
$redirect = getenv('M') . '/tiptapeditor-e2e-redirect.php';
file_put_contents($redirect, '<?php header("Location: " . $_GET["to"], true, 302);');
register_shutdown_function(fn () => @unlink($redirect));

$loop = new LoopbackImage(1048576);
$image = $loop->fetch($base . '/assets/e2e/img/pic.png');
check('downloads a real image and detects its type by content', $image['extension'] === 'png' && $image['name'] === 'pic'
    && $image['content'] === file_get_contents(getenv('M') . '/assets/e2e/img/pic.png'));
check('an HTML page is not an image', error($loop, $base . '/manager/') === RemoteImage::ERR_TYPE);
check('a missing file is a download error', error($loop, $base . '/assets/e2e/img/none.png') === RemoteImage::ERR_DOWNLOAD);
check('bigger than the limit is refused while downloading', error(new LoopbackImage(10), $base . '/assets/e2e/img/pic.png') === RemoteImage::ERR_SIZE);
check('redirect to an internal address is refused', error($loop, $base . '/tiptapeditor-e2e-redirect.php?to=' . rawurlencode('http://10.0.0.1/a.png')) === RemoteImage::ERR_HOST);
check('safe file names', preg_match('/^foto-otpuska-1-[0-9a-f]{6}\.jpg$/', RemoteImage::fileName('Фото Отпуска (1)', 'jpg'))
    && preg_match('/^image-[0-9a-f]{6}\.png$/', RemoteImage::fileName('../..', 'png')));

// The processor with the loopback downloader: stored in upload_path of the Media Source.
class LoopbackImport extends Import
{
    protected function downloader(int $maxBytes): RemoteImage
    {
        return new LoopbackImage($maxBytes);
    }
}
$run = function (array $properties) use ($modx) {
    $response = $modx->runProcessor(LoopbackImport::class, $properties);

    return ['success' => !$response->isError(), 'message' => $response->getMessage(), 'object' => $response->getObject()];
};
$path = (string)$modx->getOption('tiptapeditor.upload_path');
$result = $run(['source' => 1, 'url' => $base . '/assets/e2e/img/pic.png', 'wctx' => 'web']);
$name = $result['object']['name'] ?? '';
check('Image/Import stores the image in upload_path of the source', !empty($result['success']) && preg_match('/^pic-[0-9a-f]{6}\.png$/', $name)
    && ($result['object']['path'] ?? '') === $path && is_file(getenv('M') . '/' . $path . $name), json_encode($result));

$modx->setOption('tiptapeditor.upload_enabled', false);
$result = $run(['source' => 1, 'url' => $base . '/assets/e2e/img/pic.png']);
check('Image/Import is refused while upload_enabled is off', empty($result['success']), json_encode($result));
$modx->setOption('tiptapeditor.upload_enabled', true);

echo $failed ? "\n{$failed} check(s) failed\n" : "\nall checks passed\n";
exit($failed ? 1 : 0);
