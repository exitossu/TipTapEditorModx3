<?php

namespace TipTapEditor\Processors\Setting;

use MODX\Revolution\modSystemSetting;
use MODX\Revolution\Processors\Processor;

/**
 * System setting keys for autocomplete ([[++site_name]], {$_modx->config.site_name}).
 *
 * Needs the "settings" permission (the one the System Settings page needs). Only keys and
 * their namespace are returned: never values, which may hold passwords or API keys.
 * Loaded with the model layer, no raw SQL.
 *
 * Properties: query (2+ characters of the key), limit (1..30).
 * Result rows: key, namespace.
 */
class Search extends Processor
{
    private const MAX_LIMIT = 30;

    public function checkPermissions(): bool
    {
        return $this->modx->hasPermission('settings');
    }

    public function getLanguageTopics(): array
    {
        return ['tiptapeditor:default'];
    }

    public function process()
    {
        $query = trim((string)$this->getProperty('query', ''));
        if (mb_strlen($query) < 2 || mb_strlen($query) > 100) {
            return $this->outputArray([], 0);
        }
        $limit = max(1, min(self::MAX_LIMIT, (int)$this->getProperty('limit', 15)));

        $c = $this->modx->newQuery(modSystemSetting::class);
        $c->select($this->modx->getSelectColumns(modSystemSetting::class, 'modSystemSetting', '', ['key', 'namespace']));
        $c->where(['key:LIKE' => '%' . addcslashes($query, '%_\\') . '%']);
        $c->sortby('key', 'ASC');
        $c->limit($limit * 3);

        $results = [];
        foreach ($this->modx->getIterator(modSystemSetting::class, $c) as $setting) {
            $results[] = ['key' => (string)$setting->get('key'), 'namespace' => (string)$setting->get('namespace')];
        }
        $lower = mb_strtolower($query);
        usort($results, function (array $a, array $b) use ($lower): int {
            $startsA = str_starts_with(mb_strtolower($a['key']), $lower);
            $startsB = str_starts_with(mb_strtolower($b['key']), $lower);

            return $startsA === $startsB ? strcmp($a['key'], $b['key']) : ($startsA ? -1 : 1);
        });
        $results = array_slice($results, 0, $limit);

        return $this->outputArray($results, count($results));
    }
}
