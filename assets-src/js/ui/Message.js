import { createElement } from '../utils/dom.js';

/**
 * Short status message inside an editor (below the toolbar), announced to screen readers
 * and removed after a few seconds. Text only: never HTML.
 */
export class Message {
    constructor(root) {
        this.el = createElement('div', 'tiptapeditor__message', { role: 'status', 'aria-live': 'polite' });
        this.el.hidden = true;
        root.append(this.el);
        this.timer = null;
    }

    show(text, type = 'info', duration = 6000) {
        clearTimeout(this.timer);
        this.el.textContent = text;
        this.el.className = `tiptapeditor__message tiptapeditor__message--${type}`;
        this.el.hidden = false;
        this.timer = setTimeout(() => this.hide(), duration);
    }

    hide() {
        clearTimeout(this.timer);
        this.el.hidden = true;
        this.el.textContent = '';
    }

    destroy() {
        clearTimeout(this.timer);
        this.el.remove();
    }
}
