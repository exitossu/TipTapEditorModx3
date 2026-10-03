import { Node } from '@tiptap/core';
import { idOf, rawOf } from '../syntax/store.js';

const RAW = 'data-tiptapeditor-raw';
const PREVIEW_LENGTH = 160;

/** First element name of a fragment, for the card label ("div", "table", "comment"). */
export function describeHtml(html) {
    const source = String(html).trim();
    if (source.startsWith('<!--')) {
        return '<!-- -->';
    }
    const match = /^<([A-Za-z][A-Za-z0-9:-]*)/.exec(source);
    return match ? `<${match[1].toLowerCase()}>` : 'HTML';
}

/**
 * Plain text preview of a fragment. Parsed in an inert document (scripts never run, images
 * never load) and only its text is shown, so foreign HTML is never rendered in the manager.
 */
export function previewText(html) {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = String(html);
    doc.querySelectorAll('script, style, template').forEach((el) => el.remove());
    const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
}

/**
 * HTML the editor cannot show without changing it (a <div> layout, <figure>, a table built
 * by a {foreach}, a script, a comment…): kept verbatim as one block. In the editor it is a
 * card with the element name and a text preview; double click or Enter opens its source.
 */
export const RawHtml = Node.create({
    name: 'rawHtml',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return { onEdit: () => false, label: 'HTML' };
    },

    addAttributes() {
        return { html: { default: '', rendered: false } };
    },

    parseHTML() {
        return [{
            tag: `div[${RAW}]`,
            getAttrs: (element) => {
                const html = rawOf(element.getAttribute(RAW));
                return html === undefined ? false : { html };
            },
        }];
    },

    renderHTML({ node }) {
        return ['div', { [RAW]: idOf(node.attrs.html) }];
    },

    renderText({ node }) {
        return node.attrs.html;
    },

    addNodeView() {
        const { options } = this;
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div');
            dom.className = 'tiptapeditor__raw';
            dom.contentEditable = 'false';
            const head = document.createElement('div');
            head.className = 'tiptapeditor__raw-head';
            const label = document.createElement('span');
            label.className = 'tiptapeditor__raw-label';
            const tag = document.createElement('code');
            head.append(label, tag);
            const body = document.createElement('div');
            body.className = 'tiptapeditor__raw-preview';
            dom.append(head, body);
            let current = node;
            const apply = (next) => {
                current = next;
                label.textContent = options.label;
                tag.textContent = describeHtml(next.attrs.html);
                body.textContent = previewText(next.attrs.html);
                dom.title = next.attrs.html.length > 2000 ? `${next.attrs.html.slice(0, 2000)}…` : next.attrs.html;
            };
            apply(node);
            dom.addEventListener('dblclick', (event) => {
                if (!editor.isEditable || typeof getPos !== 'function') {
                    return;
                }
                event.preventDefault();
                editor.chain().setNodeSelection(getPos()).run();
                options.onEdit();
            });
            return {
                dom,
                update(updated) {
                    if (updated.type !== current.type) {
                        return false;
                    }
                    apply(updated);
                    return true;
                },
                ignoreMutation: () => true,
            };
        };
    },

    addKeyboardShortcuts() {
        return {
            Enter: () => {
                const { selection } = this.editor.state;
                return selection.node?.type.name === this.name ? this.options.onEdit() !== false : false;
            },
        };
    },
});
