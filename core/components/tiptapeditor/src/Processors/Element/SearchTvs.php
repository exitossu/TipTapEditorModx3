<?php

namespace TipTapEditor\Processors\Element;

use MODX\Revolution\modElement;
use MODX\Revolution\modTemplateVar;

/**
 * Search template variables ([[*name]]) by name for autocomplete; see ElementSearch.
 */
class SearchTvs extends ElementSearch
{
    protected function getClassKey(): string
    {
        return modTemplateVar::class;
    }

    protected function getPermission(): string
    {
        return 'view_tv';
    }

    protected function toRow(modElement $element): array
    {
        return parent::toRow($element) + ['caption' => (string)$element->get('caption')];
    }
}
