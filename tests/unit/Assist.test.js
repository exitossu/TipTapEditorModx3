import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { fenomItems, modxItems } from '../../assets-src/js/modx/autocomplete.js';
import { createUploadHandler, uniqueName, uploadDirectory, uploadName } from '../../assets-src/js/modx/upload.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { menuItems } from '../../assets-src/js/ui/Menus.js';
import { countText } from '../../assets-src/js/ui/StatusBar.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const t = (key) => key;

let manager;
let instance;
function start(html, server = {}) {
    document.body.innerHTML = '<textarea id="ta"></textarea>';
    document.getElementById('ta').value = html;
    manager = new EditorManager(createLogger(false));
    manager.configure({ toolbar: 'bold', ...server });
    instance = manager.create('ta');
    return instance;
}
function key(name) {
    const { view } = instance.editor;
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    return view.someProp('handleKeyDown', (handler) => handler(view, event));
}
const list = () => document.querySelector('.tiptapeditor-suggest');
const labels = () => [...document.querySelectorAll('.tiptapeditor-suggest__label')].map((el) => el.textContent);
const types = () => {
    const names = [];
    instance.editor.state.doc.descendants((node) => {
        names.push(node.type.name);
    });
    return names;
};

afterEach(() => {
    manager?.destroyAll();
    document.querySelectorAll('.tiptapeditor-suggest, .tiptapeditor-dialog').forEach((el) => el.remove());
});

describe('bubble and floating menus', () => {
    it('menu settings: true = default items, false = off, a string = own items', () => {
        expect(menuItems(true, 'a b')).toBe('a b');
        expect(menuItems('1', 'a b')).toBe('a b');
        expect(menuItems(false, 'a b')).toBe('');
        expect(menuItems('', 'a b')).toBe('');
        expect(menuItems('bold link', 'a b')).toBe('bold link');
    });

    it('both menus are built from their settings; switched off they are not there', async () => {
        start('<p>abc</p>', { bubbleMenu: 'bold italic link', floatingMenu: true });
        const names = () => instance.editor.extensionManager.extensions.map((extension) => extension.name);
        expect(names()).toEqual(expect.arrayContaining(['bubbleMenu', 'floatingMenu']));
        instance.editor.commands.setTextSelection({ from: 1, to: 3 });
        await wait(200);
        const bubble = document.querySelector('.tiptapeditor__bubble [role="toolbar"]');
        expect([...bubble.querySelectorAll('[data-tiptapeditor-item]')].map((el) => el.dataset.tiptapeditorItem)).toEqual(['bold', 'italic', 'link']);
        manager.destroyAll();
        start('<p>a</p>', { bubbleMenu: false, floatingMenu: false });
        expect(names()).not.toContain('bubbleMenu');
        expect(names()).not.toContain('floatingMenu');
    });

    it('a bubble menu button formats the selection', async () => {
        start('<p>abc</p>', { bubbleMenu: true });
        instance.editor.commands.setTextSelection({ from: 1, to: 3 });
        await wait(200);
        document.querySelector('.tiptapeditor__bubble [data-tiptapeditor-item="bold"]').click();
        expect(serialize(instance.editor)).toBe('<p><strong>ab</strong>c</p>');
    });
});

describe('slash commands', () => {
    it('"/" on an empty paragraph lists blocks, typing filters, Enter applies', async () => {
        start('<p>a</p>', { slashCommands: true });
        instance.editor.chain().setTextSelection(2).splitBlock().insertContent('/').run();
        await wait(20);
        expect(list().hidden).toBe(false);
        expect(labels()).toEqual(['Paragraph', 'Heading 2', 'Heading 3', 'Bullet list', 'Numbered list', 'Quote',
            'Image', 'Table', 'Code block', 'Horizontal line', 'Video or embed']);
        instance.editor.commands.insertContent('h3');
        await wait(20);
        expect(labels()).toEqual(['Heading 3']);
        expect(key('Enter')).toBe(true);
        expect(serialize(instance.editor)).toBe('<p>a</p><h3></h3>');
        expect(list()).toBeNull();
    });

    it('not inside text, and Escape closes the list keeping the text', async () => {
        start('<p>a</p>', { slashCommands: true });
        instance.editor.chain().setTextSelection(2).insertContent('/x').run();
        await wait(20);
        expect(list()).toBeNull();
        instance.editor.chain().splitBlock().insertContent('/').run();
        await wait(20);
        expect(list()).not.toBeNull();
        expect(key('Escape')).toBe(true);
        await wait(20);
        expect(list()).toBeNull();
        expect(serialize(instance.editor)).toBe('<p>a/x</p><p>/</p>');
    });

    it('slash_commands off: "/" is just a character', async () => {
        start('<p></p>', { slashCommands: false });
        instance.editor.chain().setTextSelection(1).insertContent('/').run();
        await wait(20);
        expect(list()).toBeNull();
    });
});

