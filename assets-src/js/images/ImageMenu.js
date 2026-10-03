import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { NodeSelection } from '@tiptap/pm/state';
import { icon } from '../ui/icons.js';
import { createElement } from '../utils/dom.js';

/**
 * Contextual menu over a selected image: Edit, Replace, Remove.
 *
 * Built from Tiptap's BubbleMenu (positioning with floating-ui). The buttons run through the
 * editor UI hooks, which exist once the editor is created.
 */
export function createImageMenu(ui, t) {
    const element = createElement('div', 'tiptapeditor__image-menu', { role: 'toolbar', 'aria-label': t('image_menu') });
    const buttons = [
        { name: 'edit', label: 'image_edit', icon: 'pencil', run: () => ui.openImage?.() },
        { name: 'replace', label: 'image_replace', icon: 'replace', run: () => ui.replaceImage?.(), when: () => ui.canBrowse?.() },
        { name: 'remove', label: 'image_remove', icon: 'trash', run: () => ui.removeImage?.() },
    ].map((item) => {
        const button = createElement('button', 'tiptapeditor__button', {
            type: 'button',
            'data-tiptapeditor-image-action': item.name,
            'aria-label': t(item.label),
            title: t(item.label),
        });
        const svg = icon(item.icon);
        if (svg) {
            button.append(svg);
        }
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => item.run());
        element.append(button);
        return { ...item, button };
    });

    const extension = BubbleMenu.extend({ name: 'imageMenu' }).configure({
        element,
        pluginKey: 'tiptapeditorImageMenu',
        // On <body>: the manager's navigation bar would cover it inside the content panel.
        appendTo: () => document.body,
        updateDelay: 0,
        options: { placement: 'top', strategy: 'fixed', offset: 6, flip: true, shift: { padding: 8 } },
        shouldShow: ({ editor, state }) => {
            const { selection } = state;
            const show = editor.isEditable && selection instanceof NodeSelection && selection.node.type.name === 'image';
            if (show) {
                for (const item of buttons) {
                    item.button.hidden = item.when ? !item.when() : false;
                }
            }
            return show;
        },
    });
    return { extension, element };
}
