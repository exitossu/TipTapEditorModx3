import { Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { previewUrl } from '../modx/MediaBrowser.js';
import { applyAttributes, EVENT_HANDLER, extraAttribute, otherAttributes, renderExtra } from '../utils/attributes.js';
import { createElement } from '../utils/dom.js';

const IMAGE_KNOWN = new Set(['src', 'alt', 'title', 'width', 'height', 'class']);
const PREVIEW_SKIP = new Set(['srcset', 'sizes']);

function significant(element) {
    return [...element.childNodes].filter((node) => node.nodeType === 1 || (node.nodeType === 3 && node.data.trim()) || node.nodeType === 8);
}

/** The <img> of "<img>" or "<a …><img></a>" (nothing else in the link), or null. */
function linkedImage(element) {
    if (element.localName === 'img') {
        return element;
    }
    if (element.localName !== 'a' || !element.hasAttribute('href')) {
        return null;
    }
    const inner = significant(element);
    return inner.length === 1 && inner[0].localName === 'img' ? inner[0] : null;
}

/** All attributes in source order (event handlers left out). */
function attributesOf(element) {
    const result = {};
    for (const name of element.getAttributeNames()) {
        if (!EVENT_HANDLER.test(name)) {
            result[name] = element.getAttribute(name);
        }
    }
    return result;
}

function imageAttrs(img) {
    return {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt'),
        title: img.getAttribute('title'),
        width: img.getAttribute('width'),
        height: img.getAttribute('height'),
        class: img.getAttribute('class'),
        extra: otherAttributes(img, IMAGE_KNOWN),
    };
}

/**
 * <figure> with one image (optionally inside a link that opens it larger) and a caption:
 *
 *   <figure><a href="img.jpg" data-fancybox aria-label="…"><img src="img.jpg" alt="…"></a>
 *     <figcaption>Source: …</figcaption></figure>
 *
 * figure → figureImage (the picture and its link, edited in the image dialog) + figcaption
 * (editable text). Every attribute of figure, a, img and figcaption is kept. A figure with
 * anything else in it (two images, a video, text outside the caption) is not parsed here and
 * stays an HTML block.
 */
export const Figure = Node.create({
    name: 'figure',
    group: 'block',
    content: 'figureImage figcaption?',
    defining: true,
    isolating: true,
    draggable: true,

    addAttributes() {
        return { extra: extraAttribute(new Set()) };
    },

    parseHTML() {
        return [{
            tag: 'figure',
            getAttrs: (element) => {
                const children = significant(element);
                if (!children.length || children.length > 2 || !linkedImage(children[0])) {
                    return false;
                }
                if (children[1] && children[1].localName !== 'figcaption') {
                    return false;
                }
                return null;
            },
        }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['figure', HTMLAttributes, 0];
    },
});

export const FigureCaption = Node.create({
    name: 'figcaption',
    content: 'inline*',
    marks: '_',
    defining: true,

    addAttributes() {
        return { extra: extraAttribute(new Set()) };
    },

    parseHTML() {
        return [{ tag: 'figcaption', context: 'figure/' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['figcaption', HTMLAttributes, 0];
    },

    addKeyboardShortcuts() {
        // Enter in a caption continues with a paragraph after the figure.
        return {
            Enter: () => {
                const { state } = this.editor;
                const { $from } = state.selection;
                if ($from.parent.type.name !== this.name || $from.depth < 2) {
                    return false;
                }
                const after = $from.after($from.depth - 1);
                const tr = state.tr.insert(after, state.schema.nodes.paragraph.create());
                tr.setSelection(TextSelection.create(tr.doc, after + 1));
                this.editor.view.dispatch(tr.scrollIntoView());
                return true;
            },
        };
    },
});

/**
 * The picture of a figure: the <img> and, when it opens larger on click, the <a> around it
 * (attributes of both kept in source order; link = null without a link).
 */
export const FigureImage = Node.create({
    name: 'figureImage',
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return { siteBaseUrl: '/', onEdit: () => false };
    },

    addAttributes() {
        const plain = (name) => ({ default: null, parseHTML: (element) => (linkedImage(element)?.getAttribute(name) ?? null) });
        return {
            src: plain('src'),
            alt: plain('alt'),
            title: plain('title'),
            width: plain('width'),
            height: plain('height'),
            class: plain('class'),
            extra: {
                default: null,
                parseHTML: (element) => imageAttrs(linkedImage(element)).extra,
                rendered: false,
            },
            link: {
                default: null,
                parseHTML: (element) => (element.localName === 'a' ? attributesOf(element) : null),
                rendered: false,
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'a', context: 'figure/', priority: 70, getAttrs: (element) => (linkedImage(element) ? null : false) },
            { tag: 'img', context: 'figure/', priority: 70 },
        ];
    },

    renderHTML({ node }) {
        const { link, extra, ...rest } = node.attrs;
        const img = ['img', { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined)), ...renderExtra(extra) }];
        return link ? ['a', renderExtra(link), img] : img;
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
            const dom = createElement('div', 'tiptapeditor__figure-image', { contenteditable: 'false' });
            const img = createElement('img');
            const badge = createElement('span', 'tiptapeditor__figure-zoom', { 'aria-hidden': 'true' });
            badge.textContent = '⤢';
            dom.append(img, badge);
            let current = node;
            const apply = (next) => {
                current = next;
                const { link, extra, ...attrs } = next.attrs;
                const all = { ...(extra || {}), ...attrs };
                if (all.src) {
                    all.src = previewUrl(all.src, siteBaseUrl);
                }
                applyAttributes(img, all, PREVIEW_SKIP);
                badge.hidden = !link;
            };
            apply(node);
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
                    apply(updated);
                    return true;
                },
                ignoreMutation: () => true,
            };
        };
    },
});
