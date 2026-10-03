import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { browseFile, fileUrl, folderOf, previewUrl } from '../../assets-src/js/modx/MediaBrowser.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

// The in-page browser hands the file back a couple of ticks after it closes.
const flush = () => new Promise((r) => setTimeout(r, 60));

/** Minimal stand-in for MODX's in-page browser: remembers the config, lets a test pick a file. */
function fakeModx() {
    const opened = [];
    const destroyed = [];
    const handlers = {};
    window.Ext = { id: () => 'ext-1', ComponentMgr: { isRegistered: (x) => x === 'modx-browser' } };
    window.MODx = {
        config: { manager_url: '/manager/' },
        load(config) {
            opened.push(config);
            return {
                win: { on: (event, fn) => { handlers[event] = fn; }, destroy: () => { destroyed.push(config); } },
                show() {},
            };
        },
    };
    return {
        opened,
        destroyed,
        pick(data) {
            handlers.hide?.();
            opened.at(-1).listeners.select.fn(data);
        },
        cancel() {
            handlers.hide?.();
        },
    };
}

describe('Media Browser URLs', () => {
    it('stores what MODX returns, or prefixes the site base URL in root mode', () => {
        const file = { fullRelativeUrl: 'assets/img/a.jpg', relativeUrl: 'img/a.jpg' };
        expect(fileUrl(file)).toBe('assets/img/a.jpg');
        expect(fileUrl(file, 'root', '/')).toBe('/assets/img/a.jpg');
        expect(fileUrl(file, 'root', '/sub/')).toBe('/sub/assets/img/a.jpg');
        expect(fileUrl({ fullRelativeUrl: 'https://bucket.s3.amazonaws.com/a.jpg' }, 'root')).toBe('https://bucket.s3.amazonaws.com/a.jpg');
    });

    it('resolves relative previews against the site, leaves absolute URLs and tags alone', () => {
        expect(previewUrl('assets/a.jpg', '/sub/')).toBe('/sub/assets/a.jpg');
        expect(previewUrl('/assets/a.jpg', '/sub/')).toBe('/assets/a.jpg');
        expect(previewUrl('https://x.test/a.jpg')).toBe('https://x.test/a.jpg');
        expect(previewUrl('[[++assets_url]]a.jpg')).toBe('[[++assets_url]]a.jpg');
    });

    it('finds the folder of an existing file inside the Media Source', () => {
        expect(folderOf('assets/img/x/a.jpg', { baseUrl: 'assets/' })).toBe('img/x/');
        expect(folderOf('/assets/img/a.jpg', { baseUrl: '/assets/' })).toBe('img/');
        expect(folderOf('/sub/assets/img/a.jpg', { baseUrl: 'assets/' }, '/sub/')).toBe('img/');
        expect(folderOf('other/a.jpg', { baseUrl: 'assets/' })).toBe('');
        expect(folderOf('https://cdn.test/a.jpg', { baseUrl: '' })).toBe('');
    });
});

describe('browseFile', () => {
    let modx;
    beforeEach(() => {
        modx = fakeModx();
    });
    afterEach(() => {
        delete window.MODx;
        delete window.Ext;
    });

    it('opens the in-page browser with the field source and context', async () => {
        const result = browseFile({ source: { id: 3 }, context: 'en', openTo: 'img/', fileTypes: 'jpg' });
        expect(modx.opened[0]).toMatchObject({ xtype: 'modx-browser', source: 3, wctx: 'en', openTo: 'img/', allowedFileTypes: 'jpg' });
        modx.pick({ fullRelativeUrl: 'assets/img/a.jpg' });
        expect(await result).toEqual({ fullRelativeUrl: 'assets/img/a.jpg' });
        await new Promise((r) => setTimeout(r, 10));
        expect(modx.destroyed).toHaveLength(1);
    });

    it('resolves null on cancel and without a source', async () => {
        const result = browseFile({ source: { id: 1 } });
        modx.cancel();
        expect(await result).toBeNull();
        expect(await browseFile({ source: null })).toBeNull();
        expect(modx.opened).toHaveLength(1);
    });

    it('popup fallback accepts only same-origin messages from its own window', async () => {
        window.Ext.ComponentMgr.isRegistered = () => false;
        const popup = { closed: false };
        const open = vi.spyOn(window, 'open').mockReturnValue(popup);
        const result = browseFile({ source: { id: 2 }, context: 'web' });
        expect(open.mock.calls[0][0]).toContain('a=browser');
        expect(open.mock.calls[0][0]).toContain('tiptapeditor=1');
        const message = { source: 'tiptapeditor', action: 'selectFile', data: { fullRelativeUrl: 'assets/b.png' } };
        window.dispatchEvent(new MessageEvent('message', { data: message, origin: 'https://evil.test', source: popup }));
        window.dispatchEvent(new MessageEvent('message', { data: message, origin: window.location.origin, source: popup }));
        expect(await result).toEqual({ fullRelativeUrl: 'assets/b.png' });
        open.mockRestore();
    });
});

