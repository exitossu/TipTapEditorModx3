import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { createImportHandler, IMAGE_IMPORT } from '../../assets-src/js/modx/upload.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

let manager;
let instance;
const button = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);
const dialog = () => document.querySelector('.tiptapeditor-dialog');

function start(html, extra = {}) {
    document.body.innerHTML = '<textarea id="ta"></textarea>';
    document.getElementById('ta').value = html;
    manager = new EditorManager(createLogger(false));
    manager.configure({
        toolbar: 'image imageUpload imageUrl',
        mediaSource: { id: 2, name: 'Filesystem', baseUrl: '/' },
        connectorUrl: '/assets/components/tiptapeditor/connector.php',
        siteBaseUrl: '/',
        resource: { id: 5, context: 'web' },
        uploadEnabled: true,
        uploadPath: 'assets/uploads/',
        syncDelay: 5,
        ...extra,
    });
    instance = manager.create('ta');
    return instance;
}

/** Answers the next file picker with the given file. */
function pickFile(file) {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function pick() {
        Object.defineProperty(this, 'files', { value: file ? [file] : [] });
        this.dispatchEvent(new Event('change'));
        click.mockRestore();
    });
}

function fakeServer(importResult) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
        const action = request.body.get('action');
        if (action === IMAGE_IMPORT) {
            return new Response(JSON.stringify(importResult));
        }
        return new Response(JSON.stringify({ success: true, results: [{ name: 'photo-abc123.jpg', fullRelativeUrl: 'assets/uploads/photo-abc123.jpg' }] }));
    });
}

afterEach(() => {
    manager?.destroyAll();
    document.querySelectorAll('.tiptapeditor-dialog, input[type="file"]').forEach((el) => el.remove());
    vi.restoreAllMocks();
    delete window.MODx;
});

describe('image from computer and by URL', () => {
    it('both buttons are hidden while uploads are off', async () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' } };
        start('<p>a</p>', { uploadEnabled: false });
        await frame();
        expect(button('image')).not.toBeNull();
        expect(button('imageUpload')).toBeNull();
        expect(button('imageUrl')).toBeNull();
    });

    it('uploads a picked file and opens the image dialog for the new image', async () => {
        const upload = vi.fn(async (file) => `assets/uploads/${file.name}`);
        start('<p>Text</p>', { uploadHandler: upload });
        instance.editor.commands.setTextSelection(5);
        await frame();
        pickFile(new File(['x'], 'shot.png', { type: 'image/png' }));
        button('imageUpload').click();
        await vi.waitFor(() => expect(instance.editor.getHTML()).toBe('<p>Text<img src="assets/uploads/shot.png" alt="" title=""></p>'));
        expect(upload).toHaveBeenCalledTimes(1);
        expect(dialog()?.textContent).toContain('Edit image');
        expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('replaces only the file of a selected image', async () => {
        start('<p><img src="assets/old.jpg" alt="Alt" title="T" width="40"></p>', { uploadHandler: async () => 'assets/uploads/new.png' });
        instance.editor.commands.setNodeSelection(1);
        await frame();
        pickFile(new File(['x'], 'new.png', { type: 'image/png' }));
        button('imageUpload').click();
        await vi.waitFor(() => expect(instance.editor.getHTML()).toBe('<p><img src="assets/uploads/new.png" alt="Alt" title="T" width="40"></p>'));
        expect(dialog()).toBeNull();
    });

    it('refuses a file that is not an image without uploading it', async () => {
        const upload = vi.fn();
        start('<p>Text</p>', { uploadHandler: upload });
        await frame();
        pickFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
        button('imageUpload').click();
        await vi.waitFor(() => expect(instance.root.querySelector('.tiptapeditor__message')?.textContent).toContain('not an image'));
        expect(upload).not.toHaveBeenCalled();
        expect(instance.editor.getHTML()).toBe('<p>Text</p>');
    });

    it('imports an image by URL through the TipTapEditor connector', async () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' }, siteId: 'tok' };
        const fetch = fakeServer({ success: true, object: { name: 'photo-abc123.jpg', path: 'assets/uploads/' } });
        start('<p>Text</p>');
        instance.editor.commands.setTextSelection(5);
        await frame();
        button('imageUrl').click();
        const input = dialog().querySelector('input');
        input.value = ' https://example.com/photo.jpg ';
        dialog().querySelector('.tiptapeditor-dialog__button--primary').click();
        await vi.waitFor(() => expect(instance.editor.getHTML()).toBe('<p>Text<img src="assets/uploads/photo-abc123.jpg" alt="" title=""></p>'));
        const sent = fetch.mock.calls[0][1].body;
        expect(fetch.mock.calls[0][0]).toBe('/assets/components/tiptapeditor/connector.php');
        expect(sent.get('action')).toBe(IMAGE_IMPORT);
        expect(sent.get('url')).toBe('https://example.com/photo.jpg');
        expect(sent.get('source')).toBe('2');
        expect(sent.has('path')).toBe(false);
        expect(fetch.mock.calls[1][1].body.get('dir')).toBe('assets/uploads/');
        // The image dialog follows for alt text and size.
        expect(dialog()?.textContent).toContain('Edit image');
    });

    it('shows the server error in the dialog and keeps it open', async () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' } };
        fakeServer({ success: false, message: 'Not allowed host' });
        start('<p>Text</p>');
        await frame();
        button('imageUrl').click();
        dialog().querySelector('input').value = 'http://10.0.0.1/a.png';
        dialog().querySelector('.tiptapeditor-dialog__button--primary').click();
        await vi.waitFor(() => expect(dialog().querySelector('.tiptapeditor-dialog__error').textContent).toBe('Not allowed host'));
        expect(instance.editor.getHTML()).toBe('<p>Text</p>');
    });

    it('checks the address before asking the server', async () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' } };
        const fetch = fakeServer({ success: true });
        start('<p>Text</p>');
        await frame();
        button('imageUrl').click();
        dialog().querySelector('input').value = 'javascript:alert(1)';
        dialog().querySelector('.tiptapeditor-dialog__button--primary').click();
        expect(dialog().querySelector('.tiptapeditor-dialog__error').textContent).toMatch(/http:\/\/ or https:/);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('import handler is off without uploads, a Media Source or a connector', () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' } };
        const base = { uploadEnabled: true, mediaSource: { id: 1 }, connectorUrl: '/c.php' };
        expect(createImportHandler(base)).toBeTypeOf('function');
        expect(createImportHandler({ ...base, uploadEnabled: false })).toBeNull();
        expect(createImportHandler({ ...base, mediaSource: null })).toBeNull();
        expect(createImportHandler({ ...base, connectorUrl: '' })).toBeNull();
    });
});
