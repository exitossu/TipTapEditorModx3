import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import {
    cleanHref, parseClassPresets, relForTarget, resourceHref, resourceIdOf,
} from '../../assets-src/js/links/links.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('link helpers', () => {
    it('never prepends a protocol and refuses script URLs', () => {
        expect(cleanHref(' [[~12]] ')).toBe('[[~12]]');
        expect(cleanHref('#top')).toBe('#top');
        expect(cleanHref('mailto:a@b.c')).toBe('mailto:a@b.c');
        expect(cleanHref('tel:+7123')).toBe('tel:+7123');
        expect(cleanHref('example.com')).toBe('example.com');
        expect(cleanHref('javascript:alert(1)')).toBeNull();
        expect(cleanHref(' JaVa\tscript:alert(1)')).toBeNull();
        expect(cleanHref('data:text/html,x')).toBeNull();
        expect(cleanHref('  ')).toBeNull();
    });

    it('adds and removes noopener noreferrer with the target, keeping other tokens', () => {
        expect(relForTarget('nofollow', true)).toBe('nofollow noopener noreferrer');
        expect(relForTarget('nofollow noopener noreferrer', false)).toBe('nofollow');
        expect(relForTarget('', false)).toBe('');
    });

    it('reads class presets from JSON or a list', () => {
        expect(parseClassPresets('{"button":"Button","link--more":"More"}')).toEqual([
            { value: 'button', label: 'Button' }, { value: 'link--more', label: 'More' },
        ]);
        expect(parseClassPresets('a, b')).toEqual([{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }]);
        expect(parseClassPresets('{broken')).toEqual([]);
    });

    it('builds and recognises resource links in the configured format', () => {
        const resource = { id: 12, context_key: 'web', uri: 'news/' };
        expect(resourceHref(resource)).toBe('[[~12]]');
        expect(resourceHref(resource, '[[~{id}? &scheme=`full`]]')).toBe('[[~12? &scheme=`full`]]');
        expect(resourceHref(resource, 'no placeholder')).toBe('[[~12]]');
        expect(resourceIdOf('[[~12]]')).toBe(12);
        expect(resourceIdOf('[[~12? &scheme=`full`]]', '[[~{id}? &scheme=`full`]]')).toBe(12);
        expect(resourceIdOf('/news/')).toBeNull();
    });
});

