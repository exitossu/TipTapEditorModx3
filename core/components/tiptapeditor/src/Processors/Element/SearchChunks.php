<?php

namespace TipTapEditor\Processors\Element;

use MODX\Revolution\modChunk;

/**
 * Search chunks ([[$name]]) by name for autocomplete; see ElementSearch.
 */
class SearchChunks extends ElementSearch
{
    protected function getClassKey(): string
    {
        return modChunk::class;
    }

    protected function getPermission(): string
    {
        return 'view_chunk';
    }
}
