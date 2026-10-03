import { SUGGESTING } from './SuggestionList.js';

/**
 * Fullscreen mode: the editor covers the manager window, the toolbar stays on top.
 * Escape leaves it. The page behind does not scroll while it is active.
 */
export class Fullscreen {
    constructor(root, { onChange } = {}) {
        this.root = root;
        this.onChange = onChange;
        this.active = false;
        this.onKeydown = (event) => {
            if (event.key === 'Escape' && this.active && !event.defaultPrevented) {
                event.preventDefault();
                this.toggle(false);
            }
        };
        // From the text or the source textarea, Escape is taken before ProseMirror (whose own
        // Escape selects the parent node). Menus, popovers and an open suggestion list keep
        // theirs: they close first.
        this.onKeydownCapture = (event) => {
            if (event.key === 'Escape' && this.active && !this.root.hasAttribute(SUGGESTING)
                && event.target.closest?.('.ProseMirror, .tiptapeditor__source')) {
                event.preventDefault();
                event.stopPropagation();
                this.toggle(false);
            }
        };
        root.addEventListener('keydown', this.onKeydown);
        root.addEventListener('keydown', this.onKeydownCapture, true);
    }

    toggle(force) {
        const next = typeof force === 'boolean' ? force : !this.active;
        if (next === this.active) {
            return;
        }
        this.active = next;
        this.root.classList.toggle('tiptapeditor--fullscreen', next);
        this.root.ownerDocument.documentElement.classList.toggle('tiptapeditor-has-fullscreen', next);
        this.onChange?.(next);
    }

    destroy() {
        this.toggle(false);
        this.root.removeEventListener('keydown', this.onKeydown);
        this.root.removeEventListener('keydown', this.onKeydownCapture, true);
    }
}
