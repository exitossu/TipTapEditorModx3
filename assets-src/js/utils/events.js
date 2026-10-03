/**
 * Dispatches a public TipTapEditor event on document, e.g. "tiptapeditor:ready".
 * Listeners must never break the editor, so errors are contained by the browser
 * (dispatchEvent reports listener exceptions without throwing).
 */
export function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(`tiptapeditor:${name}`, { detail }));
}

/** Fires input and change on a form field so MODX and other listeners see the new value. */
export function fireFieldEvents(field) {
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
}