describe('image and file buttons', () => {
    let manager;
    let instance;
    let modx;
    const button = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);
    const dialogButton = (text) => [...document.querySelectorAll('.tiptapeditor-dialog button')].find((b) => b.textContent === text);
    // The image button opens the image dialog; the Media Browser is one of its sources.
    const browseFromDialog = () => {
        button('image').click();
        dialogButton('Choose in Media Browser…').click();
    };

    const start = (html, extra = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({
            toolbar: 'image file',
            mediaSource: { id: 1, name: 'Filesystem', baseUrl: 'assets/' },
            siteBaseUrl: '/sub/',
            resource: { id: 5, context: 'web' },
            syncDelay: 5,
            ...extra,
        });
        instance = manager.create('ta');
    };

    beforeEach(() => {
        modx = fakeModx();
    });
    afterEach(() => {
        document.querySelectorAll('.tiptapeditor-dialog').forEach((el) => el.remove());
        manager.destroyAll();
        delete window.MODx;
        delete window.Ext;
    });

    it('inserts an image with the URL from MODX and shows it resolved in the editor', async () => {
        start('<p>Text</p>');
        instance.editor.commands.setTextSelection(5);
        browseFromDialog();
        expect(modx.opened[0].allowedFileTypes).toContain('webp');
        modx.pick({ fullRelativeUrl: 'assets/img/a.jpg' });
        await vi.waitFor(() => expect(document.querySelector('.tiptapeditor-dialog input').value).toBe('assets/img/a.jpg'));
        dialogButton('Save').click();
        await vi.waitFor(() => expect(instance.editor.getHTML()).toBe('<p>Text<img src="assets/img/a.jpg" alt=""></p>'));
        expect(instance.root.querySelector('.ProseMirror img').getAttribute('src')).toBe('/sub/assets/img/a.jpg');
    });

    it('replaces only the file of a selected image and opens its folder', async () => {
        start('<p><img src="assets/img/old/a.jpg" alt="Alt" title="T" width="40"></p>');
        instance.editor.commands.setNodeSelection(1);
        browseFromDialog();
        expect(modx.opened[0].openTo).toBe('img/old/');
        modx.pick({ fullRelativeUrl: 'assets/img/new.png' });
        await vi.waitFor(() => expect(document.querySelector('.tiptapeditor-dialog input').value).toBe('assets/img/new.png'));
        dialogButton('Save').click();
        await vi.waitFor(() => expect(instance.editor.getHTML()).toBe('<p><img src="assets/img/new.png" alt="Alt" title="T" width="40"></p>'));
    });

    it('links the selected text to a file, or inserts the file name as a link', async () => {
        start('<p>Price list</p>');
        instance.editor.commands.setTextSelection({ from: 1, to: 6 });
        button('file').click();
        expect(modx.opened[0].allowedFileTypes).toBe('');
        modx.pick({ fullRelativeUrl: 'assets/docs/price.pdf', name: 'price.pdf' });
        await flush();
        expect(instance.editor.getHTML()).toBe('<p><a href="assets/docs/price.pdf">Price</a> list</p>');

        instance.editor.commands.setTextSelection(11);
        button('file').click();
        modx.pick({ fullRelativeUrl: 'assets/docs/b.pdf', name: 'b.pdf' });
        await flush();
        expect(instance.editor.getHTML()).toContain('<a href="assets/docs/b.pdf">b.pdf</a>');
    });

    it('without a browsable source: file link disabled, image asks for a URL', () => {
        start('<p>x</p>', { mediaSource: null });
        expect(button('file').disabled).toBe(true);
        expect(button('image').disabled).toBe(false);
        button('image').click();
        expect(modx.opened).toHaveLength(0);
        expect(document.querySelector('.tiptapeditor-dialog [role="dialog"]')).not.toBeNull();
    });

    it('uses the Media Source of a TV', () => {
        document.body.innerHTML = '<textarea id="tv4" class="modx-richtext"><p>x</p></textarea>';
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'image', mediaSource: { id: 1 }, tvs: { tv4: { id: 4, mediaSource: { id: 7, baseUrl: '' } } } });
        instance = manager.create('tv4');
        browseFromDialog();
        expect(modx.opened[0].source).toBe(7);
    });

    it('never inserts dropped or pasted files as data URLs without an upload handler', () => {
        start('<p>x</p>');
        const file = new File(['x'], 'a.png', { type: 'image/png' });
        const view = instance.editor.view;
        const dataTransfer = { files: [file], types: ['Files'] };
        const handled = view.someProp('handleDrop', (f) => f(view, { dataTransfer, preventDefault() {}, clientX: 0, clientY: 0 }, null, false));
        expect(handled).toBe(true);
        const pasted = view.someProp('handlePaste', (f) => f(view, { clipboardData: dataTransfer, preventDefault() {} }, null));
        expect(pasted).toBe(true);
        expect(instance.editor.getHTML()).toBe('<p>x</p>');
        const message = instance.root.querySelector('.tiptapeditor__message');
        expect(message.hidden).toBe(false);
        expect(message.textContent).toMatch(/Image button/);
    });

    it('drops data: images from pasted HTML instead of storing base64', () => {
        start('<p>x</p>');
        instance.editor.view.pasteHTML('<p>a<img src="data:image/png;base64,AAAA">b</p>');
        expect(instance.editor.getHTML()).not.toContain('data:');
        expect(instance.editor.getHTML()).toContain('ab');
    });
});

describe('hasFileType', () => {
    it('checks the extension of the picked file', async () => {
        const { hasFileType } = await import('../../assets-src/js/modx/MediaBrowser.js');
        expect(hasFileType({ fullRelativeUrl: 'a/B.JPG' }, 'jpg,png')).toBe(true);
        expect(hasFileType({ ext: 'pdf', fullRelativeUrl: 'a/b.pdf' }, 'jpg,png')).toBe(false);
        expect(hasFileType({ fullRelativeUrl: 'a/b.pdf' }, '')).toBe(true);
    });
});
