<?php

return [
    'TipTapEditor' => [
        'file' => 'tiptapeditor',
        'description' => 'TipTapEditor runtime hooks: registers the editor and loads it on manager pages where it is selected.',
        'events' => [
            'OnRichTextEditorRegister' => [],
            'OnRichTextEditorInit' => [],
            'OnRichTextBrowserInit' => [],
            'OnManagerPageBeforeRender' => [],
        ],
    ],
];
