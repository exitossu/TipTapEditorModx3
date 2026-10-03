<?php

namespace TipTapEditor\Plugins;

use MODX\Revolution\modX;
use TipTapEditor\TipTapEditor;

/**
 * Base class for event handlers. The plugin element only resolves the handler class
 * from the event name and calls run(); all logic lives in the handlers.
 */
abstract class Plugin
{
    protected modX $modx;

    protected TipTapEditor $tiptapeditor;

    /** @var array<string, mixed> */
    protected array $scriptProperties;

    /**
     * @param array<string, mixed> $scriptProperties
     */
    public function __construct(modX $modx, TipTapEditor $tiptapeditor, array &$scriptProperties)
    {
        $this->modx = $modx;
        $this->tiptapeditor = $tiptapeditor;
        $this->scriptProperties = &$scriptProperties;
    }

    public function run(): void
    {
        if ($this->init()) {
            $this->process();
        }
    }

    /**
     * Decide whether the handler should run. By default only when TipTapEditor is the
     * active editor, so another selected RTE is never touched.
     */
    public function init(): bool
    {
        return $this->tiptapeditor->isActive($this->scriptProperties);
    }

    abstract public function process(): void;
}
