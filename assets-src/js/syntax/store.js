/**
 * Page-wide store of protected source fragments (MODX/Fenom tokens and raw HTML blocks).
 *
 * While content is in the editor, a fragment is represented by a sentinel: U+E000, an id,
 * U+E001. Private Use Area characters are never escaped by the HTML parser or serializer
 * and pass through text and attribute values untouched; content that already contains them
 * is not opened in the editor. Ids carry a per-page prefix, so a sentinel copied into another
 * browser tab is not mistaken for one of that tab's fragments.
 *
 * The store only grows while the page is open; fragments are deduplicated.
 */

export const OPEN = '';
export const CLOSE = '';
export const SENTINEL = /([a-z0-9]+-\d+)/g;
export const PRIVATE_MARKS = /[]/;

const prefix = Math.random().toString(36).slice(2, 8) || 'p';
const byId = new Map();
const byRaw = new Map();
let counter = 0;

/** Id of a fragment (registered on first use). */
export function idOf(raw) {
    let id = byRaw.get(raw);
    if (!id) {
        counter += 1;
        id = `${prefix}-${counter}`;
        byRaw.set(raw, id);
        byId.set(id, raw);
    }
    return id;
}

/** The fragment of an id from this page, or undefined. */
export function rawOf(id) {
    return byId.get(id);
}

export function sentinel(raw) {
    return `${OPEN}${idOf(raw)}${CLOSE}`;
}

/** Replaces every sentinel of this page by its original text; unknown ones stay. */
export function restoreSentinels(text) {
    return String(text).replace(SENTINEL, (match, id) => (byId.has(id) ? byId.get(id) : match));
}

export function hasSentinel(text) {
    SENTINEL.lastIndex = 0;
    const found = SENTINEL.test(String(text));
    SENTINEL.lastIndex = 0;
    return found;
}

/** Per-page value of marker attributes the preprocessor sets (implicit paragraphs). */
export const MARK = prefix;
