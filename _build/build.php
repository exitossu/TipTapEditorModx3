<?php

/**
 * TipTapEditor transport package builder (based on ModExtra3).
 *
 * CLI:  MODX_CORE_PATH=/path/to/core/ php _build/build.php [--install]
 * Web:  /Extras/TipTapEditor/_build/build.php[?install=1][&download=1]
 *
 * Run "npm run build" first: the package ships assets/components/tiptapeditor/dist.
 */

use MODX\Revolution\modCategory;
use MODX\Revolution\modPlugin;
use MODX\Revolution\modPluginEvent;
use MODX\Revolution\modSystemSetting;
use MODX\Revolution\modX;
use MODX\Revolution\Transport\modPackageBuilder;
use MODX\Revolution\Transport\modTransportPackage;
use xPDO\Transport\xPDOTransport;
use xPDO\xPDO;

class TipTapEditorPackage
{
    private modX $modx;
    private array $config;
    private modCategory $category;
    private array $categoryAttributes;
    public modPackageBuilder $builder;

    public function __construct(modX $modx, array $config)
    {
        $this->modx = $modx;
        $this->modx->initialize('mgr');

        $root = dirname(__DIR__) . '/';
        $this->config = array_merge([
            'root' => $root,
            'build' => $root . '_build/',
            'elements' => $root . '_build/elements/',
            'resolvers' => $root . '_build/resolvers/',
            'core' => $root . 'core/components/' . $config['name_lower'] . '/',
            'assets' => $root . 'assets/components/' . $config['name_lower'] . '/',
        ], $config);

        $this->modx->setLogLevel($this->config['log_level']);
        $this->modx->setLogTarget($this->config['log_target']);

        $this->checkSources();
        $this->initialize();
    }

    public function process(): modPackageBuilder
    {
        $this->settings();
        $this->plugins();

        $vehicle = $this->builder->createVehicle($this->category, $this->categoryAttributes);
        $vehicle->resolve('file', [
            'source' => $this->config['core'],
            'target' => "return MODX_CORE_PATH . 'components/';",
        ]);
        $vehicle->resolve('file', [
            'source' => $this->config['assets'],
            'target' => "return MODX_ASSETS_PATH . 'components/';",
        ]);
        foreach (scandir($this->config['resolvers']) as $resolver) {
            if (in_array($resolver[0], ['_', '.'], true)) {
                continue;
            }
            if ($vehicle->resolve('php', ['source' => $this->config['resolvers'] . $resolver])) {
                $this->modx->log(modX::LOG_LEVEL_INFO, 'Added resolver ' . basename($resolver, '.php'));
            }
        }
        $this->builder->putVehicle($vehicle);

        $this->builder->setPackageAttributes([
            'changelog' => file_get_contents($this->config['core'] . 'docs/changelog.txt'),
            'license' => file_get_contents($this->config['core'] . 'docs/license.txt'),
            'readme' => file_get_contents($this->config['core'] . 'docs/readme.txt'),
            'requires' => [
                'php' => '>=8.0',
                'modx' => '>=3.0.0',
            ],
        ]);

        $this->modx->log(modX::LOG_LEVEL_INFO, 'Packing up transport package zip...');
        $this->builder->pack();
        $this->modx->log(modX::LOG_LEVEL_INFO, 'Built ' . $this->builder->getSignature() . '.transport.zip');

        if (!empty($this->config['install'])) {
            $this->install();
        }

        return $this->builder;
    }

    /**
     * Refuse to build a package with a missing bundle or mismatching versions.
     */
    private function checkSources(): void
    {
        $version = $this->config['version'] . '-' . $this->config['release'];
        $service = file_get_contents($this->config['core'] . 'src/TipTapEditor.php');
        if (!preg_match("/const VERSION = '([^']+)'/", $service, $m) || $m[1] !== $version) {
            $this->fail('TipTapEditor::VERSION (' . ($m[1] ?? '?') . ') does not match package.json (' . $version . ').');
        }
        foreach (['tiptapeditor.js', 'tiptapeditor.css'] as $file) {
            if (!is_file($this->config['assets'] . 'dist/' . $file)) {
                $this->fail('dist/' . $file . ' is missing. Run "npm run build" first.');
            }
        }
    }

    private function fail(string $message): void
    {
        $this->modx->log(modX::LOG_LEVEL_ERROR, $message);
        exit(1);
    }

    private function initialize(): void
    {
        $this->builder = new modPackageBuilder($this->modx);
        $this->builder->createPackage($this->config['name_lower'], $this->config['version'], $this->config['release']);
        $this->builder->registerNamespace(
            $this->config['name_lower'],
            false,
            true,
            '{core_path}components/' . $this->config['name_lower'] . '/',
            '{assets_path}components/' . $this->config['name_lower'] . '/'
        );

        $this->category = $this->modx->newObject(modCategory::class);
        $this->category->set('category', $this->config['name']);
        $this->categoryAttributes = [
            xPDOTransport::UNIQUE_KEY => 'category',
            xPDOTransport::PRESERVE_KEYS => false,
            xPDOTransport::UPDATE_OBJECT => true,
            xPDOTransport::RELATED_OBJECTS => true,
            xPDOTransport::RELATED_OBJECT_ATTRIBUTES => [],
        ];
        $this->modx->log(modX::LOG_LEVEL_INFO, 'Created package, namespace and category.');
    }

