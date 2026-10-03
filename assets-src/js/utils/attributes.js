// Same value as VERBATIM in syntax/finishHtml.js, which sets these back.
const VERBATIM = 'data-tiptapeditor-verbatim-';

// Event handler attributes are never kept: content with onclick="…" stays in the plain
// textarea (the loss check reports it) instead of running script in the manager.
export const EVENT_HANDLER = /^on/i;

/**
 * Attributes of an element a node has no own field for (id, data-*, aria-*, style, …), as
 * written. Event handlers are left out. Returns null when there are none.
 *
 * @param {Element} element
 * @param {Set<string>} known lower case names the node stores in fields of its own
 */
export function otherAttributes(element, known) {
    const result = {};
    for (const attribute of element.getAttributeNames()) {
        // Copied from the editor: style under its marker name (see renderExtra).
        const name = attribute.toLowerCase().startsWith(VERBATIM) ? attribute.slice(VERBATIM.length) : attribute;
        const lower = name.toLowerCase();
        if (!known.has(lower) && !EVENT_HANDLER.test(lower)) {
            result[name] = element.getAttribute(attribute);
        }
    }
    return Object.keys(result).length ? result : null;
}

/**
 * Extra attributes for renderHTML. style is rendered under a marker name, because
 * ProseMirror writes it through style.cssText, which rewrites the value ("border: 0" →
 * "border: 0px;"); the serializer sets it back as written.
 */
export function renderExtra(extra) {
    const result = {};
    for (const [name, value] of Object.entries(extra || {})) {
        result[name.toLowerCase() === 'style' ? VERBATIM + name : name] = value;
    }
    return result;
}

/** Node attribute that keeps all other HTML attributes of the element. */
export function extraAttribute(known) {
    return {
        default: null,
        parseHTML: (element) => otherAttributes(element, known),
        renderHTML: (attributes) => renderExtra(attributes.extra),
    };
}

/** Sets attributes on a view element (never event handlers), removing the ones not listed. */
export function applyAttributes(element, attributes, skip = new Set()) {
    for (const name of element.getAttributeNames()) {
        if (!(name in attributes) || attributes[name] === null || attributes[name] === undefined) {
            element.removeAttribute(name);
        }
    }
    for (const [name, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || EVENT_HANDLER.test(name) || skip.has(name.toLowerCase())) {
            continue;
        }
        element.setAttribute(name, String(value));
    }
}
