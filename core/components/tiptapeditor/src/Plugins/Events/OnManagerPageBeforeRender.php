<?php

namespace TipTapEditor\Plugins\Events;

use TipTapEditor\Plugins\Plugin;

/**
 * Adds the lexicon topic to manager pages, only while TipTapEditor is the active editor.
 * Editor assets are not loaded here: OnRichTextEditorInit loads them only on pages that
 * actually have an editor.
 */
class OnManagerPageBeforeRender extends Plugin
{
    public function init(): bool
    {
        return isset($this->modx->controller) && parent::init();
    }

    public function process(): void
    {
        $this->modx->controller->addLexiconTopic('tiptapeditor:default');
    }
}
