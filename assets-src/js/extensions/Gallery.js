import { Node } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { GALLERY_SELECTOR, parseGallery, renderGallery } from '../images/gallery.js';
import { previewUrl } from '../modx/MediaBrowser.js';
import { createElement } from '../utils/dom.js';

const PREVIEW_COUNT = 8;
let inert = null;

/**
 * Image gallery as one block (images/gallery.js has the markup and templates).
 *
 * Only galleries made by the editor (data-gallery with the template name on the outer element)
 * become this node; anything else stays what it was. In the manager it is a card with thumbnails; double
 * click or Enter opens the gallery dialog. Unchanged galleries are saved as they were (the
 * field is only rewritten when the document changes).
 */
/**
 * Do galleries of the document differ from what their current template writes (the template
 * file was changed since they were saved)? Then the field is written again, so saving the
 * resource brings them up to date.
 */
export function hasOutdatedGalleries(editor) {
    const options = editor.extensionManager.extensions.find((extension) => extension.name === 'gallery')?.options;
    if (!options) {
        return false;
    }
    inert = inert || document.implementation.createHTMLDocument('');
    let outdated = false;
    editor.state.doc.descendants((node) => {
        if (!outdated && node.type.name === 'gallery' && node.attrs.source) {
            outdated = renderGallery(inert, node.attrs, options).outerHTML !== node.attrs.source;
        }
        return !outdated;
    });
    return outdated;
}

export const Gallery = Node.create({
    name: 'gallery',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return {
            templates: {},
            lightboxAttribute: '',
            lightboxLabel: '',
            siteBaseUrl: '/',
            t: (key) => key,
            onEdit: () => false,
        };
    },

    addAttributes() {
        return {
            template: { default: 'grid', rendered: false },
            items: { default: [], rendered: false },
            lightbox: { default: false, rendered: false },
            group: { default: null, rendered: false },
            wrapper: { default: null, rendered: false },
            // The markup as read (Gallery.js only compares it with the current template).
            source: { default: null, rendered: false },
        };
    },

    parseHTML() {
        return [{
            tag: GALLERY_SELECTOR,
            priority: 70,
            getAttrs: (element) => parseGallery(element, { lightboxAttribute: this.options.lightboxAttribute, templates: this.options.templates }),
        }];
    },

    renderHTML({ node }) {
        // Built in an inert document: nothing in it is loaded by the manager page.
        inert = inert || document.implementation.createHTMLDocument('');
        return renderGallery(inert, node.attrs, this.options);
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
        const { siteBaseUrl, templates, t } = this.options;
        const extension = this;
        return ({ node, getPos, editor }) => {
            const dom = createElement('div', 'tiptapeditor__gallery', { contenteditable: 'false' });
            const label = createElement('div', 'tiptapeditor__gallery-label');
            const thumbs = createElement('div', 'tiptapeditor__gallery-thumbs');
            dom.append(label, thumbs);
            let current = node;
            const render = (next) => {
                current = next;
                const { items, template, lightbox } = next.attrs;
                const templateLabel = templates[template]?.label || template;
                label.textContent = `${t('gallery')} · ${t('gallery_count').replace('{count}', String(items.length))}`
                    + ` · ${t(templateLabel)}${lightbox ? ` · ${t('lightbox_short')}` : ''}`;
                thumbs.replaceChildren(...items.slice(0, PREVIEW_COUNT).map((item) => {
                    const img = createElement('img', 'tiptapeditor__gallery-thumb', { alt: item.alt || '', loading: 'lazy' });
                    img.src = previewUrl(item.src, siteBaseUrl);
                    return img;
                }));
                if (items.length > PREVIEW_COUNT) {
                    const more = createElement('span', 'tiptapeditor__gallery-more');
                    more.textContent = `+${items.length - PREVIEW_COUNT}`;
                    thumbs.append(more);
                }
            };
            render(node);
            dom.addEventListener('dblclick', (event) => {
                if (!editor.isEditable || typeof getPos !== 'function') {
                    return;
                }
                event.preventDefault();
                editor.chain().setNodeSelection(getPos()).run();
                extension.options.onEdit();
            });
            return {
                dom,
                update(updated) {
                    if (updated.type !== current.type) {
                        return false;
                    }
                    render(updated);
                    return true;
                },
                ignoreMutation: () => true,
                stopEvent: (event) => event.type === 'dblclick',
            };
        };
    },
});
