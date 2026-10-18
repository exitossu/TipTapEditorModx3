<?php

/**
 * install and upgrade: settings removed in 0.1.0-alpha22 keep their effect.
 *
 * Values of removed settings that differ from their defaults are written into the external JSON
 * config (tiptapeditor.external_config; {core_path}config/tiptapeditor.json is created and set
 * when it is empty), as the configuration keys profiles use. Keys the file already has are not
 * changed and a copy of the previous file is kept as <file>.bak. Some values move into the
 * remaining settings instead:
 *   - enable_fullscreen = no: "fullscreen" is removed from tiptapeditor.toolbar;
 *   - autogrow = no: min_height and max_height both become the old fixed height;
 *   - protect_fenom_syntax / fenom_autocomplete: the new setting tiptapeditor.fenom;
 *   - upload_rand_length: {rand} in upload_path and upload_file_prefix becomes {rand:N};
 *   - default_profile / content_profile: that profile is copied under the name "default" /
 *     "content" when no profile of that name exists.
 * A toolbar equal to the old default toolbar is emptied, so it follows the package's toolbar.
 * Settings that moved to another area get their new area. Then the removed system settings are
 * deleted; context, user group and user settings with their keys are listed in the log (they no
 * longer have an effect) and left alone.
 *
 * @var xPDOTransport $transport
 * @var array $options
 */

use MODX\Revolution\modContextSetting;
use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modUserGroupSetting;
use MODX\Revolution\modUserSetting;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

$action = $options[xPDOTransport::PACKAGE_ACTION] ?? null;
if (!$transport->xpdo || !in_array($action, [xPDOTransport::ACTION_INSTALL, xPDOTransport::ACTION_UPGRADE], true)) {
    return true;
}

$modx = $transport->xpdo;
$prefix = 'tiptapeditor.';
$log = static fn (string $message, int $level = xPDO::LOG_LEVEL_INFO) => $modx->log($level, 'TipTapEditor: ' . $message);
$corePath = (string)$modx->getOption('core_path', null, MODX_CORE_PATH);
$basePath = (string)$modx->getOption('base_path', null, MODX_BASE_PATH);

$oldToolbar = 'undo redo | heading | bold italic underline strike code | color highlight | superscript subscript'
    . ' | align | bulletList orderedList | blockquote horizontalRule | link modxLink anchor | image gallery file table embed'
    . ' | codeBlock | clearFormatting | source fullscreen';
$removed = [
    'default_profile', 'content_profile', 'heading_levels', 'bubble_menu', 'floating_menu', 'slash_commands',
    'statusbar', 'sticky_toolbar', 'enable_fullscreen', 'default_height', 'autogrow', 'enable_tables',
    'enable_images', 'enable_iframe', 'enable_gallery', 'iframe_allowed_attributes', 'paste_as_text',
    'lightbox_label', 'preserve_style_attribute', 'protect_modx_syntax', 'protect_fenom_syntax',
    'fenom_autocomplete', 'modx_autocomplete', 'upload_rand_length',
];

/** @var array<string, modSystemSetting> $settings */
$settings = [];
foreach ($modx->getIterator(modSystemSetting::class, ['namespace' => 'tiptapeditor']) as $setting) {
    $settings[substr((string)$setting->get('key'), strlen($prefix))] = $setting;
}
$value = static fn (string $key): ?string => isset($settings[$key]) ? trim((string)$settings[$key]->get('value')) : null;
$bool = static function (?string $raw, bool $default): bool {
    if ($raw === null || $raw === '') {
        return $default;
    }

    return !in_array(strtolower($raw), ['0', 'false', 'no', 'off'], true);
};
$set = static function (string $key, string $new) use (&$settings, $log): void {
    if (isset($settings[$key]) && (string)$settings[$key]->get('value') !== $new) {
        $settings[$key]->set('value', $new);
        $settings[$key]->save();
        $log("{$key} set to \"{$new}\".");
    }
};

