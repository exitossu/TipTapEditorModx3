<?php
/**
 * Test helper: prepares a MODX site in $M for the e2e checks.
 * Creates richtext TVs "rt_one" and "rt_two" on the default template and test resources.
 * Prints JSON with the created IDs.
 */
define('MODX_API_MODE', true);
require getenv('M') . '/index.php';
$modx->initialize('mgr');

use MODX\Revolution\modResource;
use MODX\Revolution\modTemplate;
use MODX\Revolution\modTemplateVar;
use MODX\Revolution\modTemplateVarTemplate;
use MODX\Revolution\modAccessContext;
use MODX\Revolution\modAccessResourceGroup;
use MODX\Revolution\modContext;
use MODX\Revolution\modResourceGroup;
use MODX\Revolution\modResourceGroupResource;
use MODX\Revolution\modAccessPolicy;
use MODX\Revolution\modUser;
use MODX\Revolution\modUserGroup;
use MODX\Revolution\modUserGroupMember;
use MODX\Revolution\modUserGroupRole;
use MODX\Revolution\modUserProfile;
use MODX\Revolution\Sources\modFileMediaSource;
use MODX\Revolution\Sources\modMediaSourceElement;

$template = (int)$modx->getOption('default_template');
$tvs = [];
foreach (['rt_one', 'rt_two'] as $i => $name) {
    $tv = $modx->getObject(modTemplateVar::class, ['name' => $name]) ?: $modx->newObject(modTemplateVar::class);
    $tv->fromArray(['name' => $name, 'caption' => $name, 'type' => 'richtext', 'rank' => $i]);
    $tv->save();
    if (!$modx->getObject(modTemplateVarTemplate::class, ['tmplvarid' => $tv->get('id'), 'templateid' => $template])) {
        $link = $modx->newObject(modTemplateVarTemplate::class);
        $link->fromArray(['tmplvarid' => $tv->get('id'), 'templateid' => $template, 'rank' => $i], '', true, true);
        $link->save();
    }
    $tvs[$name] = $tv->get('id');
}

// A second template that only has rt_two, for the template switch check.
$alt = $modx->getObject(modTemplate::class, ['templatename' => 'E2E alt']) ?: $modx->newObject(modTemplate::class);
$alt->fromArray(['templatename' => 'E2E alt', 'content' => '[[*content]]']);
$alt->save();
if (!$modx->getObject(modTemplateVarTemplate::class, ['tmplvarid' => $tvs['rt_two'], 'templateid' => $alt->get('id')])) {
    $link = $modx->newObject(modTemplateVarTemplate::class);
    $link->fromArray(['tmplvarid' => $tvs['rt_two'], 'templateid' => $alt->get('id'), 'rank' => 0], '', true, true);
    $link->save();
}

// Files for the Media Browser checks, and a second Media Source (assets/e2e/) for rt_two.
$dir = MODX_ASSETS_PATH . 'e2e/';
@mkdir($dir . 'img', 0775, true);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
file_put_contents($dir . 'img/pic.png', $png);
// pic2.png is 64 x 48, so the image dialog has a natural size to offer.
$chunk = static fn (string $type, string $data): string => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
$rows = str_repeat("\0" . str_repeat("\x33\x99\xcc", 64), 48);
file_put_contents($dir . 'img/pic2.png', "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNCCCCC', 64, 48, 8, 2, 0, 0, 0))
    . $chunk('IDAT', gzcompress($rows)) . $chunk('IEND', ''));
file_put_contents($dir . 'price.pdf', '%PDF-1.4 e2e');
$source = $modx->getObject(modFileMediaSource::class, ['name' => 'E2E files']) ?: $modx->newObject(modFileMediaSource::class);
$source->fromArray(['name' => 'E2E files', 'class_key' => modFileMediaSource::class]);
$source->setProperties(['basePath' => 'assets/e2e/', 'baseUrl' => 'assets/e2e/']);
$source->save();
$modx->removeCollection(modMediaSourceElement::class, ['object' => $tvs['rt_two'], 'object_class' => modTemplateVar::class]);
$link = $modx->newObject(modMediaSourceElement::class);
$link->fromArray(['source' => $source->get('id'), 'object' => $tvs['rt_two'], 'object_class' => modTemplateVar::class, 'context_key' => 'web'], '', true, true);
$link->save();

