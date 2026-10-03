import { hasSentinel, rawOf, SENTINEL } from './store.js';

/**
 * Lightweight HTML scanner for the preprocessor. It works on the source string (with MODX/Fenom
 * tokens already replaced by sentinels) and returns the top-level items with their exact
 * source ranges, so content the editor cannot represent can be kept byte for byte.
 *
 * It also flags tokens in places where the browser's HTML parser or ProseMirror would move
 * or rewrap them (and with them the template logic):
 *   structural  directly inside table/thead/tbody/tfoot/tr/colgroup (the parser moves text out
 *               of tables), ul/ol/dl/menu (it would become a new list item), select/optgroup/datalist
 *   rawtext     inside script, style, textarea, title, xmp, noscript, pre (not editable text)
 *   tag         inside a tag but not in a quoted attribute value (<li[[+cls]]>), or in an
 *               attribute value it cannot be written back into with double quotes
 */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noscript', 'plaintext', 'iframe', 'noembed', 'noframes']);
const STRUCTURAL = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ul', 'ol', 'dl', 'menu', 'select', 'optgroup', 'datalist']);
const PREFORMATTED = new Set(['pre', 'listing']);

// Elements that close an open <p> (HTML's implied end tags), enough for segmentation.
const CLOSES_P = new Set([
    'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figcaption', 'figure',
    'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p',
    'pre', 'section', 'table', 'ul',
]);

/** Block-level names: at the top level they start their own item; everything else is inline. */
export const BLOCK = new Set([
    ...CLOSES_P, 'li', 'dd', 'dt', 'caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'html', 'head',
    'body', 'script', 'style', 'template', 'noscript', 'iframe', 'video', 'audio', 'picture', 'canvas', 'svg', 'math',
    'object', 'embed', 'center', 'listing', 'xmp', 'search', 'link', 'meta', 'base', 'title',
]);

const NAME_CHAR = /[A-Za-z0-9:_-]/;

function readName(src, i) {
    let j = i;
    while (j < src.length && NAME_CHAR.test(src[j])) {
        j++;
    }
    return { name: src.slice(i, j).toLowerCase(), end: j };
}

/**
 * Reads a start tag from "<" at i. Returns its name, end index, whether it closes itself,
 * and whether a sentinel sits outside a quoted attribute value or cannot be written back.
 */
function readStartTag(src, i) {
    const { name, end: nameEnd } = readName(src, i + 1);
    let j = nameEnd;
    let quote = null;
    let valueStart = 0;
    let unsafe = false;
    let bare = '';
    while (j < src.length) {
        const c = src[j];
        if (quote) {
            if (c === quote) {
                const value = src.slice(valueStart, j);
                // The serializer writes attribute values in double quotes; a token that
                // contains one cannot be written back unchanged.
                if (hasSentinel(value) && [...value.matchAll(SENTINEL)].some((m) => (rawOf(m[1]) || '').includes('"'))) {
                    unsafe = true;
                }
                quote = null;
            }
        } else if (c === '"' || c === "'") {
            quote = c;
            valueStart = j + 1;
        } else if (c === '>') {
            break;
        } else {
            bare += c;
        }
        j++;
    }
    if (hasSentinel(bare)) {
        unsafe = true;
    }
    const selfClosing = src[j - 1] === '/';
    return { name, end: Math.min(j + 1, src.length), selfClosing, unsafe };
}

/**
 * @param {string} src HTML with tokens replaced by sentinels
 * @returns {{ type: 'element'|'text'|'comment'|'other', name?: string, start: number, end: number, flags: Set<string> }[]}
 */
