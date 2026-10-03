import { debounce } from '../utils/debounce.js';

function touchesTextarea(node) {
    return node.nodeType === Node.ELEMENT_NODE
        && (node.localName === 'textarea' || (node.firstElementChild && node.querySelector('textarea')));
}

/**
 * Watches the manager form for richtext fields that appear or disappear after the first
 * render (Form Customization, extras that build panels later, removed TV blocks).
 *
 * Scope is the resource panel when it exists, otherwise the body. The callback only checks
 * whether a mutation added or removed a textarea and schedules one debounced refresh, so
 * typing in the editor or other DOM churn costs next to nothing.
 *
 * @param {() => void} refresh
 * @returns {{ disconnect: () => void }}
 */
export function observeFields(refresh, delay = 100) {
    if (typeof MutationObserver === 'undefined') {
        return { disconnect() {} };
    }
    const scope = window.Ext?.getCmp?.('modx-panel-resource')?.el?.dom || document.body;
    const schedule = debounce(refresh, delay);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.target.closest?.('.tiptapeditor')) {
                continue; // changes inside an editor
            }
            for (const node of mutation.addedNodes) {
                if (touchesTextarea(node)) {
                    schedule();
                    return;
                }
            }
            for (const node of mutation.removedNodes) {
                if (touchesTextarea(node)) {
                    schedule();
                    return;
                }
            }
        }
    });
    observer.observe(scope, { childList: true, subtree: true });

    return {
        disconnect() {
            schedule.cancel();
            observer.disconnect();
        },
    };
}
