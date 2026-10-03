<?php

namespace TipTapEditor\Processors\Resource;

use MODX\Revolution\modContext;
use MODX\Revolution\modResource;
use MODX\Revolution\Processors\Processor;
use TipTapEditor\TipTapEditor;

/**
 * Resource search for the link dialog: id, pagetitle, longtitle, alias.
 *
 * Runs through the manager connector (session + modAuth). Resources are loaded with the
 * model layer, so resource group ACLs apply ("load"), and each result is checked for
 * "list" as well; no raw SQL. Contexts are limited to the given one unless
 * tiptapeditor.links_across_contexts is on, and to contexts the user may load.
 *
 * Properties: query (2+ characters, or a resource ID), context, limit (1..50).
 * Result rows: id, pagetitle, longtitle, context_key, uri, published.
 */
class Search extends Processor
{
    private const MAX_LIMIT = 50;

    public function checkPermissions(): bool
    {
        return $this->modx->hasPermission('view_document');
    }

    public function getLanguageTopics(): array
    {
        return ['tiptapeditor:default'];
    }

    public function process()
    {
        $query = trim((string)$this->getProperty('query', ''));
        $id = ctype_digit($query) ? (int)$query : 0;
        if ($id === 0 && mb_strlen($query) < 2) {
            return $this->outputArray([], 0);
        }
        $limit = max(1, min(self::MAX_LIMIT, (int)$this->getProperty('limit', 20)));

        $contexts = $this->getContexts((string)$this->getProperty('context', ''));
        if (!$contexts) {
            return $this->outputArray([], 0);
        }

        $c = $this->modx->newQuery(modResource::class);
        $c->select($this->modx->getSelectColumns(modResource::class, 'modResource', '', [
            'id', 'pagetitle', 'longtitle', 'alias', 'context_key', 'uri', 'published', 'deleted', 'parent',
        ]));
        $c->where([
            'deleted' => false,
            'context_key:IN' => $contexts,
        ]);
        $like = '%' . addcslashes($query, '%_\\') . '%';
        $search = [
            'pagetitle:LIKE' => $like,
            'OR:longtitle:LIKE' => $like,
            'OR:alias:LIKE' => $like,
        ];
        $c->where([$search]);
        $results = [];
        if ($id > 0) {
            // The resource with the typed ID goes first.
            $c->where(['id:!=' => $id]);
            $exact = $this->modx->getObject(modResource::class, ['id' => $id, 'deleted' => false, 'context_key:IN' => $contexts]);
            if ($exact && $exact->checkPolicy('list')) {
                $results[] = $this->toRow($exact);
            }
        }
        $c->sortby('pagetitle', 'ASC');
        // Over-fetch a little: rows the user may not list are skipped below.
        $c->limit($limit * 2);

        /** @var modResource $resource */
        foreach ($this->modx->getIterator(modResource::class, $c) as $resource) {
            if (count($results) >= $limit) {
                break;
            }
            if ($resource->checkPolicy('list')) {
                $results[] = $this->toRow($resource);
            }
        }

        return $this->outputArray($results, count($results));
    }

    /**
     * @return array{id: int, pagetitle: string, longtitle: string, context_key: string, uri: string, published: bool}
     */
    private function toRow(modResource $resource): array
    {
        return [
            'id' => (int)$resource->get('id'),
            'pagetitle' => (string)$resource->get('pagetitle'),
            'longtitle' => (string)$resource->get('longtitle'),
            'context_key' => (string)$resource->get('context_key'),
            'uri' => (string)$resource->get('uri'),
            'published' => (bool)$resource->get('published'),
        ];
    }

    /**
     * Context keys to search in: the requested context, or every context the user may load
     * when links across contexts are allowed. The manager context is never searched.
     *
     * @return string[]
     */
    private function getContexts(string $requested): array
    {
        /** @var TipTapEditor $service */
        $service = $this->modx->services->get('tiptapeditor');
        $across = $service->getBoolOption('links_across_contexts');

        $keys = [];
        $c = $this->modx->newQuery(modContext::class);
        $c->where(['key:!=' => 'mgr']);
        if (!$across) {
            $c->where(['key' => $requested !== '' ? $requested : (string)$this->modx->getOption('default_context', null, 'web')]);
        }
        /** @var modContext $context */
        foreach ($this->modx->getIterator(modContext::class, $c) as $context) {
            if ($context->checkPolicy('load')) {
                $keys[] = (string)$context->get('key');
            }
        }

        return $keys;
    }
}
