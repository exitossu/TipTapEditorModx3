<?php

namespace TipTapEditor\Processors\Element;

use MODX\Revolution\modElement;
use MODX\Revolution\Processors\Processor;

/**
 * Base of the element searches for MODX tag autocomplete ([[$chunk]], [[!snippet]], [[*tv]]).
 *
 * Runs through the manager connector (session + modAuth). The user needs the view_* permission
 * of the element type; elements are loaded with the model layer and each one is checked for
 * "list" (element category ACL), so nothing hidden from the user's element tree is returned.
 * No raw SQL. Only names, captions and short descriptions leave the server, never code.
 *
 * Properties: query (1+ characters of the name), limit (1..30).
 * Result rows: name, description[, caption].
 */
abstract class ElementSearch extends Processor
{
    private const MAX_LIMIT = 30;
    private const DESCRIPTION_LENGTH = 80;

    /** @return class-string<modElement> */
    abstract protected function getClassKey(): string;

    abstract protected function getPermission(): string;

    protected function getNameField(): string
    {
        return 'name';
    }

    /**
     * @return array<string, string>
     */
    protected function toRow(modElement $element): array
    {
        return [
            'name' => (string)$element->get($this->getNameField()),
            'description' => $this->shorten((string)$element->get('description')),
        ];
    }

    public function checkPermissions(): bool
    {
        return $this->modx->hasPermission($this->getPermission());
    }

    public function getLanguageTopics(): array
    {
        return ['tiptapeditor:default'];
    }

    public function process()
    {
        $query = trim((string)$this->getProperty('query', ''));
        if ($query === '' || mb_strlen($query) > 100) {
            return $this->outputArray([], 0);
        }
        $limit = max(1, min(self::MAX_LIMIT, (int)$this->getProperty('limit', 15)));
        $name = $this->getNameField();
        $like = addcslashes($query, '%_\\');

        $c = $this->modx->newQuery($this->getClassKey());
        $c->where([$name . ':LIKE' => '%' . $like . '%']);
        $c->sortby($name, 'ASC');
        // Over-fetch: elements the user may not list are skipped below.
        $c->limit($limit * 3);

        $results = [];
        /** @var modElement $element */
        foreach ($this->modx->getIterator($this->getClassKey(), $c) as $element) {
            if ($element->checkPolicy('list')) {
                $results[] = $this->toRow($element);
            }
        }
        // Names starting with the query first.
        $lower = mb_strtolower($query);
        usort($results, function (array $a, array $b) use ($lower): int {
            $startsA = str_starts_with(mb_strtolower($a['name']), $lower);
            $startsB = str_starts_with(mb_strtolower($b['name']), $lower);

            return $startsA === $startsB ? strnatcasecmp($a['name'], $b['name']) : ($startsA ? -1 : 1);
        });
        $results = array_slice($results, 0, $limit);

        return $this->outputArray($results, count($results));
    }

    protected function shorten(string $text): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');

        return mb_strlen($text) > self::DESCRIPTION_LENGTH ? mb_substr($text, 0, self::DESCRIPTION_LENGTH - 1) . '…' : $text;
    }
}
