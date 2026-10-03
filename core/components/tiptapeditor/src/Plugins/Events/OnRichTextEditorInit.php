<?php

namespace TipTapEditor\Plugins\Events;

use MODX\Revolution\modResource;
use MODX\Revolution\modTemplateVar;
use TipTapEditor\Plugins\Plugin;

/**
 * Loads the editor bundle and hands its configuration to JS for the elements MODX passes.
 *
 * The configuration goes into a <script type="application/json"> block: it is data, never
 * executed, and JSON_HEX_* flags keep setting values from closing the tag. The bundle reads
 * every such block on the page (resource content, chunks and TVs may each fire the event).
 *
 * Manager only: the frontend richtext TV output also fires this event, without a manager
 * controller, and is left to its default behaviour.
 */
class OnRichTextEditorInit extends Plugin
{
    private const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    public function init(): bool
    {
        return isset($this->modx->controller) && empty($this->scriptProperties['forfrontend']) && parent::init();
    }

    public function process(): void
    {
        $version = rawurlencode($this->tiptapeditor->getVersion());
        $distUrl = $this->tiptapeditor->getDistUrl();
        $controller = $this->modx->controller;

        $controller->addCss($distUrl . 'tiptapeditor.css?v=' . $version);
        $controller->addJavascript($distUrl . 'tiptapeditor.js?v=' . $version);

        $json = json_encode($this->getEditorConfig(), self::JSON_FLAGS);
        if ($json === false) {
            $this->modx->log(\MODX\Revolution\modX::LOG_LEVEL_ERROR, 'Configuration is not JSON encodable: ' . json_last_error_msg(), '', 'TipTapEditor');

            return;
        }
        $controller->addHtml('<script type="application/json" data-tiptapeditor-config>' . $json . '</script>');
    }

    /**
     * @return array<string, mixed>
     */
    private function getEditorConfig(): array
    {
        /** @var modResource|null $resource */
        $resource = $this->scriptProperties['resource'] ?? null;
        $resource = $resource instanceof modResource ? $resource : null;

        $context = $this->tiptapeditor->getResourceContext($resource);

        return array_merge($this->tiptapeditor->getConfig(), [
            'elements' => $this->getElements(),
            'resource' => [
                'id' => (int)($this->scriptProperties['id'] ?? ($resource ? $resource->get('id') : 0)),
                'context' => $context,
            ],
            'mode' => (string)($this->scriptProperties['mode'] ?? ''),
            'mediaSource' => $this->tiptapeditor->getMediaSourceFor(null, $context),
            'tvs' => $this->getRichTextTvs($context),
        ]);
    }

    /**
     * Richtext TVs keyed by their textarea ID ("tv{id}"), so the editor can apply per-TV
     * settings (profiles, media sources). Only id/name/caption and the Media Source are exposed.
     *
     * @return array<string, array{id: int, name: string, caption: string, mediaSource: array|null}>
     */
    private function getRichTextTvs(string $context): array
    {
        // Loaded through xPDO objects (not raw SQL) so element access permissions apply.
        $tvs = [];
        foreach ($this->modx->getCollection(modTemplateVar::class, ['type' => 'richtext']) as $tv) {
            $tvs['tv' . $tv->get('id')] = [
                'id' => (int)$tv->get('id'),
                'name' => (string)$tv->get('name'),
                'caption' => (string)$tv->get('caption'),
                'mediaSource' => $this->tiptapeditor->getMediaSourceFor($tv, $context),
            ];
        }

        return $tvs;
    }

    /**
     * Element IDs MODX asks to replace. Richtext TVs are not included by the resource
     * controller (it fires this event before loading TVs); the bundle finds them by class.
     *
     * @return string[]
     */
    private function getElements(): array
    {
        $elements = $this->scriptProperties['elements'] ?? [];
        if (is_string($elements)) {
            $elements = explode(',', $elements);
        }
        $elements = array_map('trim', array_filter((array)$elements, 'is_scalar'));

        return array_values(array_filter($elements, fn ($id) => preg_match('/^[A-Za-z][\w:.-]*$/', $id)));
    }
}
