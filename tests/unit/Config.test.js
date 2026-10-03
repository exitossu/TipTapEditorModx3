import { Extension } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { configData, profileName, resolveConfig } from '../../assets-src/js/editor/config.js';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { registerExtension } from '../../assets-src/js/editor/registry.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { absoluteUrls, scopeSelector, splitSelectors } from '../../assets-src/js/ui/contentCss.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('configuration layers', () => {
    it('applies defaults, settings, external config, profile and runtime options in that order', () => {
        const config = resolveConfig(
            { toolbar: 'bold', minHeight: 100, features: { tables: true, images: true } },
            configData({ toolbar: 'italic', features: { tables: false }, minHeight: 150 }),
            configData({ toolbar: ['undo', 'redo', '|', ['bold', 'link']] }),
            { minHeight: 300 },
        );
        expect(config.toolbar).toBe('undo redo | bold link');
        expect(configData({ toolbar: [['undo', 'redo'], ['bold']] }).toolbar).toBe('undo redo | bold');
        expect(config.features).toMatchObject({ tables: false, images: true, fullscreen: true });
        expect(config.minHeight).toBe(300);
        expect(config.defaultHeight).toBe(300);
    });

    it('takes only known keys from external config and profiles', () => {
        expect(configData({ toolbar: 'bold', debug: true, uploadHandler: 'x', elements: ['a'], lexicon: {} })).toEqual({ toolbar: 'bold' });
        expect(configData(null)).toEqual({});
        expect(configData(['toolbar'])).toEqual({});
    });

    it('keeps only safe editor attributes', () => {
        const config = resolveConfig({ editorProps: { attributes: { spellcheck: 'false', onclick: 'x()', contenteditable: 'false', 'data-x': 1, lang: 'ru', style: 'x' } } });
        expect(config.editorAttributes).toEqual({ spellcheck: 'false', 'data-x': '1', lang: 'ru' });
    });

    it('chooses the profile: runtime option, TV entry, content profile, default', () => {
        const config = resolveConfig({ defaultProfile: 'full', contentProfile: 'article', tvProfiles: { intro: 'simple', tv7: 'seven' } });
        expect(profileName(config, { options: { profile: 'x' } })).toBe('x');
        expect(profileName(config, { field: { name: 'intro', id: 3 } })).toBe('simple');
        expect(profileName(config, { field: { name: 'other', id: 7 } })).toBe('seven');
        expect(profileName(config, { field: { name: 'other', id: 8 } })).toBe('full');
        expect(profileName(config, {})).toBe('article');
        expect(profileName(resolveConfig({}), {})).toBe('default');
    });
});

describe('profiles, extension options and editor attributes in editors', () => {
    let manager;
    const start = (server, { id = 'ta', options } = {}) => {
        document.body.innerHTML = `<textarea id="${id}"></textarea>`;
        document.getElementById(id).value = '<p>a</p>';
        manager = new EditorManager(createLogger(false));
        manager.configure(server);
        return manager.create(id, options);
    };
    const items = (instance) => [...instance.root.querySelectorAll('.tiptapeditor__toolbar:not(.tiptapeditor__toolbar--table) [data-tiptapeditor-item]')]
        .map((el) => el.dataset.tiptapeditorItem);
    afterEach(() => manager?.destroyAll());

    it('uses the content profile for the content field and the TV profile for a TV', () => {
        const server = {
            toolbar: 'bold italic underline',
            profiles: { simple: { toolbar: 'bold' }, article: { toolbar: 'italic link' } },
            contentProfile: 'article',
            tvProfiles: { intro: 'simple' },
            tvs: { tv5: { id: 5, name: 'intro', caption: 'Intro', mediaSource: null } },
        };
        const content = start(server);
        expect(items(content)).toEqual(['italic', 'link']);
        expect(content.config.profile).toBe('article');
        manager.destroyAll();
        const tv = start(server, { id: 'tv5' });
        expect(items(tv)).toEqual(['bold']);
        manager.destroyAll();
        const runtime = start(server, { options: { profile: 'simple' } });
        expect(items(runtime)).toEqual(['bold']);
    });

    it('applies the external config on top of the settings, with its profiles', () => {
        const instance = start({
            toolbar: 'bold italic',
            external: { toolbar: 'underline', editorProps: { attributes: { spellcheck: 'false' } } },
            profiles: {},
        });
        expect(items(instance)).toEqual(['underline']);
        expect(instance.editor.view.dom.getAttribute('spellcheck')).toBe('false');
        expect(instance.editor.view.dom.classList.contains('tiptapeditor__editable')).toBe(true);
    });

    it('switches extensions off and configures them by name, but never the protected ones', () => {
        const instance = start({
            toolbar: 'bold italic highlight',
            external: { extensions: { highlight: false, bold: false, rawHtml: false, heading: { levels: [9] } } },
        });
        const names = instance.editor.extensionManager.extensions.map((e) => e.name);
        expect(names).not.toContain('highlight');
        expect(names).not.toContain('bold');
        expect(names).toContain('rawHtml');
        expect(items(instance)).toEqual(['italic']);
    });

    it('adds registered extensions to new editors, configurable by name', () => {
        registerExtension(Extension.create({ name: 'testRegistered', addOptions: () => ({ value: 1 }) }));
        const find = (instance) => instance.editor.extensionManager.extensions.find((e) => e.name === 'testRegistered');
        expect(find(start({ toolbar: 'bold' })).options.value).toBe(1);
        manager.destroyAll();
        expect(find(start({ toolbar: 'bold', external: { extensions: { testRegistered: { value: 2 } } } })).options.value).toBe(2);
        manager.destroyAll();
        expect(find(start({ toolbar: 'bold', external: { extensions: { testRegistered: false } } }))).toBeUndefined();
        expect(() => registerExtension({ name: 'x' })).toThrow(TypeError);
    });
});