describe('MODX and Fenom autocomplete', () => {
    const options = { config: {}, t, logger: null };

    it('suggests tag types, resource fields, and Fenom $_modx members', async () => {
        expect((await modxItems('', options)).map((item) => item.insert)).toEqual(['[[*', '[[!', '[[$', '[[++', '[[~']);
        expect((await modxItems('*long', options)).map((item) => item.insert)).toEqual(['[[*longtitle]]']);
        expect(await modxItems('%lex', options)).toEqual([]);
        expect(await modxItems('+pl', options)).toEqual([]);
        expect((await fenomItems('_modx->res', options)).map((item) => item.insert)[0]).toBe('{$_modx->resource.');
        expect((await fenomItems('_modx->resource.intro', options)).map((item) => item.insert)).toEqual(['{$_modx->resource.introtext}']);
        expect((await fenomItems('_modx->runSn', options)).map((item) => item.insert)).toEqual(['{$_modx->runSnippet(']);
        expect((await fenomItems('paget', options)).map((item) => item.insert)).toEqual(['{$pagetitle}']);
    });

    it('asks the connector for elements and settings, and never fails the editor', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
            success: true, results: [{ name: 'pdoResources', description: 'List resources' }],
        })));
        const config = { connectorUrl: '/connector.php' };
        const items = await modxItems('!pdo', { ...options, config });
        expect(items).toEqual([{ label: 'pdoResources', detail: 'List resources', insert: '[[!pdoResources]]' }]);
        const body = fetch.mock.calls[0][1].body;
        expect(body.get('action')).toBe('TipTapEditor\\Processors\\Element\\SearchSnippets');
        expect(body.get('query')).toBe('pdo');
        fetch.mockRejectedValue(new Error('offline'));
        expect(await modxItems('$head', { ...options, config })).toEqual([]);
        fetch.mockRestore();
    });

    it('picking a field inserts the whole tag, which becomes a protected token', async () => {
        start('<p>a</p>', { modxAutocomplete: true });
        instance.editor.chain().setTextSelection(2).insertContent(' [[*pagetit').run();
        await wait(400);
        expect(labels()).toEqual(['pagetitle']);
        expect(key('Enter')).toBe(true);
        expect(serialize(instance.editor)).toBe('<p>a [[*pagetitle]]</p>');
        expect(types()).toContain('modxSyntax');
    });

    it('no suggestions inside code', async () => {
        start('<pre><code>x</code></pre>', { modxAutocomplete: true });
        instance.editor.chain().setTextSelection(2).insertContent('[[*').run();
        await wait(400);
        expect(list()).toBeNull();
    });
});

describe('status bar', () => {
    it('counts words and characters, shows the element path', async () => {
        start('<p>Hello <strong>big</strong> world [[*pagetitle]]</p><ul><li><p>x</p></li></ul>', { statusbar: true });
        const bar = instance.root.querySelector('.tiptapeditor__statusbar');
        expect(bar.querySelector('.tiptapeditor__statusbar-counts').textContent).toBe('Words: 5   Characters: 31');
        instance.editor.commands.setTextSelection(9);
        await frame();
        expect(bar.querySelector('.tiptapeditor__statusbar-path').textContent).toBe('p > strong');
        instance.editor.commands.setTextSelection(instance.editor.state.doc.content.size - 2);
        await frame();
        expect(bar.querySelector('.tiptapeditor__statusbar-path').textContent).toBe('ul > li > p');
    });

    it('off by default', () => {
        start('<p>a</p>');
        expect(instance.root.querySelector('.tiptapeditor__statusbar')).toBeNull();
    });

    it('counts Cyrillic words', () => {
        start('<p>Привет, мир! Ёлка-палка 2026</p>');
        expect(countText(instance.editor.state.doc)).toEqual({ words: 4, characters: 28 });
    });
});

