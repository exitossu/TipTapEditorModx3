import { elementFromString } from '@tiptap/core';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { markModxDirty } from '../modx/dirty.js';
import { ContentKeptAsSource } from '../syntax/errors.js';
import { findLosses } from '../syntax/LossDetector.js';
import { preprocess } from '../syntax/preprocess.js';
import { documentHtml } from '../syntax/serialize.js';
import { restoreSentinels } from '../syntax/store.js';
import { createElement } from '../utils/dom.js';
import { emit, fireFieldEvents } from '../utils/events.js';
import { Dialog } from './Dialog.js';

const LOSS_PREVIEW = 5;

/**
 * HTML source mode: a plain <textarea> (never contenteditable) in place of the editing area.
 *
 * - It shows the field value exactly as it is stored: HTML, MODX tags and Fenom literally.
 * - What is typed goes straight into the MODX field (with input/change and the dirty state),
 *   so saving the resource in source mode saves exactly the source.
 * - Back to the visual editor: unchanged source leaves the document (and undo history) as it
 *   was. Changed source is prepared like content on load (tokens, HTML blocks) and checked;
 *   if the editor would still lose something, the user decides: back to the source, or apply.
 *   After applying, the field keeps the source as typed until the document is edited.
 */
export class SourceView {
    /**
     * @param {object} options
     * @param {HTMLElement} options.root editor root
     * @param {HTMLElement} options.contentEl editing area that the source replaces
     * @param {import('@tiptap/core').Editor} options.editor
     * @param {HTMLTextAreaElement} options.textarea the MODX field
     * @param {object} options.config resolved configuration
     * @param {(key: string) => string} options.t
     * @param {(active: boolean) => void} [options.onChange]
     */
    constructor({ root, contentEl, editor, textarea, config, t, onChange }) {
        this.root = root;
        this.contentEl = contentEl;
        this.editor = editor;
        this.textarea = textarea;
        this.config = config;
        this.t = t;
        this.onChange = onChange;
        this.active = false;
        /** Set by the editor manager: the textarea binding (flush, changed flag). */
        this.binding = null;
        this.initial = '';
        this.wasEditable = true;

        this.el = createElement('textarea', 'tiptapeditor__source', {
            spellcheck: 'false',
            autocomplete: 'off',
            autocapitalize: 'off',
            wrap: 'soft',
            'aria-label': t('source_label'),
        });
        this.el.hidden = true;
        this.onInput = () => this.write(this.el.value);
        this.el.addEventListener('input', this.onInput);
        contentEl.after(this.el);
    }

    toggle(force) {
        const next = typeof force === 'boolean' ? force : !this.active;
        if (next === this.active) {
            return true;
        }
        return next ? this.open() : this.close();
    }

    open() {
        this.binding?.flush();
        this.initial = this.textarea.value;
        this.el.value = this.initial;
        this.el.readOnly = this.textarea.readOnly || !this.editor.isEditable;
        this.el.style.height = `${Math.max(this.contentEl.offsetHeight, Number(this.config.minHeight) || 0, 120)}px`;
        this.wasEditable = this.editor.isEditable;
        // Not editable while the source is shown: the toolbar disables its formatting
        // buttons. No update event, so the field is not rewritten.
        this.editor.setEditable(false, false);
        this.contentEl.hidden = true;
        this.el.hidden = false;
        this.active = true;
        this.root.classList.add('tiptapeditor--source');
        this.el.focus();
        this.el.setSelectionRange(0, 0);
        this.onChange?.(true);
        return true;
    }

    /** Back to the visual editor. Returns false when it stays in source mode. */
    close({ force = false } = {}) {
        const value = this.el.value;
        if (value !== this.initial) {
            const result = this.prepare(value);
            if (result.error) {
                this.pending?.close();
                this.pending = new Dialog({ title: this.t('source'), t: this.t, onClose: () => this.el.focus() });
                this.pending.text(this.t(result.error));
                const back = this.pending.button(this.t('source_back'), { primary: true, onClick: () => this.pending.close() });
                this.pending.actions.append(back);
                this.pending.open(back);
                return false;
            }
            if (result.losses.length && !force) {
                this.confirmLosses(result.losses);
                return false;
            }
            this.apply(result.prepared);
        }
        this.leave();
        return true;
    }

    /** Prepares source for the editor and finds what it would lose. */
    prepare(value) {
        const { schema } = this.editor;
        let prepared;
        try {
            prepared = preprocess(value, {
                schema,
                modx: Boolean(this.config.protectModxSyntax),
                fenom: Boolean(this.config.protectFenomSyntax),
                fenomTags: this.config.fenomTags,
                ignoreStyle: this.config.preserveStyleAttribute === false,
            });
        } catch (error) {
            if (error instanceof ContentKeptAsSource) {
                return { error: 'source_private_marks' };
            }
            throw error;
        }
        if (value.trim() === '') {
            return { prepared: '', losses: [] };
        }
        const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(prepared));
        const losses = findLosses(value, restoreSentinels(documentHtml(doc, schema)), { ignoreStyle: this.config.preserveStyleAttribute === false });
        return { prepared, losses };
    }

    confirmLosses(losses) {
        this.pending?.close();
        const dialog = new Dialog({ title: this.t('source'), t: this.t, onClose: () => {
            if (this.active) {
                this.el.focus();
            }
        } });
        this.pending = dialog;
        dialog.text(this.t('source_losses'));
        const list = losses.slice(0, LOSS_PREVIEW).join(', ') + (losses.length > LOSS_PREVIEW ? ', …' : '');
        dialog.text(list, 'tiptapeditor-dialog__code-text');
        const back = dialog.button(this.t('source_back'), { primary: true, onClick: () => dialog.close() });
        dialog.actions.append(
            dialog.button(this.t('source_apply_anyway'), {
                onClick: () => {
                    dialog.close();
                    this.close({ force: true });
                    if (!this.active) {
                        this.editor.view.focus();
                    }
                },
            }),
            back,
        );
        dialog.open(back);
    }

    apply(prepared) {
        this.editor.setEditable(true, false);
        // As one undoable step; no update event: the field already holds the source.
        this.editor.commands.setContent(prepared, { emitUpdate: false });
        if (this.binding) {
            this.binding.changed = false;
        }
    }

    leave() {
        this.pending?.close();
        this.pending = null;
        this.editor.setEditable(this.wasEditable, false);
        this.el.hidden = true;
        this.contentEl.hidden = false;
        this.active = false;
        this.root.classList.remove('tiptapeditor--source');
        this.onChange?.(false);
    }

    write(value) {
        if (this.textarea.value === value) {
            return;
        }
        this.textarea.value = value;
        fireFieldEvents(this.textarea);
        markModxDirty(this.textarea);
        emit('update', { editor: this.editor, element: this.textarea, value });
    }

    destroy() {
        this.pending?.close();
        if (this.active) {
            this.editor.setEditable(this.wasEditable, false);
            this.contentEl.hidden = false;
            this.root.classList.remove('tiptapeditor--source');
            this.active = false;
        }
        this.el.removeEventListener('input', this.onInput);
        this.el.remove();
    }
}
