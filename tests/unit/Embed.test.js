import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { allowedAttributes, allowedHosts, filterAttributes, isAllowedSrc, parseEmbedInput, registerEmbedProvider } from '../../assets-src/js/embed/embed.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

describe('embed providers and checks', () => {
    it.each([
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=42'],
        ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
        ['https://vk.com/video-123_456', 'https://vk.com/video_ext.php?oid=-123&id=456&hd=2'],
        ['https://vkvideo.ru/video-22822305_456242110', 'https://vk.com/video_ext.php?oid=-22822305&id=456242110&hd=2'],
        ['https://rutube.ru/video/0123456789abcdef0123456789abcdef/', 'https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef'],
        ['https://example.com/map', 'https://example.com/map'],
    ])('%s', (input, src) => {
        expect(parseEmbedInput(input).src).toBe(src);
    });

    it('reads a pasted iframe code without loading it', () => {
        const parsed = parseEmbedInput('<iframe src="https://player.vimeo.com/video/1" width="640" height="360" onload="x()" allowfullscreen></iframe>');
        expect(parsed.src).toBe('https://player.vimeo.com/video/1');
        expect(filterAttributes(parsed.attributes, allowedAttributes(''))).toEqual({
            src: 'https://player.vimeo.com/video/1', width: '640', height: '360', allowfullscreen: '',
        });
    });

    it('registered providers are tried first', () => {
        registerEmbedProvider({ name: 'test', match: (url) => (url.startsWith('test:') ? `https://embed.test/${url.slice(5)}` : null) });
        expect(parseEmbedInput('test:42').src).toBe('https://embed.test/42');
        expect(() => registerEmbedProvider({ name: 'x' })).toThrow(TypeError);
    });

    it('allows http(s) sources on allowed hosts only, never scripts', () => {
        const hosts = allowedHosts('youtube.com, *.vk.com');
        expect(isAllowedSrc('https://www.youtube.com/embed/x', hosts)).toBe(true);
        expect(isAllowedSrc('//vk.com/video_ext.php', hosts)).toBe(true);
        expect(isAllowedSrc('https://evil.com/?youtube.com', hosts)).toBe(false);
        expect(isAllowedSrc('https://notyoutube.com/', hosts)).toBe(false);
        expect(isAllowedSrc('javascript:alert(1)', [])).toBe(false);
        expect(isAllowedSrc('data:text/html,x', [])).toBe(false);
        expect(isAllowedSrc('[[++site_url]]video/', [])).toBe(true);
        expect(isAllowedSrc('[[++site_url]]video/', hosts)).toBe(false);
        expect(allowedAttributes('src,onload,width').has('onload')).toBe(false);
    });
});

describe('iframes in the editor', () => {
    let manager;
    let instance;
    const start = (html, server = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold embed', ...server });
        instance = manager.create('ta');
        return instance;
    };
    const types = () => {
        const list = [];
        instance.editor.state.doc.descendants((node) => {
            list.push(node.type.name);
        });
        return list;
    };
    const edit = () => {
        instance.editor.chain().setTextSelection(1).insertContent('Z').run();
        return serialize(instance.editor).replace('Z', '');
    };
    afterEach(() => {
        manager?.destroyAll();
        document.querySelector('.tiptapeditor-dialog')?.remove();
    });

    it('an iframe between blocks and one inside a paragraph are editable and kept', () => {
        const html = '<p>Video below.</p>\n<iframe src="https://www.youtube.com/embed/xyz" width="560" height="315" allow="autoplay; encrypted-media" allowfullscreen="" loading="lazy"></iframe>\n<p><iframe src="https://vk.com/video_ext.php?oid=1&amp;id=2" width="640" height="360" style="border: 0"></iframe></p>';
        start(html);
        expect(types().filter((type) => type === 'iframe')).toHaveLength(2);
        expect(types()).not.toContain('rawHtml');
        expect(edit().replace(/\n/g, '')).toBe(html.replace(/\n/g, ''));
    });

    it('is never loaded in the manager: a card with the address', () => {
        start('<p><iframe src="https://www.youtube.com/embed/xyz" width="560" height="315"></iframe></p>');
        expect(instance.root.querySelector('.ProseMirror iframe')).toBeNull();
        expect(instance.root.querySelector('.tiptapeditor__embed-src').textContent).toBe('www.youtube.com/embed/xyz');
        expect(instance.root.querySelector('.tiptapeditor__embed-size').textContent).toBe('560 × 315');
    });

    it.each([
        ['an event handler', '<iframe src="https://a.test/" onload="alert(1)"></iframe>'],
        ['an attribute not on the list', '<iframe src="https://a.test/" sandbox="allow-scripts"></iframe>'],
        ['a javascript: source', '<iframe src="javascript:alert(1)"></iframe>'],
    ])('with %s it stays a raw HTML block, unchanged', (_name, html) => {
        start(html);
        expect(types()).toEqual(['rawHtml']);
        expect(serialize(instance.editor)).toBe(html);
    });

    it('a host outside iframe_allowed_hosts stays raw', () => {
        start('<p><iframe src="https://other.test/x"></iframe></p>', { iframeAllowedHosts: 'youtube.com' });
        expect(types()).toEqual(['rawHtml']);
    });

    it('enable_iframe off: iframes stay raw blocks', () => {
        start('<iframe src="https://www.youtube.com/embed/xyz"></iframe>', { features: { iframe: false } });
        expect(types()).toEqual(['rawHtml']);
        expect(instance.root.querySelector('[data-tiptapeditor-item="embed"]')).toBeNull();
    });

    it('the dialog inserts a YouTube video from its page URL', () => {
        start('<p>a</p>');
        instance.editor.commands.setTextSelection(2);
        instance.root.querySelector('[data-tiptapeditor-item="embed"]').click();
        const dialog = document.querySelector('.tiptapeditor-dialog');
        dialog.querySelector('input').value = 'https://youtu.be/dQw4w9WgXcQ';
        dialog.querySelector('.tiptapeditor-dialog__button--primary').click();
        expect(serialize(instance.editor)).toBe('<p>a<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" loading="lazy"></iframe></p>');
    });

    it('the dialog refuses hosts that are not allowed', () => {
        start('<p>a</p>', { iframeAllowedHosts: 'youtube.com' });
        instance.root.querySelector('[data-tiptapeditor-item="embed"]').click();
        const dialog = document.querySelector('.tiptapeditor-dialog');
        dialog.querySelector('input').value = 'https://evil.test/x';
        dialog.querySelector('.tiptapeditor-dialog__button--primary').click();
        expect(dialog.querySelector('.tiptapeditor-dialog__error').textContent).toBe('This site is not in the list of allowed embed hosts.');
        expect(serialize(instance.editor)).toBe('<p>a</p>');
    });

    it('editing keeps the other attributes and their order', () => {
        start('<p><iframe class="video" src="https://www.youtube.com/embed/abc" width="560" height="315" title="T"></iframe></p>');
        let pos = 0;
        instance.editor.state.doc.descendants((node, p) => {
            if (node.type.name === 'iframe') {
                pos = p;
            }
        });
        instance.editor.commands.setNodeSelection(pos);
        instance.root.querySelector('[data-tiptapeditor-item="embed"]').click();
        const dialog = document.querySelector('.tiptapeditor-dialog');
        const inputs = dialog.querySelectorAll('input');
        inputs[1].value = '800';
        dialog.querySelector('.tiptapeditor-dialog__button--primary').click();
        expect(serialize(instance.editor)).toBe('<p><iframe class="video" src="https://www.youtube.com/embed/abc" width="800" height="315" title="T"></iframe></p>');
    });
});
