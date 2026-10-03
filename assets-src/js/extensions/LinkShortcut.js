import { Extension } from '@tiptap/core';

/**
 * Mod+K opens the link dialog. options.open is supplied by the editor UI; it returns false
 * while there is no dialog to open (no UI yet, read-only editor).
 */
export const LinkShortcut = Extension.create({
    name: 'linkShortcut',

    addOptions() {
        return { open: () => false };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-k': () => {
                if (!this.editor.isEditable) {
                    return false;
                }
                return this.options.open() !== false;
            },
        };
    },
});
