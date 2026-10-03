import { createElement } from '../utils/dom.js';

let counter = 0;

/**
 * Accessible modal dialog for editor forms (link, anchor, later image and source).
 *
 * - role="dialog", aria-modal, labelled by its title.
 * - Focus moves into the dialog on open, Tab stays inside it, Escape cancels, and focus
 *   returns to where it was (normally the editor) on close.
 * - Rendered on <body> under its own .tiptapeditor-dialog root, so manager styles and the
 *   editor's overflow do not clip it; all styles are scoped to that root.
 * - Its z-index stays below ExtJS windows, so the MODX Media Browser opened from a dialog
 *   shows on top of it.
 */
export class Dialog {
    /**
     * @param {object} options
     * @param {string} options.title
     * @param {(t: string) => string} options.t translator
     * @param {() => void} [options.onClose] called after the dialog closed (any way)
     * @param {string} [options.className]
     */
    constructor({ title, t, onClose, className = '' }) {
        counter += 1;
        this.t = t;
        this.onClose = onClose;
        this.returnFocus = document.activeElement;

        this.root = createElement('div', `tiptapeditor-dialog ${className}`.trim());
        this.window = createElement('div', 'tiptapeditor-dialog__window', {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': `tiptapeditor-dialog-title-${counter}`,
        });
        const heading = createElement('h2', 'tiptapeditor-dialog__title', { id: `tiptapeditor-dialog-title-${counter}` });
        heading.textContent = title;
        this.form = createElement('form', 'tiptapeditor-dialog__body', { novalidate: '' });
        this.actions = createElement('div', 'tiptapeditor-dialog__actions');
        this.window.append(heading, this.form, this.actions);
        this.root.append(this.window);

        this.onKeydown = this.onKeydown.bind(this);
        this.root.addEventListener('keydown', this.onKeydown);
        this.root.addEventListener('mousedown', (event) => {
            if (event.target === this.root) {
                event.preventDefault(); // clicks on the backdrop do not steal focus
            }
        });
        this.closed = false;
    }

    /** Adds a labelled field. Returns the control element. */
    field(label, control, { hint, id } = {}) {
        counter += 1;
        const controlId = id || `tiptapeditor-field-${counter}`;
        control.id = controlId;
        // A checkbox sits next to its label, not under it like a text field.
        const row = createElement('div', control.type === 'checkbox' ? 'tiptapeditor-dialog__field tiptapeditor-dialog__field--check' : 'tiptapeditor-dialog__field');
        const labelEl = createElement('label', 'tiptapeditor-dialog__label', { for: controlId });
        labelEl.textContent = label;
        row.append(labelEl, control);
        if (hint) {
            const hintEl = createElement('div', 'tiptapeditor-dialog__hint', { id: `${controlId}-hint` });
            hintEl.textContent = hint;
            control.setAttribute('aria-describedby', hintEl.id);
            row.append(hintEl);
        }
        this.form.append(row);
        return control;
    }

    /** Adds a paragraph of plain text (never HTML). */
    text(content, className = '') {
        const el = createElement('p', `tiptapeditor-dialog__text ${className}`.trim());
        el.textContent = content;
        this.form.append(el);
        return el;
    }

    input(type = 'text', attributes = {}) {
        return createElement('input', 'tiptapeditor-dialog__input', { type, autocomplete: 'off', spellcheck: 'false', ...attributes });
    }

    select(options, value) {
        const select = createElement('select', 'tiptapeditor-dialog__input');
        for (const option of options) {
            const el = createElement('option', '', { value: option.value });
            el.textContent = option.label;
            select.append(el);
        }
        select.value = value;
        return select;
    }

    button(label, { primary = false, type = 'button', onClick, className = '' } = {}) {
        const button = createElement('button', `tiptapeditor-dialog__button ${primary ? 'tiptapeditor-dialog__button--primary' : ''} ${className}`.trim(), { type });
        button.textContent = label;
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        return button;
    }

    /** Shows an error under the form; announced by screen readers. Empty text hides it. */
    error(text) {
        if (!this.errorEl) {
            this.errorEl = createElement('div', 'tiptapeditor-dialog__error', { role: 'alert' });
            this.form.append(this.errorEl);
        }
        this.errorEl.textContent = text || '';
        this.errorEl.hidden = !text;
    }

    open(focusTarget) {
        document.body.append(this.root);
        (focusTarget || this.focusable()[0] || this.window).focus();
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.root.removeEventListener('keydown', this.onKeydown);
        this.root.remove();
        if (this.returnFocus?.isConnected && typeof this.returnFocus.focus === 'function') {
            this.returnFocus.focus();
        }
        this.onClose?.();
    }

    focusable() {
        return [...this.window.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter((el) => !el.disabled && !el.hidden && !el.closest('[hidden]'));
    }

    onKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.close();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const items = this.focusable();
        if (!items.length) {
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
}
