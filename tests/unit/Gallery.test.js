import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { galleryTemplates, lightboxAttribute, parseGallery, renderGallery } from '../../assets-src/js/images/gallery.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

let manager;
let instance;
const dialog = () => document.querySelector('.tiptapeditor-dialog');
const button = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);

function start(html, extra = {}) {
    document.body.innerHTML = '<textarea id="ta"></textarea>';
    document.getElementById('ta').value = html;
    manager = new EditorManager(createLogger(false));
    manager.configure({
        toolbar: 'image gallery',
        mediaSource: { id: 1, name: 'Filesystem', baseUrl: '/' },
        siteBaseUrl: '/',
        resource: { id: 5, context: 'web' },
        syncDelay: 5,
        ...extra,
    });
    instance = manager.create('ta');
    return instance;
}
const types = () => {
    const names = [];
    instance.editor.state.doc.descendants((node) => {
        names.push(node.type.name);
    });
    return names;
};
const textarea = () => document.getElementById('ta').value;
function field(label) {
    const el = [...dialog().querySelectorAll('label')].find((l) => l.textContent === label);
    return document.getElementById(el.htmlFor);
}
function pickFiles(files) {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function pick() {
        Object.defineProperty(this, 'files', { value: files });
        this.dispatchEvent(new Event('change'));
        click.mockRestore();
    });
}

afterEach(() => {
    manager?.destroyAll();
    document.querySelectorAll('.tiptapeditor-dialog, input[type="file"]').forEach((el) => el.remove());
    vi.restoreAllMocks();
});

const EXAMPLE = '<figure>\n    <a href="#" aria-label="Открыть изображение: название">\n'
    + '        <img src="#" alt="" width="1024" height="576" srcset="https://example.com/320.gif 320w, https://example.com/460.gif 460w" '
    + 'sizes="(max-width: 1023px) 100vw, 1024px" loading="eager" fetchpriority="high" decoding="async">\n    </a>\n'
    + '    <figcaption>Источник изображения: Sony Pictures</figcaption>\n</figure>';

describe('figure with caption and link', () => {
    it('opens the example as an editable figure and keeps every attribute', async () => {
        start(`<p>Before</p>${EXAMPLE}`);
        expect(types()).toEqual(['paragraph', 'text', 'figure', 'figureImage', 'figcaption', 'text']);
        expect(textarea()).toBe(`<p>Before</p>${EXAMPLE}`);
        const html = serialize(instance.editor);
        expect(html).toContain('<figure><a href="#" aria-label="Открыть изображение: название"><img src="#" alt="" width="1024" height="576"');
        expect(html).toContain('srcset="https://example.com/320.gif 320w, https://example.com/460.gif 460w"');
        expect(html).toContain('sizes="(max-width: 1023px) 100vw, 1024px" loading="eager" fetchpriority="high" decoding="async"></a>');
        expect(html).toContain('<figcaption>Источник изображения: Sony Pictures</figcaption></figure>');
    });

    it('a figure with something else in it stays an HTML block', () => {
        start('<figure><img src="a.jpg"><img src="b.jpg"></figure><figure><video src="v.mp4"></video></figure>');
        expect(types().filter((t) => t === 'figure')).toEqual([]);
        expect(types()).toContain('rawHtml');
    });

    it('caption and "open larger" in the image dialog turn an image into a figure', async () => {
        start('<p><img src="assets/a.jpg" alt="Sea"></p>', { lightboxAttribute: 'data-fancybox' });
        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        field('Caption').value = 'Photo: me';
        field('Open larger on click').checked = true;
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Save').click();
        expect(serialize(instance.editor)).toBe('<figure><a href="assets/a.jpg" data-fancybox="" aria-label="Open image: Sea">'
            + '<img src="assets/a.jpg" alt="Sea"></a><figcaption>Photo: me</figcaption></figure>');
    });

    it('without caption and link the figure becomes an image again; the link follows a new file', async () => {
        start('<figure><a href="assets/a.jpg" data-fancybox=""><img src="assets/a.jpg" alt="A"></a><figcaption>Cap</figcaption></figure>',
            { lightboxAttribute: 'data-fancybox' });
        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(field('Caption').value).toBe('Cap');
        expect(field('Open larger on click').checked).toBe(true);
        field('Image URL').value = 'assets/b.jpg';
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Save').click();
        expect(serialize(instance.editor)).toContain('<a href="assets/b.jpg" data-fancybox="" aria-label="Open image: A"><img src="assets/b.jpg" alt="A"></a><figcaption>Cap</figcaption>');

        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        field('Caption').value = '';
        field('Open larger on click').checked = false;
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Save').click();
        expect(serialize(instance.editor)).toBe('<p><img src="assets/b.jpg" alt="A"></p>');
    });

    it('the lightbox attribute name comes from the settings and must be safe', () => {
        expect(lightboxAttribute('data-fancybox')).toBe('data-fancybox');
        expect(lightboxAttribute('data-lightbox')).toBe('data-lightbox');
        expect(lightboxAttribute('')).toBe('');
        expect(lightboxAttribute('onclick')).toBe('');
        expect(lightboxAttribute('href')).toBe('');
        expect(lightboxAttribute('a b')).toBe('');
    });
});

