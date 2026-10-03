/**
 * MODX and Fenom tokenizer: finds template constructs in a string, exactly as written.
 *
 * MODX:  "[[" up to the matching "]]", nested tags counted, so
 *        [[!pdoResources? &tpl=`@INLINE [[+pagetitle]]`]] is one token. Every prefix
 *        (*, ++, ~, $, %, +, -, !, #) and output filter is part of the token. An unclosed
 *        "[[" is not a token.
 * Fenom: "{" directly followed by "$", "/", "*", a quote, or a keyword (if, foreach, set,
 *        include, …) or a name from tiptapeditor.fenom_tags, up to the matching "}". Quoted
 *        strings (with backslash escapes) and nested braces are skipped over. "{ " with a
 *        space is plain text (Fenom's own rule; CSS and JSON stay text). {* … *} comments
 *        and {ignore}…{/ignore} are one token each. An unclosed tag is not a token.
 *
 * The scanner never interprets the constructs; it only finds where they start and end.
 */

export const FENOM_KEYWORDS = Object.freeze([
    'if', 'elseif', 'else', 'foreach', 'foreachelse', 'for', 'switch', 'case', 'default', 'break', 'continue',
    'set', 'add', 'var', 'include', 'insert', 'extends', 'block', 'parent', 'use', 'macro', 'import', 'filter',
    'ignore', 'raw', 'autoescape', 'autotrim', 'cycle', 'unset',
]);

const NAME = /^[A-Za-z_][\w.]*/;
const WHOLE_NAME = /^[A-Za-z_][\w.]*$/;

/** Index after the MODX tag starting at i ("[["), or -1 when it is not closed. */
function modxEnd(src, i) {
    let depth = 0;
    let j = i;
    while (j < src.length - 1) {
        if (src[j] === '[' && src[j + 1] === '[') {
            depth++;
            j += 2;
        } else if (src[j] === ']' && src[j + 1] === ']') {
            depth--;
            j += 2;
            if (depth === 0) {
                return j;
            }
        } else {
            j++;
        }
    }
    return -1;
}

/** Index after the closing brace of the Fenom tag starting at i ("{"), or -1. */
function fenomTagEnd(src, i) {
    let depth = 0;
    let quote = null;
    for (let j = i; j < src.length; j++) {
        const c = src[j];
        if (quote) {
            if (c === '\\') {
                j++;
            } else if (c === quote) {
                quote = null;
            }
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
        } else if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) {
                return j + 1;
            }
        }
    }
    return -1;
}

function fenomStart(src, i, tags) {
    const next = src[i + 1];
    if (next === undefined) {
        return null;
    }
    if (next === '*') {
        return 'comment';
    }
    if (next === '$' || next === '/' || next === '"' || next === "'") {
        return 'tag';
    }
    const name = NAME.exec(src.slice(i + 1, i + 41));
    if (!name) {
        return null;
    }
    const word = name[0];
    const after = src[i + 1 + word.length];
    // A keyword or configured name followed by the end of the tag, a space, a modifier or call.
    const bounded = after === undefined || after === '}' || after === ' ' || after === '\t' || after === '\n'
        || after === '\r' || after === '|' || after === '(';
    if (!bounded) {
        return null;
    }
    if (word === 'ignore' && after === '}') {
        return 'ignore';
    }
    return FENOM_KEYWORDS.includes(word) || tags.has(word) ? 'tag' : null;
}

function fenomEnd(src, i, kind) {
    if (kind === 'comment') {
        const close = src.indexOf('*}', i + 2);
        return close === -1 ? -1 : close + 2;
    }
    if (kind === 'ignore') {
        const close = src.indexOf('{/ignore}', i);
        return close === -1 ? -1 : close + '{/ignore}'.length;
    }
    return fenomTagEnd(src, i);
}

/** Parses tiptapeditor.fenom_tags ("myFunc, other") into a set of names. */
export function parseFenomTags(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(',');
    return new Set(list.map((name) => String(name).trim()).filter((name) => WHOLE_NAME.test(name)));
}

/**
 * @param {string} src
 * @param {{ modx?: boolean, fenom?: boolean, fenomTags?: Set<string>|string }} [options]
 * @returns {{ kind: 'modx'|'fenom', start: number, end: number, raw: string }[]}
 */
export function findTokens(src, { modx = true, fenom = true, fenomTags = new Set() } = {}) {
    const tags = fenomTags instanceof Set ? fenomTags : parseFenomTags(fenomTags);
    const tokens = [];
    const text = String(src ?? '');
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (modx && c === '[' && text[i + 1] === '[') {
            const end = modxEnd(text, i);
            if (end !== -1) {
                tokens.push({ kind: 'modx', start: i, end, raw: text.slice(i, end) });
                i = end;
                continue;
            }
        } else if (fenom && c === '{') {
            const kind = fenomStart(text, i, tags);
            const end = kind ? fenomEnd(text, i, kind) : -1;
            if (end !== -1) {
                tokens.push({ kind: 'fenom', start: i, end, raw: text.slice(i, end) });
                i = end;
                continue;
            }
        }
        i++;
    }
    return tokens;
}

export function hasTokens(src, options) {
    return findTokens(src, options).length > 0;
}