describe('attributes of paragraphs, headings, lists and marks', () => {
    let manager;
    let instance;
    const start = (html, server = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold paragraphClass align', ...server });
        instance = manager.create('ta');
        return instance;
    };
    const types = () => {
        const list = [];
        instance.editor.state.doc.forEach((node) => list.push(node.type.name));
        return list;
    };
    const edit = () => {
        instance.editor.chain().setTextSelection(1).insertContent('Z').run();
        return serialize(instance.editor).replace('Z', '');
    };
    afterEach(() => manager?.destroyAll());

    it.each([
        ['paragraph class', '<p class="lead">Lead</p>'],
        ['heading with id and class', '<h2 id="a" class="title" data-x="1">T</h2>'],
        ['quote, list and items', '<blockquote class="q" cite="/x"><p>q</p></blockquote><ul class="list" data-y="2"><li class="item" aria-label="One">one</li></ul><ol class="o" start="3"><li>x</li></ol>'],
        ['marks', '<p><strong class="b" data-x="1">b</strong> <em lang="en">i</em> <code class="c">c</code> <a href="/x" data-fancybox="" data-src="#m" aria-label="Open">l</a></p>'],
        ['code block and rule', '<pre class="p"><code>x</code></pre><hr class="sep">'],
        ['style kept as written', '<blockquote style="border: 0"><p>q</p></blockquote><p style="color:red;text-align:center">x</p>'],
    ])('%s: editable, kept when edited', (_name, html) => {
        start(html);
        expect(types()).not.toContain('rawHtml');
        expect(edit()).toBe(html);
    });

    it('event handlers still keep their block as raw HTML', () => {
        start('<p onclick="x()">a</p>');
        expect(types()).toEqual(['rawHtml']);
    });

    it('the align buttons add to a style with more than text-align', () => {
        start('<p style="color: red">x</p>');
        instance.editor.chain().setTextSelection(1).setTextAlign('center').run();
        expect(serialize(instance.editor)).toBe('<p style="color: red; text-align: center;">x</p>');
        instance.editor.chain().setTextAlign('right').run();
        expect(serialize(instance.editor)).toBe('<p style="color: red; text-align: right;">x</p>');
    });

    it('a style that is only text-align is the alignment', () => {
        start('<p style="text-align: center">x</p>');
        expect(instance.editor.isActive({ textAlign: 'center' })).toBe(true);
        instance.editor.chain().setTextSelection(1).setTextAlign('left').run();
        expect(serialize(instance.editor)).toBe('<p style="text-align: left;">x</p>');
    });

    it('preserve_style_attribute off: styles may be dropped, the content still opens', () => {
        start('<p><strong style="color: red">b</strong> x</p>', { preserveStyleAttribute: false });
        expect(types()).toEqual(['paragraph']);
        expect(edit()).toBe('<p><strong>b</strong> x</p>');
    });

    it('paragraph class presets: menu, toggle, other classes kept', async () => {
        start('<p class="custom">a</p><h2>b</h2>', { paragraphClasses: '{"lead": "Lead", "note": "Note"}' });
        await frame();
        const trigger = instance.root.querySelector('[data-tiptapeditor-item="paragraphClass"]');
        expect(trigger).not.toBeNull();
        const option = (text) => [...document.querySelectorAll('.tiptapeditor__menu-item')].find((el) => el.textContent === text);
        instance.editor.chain().setTextSelection(1).run();
        trigger.click();
        option('Lead').click();
        expect(serialize(instance.editor)).toBe('<p class="custom lead">a</p><h2>b</h2>');
        trigger.click();
        option('Note').click();
        expect(serialize(instance.editor)).toBe('<p class="custom note">a</p><h2>b</h2>');
        trigger.click();
        option('No style').click();
        expect(serialize(instance.editor)).toBe('<p class="custom">a</p><h2>b</h2>');
        instance.editor.chain().setTextSelection(4).run();
        trigger.click();
        option('Lead').click();
        expect(serialize(instance.editor)).toBe('<p class="custom">a</p><h2 class="lead">b</h2>');
    });

    it('no paragraph class menu without presets', () => {
        start('<p>a</p>');
        expect(instance.root.querySelector('[data-tiptapeditor-item="paragraphClass"]')).toBeNull();
    });
});

describe('content CSS scoping', () => {
    const scope = '.S';
    it.each([
        ['p', '.S p'],
        ['body', '.S'],
        ['html', '.S'],
        [':root', '.S'],
        ['body p', '.S p'],
        ['body.page .x', '.S .x'],
        ['html body > h1', '.S h1'],
        ['html > body h1', '.S h1'],
        ['.body p', '.S .body p'],
        ['body-like p', '.S body-like p'],
        ['a:hover', '.S a:hover'],
    ])('%s', (selector, expected) => {
        expect(scopeSelector(selector, scope)).toBe(expected);
    });

    it('splits selector lists only at top-level commas', () => {
        expect(splitSelectors('a, :is(b, c), [data-x="1,2"], d')).toEqual(['a', ':is(b, c)', '[data-x="1,2"]', 'd']);
    });

    it('resolves relative urls against the stylesheet', () => {
        expect(absoluteUrls('a{background:url(img/x.png)} b{background:url("/y.png")} c{background:url(data:x)}', 'https://site.test/assets/css/s.css'))
            .toBe('a{background:url("https://site.test/assets/css/img/x.png")} b{background:url("https://site.test/y.png")} c{background:url(data:x)}');
    });
});
