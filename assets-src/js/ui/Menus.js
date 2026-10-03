import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
import { TextSelection } from '@tiptap/pm/state';
import { createElement } from '../utils/dom.js';
import { Toolbar } from './Toolbar.js';

/** Default controls; tiptapeditor.bubble_menu / floating_menu switch them on and off, a profile
 *  or the external config may give its own list ("bubbleMenu": "bold italic link"). */
export const BUBBLE_MENU = 'bold italic underline strike code link';
export const FLOATING_MENU = 'h2 h3 bulletList orderedList blockquote codeBlock image gallery table embed';

/** Toolbar string for a menu setting: false/'' = off, true = default, a string = its items. */
export function menuItems(value, fallback) {
    if (value === false || value === 0 || value === '0' || value === '' || value === null || value === undefined) {
        return '';
    }
    if (value === true || value === 1 || value === '1') {
        return fallback;
    }
    return String(value);
}

function inCode(state) {
    const { $from } = state.selection;
    return $from.parent.type.spec.code || state.selection.$from.marks().some((mark) => mark.type.spec.code);
}

/**
 * Bubble menu over selected text and floating menu on an empty paragraph. Both are built in
 * two steps: the Tiptap extensions need their element before the editor exists, the controls
 * (the same Toolbar class as the main toolbar) need the editor. They are shown on <body>:
 * inside the manager's content panel (its own stacking context) the navigation bar would
 * cover them.
 *
 * @param {object} config resolved configuration
 * @param {(key: string) => string} t
 * @param {{ blocked: () => boolean }} state  true while source mode or a dialog owns the editor
 */
export function createMenus(config, t, state) {
    const extensions = [];
    const parts = [];

    const bubbleItems = menuItems(config.bubbleMenu, BUBBLE_MENU);
    if (bubbleItems) {
        const element = createElement('div', 'tiptapeditor__bubble');
        parts.push({ element, items: bubbleItems, label: 'bubble_menu', className: 'tiptapeditor__toolbar--bubble' });
        extensions.push(BubbleMenu.configure({
            element,
            pluginKey: 'tiptapeditorBubbleMenu',
            appendTo: () => document.body,
            updateDelay: 120,
            options: { placement: 'top', strategy: 'fixed', offset: 8, flip: true, shift: { padding: 8 } },
            shouldShow: ({ editor, state: editorState, from, to }) => {
                const { selection } = editorState;
                return editor.isEditable && !state.blocked()
                    && selection instanceof TextSelection && !selection.empty
                    && editorState.doc.textBetween(from, to, ' ', ' ').trim() !== ''
                    && !inCode(editorState);
            },
        }));
    }

    const floatingItems = menuItems(config.floatingMenu, FLOATING_MENU);
    if (floatingItems) {
        const element = createElement('div', 'tiptapeditor__floating');
        parts.push({ element, items: floatingItems, label: 'floating_menu', className: 'tiptapeditor__toolbar--floating' });
        extensions.push(FloatingMenu.configure({
            element,
            pluginKey: 'tiptapeditorFloatingMenu',
            appendTo: () => document.body,
            options: { placement: 'right', strategy: 'fixed', offset: 12, flip: true, shift: { padding: 8 } },
            shouldShow: ({ editor, view, state: editorState }) => {
                const { selection } = editorState;
                const { $from } = selection;
                return editor.isEditable && !state.blocked() && view.hasFocus()
                    && selection.empty && $from.depth === 1
                    && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0;
            },
        }));
    }

    const toolbars = [];
    return {
        extensions,
        /** Builds the controls once the editor exists. */
        mount(editor, context) {
            for (const part of parts) {
                const toolbar = new Toolbar(editor, { ...config, toolbar: part.items }, context, {
                    className: part.className,
                    label: part.label,
                });
                if (toolbar.isEmpty) {
                    toolbar.destroy();
                    part.element.hidden = true;
                    continue;
                }
                part.element.append(toolbar.el);
                toolbars.push(toolbar);
            }
        },
        destroy() {
            toolbars.forEach((toolbar) => toolbar.destroy());
            parts.forEach((part) => part.element.remove());
        },
    };
}
