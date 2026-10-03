import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { fenomItems, modxItems } from '../modx/autocomplete.js';
import { suggestionRenderer } from '../ui/SuggestionList.js';

// Server searches wait until typing pauses (tiptapeditor spec: 250–400 ms).
const DEBOUNCE = 300;

function outsideCode(state, range) {
    const $from = state.doc.resolve(range.from);
    return !$from.parent.type.spec.code && !$from.marks().some((mark) => mark.type.spec.code);
}

function suggestion(editor, { key, char, items, hooks, label }) {
    const t = hooks.t || ((name) => name);
    return Suggestion({
        editor,
        pluginKey: new PluginKey(key),
        char,
        allowedPrefixes: null,
        debounce: DEBOUNCE,
        decorationClass: 'tiptapeditor__suggestion',
        allow: ({ state, range }) => editor.isEditable && outsideCode(state, range),
        items: ({ query, signal }) => items(query, { config: hooks.config || {}, t, logger: hooks.logger, signal }),
        command: ({ editor: target, range, props }) => {
            // Plain text: a complete tag becomes a protected token right away (TokenizeText).
            target.chain().focus().insertContentAt(range, props.insert).run();
        },
        render: suggestionRenderer({
            className: 'tiptapeditor-suggest--code',
            label,
            loadingText: () => t('suggest_loading'),
        }),
    });
}

/**
 * Autocomplete for MODX tags (tiptapeditor.modx_autocomplete) and Fenom (tiptapeditor.fenom_autocomplete).
 * See modx/autocomplete.js for what is suggested.
 */
export const ModxAutocomplete = Extension.create({
    name: 'modxAutocomplete',

    addOptions() {
        return {
            modx: true,
            fenom: false,
            // { t, config, logger } filled in by createEditor
            hooks: null,
        };
    },

    addProseMirrorPlugins() {
        const hooks = this.options.hooks || {};
        const t = hooks.t || ((name) => name);
        const plugins = [];
        if (this.options.modx) {
            plugins.push(suggestion(this.editor, { key: 'tiptapeditorModxAutocomplete', char: '[[', items: modxItems, hooks, label: t('ac_modx') }));
        }
        if (this.options.fenom) {
            plugins.push(suggestion(this.editor, { key: 'tiptapeditorFenomAutocomplete', char: '{$', items: fenomItems, hooks, label: t('ac_fenom') }));
        }
        return plugins;
    },
});
