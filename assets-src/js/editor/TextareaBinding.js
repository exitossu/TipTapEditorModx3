import { serialize } from '../syntax/serialize.js';
import { debounce } from '../utils/debounce.js';
import { emit, fireFieldEvents } from '../utils/events.js';
import { markModxDirty } from '../modx/dirty.js';

/**
 * Keeps the original textarea in sync with the editor.
 *
 * The textarea is written only after the document really changed: opening content and
 * saving without edits returns it byte for byte. Writes are debounced while typing;
 * flush() writes synchronously and is called before every form submit.
 */
export class TextareaBinding {
    /**
     * @param {HTMLTextAreaElement} textarea
     * @param {import('@tiptap/core').Editor} editor
     * @param {{ delay?: number }} options
     */
    constructor(textarea, editor, { delay = 150 } = {}) {
        this.textarea = textarea;
        this.editor = editor;
        this.changed = false;
        this.write = debounce(() => this.writeNow(), delay);
        this.onUpdate = () => {
            this.changed = true;
            this.write();
        };
        editor.on('update', this.onUpdate);
    }

    writeNow() {
        if (!this.changed || this.editor.isDestroyed) {
            return false;
        }
        const value = serialize(this.editor);
        if (this.textarea.value === value) {
            return false;
        }
        this.textarea.value = value;
        fireFieldEvents(this.textarea);
        markModxDirty(this.textarea);
        emit('update', { editor: this.editor, element: this.textarea, value });
        return true;
    }

    /**
     * Writes the field now although nothing was edited (galleries whose template changed): the
     * next save of the resource stores the new markup. The resource is not marked as changed.
     */
    refresh() {
        if (this.editor.isDestroyed) {
            return;
        }
        this.changed = true;
        this.textarea.value = serialize(this.editor);
    }

    /** Synchronous write of pending changes. */
    flush() {
        this.write.cancel();
        return this.writeNow();
    }

    dispose() {
        this.flush();
        this.editor.off('update', this.onUpdate);
    }
}