describe('image upload through MODX', () => {
    it('safe file names, the prefix as the name, free names and upload folders', () => {
        expect(uploadName({ name: 'Фото Отпуска (1).JPG', type: 'image/jpeg' })).toBe('foto-otpuska-1.jpg');
        expect(uploadName({ name: 'Café menu.png', type: 'image/png' })).toBe('cafe-menu.png');
        expect(uploadName({ name: '', type: 'image/webp' })).toBe('image.webp');
        expect(uploadName({ name: 'Фото.JPG', type: 'image/jpeg' }, '15')).toBe('15.jpg');
        expect(uploadName({ name: 'a.png', type: 'image/png' }, '15-')).toBe('15.png');
        expect(uploadName({ name: 'a.png', type: 'image/png' }, '../x/y')).toBe('x-y.png');
        expect(uniqueName('15.png', new Set())).toBe('15.png');
        expect(uniqueName('15.png', new Set(['15.png', '15-1.png']))).toBe('15-2.png');
        expect(uploadDirectory('assets/uploads')).toBe('assets/uploads/');
        expect(uploadDirectory('/../assets//./img/../x/')).toBe('assets/img/x/');
        expect(uploadDirectory('')).toBe('/');
    });

    it('off unless enabled with a Media Source and a manager connector', () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' }, siteId: 'tok' };
        expect(createUploadHandler({ uploadEnabled: false, mediaSource: { id: 1 } })).toBeNull();
        expect(createUploadHandler({ uploadEnabled: true, mediaSource: null })).toBeNull();
        expect(createUploadHandler({ uploadEnabled: true, mediaSource: { id: 1 } })).toBeTypeOf('function');
        delete window.MODx;
        expect(createUploadHandler({ uploadEnabled: true, mediaSource: { id: 1 } })).toBeNull();
    });

    it('uploads with the MODX processor and returns the URL MODX lists', async () => {
        window.MODx = { config: { connector_url: '/connectors/index.php' }, siteId: 'tok' };
        const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, request) => {
            const action = request.body.get('action');
            if (action === 'Browser/File/Upload') {
                return new Response(JSON.stringify({ success: true }));
            }
            const name = fetch.mock.calls.find(([, r]) => r.body.get('action') === 'Browser/File/Upload')?.[1].body.get('file').name;
            if (!name) {
                return new Response(JSON.stringify({ success: true, results: [{ name: 'shot.png' }] }));
            }
            return new Response(JSON.stringify({ success: true, results: [{ name, fullRelativeUrl: `assets/uploads/${name}` }] }));
        });
        const upload = createUploadHandler({ uploadEnabled: true, uploadPath: 'assets/uploads/', mediaSource: { id: 2 }, resource: { context: 'web' } });
        const url = await upload(new File(['x'], 'shot.png', { type: 'image/png' }));
        // shot.png is already in the folder: the new file does not replace it.
        expect(url).toBe('assets/uploads/shot-1.png');
        expect(fetch.mock.calls[0][1].body.get('action')).toBe('Browser/Directory/GetFiles');
        const sent = fetch.mock.calls[1][1].body;
        expect(fetch.mock.calls[1][0]).toBe('/connectors/index.php');
        expect(sent.get('source')).toBe('2');
        expect(sent.get('path')).toBe('assets/uploads/');
        expect(sent.get('HTTP_MODAUTH')).toBe('tok');
        expect(fetch.mock.calls[2][1].body.get('action')).toBe('Browser/Directory/GetFiles');

        // A file type the source does not allow is skipped by MODX without an error.
        fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true, results: [] })));
        await expect(upload(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow(/not in the Media Source/);
        fetch.mockRestore();
        delete window.MODx;
    });
});

describe('empty content', () => {
    it.each([['<p></p>'], ['<p><br></p>'], ['  <p>&nbsp;</p>\n'], ['']])('%j opens as an empty editor and stays as written until edited', (value) => {
        start(value);
        expect(instance).not.toBeNull();
        expect(instance.editor.isEmpty).toBe(true);
        manager.syncAll();
        expect(document.getElementById('ta').value).toBe(value);
    });
});