describe('gallery', () => {
    const { templates } = galleryTemplates('');
    const items = [
        { src: 'img/1.jpg', alt: 'One', caption: 'First' },
        { src: 'img/2.jpg', alt: 'Two & "2"', caption: '' },
    ];

    it('renders the grid template with the lightbox group and reads it back', () => {
        const el = renderGallery(document, { template: 'grid', items, lightbox: true, group: 'gallery-abc' },
            { templates, lightboxAttribute: 'data-fancybox', lightboxLabel: 'Open: {alt}' });
        expect(el.outerHTML).toBe('<div class="gallery" data-tiptapeditor-gallery="grid">'
            + '<figure class="gallery__item"><a href="img/1.jpg" data-fancybox="gallery-abc" aria-label="Open: One"><img src="img/1.jpg" alt="One"></a><figcaption>First</figcaption></figure>'
            + '<figure class="gallery__item"><a href="img/2.jpg" data-fancybox="gallery-abc" aria-label="Open: Two &amp; &quot;2&quot;"><img src="img/2.jpg" alt="Two &amp; &quot;2&quot;"></a></figure>'
            + '</div>');
        const parsed = parseGallery(el, { lightboxAttribute: 'data-fancybox' });
        expect(parsed).toMatchObject({ template: 'grid', lightbox: true, group: 'gallery-abc' });
        expect(parsed.items.map((i) => [i.src, i.alt, i.caption])).toEqual([['img/1.jpg', 'One', 'First'], ['img/2.jpg', 'Two & "2"', '']]);
    });

    it('slider and images templates', () => {
        const slider = renderGallery(document, { template: 'slider', items, lightbox: false }, { templates });
        expect(slider.outerHTML).toContain('<div class="swiper gallery-slider" data-tiptapeditor-gallery="slider"><div class="swiper-wrapper"><div class="swiper-slide"><figure><img src="img/1.jpg" alt="One"><figcaption>First</figcaption></figure></div>');
        const plain = renderGallery(document, { template: 'images', items, lightbox: false }, { templates });
        expect(plain.outerHTML).toBe('<div class="gallery gallery--images" data-tiptapeditor-gallery="images"><img src="img/1.jpg" alt="One"><img src="img/2.jpg" alt="Two &amp; &quot;2&quot;"></div>');
    });

    it('own templates from JSON; scripts and event handlers are removed, broken ones skipped', () => {
        const { templates: own, errors } = galleryTemplates(JSON.stringify({
            cards: { label: 'Cards', wrapper: '<ul class="cards" onclick="x()">{items}<script>alert(1)</script></ul>', item: '<li onmouseover="y()">{image}{caption}</li>' },
            broken: { wrapper: '<div></div>', item: '{image}' },
        }));
        expect(Object.keys(own)).toEqual(['grid', 'slider', 'images', 'cards']);
        expect(errors).toHaveLength(1);
        const el = renderGallery(document, { template: 'cards', items: items.slice(0, 1), lightbox: false }, { templates: own });
        expect(el.outerHTML).toBe('<ul class="cards" data-tiptapeditor-gallery="cards"><li><img src="img/1.jpg" alt="One"><figcaption>First</figcaption></li></ul>');
        expect(galleryTemplates('{oops').errors).toEqual(['gallery_templates is not valid JSON']);
    });

    it('opens a saved gallery as one block and saves it unchanged', () => {
        const html = '<p>Text</p><div class="gallery" data-tiptapeditor-gallery="grid" id="g1"><figure class="gallery__item"><img src="img/1.jpg" alt="One"><figcaption>First</figcaption></figure></div>';
        start(html);
        expect(types()).toEqual(['paragraph', 'text', 'gallery']);
        expect(instance.root.querySelector('.tiptapeditor__gallery-label').textContent).toContain('1 images');
        expect(serialize(instance.editor)).toBe(html);
    });

    it('a gallery saved under the old name (data-tiptaprte-gallery) still opens as a gallery', () => {
        const html = '<div class="gallery" data-tiptaprte-gallery="grid"><figure class="gallery__item"><img src="img/1.jpg" alt="One"></figure></div>';
        start(html);
        expect(types()).toEqual(['gallery']);
        expect(instance.editor.state.doc.firstChild.attrs.template).toBe('grid');
        expect(serialize(instance.editor)).toBe(html.replace('data-tiptaprte-gallery', 'data-tiptapeditor-gallery'));
    });

    it('markup it cannot keep stays an HTML block', () => {
        start('<div data-tiptapeditor-gallery="grid"><figure><img src="a.jpg"><figcaption>A <b>bold</b> caption</figcaption></figure></div>'
            + '<div data-tiptapeditor-gallery="grid"><p>text</p><img src="b.jpg"></div>');
        expect(types()).not.toContain('gallery');
        expect(types().filter((t) => t === 'rawHtml')).toHaveLength(2);
    });

    it('gallery dialog: uploads several files, orders, captions and inserts with the lightbox group', async () => {
        let n = 0;
        start('<p>Text</p>', {
            mediaSource: null,
            uploadHandler: async (file) => `assets/uploads/${file.name}`,
            lightbox: true,
            lightboxAttribute: 'data-fancybox',
            galleryTemplate: 'grid',
        });
        instance.editor.commands.setTextSelection(5);
        await frame();
        button('gallery').click();
        expect(dialog().querySelector('h2').textContent).toBe('Insert gallery');
        pickFiles([new File(['x'], 'a.png', { type: 'image/png' }), new File(['x'], 'b.png', { type: 'image/png' })]);
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Upload from computer…').click();
        await vi.waitFor(() => expect(dialog().querySelectorAll('.tiptapeditor-gallery-list__item')).toHaveLength(2));
        // b first, with a caption.
        dialog().querySelectorAll('[data-move="up"]')[1].click();
        const rows = dialog().querySelectorAll('.tiptapeditor-gallery-list__item');
        const [altB, captionB] = rows[0].querySelectorAll('input');
        altB.value = 'Bee';
        altB.dispatchEvent(new Event('input'));
        captionB.value = 'A bee';
        captionB.dispatchEvent(new Event('input'));
        n += 1;
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Insert').click();
        const html = serialize(instance.editor);
        const group = /data-fancybox="(gallery-[a-z0-9]+)"/.exec(html)?.[1];
        expect(group).toBeTruthy();
        expect(html).toBe(`<p>Text</p><div class="gallery" data-tiptapeditor-gallery="grid">`
            + `<figure class="gallery__item"><a href="assets/uploads/b.png" data-fancybox="${group}" aria-label="Open image: Bee"><img src="assets/uploads/b.png" alt="Bee"></a><figcaption>A bee</figcaption></figure>`
            + `<figure class="gallery__item"><a href="assets/uploads/a.png" data-fancybox="${group}" aria-label="Open image:"><img src="assets/uploads/a.png" alt=""></a></figure></div>`);
        expect(n).toBe(1);
    });

    it('an empty gallery is not inserted', async () => {
        start('<p>Text</p>', { mediaSource: null, uploadHandler: async () => '' });
        await frame();
        button('gallery').click();
        [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'Insert').click();
        expect(dialog().querySelector('.tiptapeditor-dialog__error').textContent).toBe('Add at least one image.');
        expect(types()).not.toContain('gallery');
    });
});
