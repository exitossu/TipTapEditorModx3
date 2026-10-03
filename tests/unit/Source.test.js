import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('HTML source mode', () => {
    let manager;
    let instance;
    let textarea;
    const start = (html, { readOnly = false } = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        textarea = document.getElementById('ta');
        textarea.value = html;
        textarea.readOnly = readOnly;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold | source fullscreen' });
        instance = manager.create('ta');
        return instance;
    };
    const button = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);
    const sourceEl = () => instance.root.querySelector('.tiptapeditor__source');
    const typeSource = (value) => {
        sourceEl().value = value;
        sourceEl().dispatchEvent(new Event('input', { bubbles: true }));
    };
    const dialog = () => document.querySelector('.tiptapeditor-dialog');
    afterEach(() => {
        manager?.destroyAll();
        dialog()?.remove();
    });

    const content = '<h2>Title</h2>\n\n<p>Text [[*pagetitle]] &amp; {$x}</p>\n[[!pdoResources? &parents=`10`]]\n';

    it('shows the field value exactly, in a plain textarea', async () => {
        start(content);
        button('source').click();
        await frame();
        expect(instance.source.active).toBe(true);
        expect(sourceEl().localName).toBe('textarea');
        expect(sourceEl().hidden).toBe(false);
        expect(sourceEl().value).toBe(content);
        expect(instance.root.querySelector('.tiptapeditor__content').hidden).toBe(true);
        expect(instance.editor.isEditable).toBe(false);
        expect(button('bold').disabled).toBe(true);
        expect(button('source').disabled).toBe(false);
        expect(button('source').getAttribute('aria-pressed')).toBe('true');
        expect(button('fullscreen').disabled).toBe(false);
    });

    it('shows pending editor changes', () => {
        start('<p>a</p>');
        instance.editor.chain().setTextSelection(2).insertContent('b').run();
        instance.source.toggle(true);
        expect(sourceEl().value).toBe('<p>ab</p>');
    });

    it('writes what is typed straight into the field, with input and change events', () => {
        start('<p>a</p>');
        const events = [];
        textarea.addEventListener('input', () => events.push('input'));
        textarea.addEventListener('change', () => events.push('change'));
        instance.source.toggle(true);
        typeSource('<p>b [[$c? &d=`1`]]</p>');
        expect(textarea.value).toBe('<p>b [[$c? &d=`1`]]</p>');
        expect(events).toEqual(['input', 'change']);
        manager.syncAll();
        expect(textarea.value).toBe('<p>b [[$c? &d=`1`]]</p>');
    });

    it('back without changes keeps the document, its history and the field as they were', () => {
        start(content);
        const before = instance.editor.state.doc;
        instance.source.toggle(true);
        expect(instance.source.toggle(false)).toBe(true);
        expect(instance.editor.state.doc).toBe(before);
        expect(instance.editor.isEditable).toBe(true);
        manager.syncAll();
        expect(textarea.value).toBe(content);
    });

    it('applies changed source; the field keeps the source until the document is edited', () => {
        start('<p>old</p>');
        instance.source.toggle(true);
        const source = '<p>new [[*pagetitle]]</p>\n\n<div class="box">x</div>\n{if $a}\n<p>b</p>\n{/if}';
        typeSource(source);
        expect(instance.source.toggle(false)).toBe(true);
        const types = [];
        instance.editor.state.doc.forEach((node) => types.push(node.type.name));
        expect(types).toEqual(['paragraph', 'rawHtml', 'modxSyntaxBlock', 'paragraph', 'modxSyntaxBlock']);
        manager.syncAll();
        expect(textarea.value).toBe(source);
        instance.editor.chain().setTextSelection(1).insertContent('N').run();
        manager.syncAll();
        expect(textarea.value).toBe('<p>Nnew [[*pagetitle]]</p><div class="box">x</div>\n{if $a}\n<p>b</p>\n{/if}');
    });

    it('applying is one undo step', () => {
        start('<p>old</p>');
        instance.source.toggle(true);
        typeSource('<p>new</p>');
        instance.source.toggle(false);
        instance.editor.commands.undo();
        expect(serialize(instance.editor)).toBe('<p>old</p>');
    });

    it('empty source empties the editor', () => {
        start('<p>a</p>');
        instance.source.toggle(true);
        typeSource('');
        instance.source.toggle(false);
        expect(serialize(instance.editor)).toBe('');
        expect(textarea.value).toBe('');
    });

    it('stays in source mode when the source holds the editor\'s private characters', () => {
        start('<p>a</p>');
        instance.source.toggle(true);
        typeSource('<p>xy</p>');
        expect(instance.source.toggle(false)).toBe(false);
        expect(instance.source.active).toBe(true);
        expect(dialog()).not.toBeNull();
        expect(textarea.value).toBe('<p>xy</p>');
        dialog().querySelector('.tiptapeditor-dialog__button--primary').click();
        expect(dialog()).toBeNull();
        expect(instance.source.active).toBe(true);
    });

    it('is read-only for a read-only field', () => {
        start('<p>a</p>', { readOnly: true });
        instance.source.toggle(true);
        expect(sourceEl().readOnly).toBe(true);
        instance.source.toggle(false);
        expect(instance.editor.isEditable).toBe(false);
    });

    it('destroying the editor in source mode keeps the typed value', () => {
        start('<p>a</p>');
        instance.source.toggle(true);
        typeSource('<p>typed</p>');
        manager.destroyAll();
        expect(textarea.value).toBe('<p>typed</p>');
        expect(document.querySelector('.tiptapeditor__source')).toBeNull();
    });
});
