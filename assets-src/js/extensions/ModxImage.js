import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';
import { previewUrl } from '../modx/MediaBrowser.js';
import { applyAttributes, otherAttributes, renderExtra } from '../utils/attributes.js';

const KNOWN = new Set(['src', 'alt', 'title', 'width', 'height', 'class']);
// Shown in the editor without these: a relative srcset would load from the manager directory.
const PREVIEW_SKIP = new Set(['srcset', 'sizes']);

/** Attributes of an <img> the node has no own field for (data-*, id, loading, style, srcset…). */
export function extraAttributes(element) {
    return otherAttributes(element, KNOWN);
}

/**
 * Image node for MODX content.
 *
 * - Inline, so an <img> inside a paragraph stays where it is.
 * - Keeps src, alt, title, width, height, class and every other attribute (data-*, id,
 *   loading, srcset, style…) exactly as written; only event handlers are not accepted.
 * - data: URLs are not accepted (no base64 in resource content).
 * - The saved src is exactly what the content or the Media Browser gave; only the image
 *   shown in the editor resolves relative URLs against the site base URL, because the
 *   manager runs in another directory.
 * - Double click or Enter on a selected image opens the image dialog.
 */
export const ModxImage = Image.extend({
    addOptions() {
        return {
            ...this.parent?.(),
            inline: true,
            allowBase64: false,
            siteBaseUrl: '/',
            onEdit: () => false,
        };
    },

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute('width'),
            },
            height: {
                default: null,
                parseHTML: (element) => element.getAttribute('height'),
            },
            class: {
                default: null,
                parseHTML: (element) => element.getAttribute('class'),
            },
            extra: {
                default: null,
                parseHTML: (element) => extraAttributes(element),
                renderHTML: (attributes) => renderExtra(attributes.extra),
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            Enter: () => {
                const { selection } = this.editor.state;
                if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
                    return false;
                }
                return this.options.onEdit() !== false;
            },
        };
    },

    addNodeView() {
        const { siteBaseUrl } = this.options;
        const extension = this;
        return ({ node, getPos, editor }) => {
            const img = document.createElement('img');
            let current = node;
            const apply = (next) => {
                current = next;
                const attrs = { ...(next.attrs.extra || {}), ...next.attrs };
                delete attrs.extra;
                if (attrs.src !== null && attrs.src !== undefined) {
                    attrs.src = previewUrl(attrs.src, siteBaseUrl);
                }
                applyAttributes(img, attrs, PREVIEW_SKIP);
            };
            apply(node);
            img.addEventListener('dblclick', (event) => {
                if (!editor.isEditable || typeof getPos !== 'function') {
                    return;
                }
                event.preventDefault();
                editor.chain().setNodeSelection(getPos()).run();
                extension.options.onEdit();
            });
            return {
                dom: img,
                update(updated) {
                    if (updated.type !== current.type) {
                        return false;
                    }
                    apply(updated);
                    return true;
                },
            };
        };
    },
});
