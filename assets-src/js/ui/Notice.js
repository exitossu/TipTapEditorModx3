import { createElement } from '../utils/dom.js';

/**
 * Inline message shown above a textarea that stays a plain field.
 */
export function showNotice(textarea, message, type = 'info') {
    removeNotice(textarea);
    const notice = createElement('div', `tiptapeditor-notice tiptapeditor-notice--${type}`, {
        role: type === 'error' ? 'alert' : 'status',
        'data-tiptapeditor-notice': textarea.id || '',
    });
    notice.textContent = message;
    textarea.before(notice);
    return notice;
}

export function removeNotice(textarea) {
    const prev = textarea.previousElementSibling;
    if (prev && prev.hasAttribute('data-tiptapeditor-notice')) {
        prev.remove();
    }
}
