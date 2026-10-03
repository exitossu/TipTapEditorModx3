import { createElement } from '../utils/dom.js';

/**
 * Small popover anchored under a toolbar trigger. Closes on Escape (focus returns to the
 * trigger), on outside pointerdown and when focus leaves it. One popover is open at a time.
 */
let openPopover = null;

export class Popover {
    constructor(trigger, className, { onClose } = {}) {
        this.trigger = trigger;
        this.onClose = onClose;
        this.el = createElement('div', `tiptapeditor__popover ${className}`);
        this.el.hidden = true;
        this.abort = null;
    }

    get isOpen() {
        return !this.el.hidden;
    }

    open() {
        if (openPopover && openPopover !== this) {
            openPopover.close(false);
        }
        openPopover = this;
        this.el.hidden = false;
        this.trigger.setAttribute('aria-expanded', 'true');
        this.position();

        this.abort = new AbortController();
        const { signal } = this.abort;
        const doc = this.el.ownerDocument;
        doc.addEventListener('pointerdown', (event) => {
            if (!this.el.contains(event.target) && !this.trigger.contains(event.target)) {
                this.close(false);
            }
        }, { signal, capture: true });
        this.el.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.close(true);
            }
        }, { signal });
        this.el.addEventListener('focusout', (event) => {
            if (event.relatedTarget && !this.el.contains(event.relatedTarget) && event.relatedTarget !== this.trigger) {
                this.close(false);
            }
        }, { signal });
    }

    position() {
        const parent = this.el.offsetParent || this.el.parentElement;
        if (!parent) {
            return;
        }
        const anchor = this.trigger.getBoundingClientRect();
        const box = parent.getBoundingClientRect();
        this.el.style.left = `${Math.max(0, anchor.left - box.left)}px`;
        this.el.style.top = `${anchor.bottom - box.top + 4}px`;
    }

    close(returnFocus) {
        if (this.el.hidden) {
            return;
        }
        this.el.hidden = true;
        this.trigger.setAttribute('aria-expanded', 'false');
        this.abort?.abort();
        this.abort = null;
        if (openPopover === this) {
            openPopover = null;
        }
        if (returnFocus) {
            this.trigger.focus();
        }
        this.onClose?.();
    }

    destroy() {
        this.close(false);
        this.el.remove();
    }
}
