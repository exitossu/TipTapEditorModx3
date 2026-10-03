<?php

namespace TipTapEditor\Plugins\Events;

use TipTapEditor\Plugins\Plugin;

/**
 * Fallback Media Browser integration for the standalone browser page (?a=browser).
 *
 * The editor normally opens MODX's in-page browser window. Where that is not available it
 * opens ?a=browser&tiptapeditor=1 in a popup; for that page this handler adds a small script
 * and returns the name of its callback, which MODX assigns to MODx.onBrowserReturn.
 * Without the tiptapeditor flag the page belongs to someone else and is left alone.
 */
class OnRichTextBrowserInit extends Plugin
{
    public function init(): bool
    {
        return isset($this->modx->controller) && !empty($this->scriptProperties['tiptapeditor']) && parent::init();
    }

    public function process(): void
    {
        $version = rawurlencode($this->tiptapeditor->getVersion());
        $this->modx->controller->addJavascript($this->tiptapeditor->getAssetsUrl() . 'js/browser.js?v=' . $version);
        $this->modx->event->output('TipTapEditor.browserCallback');
    }
}
