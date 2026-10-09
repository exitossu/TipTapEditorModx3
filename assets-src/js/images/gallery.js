import { EVENT_HANDLER } from '../utils/attributes.js';

/**
 * Galleries and the "open larger" link of images (lightbox).
 *
 * A gallery is stored in the content as the markup of its template, with the template name in
 * data-gallery on the outer element, so the editor can open it again:
 *
 *   <div class="gallery" data-gallery="grid">
 *     <figure class="gallery__item">
 *       <a href="img/1.jpg" data-fancybox="gallery-3fa9c1" aria-label="Open image: Sea"><img src="img/1.jpg" alt="Sea"></a>
 *       <figcaption>Sea</figcaption>
 *     </figure>
 *   </div>
 *
 * The attribute of the lightbox link comes from tiptapeditor.lightbox_attribute (data-fancybox is
 * only an example): a single image gets it without a value, a gallery with its group name.
 *
 * Templates are data: HTML with the placeholders {items} (wrapper) and {image}, {caption}
 * (item). Built in: grid, slider (Swiper markup), images (only the pictures). Files in
 * tiptapeditor.gallery_templates_path (one .html per template, read on the server) add templates or
 * replace them by name. Event handler attributes and script-like elements of a
 * template are removed, so a template cannot run code in the manager or on the site.
 *
 * A gallery is always written with its current template: after a template file is changed, the
 * galleries using it follow the next time the content is saved.
 */

/** Template name on the outer element of a gallery. */
export const GALLERY_ATTRIBUTE = 'data-gallery';
/** The same, as written up to 0.1.0-alpha20: still read, written as data-gallery. */
export const LEGACY_GALLERY_ATTRIBUTES = Object.freeze(['data-tiptapeditor-gallery']);
const MARKERS = [GALLERY_ATTRIBUTE, ...LEGACY_GALLERY_ATTRIBUTES];
/** Elements that can be a gallery (a lightbox link may use data-gallery for its group). */
export const GALLERY_SELECTOR = MARKERS.map((name) => `[${name}]:not(a)`).join(', ');

export const BUILTIN_TEMPLATES = Object.freeze({
    grid: {
        label: 'gallery_template_grid',
        wrapper: '<div class="gallery">{items}</div>',
        item: '<figure class="gallery__item">{image}{caption}</figure>',
    },
    slider: {
        label: 'gallery_template_slider',
        wrapper: '<div class="swiper gallery-slider"><div class="swiper-wrapper">{items}</div>'
            + '<div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>',
        item: '<div class="swiper-slide"><figure>{image}{caption}</figure></div>',
    },
    images: {
        label: 'gallery_template_images',
        wrapper: '<div class="gallery gallery--images">{items}</div>',
        item: '{image}',
    },
});

const UNSAFE_ELEMENTS = 'script, style, iframe, object, embed, link, meta, base, form, input, button, textarea, select, template';
const NAME = /^[a-z][a-z0-9_-]*$/i;
const ATTRIBUTE_NAME = /^[a-z_:][a-z0-9_:.-]*$/i;

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validTemplate(template) {
    return isPlainObject(template)
        && typeof template.wrapper === 'string' && template.wrapper.split('{items}').length === 2
        && typeof template.item === 'string' && template.item.split('{image}').length === 2
        && template.item.split('{caption}').length <= 2;
}

/**
 * Built-in templates, then the template files (an object from the server, Gallery\TemplateFiles):
 * {"cards": {"label": "Cards", "wrapper": "<ul class=\"cards\">{items}</ul>", "item": "<li>{image}{caption}</li>"}}.
 * A file replaces the built-in template of the same name. Invalid entries are skipped (logged by
 * the caller).
 * @returns {{ templates: Record<string, {label: string, wrapper: string, item: string}>, errors: string[] }}
 */
export function galleryTemplates(files = null) {
    const errors = [];
    const sources = [BUILTIN_TEMPLATES, ...(isPlainObject(files) ? [files] : [])];
    const templates = {};
    for (const source of sources) {
        for (const [name, template] of Object.entries(source)) {
            if (!NAME.test(name) || !validTemplate(template)) {
                errors.push(`gallery template "${name}" skipped: needs "wrapper" with {items} and "item" with {image}`);
                continue;
            }
            templates[name] = { label: String(template.label || name), wrapper: template.wrapper, item: template.item };
        }
    }
    return { templates, errors };
}

