import { Extension } from '@tiptap/core';
import { MARK } from '../syntax/store.js';

export const IMPLICIT = 'data-tiptapeditor-implicit';

/**
 * Paragraph attribute "implicit": the paragraph was not in the source, the preprocessor
 * added it around text written directly in a list item, table cell, blockquote or at the top
 * level (<li>Text</li>, <td>10</td>). The serializer leaves it out again (syntax/finishHtml.js),
 * so such content keeps its form. Only the preprocessor's own marker (with this page's value)
 * is read; the attribute in pasted or written HTML means nothing.
 */
export const ImplicitParagraph = Extension.create({
    name: 'implicitParagraph',

    addGlobalAttributes() {
        return [{
            types: ['paragraph'],
            attributes: {
                implicit: {
                    default: false,
                    keepOnSplit: false,
                    parseHTML: (element) => element.getAttribute(IMPLICIT) === MARK,
                    renderHTML: (attributes) => (attributes.implicit ? { [IMPLICIT]: MARK } : {}),
                },
            },
        }];
    },
});
