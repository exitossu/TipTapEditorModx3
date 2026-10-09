<?php

namespace TipTapEditor\Processors\Image;

use MODX\Revolution\modResource;
use RuntimeException;
use TipTapEditor\Media\UploadPath;

/**
 * Upload folder and file name prefix for the request's resource, TV and context, from
 * tiptapeditor.upload_path and tiptapeditor.upload_file_prefix (see Media\UploadPath).
 *
 * Request properties: resource (id, 0 for a new resource), parent (for a new resource), tv
 * (TV id, empty for the content field), wctx. Resources are read through the model layer and
 * only when the user may view them; otherwise their placeholders stay empty.
 */
trait UploadTarget
{
    /**
     * @return array{path: string, prefix: string}
     * @throws RuntimeException with a lexicon key of the tiptapeditor namespace
     */
    protected function uploadTarget(): array
    {
        $folder = (string)$this->modx->getOption('tiptapeditor.upload_path', null, 'assets/uploads/');
        $prefix = (string)$this->modx->getOption('tiptapeditor.upload_file_prefix', null, '');
        if (!str_contains($folder . $prefix, '{')) {
            return ['path' => (new UploadPath([]))->folder($folder), 'prefix' => (new UploadPath([]))->prefix($prefix)];
        }

        $resource = $this->viewableResource((int)$this->getProperty('resource', 0));
        $parentId = $resource ? (int)$resource->get('parent') : max(0, (int)$this->getProperty('parent', 0));
        $parent = $this->viewableResource($parentId);
        $values = [
            'id' => $resource ? (int)$resource->get('id') : 0,
            'alias' => $resource ? (string)$resource->get('alias') : '',
            'pid' => $parentId,
            'palias' => $parent ? (string)$parent->get('alias') : '',
            'context' => $resource ? (string)$resource->get('context_key') : (string)$this->getProperty('wctx', ''),
            'tid' => (int)$this->getProperty('tv', 0) ?: '',
            'uid' => (int)$this->modx->user->get('id'),
        ];
        $paths = new UploadPath($values, (int)$this->modx->getOption('tiptapeditor.upload_rand_length', null, 6));

        return ['path' => $paths->folder($folder), 'prefix' => $paths->prefix($prefix)];
    }

    private function viewableResource(int $id): ?modResource
    {
        if ($id <= 0) {
            return null;
        }
        /** @var modResource|null $resource */
        $resource = $this->modx->getObject(modResource::class, $id);

        return $resource && $resource->checkPolicy('view') ? $resource : null;
    }
}