/**
 * Template of a gallery element: the one its data-gallery (or old marker) names, "grid" when that
 * template no longer exists, null for an element without a marker.
 */
export function galleryTemplateOf(element, templates) {
    const marker = MARKERS.find((name) => element.hasAttribute(name));
    if (!marker || element.localName === 'a') {
        return null;
    }
    const name = element.getAttribute(marker);
    return templates[name] ? name : (templates.grid ? 'grid' : Object.keys(templates)[0] || null);
}

/**
 * The attribute of the lightbox link from tiptapeditor.lightbox_attribute: whatever the site's
 * lightbox script looks for (data-fancybox, data-lightbox …). '' = a plain link.
 * Unsafe names (event handlers, href, src, style) give ''.
 */
export function lightboxAttribute(value) {
    const name = String(value ?? '').trim();
    return name && ATTRIBUTE_NAME.test(name) && !EVENT_HANDLER.test(name) && !/^(href|src|style|aria-label)$/i.test(name)
        ? name : '';
}

/** aria-label of the lightbox link: "Open image: {alt}" with the alt text or caption. */
export function lightboxLabel(template, text) {
    const label = String(template || '');
    if (!label) {
        return null;
    }
    return label.replace('{alt}', String(text || '').trim()).trim();
}

export function newGroup(random = Math.random().toString(36).slice(2, 8)) {
    return `gallery-${random}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attributesHtml(attributes) {
    return Object.entries(attributes)
        .filter(([name, value]) => value !== null && value !== undefined && ATTRIBUTE_NAME.test(name) && !EVENT_HANDLER.test(name))
        .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
        .join('');
}

/** <img> (and the lightbox link around it) of one gallery item, as HTML. */
export function itemImageHtml(item, { lightbox, attribute, group, label }) {
    const img = `<img${attributesHtml({
        src: item.src,
        alt: item.alt ?? '',
        title: item.title || null,
        width: item.width || null,
        height: item.height || null,
        ...(item.extra || {}),
    })}>`;
    if (!lightbox) {
        return img;
    }
    return `<a${attributesHtml({
        href: item.href || item.src,
        ...(attribute ? { [attribute]: group || '' } : {}),
        'aria-label': lightboxLabel(label, item.alt || item.caption),
    })}>${img}</a>`;
}

function stripUnsafe(root) {
    root.querySelectorAll(UNSAFE_ELEMENTS).forEach((el) => el.remove());
    for (const el of [root, ...root.querySelectorAll('*')]) {
        for (const name of el.getAttributeNames()) {
            const value = el.getAttribute(name) || '';
            if (EVENT_HANDLER.test(name) || /^\s*(javascript|vbscript|data):/i.test(value)) {
                el.removeAttribute(name);
            }
        }
    }
}

/**
 * The gallery element for the content.
 * @param {Document} doc document to create the element in
 * @param {object} attrs node attributes: template, items, lightbox, group, wrapper
 * @param {object} options templates, lightboxAttribute, lightboxLabel
 */
export function renderGallery(doc, attrs, { templates, lightboxAttribute: attribute, lightboxLabel: label }) {
    const template = templates[attrs.template] || templates.grid;
    const name = attribute || '';
    const items = (attrs.items || []).map((item) => {
        const caption = String(item.caption || '').trim();
        return template.item
            .replace('{image}', itemImageHtml(item, { lightbox: attrs.lightbox, attribute: name, group: attrs.group, label }))
            .replace('{caption}', caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '');
    }).join('');
    const box = doc.createElement('div');
    box.innerHTML = template.wrapper.replace('{items}', items);
    const wrapper = box.firstElementChild || doc.createElement('div');
    stripUnsafe(wrapper);
    if (attrs.wrapper) {
        // Attributes of a saved gallery in their order (its id, style …); the template adds what
        // they lack. The class is always the template's, so a changed template applies.
        const fromTemplate = Object.fromEntries(wrapper.getAttributeNames().map((key) => [key, wrapper.getAttribute(key)]));
        wrapper.getAttributeNames().forEach((key) => wrapper.removeAttribute(key));
        for (const [key, value] of Object.entries(attrs.wrapper)) {
            if (ATTRIBUTE_NAME.test(key) && !EVENT_HANDLER.test(key) && !MARKERS.includes(key) && key !== 'class') {
                wrapper.setAttribute(key, value);
            } else if (key === GALLERY_ATTRIBUTE || (key === 'class' && fromTemplate.class !== undefined)) {
                // Keep the place of data-gallery and class in the saved order.
                wrapper.setAttribute(key, '');
            }
        }
        for (const [key, value] of Object.entries(fromTemplate)) {
            if (!wrapper.hasAttribute(key)) {
                wrapper.setAttribute(key, value);
            }
        }
        if (fromTemplate.class !== undefined) {
            wrapper.setAttribute('class', fromTemplate.class);
        }
    }
    wrapper.setAttribute(GALLERY_ATTRIBUTE, attrs.template in templates ? attrs.template : 'grid');
    return wrapper;
}

const IMAGE_KNOWN = new Set(['src', 'alt', 'title', 'width', 'height']);

/**
 * Gallery node attributes read from its element, or false when the markup holds something
 * the gallery cannot keep (a formatted caption, text outside captions, a link that is not the
 * lightbox link, …): such markup stays as an HTML block.
 */
export function parseGallery(element, { lightboxAttribute: attribute, templates = null }) {
    const template = galleryTemplateOf(element, templates || galleryTemplates().templates);
    if (!template) {
        return false;
    }
    const name = attribute || '';
    const images = [...element.querySelectorAll('img')];
    if (!images.length) {
        return false;
    }
    let lightbox = null;
    let group = '';
    const items = [];
    for (const img of images) {
        const link = img.parentElement?.closest('a');
        const linked = Boolean(link && element.contains(link));
        if (linked && ((name && !link.hasAttribute(name)) || !link.hasAttribute('href') || link.querySelectorAll('img').length !== 1 || link.textContent.trim())) {
            return false;
        }
        if (lightbox !== null && lightbox !== linked) {
            return false;
        }
        lightbox = linked;
        if (linked && name) {
            group = link.getAttribute(name) || group;
        }
        const figure = img.closest('figure');
        const figcaption = figure && element.contains(figure) ? figure.querySelector('figcaption') : null;
        if (figcaption && figcaption.children.length) {
            return false;
        }
        const extra = {};
        for (const attr of img.getAttributeNames()) {
            if (!IMAGE_KNOWN.has(attr.toLowerCase()) && !EVENT_HANDLER.test(attr)) {
                extra[attr] = img.getAttribute(attr);
            }
        }
        items.push({
            src: img.getAttribute('src') || '',
            alt: img.getAttribute('alt') ?? '',
            title: img.getAttribute('title'),
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
            extra: Object.keys(extra).length ? extra : null,
            href: linked && link.getAttribute('href') !== img.getAttribute('src') ? link.getAttribute('href') : null,
            caption: figcaption ? figcaption.textContent.trim() : '',
        });
    }
    // Text outside captions would be lost.
    const clone = element.cloneNode(true);
    clone.querySelectorAll('figcaption').forEach((el) => el.remove());
    if (clone.textContent.trim()) {
        return false;
    }
    const wrapper = {};
    for (const attr of element.getAttributeNames()) {
        // An old marker takes the place of data-gallery.
        if (!EVENT_HANDLER.test(attr) && !(LEGACY_GALLERY_ATTRIBUTES.includes(attr) && element.hasAttribute(GALLERY_ATTRIBUTE))) {
            wrapper[LEGACY_GALLERY_ATTRIBUTES.includes(attr) ? GALLERY_ATTRIBUTE : attr] = element.getAttribute(attr);
        }
    }
    return {
        template,
        // The markup as read: compared with the current template when the editor opens.
        source: element.outerHTML,
        items,
        lightbox: Boolean(lightbox),
        group: group || null,
        wrapper: Object.keys(wrapper).length ? wrapper : null,
    };
}
