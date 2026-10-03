import { EVENT_HANDLER } from '../utils/attributes.js';

/**
 * Galleries and the "open larger" link of images (lightbox).
 *
 * A gallery is stored in the content as the markup of its template, with the template name on
 * the outer element (data-tiptapeditor-gallery="grid"), so the editor can open it again:
 *
 *   <div class="gallery" data-tiptapeditor-gallery="grid">
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
 * (item). Built in: grid, slider (Swiper markup), images (only the pictures). More come from
 * tiptapeditor.gallery_templates (JSON). Event handler attributes and script-like elements of a
 * template are removed, so a template cannot run code in the manager or on the site.
 */

export const GALLERY_ATTRIBUTE = 'data-tiptapeditor-gallery';
/** Galleries saved before the extra was renamed (TiptapRTE 0.1.0-alpha15). */
export const LEGACY_GALLERY_ATTRIBUTE = 'data-tiptaprte-gallery';
export const GALLERY_SELECTOR = `[${GALLERY_ATTRIBUTE}], [${LEGACY_GALLERY_ATTRIBUTE}]`;

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
 * Built-in templates plus tiptapeditor.gallery_templates (a JSON object or its text):
 * {"cards": {"label": "Cards", "wrapper": "<ul class=\"cards\">{items}</ul>", "item": "<li>{image}{caption}</li>"}}.
 * Invalid entries are skipped (logged by the caller).
 * @returns {{ templates: Record<string, {label: string, wrapper: string, item: string}>, errors: string[] }}
 */
export function galleryTemplates(setting) {
    const templates = { ...BUILTIN_TEMPLATES };
    const errors = [];
    let custom = setting;
    if (typeof custom === 'string') {
        if (!custom.trim()) {
            return { templates, errors };
        }
        try {
            custom = JSON.parse(custom);
        } catch {
            return { templates, errors: ['gallery_templates is not valid JSON'] };
        }
    }
    if (custom && !isPlainObject(custom)) {
        return { templates, errors: ['gallery_templates must be a JSON object'] };
    }
    for (const [name, template] of Object.entries(custom || {})) {
        if (!NAME.test(name) || !validTemplate(template)) {
            errors.push(`gallery template "${name}" skipped: needs "wrapper" with {items} and "item" with {image}`);
            continue;
        }
        templates[name] = { label: String(template.label || name), wrapper: template.wrapper, item: template.item };
    }
    return { templates, errors };
}

/**
 * The attribute of the lightbox link from tiptapeditor.lightbox_attribute: whatever the site's
 * lightbox script looks for (data-fancybox, data-lightbox, data-gallery …). '' = a plain link.
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
    const templateName = attrs.template in templates ? attrs.template : 'grid';
    if (attrs.wrapper) {
        // Attributes of a saved gallery in their order; the template adds what they lack.
        const fromTemplate = Object.fromEntries(wrapper.getAttributeNames().map((key) => [key, wrapper.getAttribute(key)]));
        wrapper.getAttributeNames().forEach((key) => wrapper.removeAttribute(key));
        for (const [key, value] of Object.entries(attrs.wrapper)) {
            if (ATTRIBUTE_NAME.test(key) && !EVENT_HANDLER.test(key)) {
                wrapper.setAttribute(key, key === GALLERY_ATTRIBUTE ? templateName : value);
            }
        }
        for (const [key, value] of Object.entries(fromTemplate)) {
            if (!wrapper.hasAttribute(key)) {
                wrapper.setAttribute(key, value);
            }
        }
    }
    wrapper.setAttribute(GALLERY_ATTRIBUTE, templateName);
    return wrapper;
}

const IMAGE_KNOWN = new Set(['src', 'alt', 'title', 'width', 'height']);

/**
 * Gallery node attributes read from its element, or false when the markup holds something
 * the gallery cannot keep (a formatted caption, text outside captions, a link that is not the
 * lightbox link, …): such markup stays as an HTML block.
 */
export function parseGallery(element, { lightboxAttribute: attribute }) {
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
        if (!EVENT_HANDLER.test(attr)) {
            // The old name is written with the current one when the gallery is saved again.
            wrapper[attr === LEGACY_GALLERY_ATTRIBUTE ? GALLERY_ATTRIBUTE : attr] = element.getAttribute(attr);
        }
    }
    return {
        template: element.getAttribute(GALLERY_ATTRIBUTE) || element.getAttribute(LEGACY_GALLERY_ATTRIBUTE) || 'grid',
        items,
        lightbox: Boolean(lightbox),
        group: group || null,
        wrapper: Object.keys(wrapper).length ? wrapper : null,
    };
}