// 1. Values for the external config.
$json = [];
$plain = [
    'heading_levels' => ['headingLevels', '1,2,3,4,5,6'],
    'bubble_menu' => ['bubbleMenu', true],
    'floating_menu' => ['floatingMenu', true],
    'slash_commands' => ['slashCommands', true],
    'statusbar' => ['statusbar', false],
    'sticky_toolbar' => ['stickyToolbar', true],
    'iframe_allowed_attributes' => ['iframeAllowedAttributes', 'src,width,height,allow,allowfullscreen,loading,title,name,referrerpolicy,frameborder,class,id,style'],
    'paste_as_text' => ['pasteAsText', false],
    'lightbox_label' => ['lightboxLabel', ''],
    'preserve_style_attribute' => ['preserveStyleAttribute', true],
    'protect_modx_syntax' => ['protectModxSyntax', true],
    'modx_autocomplete' => ['modxAutocomplete', true],
];
foreach ($plain as $key => [$jsKey, $default]) {
    $raw = $value($key);
    if ($raw === null) {
        continue;
    }
    if (is_bool($default)) {
        if ($bool($raw, $default) !== $default) {
            $json[$jsKey] = !$default;
        }
    } elseif ($raw !== '' && preg_replace('/\s+/', '', $raw) !== preg_replace('/\s+/', '', $default)) {
        $json[$jsKey] = $jsKey === 'headingLevels' ? array_values(array_map('intval', array_filter(preg_split('/\s*,\s*/', $raw)))) : $raw;
    }
}
foreach (['enable_tables' => 'tables', 'enable_images' => 'images', 'enable_iframe' => 'iframe', 'enable_gallery' => 'gallery'] as $key => $feature) {
    if (!$bool($value($key), true)) {
        $json['features'][$feature] = false;
    }
}

// 2. Values that move into remaining settings.
$toolbar = $value('toolbar');
if ($toolbar !== null) {
    $normalize = static fn (string $text): string => trim((string)preg_replace('/\s+/', ' ', $text));
    if ($normalize($toolbar) === $normalize($oldToolbar)) {
        $toolbar = '';
    }
    if (!$bool($value('enable_fullscreen'), true)) {
        $items = $toolbar === '' ? $oldToolbar : $toolbar;
        $items = (string)preg_replace('/(^|\s)fullscreen(?=\s|$)/', ' ', $items);
        $toolbar = trim((string)preg_replace(['/\s+/', '/(\|\s*)+\|/'], [' ', '|'], $items), ' |');
    }
    $set('toolbar', $toolbar);
}
if ($value('autogrow') !== null && !$bool($value('autogrow'), true)) {
    $height = max((int)($value('default_height') ?: 300), (int)($value('min_height') ?: 200));
    $set('min_height', (string)$height);
    $set('max_height', (string)$height);
}
if ($value('protect_fenom_syntax') !== null || $value('fenom_autocomplete') !== null) {
    $protect = $bool($value('protect_fenom_syntax'), true);
    $set('fenom', !$protect ? '0' : ($bool($value('fenom_autocomplete'), false) ? '1' : 'auto'));
}
$randLength = (int)($value('upload_rand_length') ?? 6);
if ($randLength !== 6 && $randLength >= 1 && $randLength <= 32) {
    foreach (['upload_path', 'upload_file_prefix'] as $key) {
        if ($value($key) !== null && str_contains((string)$value($key), '{rand}')) {
            $set($key, str_replace('{rand}', '{rand:' . $randLength . '}', (string)$value($key)));
        }
    }
}

