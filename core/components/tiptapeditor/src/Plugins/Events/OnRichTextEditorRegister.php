<?php

namespace TipTapEditor\Plugins\Events;

use TipTapEditor\Plugins\Plugin;

/**
 * Adds "TipTapEditor" to the list of available editors (which_editor).
 * Runs regardless of the selected editor, otherwise it could never be chosen.
 */
class OnRichTextEditorRegister extends Plugin
{
    public function init(): bool
    {
        return true;
    }

    public function process(): void
    {
        $this->modx->event->output($this->tiptapeditor->getEditorName());
    }
}
