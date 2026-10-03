import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { observeFields } from '../../assets-src/js/modx/fieldObserver.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

function addTv(id, value = '<p>tv</p>', parent = document.body) {
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.name = id;
    textarea.className = 'modx-richtext';
    textarea.value = value;
    parent.append(textarea);
    return textarea;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('richtext TVs', () => {
    let manager;
    let watcher;

    beforeEach(() => {
        document.body.innerHTML = '';
        // happy-dom has no layout: treat every field as visible.
        vi.stubGlobal('IntersectionObserver', undefined);
        manager = new EditorManager(createLogger(false));
        manager.configure({
            syncDelay: 10,
            elements: ['ta'],
            tvs: { tv7: { id: 7, name: 'rt_one', caption: 'Rich one' } },
        });
    });

    afterEach(() => {
        watcher?.disconnect();
        watcher = null;
        manager.destroyAll();
        vi.unstubAllGlobals();
        delete window.MODx;
        delete window.Ext;
    });

    it('mounts every textarea.modx-richtext and passes the TV metadata', () => {
        addTv('tv7');
        addTv('tv8');
        manager.refresh();
        expect(manager.instances.size).toBe(2);
        expect(manager.getInstance('tv7').config.field).toEqual({ id: 7, name: 'rt_one', caption: 'Rich one' });
        expect(manager.getInstance('tv8').config.field).toBeNull();
    });

    it('leaves the resource content field to MODx.loadRTE', () => {
        window.MODx = { panel: { Resource: function Resource() {} } };
        const panel = { initialized: false };
        window.Ext = { getCmp: (id) => (id === 'modx-panel-resource' ? panel : undefined) };
        addTv('tv9');
        manager.refresh();
        expect(manager.instances.size).toBe(0); // panel still setting up its tabs
        panel.initialized = true;
        const ta = document.createElement('textarea');
        ta.id = 'ta';
        document.body.append(ta);
        addTv('tv7');
        manager.refresh();
        expect(manager.getInstance('ta')).toBeNull();
        expect(manager.getInstance('tv7')).not.toBeNull();
        expect(manager.getInstance('tv9')).not.toBeNull();
    });

    it('makes a read-only TV non-editable and skips disabled ones', () => {
        addTv('tv7').readOnly = true;
        addTv('tv8').disabled = true;
        manager.refresh();
        expect(manager.getInstance('tv7').editor.isEditable).toBe(false);
        expect(manager.getInstance('tv8')).toBeNull();
    });

    it('mounts TVs added later and destroys editors of removed ones', async () => {
        watcher = observeFields(() => manager.refresh(), 5);
        const block = document.createElement('div');
        document.body.append(block);
        addTv('tv7', '<p>late</p>', block);
        await wait(40);
        const instance = manager.getInstance('tv7');
        expect(instance).not.toBeNull();
        expect(instance.editor.getHTML()).toBe('<p>late</p>');

        block.remove();
        await wait(40);
        expect(manager.instances.size).toBe(0);
        expect(instance.editor.isDestroyed).toBe(true);
    });

    it('ignores DOM changes inside an editor', async () => {
        addTv('tv7');
        manager.refresh();
        const spy = vi.fn();
        watcher = observeFields(spy, 5);
        manager.getInstance('tv7').editor.commands.insertContent('<p>more</p>');
        await wait(30);
        expect(spy).not.toHaveBeenCalled();
    });

    it('keeps the TV value untouched until edited and marks it changed after an edit', async () => {
        const original = '<p>Keep <b>this</b></p>';
        const tv = addTv('tv7', original);
        const changes = vi.fn();
        tv.addEventListener('change', changes);
        manager.refresh();
        manager.syncAll();
        expect(tv.value).toBe(original);
        expect(changes).not.toHaveBeenCalled();

        manager.getInstance('tv7').editor.commands.insertContent(' more');
        manager.syncAll();
        expect(tv.value).toContain('more');
        expect(changes).toHaveBeenCalled();
    });
});
