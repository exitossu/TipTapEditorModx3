import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { parseToolbar } from '../../assets-src/js/ui/parseToolbar.js';
import { resolveToolbarItemName } from '../../assets-src/js/ui/toolbarItems.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

describe('parseToolbar', () => {
    it('splits groups, ignores empty groups and duplicates, reports unknown items', () => {
        const { groups, unknown } = parseToolbar(' undo redo || BOLD italic bold | nope |', resolveToolbarItemName);
        expect(groups).toEqual([['undo', 'redo'], ['bold', 'italic']]);
        expect(unknown).toEqual(['nope']);
    });

    it('accepts arrays from external config', () => {
        expect(parseToolbar(['undo', '|', 'bold'], resolveToolbarItemName).groups).toEqual([['undo'], ['bold']]);
        expect(parseToolbar([['undo'], ['bold', 'italic']], resolveToolbarItemName).groups).toEqual([['undo'], ['bold', 'italic']]);
    });
});

describe('Toolbar', () => {
    let manager;
    let instance;
    const button = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);

    beforeEach(() => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = '<p>Hello world</p>';
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'undo redo | heading | bold italic | align | color | bulletList | fullscreen', headingLevels: '2,3' });
        instance = manager.create('ta');
    });

    afterEach(() => manager.destroyAll());

    it('renders an accessible toolbar from the setting', () => {
        const toolbar = instance.root.querySelector('[role="toolbar"]');
        expect(toolbar).not.toBeNull();
        const names = [...toolbar.querySelectorAll('[data-tiptapeditor-item]')].map((el) => el.dataset.tiptapeditorItem);
        expect(names).toEqual(['undo', 'redo', 'heading', 'bold', 'italic', 'align', 'color', 'bulletList', 'fullscreen']);
        for (const el of toolbar.querySelectorAll('[data-tiptapeditor-item]')) {
            expect(el.getAttribute('type')).toBe('button');
            expect(el.getAttribute('aria-label')).toBeTruthy();
        }
        // one Tab stop
        expect([...toolbar.querySelectorAll('[data-tiptapeditor-item]')].filter((el) => el.tabIndex === 0)).toHaveLength(1);
        expect(button('bold').getAttribute('title')).toMatch(/Bold \((Ctrl|⌘)\+B\)/);
    });

    it('reflects active state with aria-pressed and disabled state with editor.can()', () => {
        const { editor } = instance;
        editor.commands.selectAll();
        instance.root.querySelector('[data-tiptapeditor-item="bold"]').click();
        expect(editor.getHTML()).toBe('<p><strong>Hello world</strong></p>');
        expect(button('bold').getAttribute('aria-pressed')).toBe('true');
        expect(button('italic').getAttribute('aria-pressed')).toBe('false');
        expect(button('undo').disabled).toBe(false);
        expect(button('redo').disabled).toBe(true);
    });

    it('heading menu offers the configured levels and applies them', () => {
        button('heading').click();
        const items = [...instance.root.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent);
        expect(items.slice(0, 3)).toEqual(['Paragraph', 'Heading 2', 'Heading 3']);
        instance.root.querySelectorAll('[role="menuitemradio"]')[2].click();
        expect(instance.editor.getHTML()).toBe('<h3>Hello world</h3>');
    });

    it('moves focus with arrow keys inside the toolbar, skipping disabled controls', () => {
        // Fresh editor: undo and redo are disabled (no history).
        expect(button('undo').disabled).toBe(true);
        const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        button('heading').focus();
        key('ArrowRight');
        expect(document.activeElement).toBe(button('bold'));
        key('Home');
        expect(document.activeElement).toBe(button('heading'));
        key('ArrowLeft');
        expect(document.activeElement).toBe(button('fullscreen'));
        expect(button('fullscreen').tabIndex).toBe(0);
    });

    it('fullscreen toggles and Escape leaves it', () => {
        button('fullscreen').click();
        expect(instance.root.classList.contains('tiptapeditor--fullscreen')).toBe(true);
        instance.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(instance.root.classList.contains('tiptapeditor--fullscreen')).toBe(false);
    });

    it('applies text color and alignment', () => {
        const { editor } = instance;
        editor.commands.selectAll();
        button('color').click();
        instance.root.querySelector('.tiptapeditor__swatch').click();
        expect(editor.getHTML()).toBe('<p><span style="color: #000000;">Hello world</span></p>');
        button('align').click();
        [...instance.root.querySelectorAll('[role="menuitemradio"]')].find((el) => el.textContent === 'Align center').click();
        expect(editor.getHTML()).toContain('style="text-align: center;"');
    });

    it('hides items whose feature is switched off', () => {
        manager.destroyAll();
        manager.configure({ toolbar: 'bold fullscreen', features: { fullscreen: false } });
        instance = manager.create('ta');
        expect(button('fullscreen')).toBeNull();
        expect(button('bold')).not.toBeNull();
    });
});
