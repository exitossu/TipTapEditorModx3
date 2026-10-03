import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { dimension, joinImageClasses, splitImageClasses, updatedImageClass } from '../../assets-src/js/images/classes.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

// The in-page browser hands the file back a couple of ticks after it closes.
const flush = () => new Promise((r) => setTimeout(r, 20));
const PRESETS = [{ value: 'article-image', label: 'Article' }, { value: 'article-image article-image--wide', label: 'Wide' }];

describe('image classes', () => {
    it('splits alignment, preset and other classes', () => {
        expect(splitImageClasses('lazy article-image align-left article-image--wide', PRESETS))
            .toEqual({ align: 'left', preset: 'article-image article-image--wide', other: 'lazy' });
        expect(splitImageClasses(null, PRESETS)).toEqual({ align: '', preset: '', other: '' });
    });

    it('joins them back, and keeps the original order when nothing changed', () => {
        expect(joinImageClasses({ align: 'center', preset: 'article-image', other: 'x' })).toBe('x article-image align-center');
        expect(joinImageClasses({})).toBeNull();
        const original = 'align-left lazy article-image';
        expect(updatedImageClass(original, splitImageClasses(original, PRESETS), PRESETS)).toBe(original);
        expect(updatedImageClass(original, { align: 'right', preset: 'article-image', other: 'lazy' }, PRESETS)).toBe('lazy article-image align-right');
    });

    it('accepts pixel and percent sizes only', () => {
        expect(dimension('640')).toBe('640');
        expect(dimension(' 100% ')).toBe('100%');
        expect(dimension('')).toBeNull();
        expect(dimension('12px')).toBeUndefined();
        expect(dimension('abc')).toBeUndefined();
    });
});

