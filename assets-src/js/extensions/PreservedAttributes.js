import { Extension } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import { otherAttributes, renderExtra } from '../utils/attributes.js';

/**
 * Keeps the attributes of ordinary elements that the editor has no field for: id, class,
 * title, lang, dir, role, data-*, aria-*, style, … on paragraphs, headings, quotes, lists,
 * list items, code blocks, horizontal rules and inline marks (<p class="lead">,
 * <h2 class="title">, <strong data-x="1">, <a data-fancybox>). They are written back as
 * they were; event handler attributes are never kept (that content stays a raw HTML block).
 *
 * style: kept verbatim (tiptapeditor.preserve_style_attribute). On paragraphs and headings a
 * style that is only "text-align" is the alignment of the editor's align buttons instead.
 */

const NODES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'codeBlock', 'horizontalRule'];
const MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'subscript', 'superscript', 'link'];

// Attributes the node or mark handles itself.
const OWN = {
    heading: ['id'],
    orderedList: ['start', 'type'],
    link: ['href', 'target', 'rel', 'class', 'title'],
};
const ALIGNED = new Set(['paragraph', 'heading']);
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

/** True when a style attribute holds nothing but a text-align the align buttons know. */
export function isAlignmentOnly(style) {
    const declarations = String(style || '').split(';').map((part) => part.trim()).filter(Boolean);
    return declarations.length > 0 && declarations.every((declaration) => {
        const [property, value] = declaration.split(':').map((part) => (part || '').trim().toLowerCase());
        return property === 'text-align' && ALIGNMENTS.has(value);
    });
}

function extraFor(type, preserveStyle) {
    const known = new Set(OWN[type] || []);
    return {
        default: null,
        parseHTML: (element) => {
            const extra = otherAttributes(element, known);
            if (!extra) {
                return null;
            }
            for (const name of Object.keys(extra)) {
                // The editor's own markers (implicit paragraphs, table sections, tokens).
                if (name.toLowerCase().startsWith('data-tiptapeditor-')) {
                    delete extra[name];
                }
            }
            if ('style' in extra && (!preserveStyle || (ALIGNED.has(type) && isAlignmentOnly(extra.style)))) {
                delete extra.style;
            }
            return Object.keys(extra).length ? extra : null;
        },
        renderHTML: (attributes) => renderExtra(attributes.extra),
    };
}

export const PreservedAttributes = Extension.create({
    name: 'preservedAttributes',

    addOptions() {
        return { preserveStyle: true };
    },

    addGlobalAttributes() {
        return [...NODES, ...MARKS].map((type) => ({
            types: [type],
            attributes: { extra: extraFor(type, this.options.preserveStyle) },
        }));
    },
});

/**
 * Alignment that leaves a style with more than text-align to PreservedAttributes: the align
 * buttons then add their text-align to that style (see syntax/finishHtml.js).
 */
export const ModxTextAlign = TextAlign.extend({
    addGlobalAttributes() {
        return (this.parent?.() || []).map((entry) => {
            const { textAlign } = entry.attributes;
            return {
                ...entry,
                attributes: {
                    ...entry.attributes,
                    textAlign: {
                        ...textAlign,
                        parseHTML: (element) => {
                            const style = element.getAttribute('style');
                            return style && !isAlignmentOnly(style) ? this.options.defaultAlignment : textAlign.parseHTML(element);
                        },
                    },
                },
            };
        });
    },
});