// A manager user without file_manager (policy "Content Editor"): file buttons must be disabled.
$group = $modx->getObject(modUserGroup::class, ['name' => 'E2E Editors']) ?: $modx->newObject(modUserGroup::class);
$group->set('name', 'E2E Editors');
$group->save();
$role = $modx->getObject(modUserGroupRole::class, ['authority' => 9999]);
foreach (['mgr' => 'Content Editor', 'web' => 'Resource'] as $ctx => $policyName) {
    $policy = $modx->getObject(modAccessPolicy::class, ['name' => $policyName]);
    $acl = $modx->getObject(modAccessContext::class, ['target' => $ctx, 'principal' => $group->get('id'), 'principal_class' => modUserGroup::class])
        ?: $modx->newObject(modAccessContext::class);
    $acl->fromArray(['target' => $ctx, 'principal_class' => modUserGroup::class, 'principal' => $group->get('id'), 'authority' => 9999, 'policy' => $policy->get('id')]);
    $acl->save();
}
$editor = $modx->getObject(modUser::class, ['username' => 'e2e_editor']);
if (!$editor) {
    $editor = $modx->newObject(modUser::class);
    $editor->set('username', 'e2e_editor');
    $profile = $modx->newObject(modUserProfile::class);
    $profile->fromArray(['email' => 'e2e_editor@example.com', 'fullname' => 'E2E editor']);
    $editor->addOne($profile);
}
$editor->set('password', 'editor12345');
$editor->set('active', 1);
$editor->save();
if (!$modx->getObject(modUserGroupMember::class, ['user_group' => $group->get('id'), 'member' => $editor->get('id')])) {
    $member = $modx->newObject(modUserGroupMember::class);
    $member->fromArray(['user_group' => $group->get('id'), 'member' => $editor->get('id'), 'role' => $role->get('id')]);
    $member->save();
}
$editor->set('primary_group', $group->get('id'));
$editor->save();