// 3. default_profile / content_profile become the profiles "default" / "content".
$aliases = [];
foreach (['default_profile' => 'default', 'content_profile' => 'content'] as $key => $alias) {
    $name = (string)$value($key);
    if ($name !== '' && $name !== $alias) {
        $aliases[$alias] = [$key, $name];
    }
}
if ($aliases && $value('profiles') !== null && $value('profiles') !== '') {
    $profiles = json_decode((string)$value('profiles'), true);
    if (is_array($profiles)) {
        $changed = false;
        foreach ($aliases as $alias => [, $name]) {
            if (isset($profiles[$name]) && !isset($profiles[$alias])) {
                $profiles[$alias] = $profiles[$name];
                $changed = true;
                unset($aliases[$alias]);
                $log("the profile \"{$name}\" is now also the profile \"{$alias}\" (tiptapeditor.profiles).");
            }
        }
        if ($changed) {
            $set('profiles', (string)json_encode($profiles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
    }
}

// 4. Write the external config.
$externalSetting = (string)$value('external_config');
$placeholders = [
    '{core_path}' => $corePath,
    '{base_path}' => $basePath,
    '{assets_path}' => (string)$modx->getOption('assets_path', null, MODX_ASSETS_PATH),
];
$resolve = static function (string $setting) use ($placeholders, $basePath): string {
    $path = strtr($setting, $placeholders);

    return preg_match('~^(/|[A-Za-z]:[\\\\/])~', $path) ? $path : rtrim($basePath, '/\\') . '/' . $path;
};
$file = $externalSetting !== '' ? $resolve($externalSetting) : $corePath . 'config/tiptapeditor.json';
$data = [];
$readable = true;
if (is_file($file)) {
    $data = json_decode((string)file_get_contents($file), true);
    $readable = is_array($data) && strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'json';
    $data = $readable ? $data : [];
}
foreach ($aliases as $alias => [$key, $name]) {
    if (isset($data['profiles'][$name]) && !isset($data['profiles'][$alias])) {
        $json['profiles'][$alias] = $data['profiles'][$name];
        $log("the profile \"{$name}\" is now also the profile \"{$alias}\" (external config).");
    } else {
        $log("tiptapeditor.{$key} pointed to the profile \"{$name}\", which was not found; name your profile \"{$alias}\" to apply it.", xPDO::LOG_LEVEL_WARN);
    }
}
if ($json) {
    $added = [];
    foreach ($json as $key => $item) {
        if (in_array($key, ['features', 'profiles'], true)) {
            foreach ($item as $name => $sub) {
                if (!isset($data[$key][$name])) {
                    $data[$key][$name] = $sub;
                    $added[] = "{$key}.{$name}";
                }
            }
        } elseif (!array_key_exists($key, $data)) {
            $data[$key] = $item;
            $added[] = $key;
        }
    }
    if (!$readable) {
        // Never overwrite a file that is not a JSON object: the values go next to it.
        $file = preg_replace('/(\.json)?$/i', '', $file) . '.migrated.json';
        $log("the external config is not a JSON object; the values of removed settings were written to {$file} instead. Copy them into your config.", xPDO::LOG_LEVEL_WARN);
    } elseif (is_file($file)) {
        @copy($file, $file . '.bak');
    }
    $folder = dirname($file);
    $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    if ((is_dir($folder) || @mkdir($folder, 0755, true)) && file_put_contents($file, $encoded) !== false) {
        if ($externalSetting === '' && isset($settings['external_config'])) {
            $set('external_config', '{core_path}config/tiptapeditor.json');
        }
        $log('values of removed settings moved to ' . $file . ': ' . implode(', ', $added) . '.');
    } else {
        $log('could not write ' . $file . '. Values of removed settings: ' . json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), xPDO::LOG_LEVEL_ERROR);
    }
}

// 5. New areas of moved settings.
$schema = $corePath . 'components/tiptapeditor/src/Config/Settings.php';
// The class may be loaded already (autoloader, or the build when it installs right away).
if (class_exists(\TipTapEditor\Config\Settings::class) || (is_file($schema) && require_once $schema)) {
    foreach (\TipTapEditor\Config\Settings::all() as $key => $definition) {
        if (isset($settings[$key]) && $settings[$key]->get('area') !== $definition['area']) {
            $settings[$key]->set('area', $definition['area']);
            $settings[$key]->save();
        }
    }
}

// 6. Remove the old settings.
$deleted = [];
foreach ($removed as $key) {
    if (isset($settings[$key]) && $settings[$key]->remove()) {
        $deleted[] = $key;
    }
}
if ($deleted) {
    $log('removed settings: ' . implode(', ', $deleted) . '. See the changelog for where each one went.');
}
$keys = array_map(static fn (string $key): string => $prefix . $key, $removed);
foreach ([modContextSetting::class => 'context_key', modUserGroupSetting::class => 'group', modUserSetting::class => 'user'] as $class => $owner) {
    foreach ($modx->getIterator($class, ['key:IN' => $keys]) as $override) {
        $log(sprintf(
            '%s setting %s of %s "%s" no longer has an effect; set it in a profile or the external config.',
            substr(strrchr($class, '\\'), 1),
            $override->get('key'),
            $owner,
            $override->get($owner)
        ), xPDO::LOG_LEVEL_WARN);
    }
}

$modx->getCacheManager()->refresh();

return true;
