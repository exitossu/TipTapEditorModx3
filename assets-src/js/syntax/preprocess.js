import { elementFromString } from '@tiptap/core';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import { IMPLICIT } from '../extensions/ImplicitParagraph.js';
import { ContentKeptAsSource } from './errors.js';
import { BODYLESS } from './finishHtml.js';
import { BLOCK, scanTopLevel } from './htmlScanner.js';
import { findLosses } from './LossDetector.js';
import { documentHtml } from './serialize.js';
import { hasSentinel, idOf, MARK, PRIVATE_MARKS, restoreSentinels, sentinel, SENTINEL } from './store.js';
import { findTokens } from './tokenizer.js';

/**
 * Content → HTML for the editor, without losing anything.
 *
 * 1. MODX/Fenom tokens are replaced by sentinels in the source string, before any HTML parser
 *    sees them (so "&", "<", quotes and braces inside them are never touched).
 * 2. The source is split into top-level items (htmlScanner.js) with exact source ranges.
 * 3. Each block is checked on its own: if the editor can represent it (parse and serialize it
 *    with the editor schema; nothing may be lost), it is editable; otherwise it is kept as a
 *    raw HTML block, byte for byte. Tokens where the HTML parser would move them (a {foreach}
 *    between table rows) or in raw text (script, pre) also keep their block raw.
 * 4. Text written without a paragraph (at the top level, in list items, cells, quotes) gets an
 *    implicit paragraph the serializer leaves out again.
 * 5. Tokens in text become token nodes: a block token when it stands alone between blocks,
 *    otherwise an inline badge. Tokens in attribute values stay sentinels there.
 */

const CONTAINERS = new Set(['li', 'td', 'th', 'blockquote']);
const NEWLINE_WHITESPACE = /^(\n\s\s|\n)$/;

function inertDocument() {
    return document.implementation.createHTMLDocument('');
}

function isInline(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return true;
    }
    return node.nodeType === Node.ELEMENT_NODE && !BLOCK.has(node.localName);
}

function isSignificant(node) {
    return node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.data.trim() !== '');
}

function implicitParagraph(doc) {
    const p = doc.createElement('p');
    p.setAttribute(IMPLICIT, MARK);
    return p;
}

/** Wraps runs of inline content directly in a list item, cell or quote in implicit paragraphs. */
function wrapInlineRuns(container) {
    const doc = container.ownerDocument;
    let group = [];
    const flush = () => {
        if (group.some(isSignificant)) {
            const p = implicitParagraph(doc);
            group[0].before(p);
            p.append(...group);
        }
        group = [];
    };
    for (const child of [...container.childNodes]) {
        if (isInline(child)) {
            group.push(child);
        } else {
            flush();
        }
    }
    flush();
    const first = [...container.children][0];
    if (!first) {
        // Empty cell, item or quote: keeps its form instead of getting an empty <p>.
        container.append(implicitParagraph(doc));
    } else if (container.localName === 'li' && first.localName !== 'p') {
        // A list item starts with a paragraph in the editor; <li><ul>… keeps its form.
        first.before(implicitParagraph(doc));
    }
}

/**
 * Tiptap drops text nodes that are a bare newline (plus two spaces) while parsing, which
 * glues words together ("<b>a</b>\n<i>b</i>"). Between inline content such a newline is a
 * space, so it is written as one.
 */
function keepInlineSpaces(root) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (NEWLINE_WHITESPACE.test(node.data)) {
            texts.push(node);
        }
    }
    for (const text of texts) {
        const prev = text.previousSibling;
        const next = text.nextSibling;
        const parentInline = text.parentElement && !BLOCK.has(text.parentElement.localName) && text.parentElement !== root;
        const between = prev && next && isInline(prev) && isInline(next);
        if (between || (parentInline && (prev || next))) {
            text.data = ' ';
        }
    }
}

/** Sentinels in text → token elements (inline). */
function tokenElements(root) {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        SENTINEL.lastIndex = 0;
        if (SENTINEL.test(node.data)) {
            texts.push(node);
        }
    }
    for (const text of texts) {
        const fragment = doc.createDocumentFragment();
        let last = 0;
        SENTINEL.lastIndex = 0;
        for (const match of text.data.matchAll(SENTINEL)) {
            if (match.index > last) {
                fragment.append(text.data.slice(last, match.index));
            }
            const span = doc.createElement('span');
            span.setAttribute('data-tiptapeditor-token', match[1]);
            fragment.append(span);
            last = match.index + match[0].length;
        }
        if (last < text.data.length) {
            fragment.append(text.data.slice(last));
        }
        text.replaceWith(fragment);
    }
}

/** For each <table> in source order: true when no <tbody> is written in it. */
function bodylessTables(html) {
    const result = [];
    const open = [];
    for (const match of html.matchAll(/<(\/?)(table|tbody)\b/gi)) {
        const name = match[2].toLowerCase();
        if (name === 'table' && !match[1]) {
            open.push(result.length);
            result.push(true);
        } else if (name === 'table') {
            open.pop();
        } else if (!match[1] && open.length) {
            result[open[open.length - 1]] = false;
        }
    }
    return result;
}

