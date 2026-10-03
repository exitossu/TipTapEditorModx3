/**
 * Small DOM helpers.
 */
export function createElement(tag, className, attributes = {}) {
    const el = document.createElement(tag);
    if (className) {
        el.className = className;
    }
    for (const [name, value] of Object.entries(attributes)) {
        el.setAttribute(name, value);
    }
    return el;
}

// ExtJS hides inactive tabs by moving them off screen (x-hide-offsets), so they still have a box.
const EXT_HIDDEN = '.x-hide-offsets, .x-hide-display, .x-hide-visibility';

/** True when the element is actually shown (not in a hidden tab or collapsed panel). */
export function isRendered(el) {
    return el.isConnected && el.getClientRects().length > 0 && !el.closest(EXT_HIDDEN);
}

/**
 * Resolves textarea elements from IDs, elements or selectors.
 * @param {Array<string|Element>|string|Element|undefined} targets
 * @returns {HTMLTextAreaElement[]}
 */
export function resolveTextareas(targets, root = document) {
    const list = targets === undefined || targets === null ? [] : [].concat(targets);
    const found = [];
    for (const target of list) {
        let el = null;
        if (target instanceof Element) {
            el = target;
        } else if (typeof target === 'string' && target) {
            el = root.getElementById ? root.getElementById(target) : null;
            if (!el && /[#.[\s]/.test(target)) {
                try {
                    el = root.querySelector(target);
                } catch {
                    el = null;
                }
            }
        }
        if (el instanceof HTMLTextAreaElement && !found.includes(el)) {
            found.push(el);
        }
    }
    return found;
}
