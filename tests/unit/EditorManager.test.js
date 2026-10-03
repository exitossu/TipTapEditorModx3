import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Extension } from '@tiptap/core';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

function addTextarea(id, value = '') {
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.name = id;
    textarea.value = value;
    document.body.append(textarea);
    return textarea;
}

describe('EditorManager', () => {
    let manager;

    beforeEach(() => {
        document.body.innerHTML = '';
        manager = new EditorManager(createLogger(false));
        manager.configure({ syncDelay: 10 });
    });

    afterEach(() => manager.destroyAll());

    it('creates an editor next to the textarea and hides it only after success', () => {
        const ta = addTextarea('ta', '<p>Hello</p>');
        const instance = manager.create('ta');
        expect(instance).not.toBeNull();
        expect(ta.isConnected).toBe(true);
        expect(ta.classList.contains('tiptapeditor-source--hidden')).toBe(true);
        expect(ta.getAttribute('data-tiptap-initialized')).toBe('1');
        expect(ta.nextElementSibling).toBe(instance.root);
        expect(instance.editor.getHTML()).toBe('<p>Hello</p>');
    });

    it('is idempotent', () => {
        addTextarea('ta', '<p>x</p>');
        const first = manager.create('ta');
        expect(manager.create('ta')).toBe(first);
        manager.mount(['ta']);
        expect(manager.instances.size).toBe(1);
        expect(document.querySelectorAll('.tiptapeditor').length).toBe(1);
    });

    it('does not touch the textarea until the document changes', async () => {
        const original = '<p>Keep   <b>exactly</b>\n this</p>';
        const ta = addTextarea('ta', original);
        manager.create('ta');
        manager.syncAll();
        await new Promise((r) => setTimeout(r, 30));
        expect(ta.value).toBe(original);
    });

    it('writes changes, fires input and change, and syncAll flushes synchronously', () => {
        const ta = addTextarea('ta', '<p>a</p>');
        const events = [];
        ta.addEventListener('input', () => events.push('input'));
        ta.addEventListener('change', () => events.push('change'));
        const { editor } = manager.create('ta');

        editor.commands.insertContentAt(editor.state.doc.content.size - 1, 'b');
        expect(ta.value).toBe('<p>a</p>'); // debounced
        manager.syncAll();
        expect(ta.value).toBe('<p>ab</p>');
        expect(events).toEqual(['input', 'change']);
    });

    it('stores an empty document as an empty string', () => {
        const ta = addTextarea('ta', '<p>x</p>');
        const { editor } = manager.create('ta');
        editor.commands.clearContent(true);
        manager.syncAll();
        expect(ta.value).toBe('');
    });

    it('keeps several editors independent', () => {
        const a = addTextarea('ta', '<p>a</p>');
        const b = addTextarea('tv1', '<p>b</p>');
        manager.create(a);
        const second = manager.create(b);
        second.editor.commands.setContent('<p>changed</p>', { emitUpdate: true });
        manager.syncAll();
        expect(a.value).toBe('<p>a</p>');
        expect(b.value).toBe('<p>changed</p>');
    });

    it('destroy syncs and restores the textarea', () => {
        const ta = addTextarea('ta', '<p>a</p>');
        const { editor } = manager.create('ta');
        editor.commands.setContent('<p>new</p>', { emitUpdate: true });
        manager.destroy('ta');
        expect(ta.value).toBe('<p>new</p>');
        expect(ta.classList.contains('tiptapeditor-source--hidden')).toBe(false);
        expect(ta.hasAttribute('data-tiptap-initialized')).toBe(false);
        expect(document.querySelector('.tiptapeditor')).toBeNull();
        expect(manager.instances.size).toBe(0);
    });

    it('leaves the textarea usable when the editor fails to start', () => {
        const ta = addTextarea('ta', '<p>a</p>');
        const broken = Extension.create({
            name: 'broken',
            addProseMirrorPlugins() {
                throw new Error('boom');
            },
        });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(manager.create('ta', { extensions: [broken] })).toBeNull();
        spy.mockRestore();
        expect(ta.classList.contains('tiptapeditor-source--hidden')).toBe(false);
        expect(document.querySelector('.tiptapeditor')).toBeNull();
        expect(document.querySelector('.tiptapeditor-notice--error')).not.toBeNull();
        expect(ta.value).toBe('<p>a</p>');
    });

    it('keeps HTML it cannot show losslessly as a raw block, unchanged', () => {
        const html = '<div class="box"><p>x</p></div><p>Text</p>';
        addTextarea('ta', html);
        const instance = manager.create('ta');
        expect(instance).not.toBeNull();
        expect(instance.editor.state.doc.firstChild.type.name).toBe('rawHtml');
        expect(instance.root.querySelector('.tiptapeditor__raw').textContent).toContain('<div>');
        expect(serialize(instance.editor)).toBe(html);
    });

    it('keeps content with characters it uses internally in the textarea', () => {
        const ta = addTextarea('ta', '<p>a\uE000b</p>');
        expect(manager.create('ta')).toBeNull();
        expect(ta.classList.contains('tiptapeditor-source--hidden')).toBe(false);
        expect(ta.getAttribute('data-tiptap-initialized')).toBe('source');
        expect(document.querySelector('.tiptapeditor-notice')).not.toBeNull();
    });

    it('opens content with MODX or Fenom tags and keeps them', () => {
        addTextarea('a', '<p>[[*pagetitle]]</p>');
        addTextarea('b', '<p>{$resource.id}</p>');
        expect(serialize(manager.create('a').editor)).toBe('<p>[[*pagetitle]]</p>');
        expect(serialize(manager.create('b').editor)).toBe('<p>{$resource.id}</p>');
    });

    it('keeps links exactly as they are', () => {
        addTextarea('ta', '<p><a href="/news/">News</a> <a href="https://x.test" target="_blank" rel="noopener">X</a></p>');
        const { editor } = manager.create('ta');
        expect(editor.getHTML()).toBe('<p><a href="/news/">News</a> <a target="_blank" rel="noopener" href="https://x.test">X</a></p>');
    });

    it('mounts requested elements and richtext TVs, skipping unknown ones', () => {
        manager.configure({ syncDelay: 10, elements: ['ta', 'missing'] });
        addTextarea('ta', '<p>a</p>');
        const tv = addTextarea('tv5', '<p>tv</p>');
        tv.className = 'modx-richtext';
        addTextarea('plain', 'not mine');
        manager.mount();
        expect(manager.instances.size).toBe(2);
        expect(manager.getInstance('plain')).toBeNull();
    });
});
