import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { parseToolbar } from '../ui/parseToolbar.js';
import { suggestionRenderer } from '../ui/SuggestionList.js';
import { itemAvailable, runItem } from '../ui/Toolbar.js';
import { getToolbarItem, resolveToolbarItemName } from '../ui/toolbarItems.js';

export const SLASH_COMMANDS = 'paragraph h2 h3 bulletList orderedList blockquote image gallery table codeBlock horizontalRule embed';

/**
 * Slash menu (tiptapeditor.slash_commands): "/" at the start of an empty paragraph opens a list
 * of blocks; typing filters it. The entries are toolbar items, named like in the toolbar
 * setting, so an extra registered with TipTapEditor.registerToolbarItem() can be listed too
 * ("slashCommands": "h2 h3 myWidget" in a profile or the external config).
 */
export const SlashCommands = Extension.create({
    name: 'slashCommands',

    addOptions() {
        return {
            items: SLASH_COMMANDS,
            // { t, config, context() } filled in by createEditor
            hooks: null,
        };
    },

    addProseMirrorPlugins() {
        const { editor } = this;
        const hooks = this.options.hooks || {};
        const t = hooks.t || ((key) => key);
        const config = hooks.config || {};
        const names = parseToolbar(this.options.items, resolveToolbarItemName).groups.flat();

        const entries = () => names
            .map((name) => getToolbarItem(name))
            .filter((item) => item && itemAvailable(item, editor, config))
            .map((item) => ({ name: item.name, label: t(item.label), icon: item.icon, item }));

        return [Suggestion({
            editor,
            pluginKey: new PluginKey('tiptapeditorSlashCommands'),
            char: '/',
            startOfLine: true,
            allowedPrefixes: null,
            decorationClass: 'tiptapeditor__suggestion',
            allow: ({ state, range }) => {
                const $from = state.doc.resolve(range.from);
                // Only a paragraph that holds nothing but the "/command" being typed.
                return editor.isEditable && $from.parent.type.name === 'paragraph'
                    && range.from === $from.start() && range.to === $from.end();
            },
            items: ({ query }) => {
                const q = query.toLowerCase();
                return entries().filter((entry) => !q || entry.label.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q));
            },
            command: ({ editor: target, range, props }) => {
                runItem(props.item, target, hooks.context?.() || { t, config }, target.chain().focus().deleteRange(range));
            },
            render: suggestionRenderer({
                className: 'tiptapeditor-suggest--slash',
                label: t('slash_commands'),
                emptyText: () => t('suggest_none'),
            }),
        })];
    },
});