    /**
     * System settings: keys "tiptapeditor.{name}". Existing values are kept on upgrade.
     */
    private function settings(): void
    {
        $settings = include $this->config['elements'] . 'settings.php';
        $attributes = [
            xPDOTransport::UNIQUE_KEY => 'key',
            xPDOTransport::PRESERVE_KEYS => true,
            xPDOTransport::UPDATE_OBJECT => !empty($this->config['update']['settings']),
            xPDOTransport::RELATED_OBJECTS => false,
        ];
        foreach ($settings as $name => $data) {
            $value = $data['value'];
            if (is_bool($value)) {
                $value = $value ? '1' : '0';
            }
            /** @var modSystemSetting $setting */
            $setting = $this->modx->newObject(modSystemSetting::class);
            $setting->fromArray([
                'key' => $this->config['name_lower'] . '.' . $name,
                'value' => (string)$value,
                'xtype' => $data['xtype'],
                'namespace' => $this->config['name_lower'],
                'area' => $data['area'],
            ], '', true, true);
            $this->builder->putVehicle($this->builder->createVehicle($setting, $attributes));
        }
        $this->modx->log(modX::LOG_LEVEL_INFO, 'Packaged in ' . count($settings) . ' system settings.');
    }

    private function plugins(): void
    {
        $plugins = include $this->config['elements'] . 'plugins.php';
        $this->categoryAttributes[xPDOTransport::RELATED_OBJECT_ATTRIBUTES]['Plugins'] = [
            xPDOTransport::UNIQUE_KEY => 'name',
            xPDOTransport::PRESERVE_KEYS => false,
            xPDOTransport::UPDATE_OBJECT => !empty($this->config['update']['plugins']),
            xPDOTransport::RELATED_OBJECTS => true,
            xPDOTransport::RELATED_OBJECT_ATTRIBUTES => [
                'PluginEvents' => [
                    xPDOTransport::PRESERVE_KEYS => true,
                    xPDOTransport::UPDATE_OBJECT => true,
                    xPDOTransport::UNIQUE_KEY => ['pluginid', 'event'],
                ],
            ],
        ];
        $objects = [];
        foreach ($plugins as $name => $data) {
            $file = 'core/components/' . $this->config['name_lower'] . '/elements/plugins/' . $data['file'] . '.php';
            /** @var modPlugin $plugin */
            $plugin = $this->modx->newObject(modPlugin::class);
            $plugin->fromArray([
                'name' => $name,
                'description' => $data['description'] ?? '',
                'plugincode' => $this->getFileContent($this->config['root'] . $file),
                'static' => !empty($this->config['static']['plugins']),
                'source' => 1,
                'static_file' => $file,
            ], '', true, true);

            $events = [];
            foreach ($data['events'] ?? [] as $eventName => $eventData) {
                /** @var modPluginEvent $event */
                $event = $this->modx->newObject(modPluginEvent::class);
                $event->fromArray(array_merge([
                    'event' => $eventName,
                    'priority' => 0,
                    'propertyset' => 0,
                ], $eventData), '', true, true);
                $events[] = $event;
            }
            $plugin->addMany($events);
            $objects[] = $plugin;
        }
        $this->category->addMany($objects);
        $this->modx->log(modX::LOG_LEVEL_INFO, 'Packaged in ' . count($objects) . ' plugin(s).');
    }

    /**
     * Element code without the opening tag, as MODX stores it.
     */
    private function getFileContent(string $filename): string
    {
        $content = trim((string)file_get_contents($filename));

        return trim(preg_replace('#^<\?php#', '', $content));
    }

    private function install(): void
    {
        $signature = $this->builder->getSignature();
        $sig = explode('-', $signature);
        $versionParts = explode('.', $sig[1]);

        /** @var modTransportPackage $package */
        $package = $this->modx->getObject(modTransportPackage::class, ['signature' => $signature]);
        if (!$package) {
            $package = $this->modx->newObject(modTransportPackage::class);
            $package->set('signature', $signature);
            $package->fromArray([
                'created' => date('Y-m-d H:i:s'),
                'updated' => null,
                'state' => 1,
                'workspace' => 1,
                'provider' => 0,
                'source' => $signature . '.transport.zip',
                'package_name' => $this->config['name'],
                'version_major' => $versionParts[0],
                'version_minor' => $versionParts[1] ?? 0,
                'version_patch' => $versionParts[2] ?? 0,
            ]);
            if (!empty($sig[2])) {
                $r = preg_split('#([0-9]+)#', $sig[2], -1, PREG_SPLIT_DELIM_CAPTURE);
                $package->set('release', $r[0] ?? $sig[2]);
                $package->set('release_index', $r[1] ?? '0');
            }
            $package->save();
        }
        if ($package->install()) {
            $this->modx->runProcessor('System/ClearCache');
            $this->modx->log(modX::LOG_LEVEL_INFO, 'Installed ' . $signature);
        } else {
            $this->fail('Could not install ' . $signature);
        }
    }
}

$config = require __DIR__ . '/config.inc.php';
require_once MODX_CORE_PATH . 'vendor/autoload.php';

$modx = new modX();
$builder = (new TipTapEditorPackage($modx, $config))->process();

if (!empty($config['download'])) {
    $name = $builder->getSignature() . '.transport.zip';
    $content = file_get_contents(MODX_CORE_PATH . 'packages/' . $name);
    if ($content !== false) {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename=' . $name);
        header('Content-Length: ' . strlen($content));
        exit($content);
    }
}