$resources = [];
$fixtures = [
    'plain' => "<h2>Title</h2>\n<p>Hello   <b>world</b> and <a href=\"/news/\" class=\"button\">news</a>.</p>\n<ul><li>one</li><li>two</li></ul>",
    'modx' => '<p>[[*pagetitle]] and [[!snippet? &a=`1`]]</p>',
    'unsupported' => '<div class="box"><p>inside a div</p></div>',
    'norichtext' => '<p>Rich text is off</p>',
    'images' => '<p>Intro <img src="assets/e2e/img/pic.png" alt="Pic" title="T" width="40" height="30" class="lead align-left" id="pic" '
        . 'data-fancybox="gallery" loading="lazy" srcset="assets/e2e/img/pic2.png 2x" style="border: 0"> end</p>',
    'imagebad' => '<p><img src="assets/e2e/img/pic.png" onerror="alert(1)"></p>',
    'tables' => "<p>Prices</p>\n<table class=\"table\" data-x=\"1\">\n<thead><tr><th>Name</th><th>Price</th></tr></thead>\n"
        . "<tbody><tr><td>Tea</td><td align=\"right\">10</td></tr><tr><td>Coffee</td><td align=\"right\">12</td></tr></tbody>\n"
        . "<tfoot><tr><td colspan=\"2\">Total</td></tr></tfoot>\n</table>\n<p>After</p>",
    'tablebad' => '<table><caption>Caption</caption><tr><td>a</td></tr></table>',
    // Stage 10: MODX/Fenom syntax (the acceptance fixture of the spec, section 47).
    'syntax' => rtrim(file_get_contents(__DIR__ . '/../fixtures/mixed-content.html')),
    'fenomtable' => "<p>Rows</p>\n<table class=\"list\">\n{foreach \$rows as \$row}\n<tr><td>{\$row.name}</td><td>[[+price:default=`0`]]</td></tr>\n{/foreach}\n</table>",
    'syntaxtype' => '<p>Start</p>',
    // Stage 12: attributes of ordinary elements, class presets, content CSS.
    'article' => rtrim(file_get_contents(__DIR__ . '/../fixtures/article.html')),
    // Stage 12b: menus, slash commands, autocomplete, paste, embeds, uploads.
    'assist' => '<p>Some text to format.</p>',
    'iframe' => rtrim(file_get_contents(__DIR__ . '/../fixtures/iframe.html')),
    // Figures with captions, lightbox links and galleries.
    'figure' => rtrim(file_get_contents(__DIR__ . '/figure.html')),
    'gallery' => '<p>Gallery below.</p>',
];
foreach ($fixtures as $alias => $content) {
    $r = $modx->getObject(modResource::class, ['alias' => 'e2e-' . $alias]) ?: $modx->newObject(modResource::class);
    $r->fromArray([
        'pagetitle' => 'E2E ' . $alias, 'alias' => 'e2e-' . $alias, 'context_key' => 'web',
        'template' => $template, 'published' => 1, 'richtext' => (int)($alias !== 'norichtext'), 'content' => $content,
    ]);
    $r->save();
    foreach ($tvs as $name => $id) {
        $r->setTVValue($name, in_array($alias, ['plain', 'norichtext'], true) ? "<p>$name value</p>" : '');
    }
    // Drop edit locks left by earlier runs (another test user may have opened the resource).
    $lockedBy = $r->getLock();
    if ($lockedBy) {
        $r->removeLock($lockedBy);
    }
    $resources[$alias] = $r->get('id');
}
// Link search: a resource hidden by a resource group (only Administrator may see it) and a
// resource in a second context.
$hidden = $modx->getObject(modResource::class, ['alias' => 'e2e-secret']) ?: $modx->newObject(modResource::class);
$hidden->fromArray(['pagetitle' => 'E2E secret', 'alias' => 'e2e-secret', 'context_key' => 'web', 'template' => $template, 'published' => 1]);
$hidden->save();
$rg = $modx->getObject(modResourceGroup::class, ['name' => 'E2E Hidden']) ?: $modx->newObject(modResourceGroup::class);
$rg->set('name', 'E2E Hidden');
$rg->save();
if (!$modx->getObject(modResourceGroupResource::class, ['document_group' => $rg->get('id'), 'document' => $hidden->get('id')])) {
    $link = $modx->newObject(modResourceGroupResource::class);
    $link->fromArray(['document_group' => $rg->get('id'), 'document' => $hidden->get('id')], '', true, true);
    $link->save();
}
$resourcePolicy = $modx->getObject(modAccessPolicy::class, ['name' => 'Resource']);
foreach (['web', 'mgr'] as $ctx) {
    $acl = $modx->getObject(modAccessResourceGroup::class, ['target' => $rg->get('id'), 'principal' => 1, 'context_key' => $ctx])
        ?: $modx->newObject(modAccessResourceGroup::class);
    $acl->fromArray(['target' => $rg->get('id'), 'principal_class' => modUserGroup::class, 'principal' => 1, 'authority' => 9999,
        'policy' => $resourcePolicy->get('id'), 'context_key' => $ctx]);
    $acl->save();
}
$ctx = $modx->getObject(modContext::class, 'e2eother') ?: $modx->newObject(modContext::class);
$ctx->set('key', 'e2eother');
$ctx->set('name', 'E2E other');
$ctx->save();
$other = $modx->getObject(modResource::class, ['alias' => 'e2e-other-ctx']) ?: $modx->newObject(modResource::class);
$other->fromArray(['pagetitle' => 'E2E other context', 'alias' => 'e2e-other-ctx', 'context_key' => 'e2eother', 'template' => $template, 'published' => 1]);
$other->save();
$resources['secret'] = $hidden->get('id');
$resources['other'] = $other->get('id');

// Elements for the autocomplete check.
$chunk = $modx->getObject(\MODX\Revolution\modChunk::class, ['name' => 'e2eHeader']) ?: $modx->newObject(\MODX\Revolution\modChunk::class);
$chunk->fromArray(['name' => 'e2eHeader', 'description' => 'E2E header chunk', 'snippet' => '<header>E2E</header>']);
$chunk->save();

$modx->getCacheManager()->refresh();
echo json_encode(['source' => $source->get('id'), 'templates' => ['default' => $template, 'alt' => $alt->get('id')], 'tvs' => $tvs, 'resources' => $resources, 'fixtures' => $fixtures]);
