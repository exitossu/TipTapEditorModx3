import { Node } from '@tiptap/core';
import { allowedAttributes, allowedHosts, hostOf, isAllowedSrc } from '../embed/embed.js';
import { EVENT_HANDLER, renderExtra } from '../utils/attributes.js';

/**
 * <iframe> (video embeds, maps, forms) as an inline atom, so both forms sites use survive:
 * <p><iframe …></iframe></p> and a bare <iframe> between blocks (an implicit paragraph the
 * serializer leaves out).
 *
 * Only iframes made of allowed attributes (tiptapeditor.iframe_allowed_attributes) with a src on
 * an allowed host (tiptapeditor.iframe_allowed_hosts) become this node. Any other iframe (an
 * onload handler, an unknown attribute, javascript: src, content inside) is not parsed here
 * and stays as a raw HTML block, so nothing is dropped and nothing runs.
 *
 * In the manager the iframe is never loaded: the node shows a card with the host and size.
 * Double click or Enter opens the embed dialog.
 */
export const Iframe = Node.create({
    name: 'iframe',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return {
            allowedAttributes: null,
            allowedHosts: '',
            label: 'Embed',
            onEdit: () => false,
        };
    },

    addAttributes() {
        // All attributes in source order; written back in the same order.
        return { attributes: { default: {}, rendered: false } };
    },

    parseHTML() {
        const allowed = allowedAttributes(this.options.allowedAttributes);
        const hosts = allowedHosts(this.options.allowedHosts);
        return [{
            tag: 'iframe',
            getAttrs: (element) => {
                if (element.childNodes.length && element.textContent.trim()) {
                    return false;
                }
                const attributes = {};
                for (const name of element.getAttributeNames()) {
                    const lower = name.toLowerCase();
                    if (EVENT_HANDLER.test(lower) || !allowed.has(lower)) {
                        return false;
                    }
                    attributes[name] = element.getAttribute(name);
                }
                if (!isAllowedSrc(element.getAttribute('src'), hosts)) {
                    return false;
                }
                return { attributes };
            },
        }];
    },

    renderHTML({ node }) {
        return ['iframe', renderExtra(node.attrs.attributes)];
    },

    renderText({ node }) {
        return node.attrs.attributes?.src || '';
    },

    addNodeView() {
        const { options } = this;
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('span');
            dom.className = 'tiptapeditor__embed';
            dom.contentEditable = 'false';
            const label = document.createElement('span');
            label.className = 'tiptapeditor__embed-label';
            const src = document.createElement('span');
            src.className = 'tiptapeditor__embed-src';
            const size = document.createElement('span');
            size.className = 'tiptapeditor__embed-size';
            dom.append(label, src, size);
            let current = node;
            const apply = (next) => {
                current = next;
                const attributes = next.attrs.attributes || {};
                const value = String(attributes.src || '');
                label.textContent = options.label;
                src.textContent = hostOf(value) ? value.replace(/^(https?:)?\/\//i, '') : value;
                size.textContent = attributes.width || attributes.height ? `${attributes.width || '?'} × ${attributes.height || '?'}` : '';
                dom.title = value;
                const width = parseInt(attributes.width, 10);
                dom.style.width = width > 0 ? `${Math.min(width, 640)}px` : '';
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
