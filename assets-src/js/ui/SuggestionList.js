import { createElement } from '../utils/dom.js';
import { icon } from './icons.js';

let counter = 0;

export const SUGGESTING = 'data-tiptapeditor-suggesting';

/**
 * Popup list for Tiptap suggestions (slash commands, MODX/Fenom autocomplete).
 *
 * The list is a listbox; the editor keeps the focus and points at the highlighted option with
 * aria-activedescendant. Arrow keys move, Enter or Tab picks, Escape closes (handled by the
 * suggestion plugin), the mouse picks without taking the focus. Items are text only:
 * { label, detail?, icon?, ... }. While the list is open the editor root carries
 * data-tiptapeditor-suggesting, so other Escape handlers (fullscreen) leave the key alone.
 *
 * @param {{ className?: string, emptyText?: () => string, loadingText?: () => string, label: string }} options
 */
export function suggestionRenderer({ className = '', emptyText, loadingText, label }) {
    return () => {
        let el = null;
        let list = null;
        let unmount = null;
        let props = null;
        let items = [];
        let index = 0;
        let root = null;
        let editable = null;
        const id = `tiptapeditor-suggest-${++counter}`;

        const optionId = (i) => `${id}-${i}`;

        const highlight = (next) => {
            index = items.length ? (next + items.length) % items.length : 0;
            list?.querySelectorAll('[role="option"]').forEach((option, i) => {
                option.setAttribute('aria-selected', String(i === index));
                if (i === index) {
                    option.scrollIntoView?.({ block: 'nearest' });
                }
            });
            if (items.length) {
                editable?.setAttribute('aria-activedescendant', optionId(index));
            } else {
                editable?.removeAttribute('aria-activedescendant');
            }
        };

        const pick = (i) => {
            const item = items[i];
            if (item && props) {
                props.command(item);
            }
        };

        const draw = () => {
            items = Array.isArray(props.items) ? props.items : [];
            list.replaceChildren();
            items.forEach((item, i) => {
                const option = createElement('div', 'tiptapeditor-suggest__item', { role: 'option', id: optionId(i), 'aria-selected': 'false' });
                const svg = item.icon ? icon(item.icon) : null;
                if (svg) {
                    option.append(svg);
                }
                const text = createElement('span', 'tiptapeditor-suggest__label');
                text.textContent = item.label;
                option.append(text);
                if (item.detail) {
                    const detail = createElement('span', 'tiptapeditor-suggest__detail');
                    detail.textContent = item.detail;
                    option.append(detail);
                }
                option.addEventListener('mousedown', (event) => event.preventDefault());
                option.addEventListener('click', () => pick(i));
                option.addEventListener('mousemove', () => {
                    if (index !== i) {
                        highlight(i);
                    }
                });
                list.append(option);
            });
            let note = '';
            if (!items.length) {
                note = props.loading ? (loadingText?.() || '') : (emptyText?.(props) || '');
            }
            if (note) {
                const empty = createElement('div', 'tiptapeditor-suggest__empty');
                empty.textContent = note;
                list.append(empty);
            }
            el.hidden = !items.length && !note;
            highlight(0);
        };

        return {
            onStart(next) {
                props = next;
                editable = next.editor.view.dom;
                root = editable.closest('.tiptapeditor');
                root?.setAttribute(SUGGESTING, '');
                el = createElement('div', `tiptapeditor-suggest ${className}`.trim());
                list = createElement('div', 'tiptapeditor-suggest__list', { role: 'listbox', id, 'aria-label': label });
                el.append(list);
                el.addEventListener('mousedown', (event) => event.preventDefault());
                editable.setAttribute('aria-controls', id);
                editable.setAttribute('aria-expanded', 'true');
                unmount = next.mount(el);
                draw();
            },
            onUpdate(next) {
                props = next;
                if (el) {
                    draw();
                }
            },
            onKeyDown({ event }) {
                if (!items.length || el?.hidden) {
                    return false;
                }
                if (event.key === 'ArrowDown') {
                    highlight(index + 1);
                    return true;
                }
                if (event.key === 'ArrowUp') {
                    highlight(index - 1);
                    return true;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                    pick(index);
                    return true;
                }
                return false;
            },
            onExit() {
                unmount?.();
                el?.remove();
                root?.removeAttribute(SUGGESTING);
                editable?.removeAttribute('aria-activedescendant');
                editable?.removeAttribute('aria-controls');
                editable?.removeAttribute('aria-expanded');
                el = null;
                list = null;
                unmount = null;
                props = null;
                items = [];
            },
        };
    };
}