describe('image node and dialog', () => {
    let manager;
    let instance;
    const dialog = () => document.querySelector('.tiptapeditor-dialog');
    const field = (label) => {
        const el = [...dialog().querySelectorAll('label')].find((l) => l.textContent === label);
        return el && document.getElementById(el.htmlFor);
    };
    const click = (text) => [...dialog().querySelectorAll('button')].find((b) => b.textContent === text).click();
    const start = (html, extra = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'image', siteBaseUrl: '/', imageClasses: '{"article-image":"Article"}', ...extra });
        instance = manager.create('ta');
    };

    afterEach(() => {
        document.querySelectorAll('.tiptapeditor-dialog').forEach((el) => el.remove());
        manager?.destroyAll();
    });

    it('keeps every attribute of existing images', () => {
        const html = '<p>A <img src="assets/a.jpg" alt="A" title="T" width="300" height="200" class="lead align-left" '
            + 'id="pic" data-fancybox="gallery" data-src="assets/big.jpg" loading="lazy" srcset="assets/a-2x.jpg 2x" style="border: 0"> b</p>';
        start(html);
        expect(instance).not.toBeNull();
        const out = instance.editor.getHTML();
        for (const part of ['src="assets/a.jpg"', 'alt="A"', 'title="T"', 'width="300"', 'height="200"', 'class="lead align-left"',
            'id="pic"', 'data-fancybox="gallery"', 'data-src="assets/big.jpg"', 'loading="lazy"', 'srcset="assets/a-2x.jpg 2x"', 'style="border: 0']) {
            expect(out).toContain(part);
        }
        // The editor view shows the image without srcset (it would resolve against /manager/).
        const shown = instance.root.querySelector('.ProseMirror img');
        expect(shown.getAttribute('src')).toBe('/assets/a.jpg');
        expect(shown.hasAttribute('srcset')).toBe(false);
    });

    it('keeps an image with an event handler as a raw block, never as an editable image', () => {
        start('<p><img src="a.jpg" onerror="alert(1)"></p><p>b</p>');
        expect(instance.editor.state.doc.firstChild.type.name).toBe('rawHtml');
        expect(instance.root.querySelector('.ProseMirror img')).toBeNull();
        expect(serialize(instance.editor)).toBe('<p><img src="a.jpg" onerror="alert(1)"></p><p>b</p>');
    });

    it('edits alt, title, size, alignment and style of the selected image', () => {
        start('<p><img src="assets/a.jpg" alt="" class="lazy" data-x="1"></p>');
        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(dialog().querySelector('h2').textContent).toBe('Edit image');
        expect(document.activeElement).toBe(field('Alternative text (alt)'));
        field('Alternative text (alt)').value = 'A cat';
        field('Title').value = 'Cat';
        field('Width').value = '320';
        field('Height').value = '240';
        field('Alignment').value = 'right';
        field('Style').value = 'article-image';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p><img src="assets/a.jpg" alt="A cat" title="Cat" width="320" height="240" class="lazy article-image align-right" data-x="1"></p>');
    });

    it('saving without changes keeps the image as it was', () => {
        const html = '<p><img src="assets/a.jpg" alt="x" class="align-left lazy" width="100%"></p>';
        start(html);
        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const docBefore = instance.editor.state.doc;
        click('Save');
        // No transaction changed the document, so the textarea keeps the original markup.
        expect(instance.editor.state.doc.eq(docBefore)).toBe(true);
        manager.syncAll();
        expect(document.getElementById('ta').value).toBe(html);
    });

    it('validates sizes and URLs', () => {
        start('<p><img src="assets/a.jpg" alt=""></p>');
        instance.editor.commands.setNodeSelection(1);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        field('Width').value = '12px';
        click('Save');
        expect(dialog().querySelector('[role="alert"]').textContent).toMatch(/whole numbers/);
        field('Width').value = '';
        field('Image URL').value = 'javascript:alert(1)';
        click('Save');
        expect(dialog().querySelector('[role="alert"]').textContent).toMatch(/not allowed/);
        expect(instance.editor.getHTML()).toBe('<p><img src="assets/a.jpg" alt=""></p>');
    });

    it('removes the image from the dialog', () => {
        start('<p>a<img src="assets/a.jpg" alt="">b</p>');
        instance.editor.commands.setNodeSelection(2);
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        click('Remove image');
        expect(instance.editor.getHTML()).toBe('<p>ab</p>');
    });

    it('inserts by URL when there is no Media Browser', () => {
        start('<p>a</p>', { mediaSource: null });
        instance.editor.commands.setTextSelection(2);
        instance.root.querySelector('[data-tiptapeditor-item="image"]').click();
        expect(dialog().querySelector('h2').textContent).toBe('Insert image');
        field('Image URL').value = 'https://example.com/a.png';
        field('Alternative text (alt)').value = 'Logo';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p>a<img src="https://example.com/a.png" alt="Logo"></p>');
    });

    it('the image button opens the dialog; a file picked in the Media Browser fills its URL', async () => {
        let select;
        window.Ext = { id: () => 'x', ComponentMgr: { isRegistered: () => true } };
        window.MODx = { config: {}, load: (config) => { select = config.listeners.select.fn; return { win: { on() {}, destroy() {} }, show() {} }; } };
        start('<p>a</p>', { mediaSource: { id: 1, baseUrl: '' } });
        instance.editor.commands.setTextSelection(2);
        instance.root.querySelector('[data-tiptapeditor-item="image"]').click();
        expect(dialog().querySelector('h2').textContent).toBe('Insert image');
        click('Choose in Media Browser…');
        select({ fullRelativeUrl: 'assets/new.png' });
        await vi.waitFor(() => expect(field('Image URL').value).toBe('assets/new.png'));
        // The focus stays in the dialog, not in the editor behind it.
        await new Promise((r) => requestAnimationFrame(r));
        expect(dialog().contains(document.activeElement)).toBe(true);
        field('Alternative text (alt)').value = 'New';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p>a<img src="assets/new.png" alt="New"></p>');
        delete window.MODx;
        delete window.Ext;
    });

    it('shows a contextual menu for a selected image', async () => {
        start('<p><img src="assets/a.jpg" alt=""></p>');
        instance.editor.commands.setNodeSelection(1);
        await new Promise((r) => setTimeout(r, 30));
        const menu = document.querySelector('.tiptapeditor__image-menu');
        expect(menu).not.toBeNull();
        const actions = [...menu.querySelectorAll('[data-tiptapeditor-image-action]')].filter((b) => !b.hidden).map((b) => b.dataset.tiptapeditorImageAction);
        expect(actions).toEqual(['edit', 'remove']);
        menu.querySelector('[data-tiptapeditor-image-action="edit"]').click();
        expect(dialog().querySelector('h2').textContent).toBe('Edit image');
    });
});
