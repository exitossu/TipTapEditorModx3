import { Extension } from '@tiptap/core';

export const ANCHOR_ID = /^[A-Za-z][\w:.-]*$/;

/**
 * id attribute on headings: keeps existing anchors (<h2 id="prices">) and lets editors set
 * one, so the link dialog can offer "#prices". Only valid HTML ids are written.
 */
export const HeadingAnchor = Extension.create({
    name: 'headingAnchor',

    addGlobalAttributes() {
        return [{
            types: ['heading'],
            attributes: {
                id: {
                    default: null,
                    parseHTML: (element) => element.getAttribute('id') || null,
                    renderHTML: (attributes) => (attributes.id ? { id: attributes.id } : {}),
                },
            },
        }];
    },

    addCommands() {
        return {
            setHeadingId: (id) => ({ commands }) => {
                const value = String(id ?? '').trim();
                if (value && !ANCHOR_ID.test(value)) {
                    return false;
                }
                return commands.updateAttributes('heading', { id: value || null });
            },
        };
    },
});
