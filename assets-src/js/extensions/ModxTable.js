import { Extension } from '@tiptap/core';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { BODYLESS } from '../syntax/finishHtml.js';
import { MARK } from '../syntax/store.js';
import { applyAttributes, extraAttribute } from '../utils/attributes.js';

const CELL_KNOWN = new Set(['colspan', 'rowspan', 'colwidth']);

function cellAttributes() {
    return {
        colspan: { default: 1 },
        rowspan: { default: 1 },
        // Only Tiptap's own colwidth attribute; widths of a <colgroup> are not taken over
        // (a table with <colgroup> stays in the textarea, the loss check reports it).
        colwidth: {
            default: null,
            parseHTML: (element) => {
                const value = element.getAttribute('colwidth');
                return value ? value.split(',').map((width) => parseInt(width, 10)) : null;
            },
            renderHTML: (attributes) => (attributes.colwidth ? { colwidth: attributes.colwidth.join(',') } : {}),
        },
        // Tiptap's "align" would rewrite align="…" as style="text-align: …"; the attribute
        // stays as written in "extra" instead.
        align: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
        extra: extraAttribute(CELL_KNOWN),
    };
}

/**
 * Table for MODX content.
 *
 * - The <table> keeps its class and every other attribute as written; no <colgroup>, no
 *   min-width style and no wrapper are added.
 * - Rows remember whether they were in <thead>, <tbody> or <tfoot>; the serializer puts
 *   them back into those sections (syntax/finishHtml.js).
 * - Rows and cells keep all their attributes (class, style, id, data-*, align, valign, …);
 *   colspan and rowspan are the table's own, for merging and splitting.
 * - Cells written without paragraphs keep that form (implicit paragraphs, see
 *   extensions/ImplicitParagraph.js).
 * - Column resizing is off: it would write widths into the content.
 */
export const ModxTable = Table.extend({
    addOptions() {
        return {
            ...this.parent?.(),
            resizable: false,
            renderWrapper: false,
            View: null,
        };
    },

    addAttributes() {
        return {
            class: {
                default: null,
                parseHTML: (element) => element.getAttribute('class'),
            },
            // Rows written directly in <table>, without <tbody> (set by syntax/preprocess.js).
            bodyless: {
                default: false,
                parseHTML: (element) => element.getAttribute(BODYLESS) === MARK,
                renderHTML: (attributes) => (attributes.bodyless ? { [BODYLESS]: MARK } : {}),
            },
            extra: extraAttribute(new Set(['class', BODYLESS])),
        };
    },

    renderHTML({ HTMLAttributes }) {
        return ['table', HTMLAttributes, 0];
    },

    addNodeView() {
        return ({ node }) => {
            // In the editor the table sits in a scroll container, so wide tables do not
            // stretch the manager page.
            const dom = document.createElement('div');
            dom.className = 'tiptapeditor__table';
            const table = document.createElement('table');
            const body = document.createElement('tbody');
            table.append(body);
            dom.append(table);
            let current = node;
            const apply = (next) => {
                current = next;
                applyAttributes(table, { ...(next.attrs.extra || {}), class: next.attrs.class });
            };
            apply(node);
            return {
                dom,
                contentDOM: body,
                update(updated) {
                    if (updated.type !== current.type) {
                        return false;
                    }
                    apply(updated);
                    return true;
                },
                ignoreMutation: (mutation) => mutation.type === 'attributes' && (mutation.target === table || mutation.target === dom),
            };
        };
    },
});

export const ModxTableRow = TableRow.extend({
    addAttributes() {
        return {
            section: {
                default: 'tbody',
                parseHTML: (element) => {
                    const parent = element.parentElement?.localName;
                    return parent === 'thead' || parent === 'tfoot' ? parent : 'tbody';
                },
                renderHTML: (attributes) => (attributes.section && attributes.section !== 'tbody'
                    ? { 'data-tiptapeditor-section': attributes.section }
                    : {}),
            },
            extra: extraAttribute(new Set()),
        };
    },
});

export const ModxTableCell = TableCell.extend({
    addAttributes: cellAttributes,
});

export const ModxTableHeader = TableHeader.extend({
    addAttributes: cellAttributes,
});

/** All table nodes, configured for MODX content. */
export const ModxTableKit = Extension.create({
    name: 'modxTableKit',

    addExtensions() {
        return [ModxTable, ModxTableRow, ModxTableCell, ModxTableHeader];
    },
});