export function scanTopLevel(src) {
    const items = [];
    const stack = [];
    let current = null; // the top-level element item being read
    let i = 0;

    const flag = (name) => current?.flags.add(name);
    const closeTo = (index, at) => {
        stack.length = index;
        if (!stack.length && current) {
            current.end = at;
            items.push(current);
            current = null;
        }
    };
    const pushText = (start, end) => {
        if (start >= end) {
            return;
        }
        const last = items[items.length - 1];
        if (last && last.type === 'text' && last.end === start) {
            last.end = end;
        } else {
            items.push({ type: 'text', start, end, flags: new Set() });
        }
    };
    const checkText = (start, end) => {
        if (!stack.length || !hasSentinel(src.slice(start, end))) {
            return;
        }
        const inner = stack[stack.length - 1];
        if (STRUCTURAL.has(inner)) {
            flag('structural');
        }
        if (stack.some((name) => PREFORMATTED.has(name))) {
            flag('rawtext');
        }
    };

    while (i < src.length) {
        const lt = src.indexOf('<', i);
        const textEnd = lt === -1 ? src.length : lt;
        if (textEnd > i) {
            if (stack.length) {
                checkText(i, textEnd);
            } else {
                pushText(i, textEnd);
            }
            i = textEnd;
            continue;
        }
        // At "<".
        if (src.startsWith('<!--', i)) {
            const close = src.indexOf('-->', i + 4);
            const end = close === -1 ? src.length : close + 3;
            if (!stack.length) {
                items.push({ type: 'comment', start: i, end, flags: new Set() });
            } else if (hasSentinel(src.slice(i, end))) {
                flag('rawtext');
            }
            i = end;
            continue;
        }
        if (src[i + 1] === '!' || src[i + 1] === '?') {
            const close = src.indexOf('>', i);
            const end = close === -1 ? src.length : close + 1;
            if (!stack.length) {
                items.push({ type: 'other', start: i, end, flags: new Set() });
            }
            i = end;
            continue;
        }
        if (src[i + 1] === '/' && /[A-Za-z]/.test(src[i + 2] || '')) {
            const { name, end: nameEnd } = readName(src, i + 2);
            const close = src.indexOf('>', nameEnd);
            const end = close === -1 ? src.length : close + 1;
            const index = stack.lastIndexOf(name);
            if (index !== -1) {
                closeTo(index, end);
            } else if (!stack.length) {
                // A stray end tag at the top level: kept as it is.
                items.push({ type: 'other', start: i, end, flags: new Set() });
            }
            i = end;
            continue;
        }
        if (!/[A-Za-z]/.test(src[i + 1] || '')) {
            // A lone "<" is text.
            if (stack.length) {
                checkText(i, i + 1);
            } else {
                pushText(i, i + 1);
            }
            i++;
            continue;
        }

        const tag = readStartTag(src, i);
        const { name } = tag;
        // Implied end tags, enough to find where top-level elements end.
        if (stack.length) {
            const top = stack[stack.length - 1];
            if (top === 'p' && CLOSES_P.has(name)) {
                closeTo(stack.length - 1, i);
            } else if ((name === 'li' && stack.includes('li')) || ((name === 'dt' || name === 'dd') && (top === 'dt' || top === 'dd'))) {
                const index = stack.lastIndexOf(name === 'li' ? 'li' : top);
                if (index > Math.max(stack.lastIndexOf('ul'), stack.lastIndexOf('ol'), stack.lastIndexOf('dl'))) {
                    closeTo(index, i);
                }
            } else if ((name === 'td' || name === 'th') && (top === 'td' || top === 'th')) {
                closeTo(stack.length - 1, i);
            } else if (name === 'tr') {
                const index = stack.lastIndexOf('tr');
                if (index !== -1 && index > stack.lastIndexOf('table')) {
                    closeTo(index, i);
                }
            } else if (name === 'option' && top === 'option') {
                closeTo(stack.length - 1, i);
            }
        }
        if (!stack.length) {
            current = { type: 'element', name, start: i, end: tag.end, flags: new Set() };
        }
        if (tag.unsafe) {
            flag('tag');
        }
        if (VOID.has(name) || tag.selfClosing) {
            if (!stack.length && current) {
                current.end = tag.end;
                items.push(current);
                current = null;
            }
            i = tag.end;
            continue;
        }
        if (RAW_TEXT.has(name)) {
            // Raw text elements end only at their own end tag.
            const close = src.toLowerCase().indexOf(`</${name}`, tag.end);
            const contentEnd = close === -1 ? src.length : close;
            const gt = close === -1 ? -1 : src.indexOf('>', close);
            const endTagEnd = gt === -1 ? src.length : gt + 1;
            if (hasSentinel(src.slice(tag.end, contentEnd))) {
                flag('rawtext');
            }
            if (!stack.length) {
                current.end = endTagEnd;
                items.push(current);
                current = null;
            }
            i = endTagEnd;
            continue;
        }
        stack.push(name);
        i = tag.end;
    }
    if (current) {
        current.end = src.length;
        items.push(current);
    }
    return items;
}