/** Prepares a fragment for the editor: implicit paragraphs, spaces, token elements. */
function prepareFragment(html) {
    const doc = inertDocument();
    const body = doc.body;
    body.innerHTML = html;
    const bodyless = bodylessTables(html);
    body.querySelectorAll('table').forEach((table, index) => {
        if (bodyless[index]) {
            table.setAttribute(BODYLESS, MARK);
        }
    });
    keepInlineSpaces(body);
    tokenElements(body);
    // Tokens in attribute values are plain text in the document (the serializer protects them).
    body.querySelectorAll('*').forEach((element) => {
        for (const name of element.getAttributeNames()) {
            const value = element.getAttribute(name);
            if (hasSentinel(value)) {
                element.setAttribute(name, restoreSentinels(value));
            }
        }
    });
    [...body.querySelectorAll('li, td, th, blockquote')].forEach(wrapInlineRuns);
    return body.innerHTML;
}

/** True when the editor would lose something of `source` when given `prepared`. */
function losesSomething(schema, prepared, source, lossOptions) {
    try {
        const doc = PMDOMParser.fromSchema(schema).parse(elementFromString(prepared));
        return findLosses(restoreSentinels(source), restoreSentinels(documentHtml(doc, schema)), lossOptions).length > 0;
    } catch {
        return true;
    }
}

function rawBlock(source) {
    return `<div data-tiptapeditor-raw="${idOf(restoreSentinels(source))}"></div>`;
}

function blockToken(id) {
    return `<div data-tiptapeditor-token="${id}"></div>`;
}

/** Tokens alone between blocks: each its own block, unless several share a line. */
function standaloneTokens(source) {
    if (source.replace(SENTINEL, '').trim() !== '') {
        return null;
    }
    const matches = [...source.matchAll(SENTINEL)];
    for (let i = 1; i < matches.length; i++) {
        const gap = source.slice(matches[i - 1].index + matches[i - 1][0].length, matches[i].index);
        if (!gap.includes('\n')) {
            return null;
        }
    }
    return matches.map((match) => match[1]);
}

/**
 * Tokens at the start or end of a text run that stand on a line of their own ("{/if}" before
 * "Text…" on the next line) are blocks. Returns the ids before, the text, the ids after.
 */
function peelLineTokens(text) {
    const before = [];
    const after = [];
    let rest = text;
    const lead = new RegExp(`^\\s*${SENTINEL.source}([ \\t]*\\n)`);
    const trail = new RegExp(`(\\n[ \\t]*)${SENTINEL.source}\\s*$`);
    for (let match = lead.exec(rest); match && rest.slice(match[0].length).trim(); match = lead.exec(rest)) {
        before.push(match[1]);
        rest = rest.slice(match[0].length);
    }
    for (let match = trail.exec(rest); match && rest.slice(0, match.index).trim(); match = trail.exec(rest)) {
        after.unshift(match[2]);
        rest = rest.slice(0, match.index);
    }
    return { before, rest, after };
}

/**
 * @param {string} content textarea value
 * @param {object} options
 * @param {import('@tiptap/pm/model').Schema} options.schema editor schema
 * @param {boolean} [options.modx] protect MODX tags
 * @param {boolean} [options.fenom] protect Fenom
 * @param {string|Set<string>} [options.fenomTags] extra Fenom tag names
 * @param {boolean} [options.ignoreStyle] style attributes may be dropped (preserve_style_attribute off)
 * @returns {string} HTML for the editor
 */
export function preprocess(content, { schema, modx = true, fenom = true, fenomTags = '', ignoreStyle = false }) {
    const lossOptions = { ignoreStyle };
    const source = String(content ?? '');
    if (PRIVATE_MARKS.test(source)) {
        throw new ContentKeptAsSource('content_kept_as_source', ['private use characters U+E000/U+E001']);
    }
    let html = '';
    let last = 0;
    for (const token of findTokens(source, { modx, fenom, fenomTags })) {
        html += source.slice(last, token.start) + sentinel(token.raw);
        last = token.end;
    }
    html += source.slice(last);

    const parts = [];
    let run = [];
    const flushRun = () => {
        if (!run.length) {
            return;
        }
        const text = html.slice(run[0].start, run[run.length - 1].end);
        const flagged = run.some((item) => item.flags.size);
        run = [];
        if (!text.trim()) {
            return;
        }
        const alone = flagged ? null : standaloneTokens(text);
        if (alone) {
            parts.push(...alone.map(blockToken));
            return;
        }
        if (flagged) {
            parts.push(rawBlock(text));
            return;
        }
        const { before, rest, after } = peelLineTokens(text);
        const prepared = `<p ${IMPLICIT}="${MARK}">${prepareFragment(rest)}</p>`;
        if (losesSomething(schema, prepared, rest, lossOptions)) {
            parts.push(rawBlock(text));
            return;
        }
        parts.push(...before.map(blockToken), prepared, ...after.map(blockToken));
    };

    // With the iframe extension an <iframe> is inline content: one between blocks becomes an
    // implicit paragraph the serializer leaves out again.
    const inlineIframe = Boolean(schema?.nodes.iframe);
    for (const item of scanTopLevel(html)) {
        if (item.type === 'text' || (item.type === 'element' && (!BLOCK.has(item.name) || (inlineIframe && item.name === 'iframe' && !item.flags.size)))) {
            run.push(item);
            continue;
        }
        flushRun();
        const text = html.slice(item.start, item.end);
        if (item.type !== 'element' || item.flags.size) {
            parts.push(rawBlock(text));
            continue;
        }
        const prepared = prepareFragment(text);
        parts.push(losesSomething(schema, prepared, text, lossOptions) ? rawBlock(text) : prepared);
    }
    flushRun();
    return parts.join('');
}
