import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { cleanPastedHtml } from '../paste/cleanPaste.js';

/**
 * Paste handling (tiptapeditor.paste_as_text):
 *  - HTML from Word, Google Docs and web pages is cleaned (paste/cleanPaste.js) before the
 *    editor parses it; HTML copied inside the editor is left as it is.
 *  - With pasteAsText every paste inserts the clipboard's plain text (paragraphs per line
 *    break), as Ctrl+Shift+V always does.
 * Images that only exist on the user's computer or as data: URLs are dropped and the user is
 * told (onImagesRemoved).
 */
export const PasteCleaner = Extension.create({
    name: 'pasteCleaner',

    addOptions() {
        return {
            pasteAsText: false,
            onImagesRemoved: () => {},
        };
    },

    addProseMirrorPlugins() {
        const options = this.options;
        let plain = false;
        return [new Plugin({
            key: new PluginKey('tiptapeditorPasteCleaner'),
            props: {
                transformPastedHTML(html) {
                    const result = cleanPastedHtml(html);
                    if (result.removedImages) {
                        options.onImagesRemoved(result.removedImages);
                    }
                    return result.html;
                },
                handlePaste(view, event) {
                    if (!options.pasteAsText || plain) {
                        return false;
                    }
                    const data = event.clipboardData;
                    const types = [...(data?.types || [])];
                    if (!types.includes('text/html')) {
                        return false; // plain text or files: handled as usual
                    }
                    const text = data.getData('text/plain');
                    if (!text) {
                        return false;
                    }
                    plain = true;
                    try {
                        view.pasteText(text, event);
                    } finally {
                        plain = false;
                    }
                    return true;
                },
            },
        })];
    },
});
