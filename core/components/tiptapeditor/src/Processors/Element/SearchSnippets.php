<?php

namespace TipTapEditor\Processors\Element;

use MODX\Revolution\modSnippet;

/**
 * Search snippets ([[!name]]) by name for autocomplete; see ElementSearch.
 */
class SearchSnippets extends ElementSearch
{
    protected function getClassKey(): string
    {
        return modSnippet::class;
    }

    protected function getPermission(): string
    {
        return 'view_snippet';
    }
}