describe('link dialog', () => {
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
        manager.configure({
            toolbar: 'link modxLink unlink anchor',
            connectorUrl: '/assets/components/tiptapeditor/connector.php',
            resource: { id: 1, context: 'web' },
            ...extra,
        });
        instance = manager.create('ta');
    };

    afterEach(() => {
        dialog()?.remove();
        manager.destroyAll();
        vi.unstubAllGlobals();
        delete window.MODx;
    });

    it('opens with Mod+K, is a labelled modal and closes with Escape', () => {
        start('<p>Hello world</p>');
        instance.editor.commands.setTextSelection({ from: 1, to: 6 });
        instance.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: !isMac, metaKey: isMac, bubbles: true }));
        const win = dialog().querySelector('[role="dialog"]');
        expect(win.getAttribute('aria-modal')).toBe('true');
        expect(document.getElementById(win.getAttribute('aria-labelledby')).textContent).toBe('Insert link');
        expect(document.activeElement).toBe(field('URL'));
        dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(dialog()).toBeNull();
    });

    it('links the selection without adding target or rel', () => {
        start('<p>Hello world</p>');
        instance.editor.commands.setTextSelection({ from: 1, to: 6 });
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        field('URL').value = '[[~12]]';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p><a href="[[~12]]">Hello</a> world</p>');
    });

    it('new window adds a safe rel; title and class are written', () => {
        start('<p>Hello world</p>', { linkClasses: '{"button":"Button"}' });
        instance.editor.commands.setTextSelection({ from: 1, to: 6 });
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        field('URL').value = 'https://example.com';
        field('Title').value = 'Example';
        field('Open in').value = '_blank';
        field('Open in').dispatchEvent(new Event('change'));
        expect(field('Rel').value).toBe('noopener noreferrer');
        field('CSS class').value = 'button';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p><a target="_blank" rel="noopener noreferrer" class="button" href="https://example.com" title="Example">Hello</a> world</p>');
    });

    it('edits and removes an existing link, keeping unknown attributes out of it', () => {
        start('<p><a href="/old/" class="x">Hello</a> world</p>');
        instance.editor.commands.setTextSelection(3);
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        expect(field('URL').value).toBe('/old/');
        expect(field('CSS class').value).toBe('x');
        field('URL').value = '/new/';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p><a class="x" href="/new/">Hello</a> world</p>');

        instance.editor.commands.setTextSelection(3);
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        click('Remove link');
        expect(instance.editor.getHTML()).toBe('<p>Hello world</p>');
    });

    it('refuses javascript: URLs', () => {
        start('<p>Hello</p>');
        instance.editor.commands.setTextSelection({ from: 1, to: 6 });
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        field('URL').value = 'javascript:alert(1)';
        click('Save');
        expect(dialog().querySelector('[role="alert"]').textContent).toMatch(/not allowed/);
        expect(instance.editor.getHTML()).toBe('<p>Hello</p>');
    });

    it('inserts text and link when nothing is selected', () => {
        start('<p>Hello</p>');
        instance.editor.commands.setTextSelection(6);
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        field('URL').value = 'mailto:a@b.c';
        field('Link text').value = ' mail';
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p>Hello<a href="mailto:a@b.c">mail</a></p>');
    });

    it('searches MODX resources through the connector and inserts [[~id]]', async () => {
        window.MODx = { siteId: 'token123' };
        const fetchMock = vi.fn(async (url, init) => ({
            ok: true,
            json: async () => ({
                success: true,
                total: 1,
                results: [{ id: 12, pagetitle: 'News', longtitle: '', context_key: 'web', uri: 'news/', published: true }],
                request: { url, body: String(init.body), headers: init.headers },
            }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        start('<p>Hello</p>');
        instance.editor.commands.setTextSelection(6);
        instance.root.querySelector('[data-tiptapeditor-item="modxLink"]').click();
        const search = dialog().querySelector('input[type="search"]');
        expect(document.activeElement).toBe(search);
        search.value = 'ne';
        search.dispatchEvent(new Event('input'));
        await wait(350);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/assets/components/tiptapeditor/connector.php');
        const body = new URLSearchParams(init.body);
        expect(body.get('action')).toBe('TipTapEditor\\Processors\\Resource\\Search');
        expect(body.get('query')).toBe('ne');
        expect(body.get('context')).toBe('web');
        expect(init.headers.modAuth).toBe('token123');
        const option = dialog().querySelector('[role="option"]');
        expect(option.getAttribute('aria-selected')).toBe('true');
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(field('URL').value).toBe('[[~12]]');
        expect(field('Link text').value).toBe('News');
        click('Save');
        expect(instance.editor.getHTML()).toBe('<p>Hello<a href="[[~12]]">News</a></p>');
    });

    it('offers heading anchors and sets them', () => {
        start('<h2 id="prices">Prices</h2><h3>Contacts</h3><p>Go</p>');
        expect(instance.editor.getHTML()).toBe('<h2 id="prices">Prices</h2><h3>Contacts</h3><p>Go</p>');
        instance.editor.commands.setTextSelection(12);
        instance.root.querySelector('[data-tiptapeditor-item="anchor"]').click();
        field('Anchor name (id)').value = '1bad';
        click('Save');
        expect(dialog().querySelector('[role="alert"]').textContent).toMatch(/not a valid/);
        field('Anchor name (id)').value = 'contacts';
        click('Save');
        expect(instance.editor.getHTML()).toContain('<h3 id="contacts">Contacts</h3>');

        instance.editor.commands.setTextSelection({ from: 19, to: 21 });
        instance.root.querySelector('[data-tiptapeditor-item="link"]').click();
        const select = [...dialog().querySelectorAll('select')].find((s) => s.getAttribute('aria-label') === 'Anchor in this text…');
        expect([...select.options].map((o) => o.value)).toEqual(['', '#prices', '#contacts']);
        select.value = '#contacts';
        select.dispatchEvent(new Event('change'));
        click('Save');
        expect(instance.editor.getHTML()).toContain('<p><a href="#contacts">Go</a></p>');
    });
});
