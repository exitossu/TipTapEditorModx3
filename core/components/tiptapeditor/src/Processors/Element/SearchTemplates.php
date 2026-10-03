<?php

namespace TipTapEditor\Processors\Element;

use MODX\Revolution\modTemplate;

/**
 * Search templates by name for autocomplete; see ElementSearch.
 */
class SearchTemplates extends ElementSearch
{
    protected function getClassKey(): string
    {
        return modTemplate::class;
    }

    protected function getPermission(): string
    {
        return 'view_template';
    }

    protected function getNameField(): string
    {
        return 'templatename';
    }
}
