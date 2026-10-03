import { IMPLICIT } from '../extensions/ImplicitParagraph.js';
import { OPEN, CLOSE, sentinel } from './store.js';
import { findTokens } from './tokenizer.js';

/**
 * Last step of serialization, on the DOM ProseMirror produced, before it becomes a string:
 *
 * - MODX/Fenom tokens and raw HTML blocks become their sentinels; serialize() replaces those by
 *   the original source text after the DOM became a string, so nothing in them is escaped.
 *   Tokens in attribute values (href="[[~5? &scheme=`abs`]]") are text in the document, so
 *   the link and image dialogs show them; here they become sentinels too, so their "&" and
 *   quotes are not escaped.
 * - Table rows go back into <thead>, <tbody> and <tfoot> (ProseMirror tables only know rows).
 *   A leading run of header-section rows is the <thead>, a trailing run of footer rows the
 *   <tfoot> (also a footer run right after the head, the HTML 4 order); every other row is
 *   in one <tbody>.
 * - A paragraph the preprocessor added around text written without one (implicit) is left
 *   out again, unless it got attributes of its own (alignment) or a paragraph next to it
 *   (the text was split into paragraphs since).
 * - The editor's marker attributes are removed.
 */

const SECTION = 'data-tiptapeditor-section';
export const BODYLESS = 'data-tiptapeditor-bodyless';
// Attribute values the DOM would rewrite (style through style.cssText: "border: 0" becomes
// "border: 0px;") are rendered under this prefix and set back here as plain strings.
export const VERBATIM = 'data-tiptapeditor-verbatim-';
const PROTECTED = '[data-tiptapeditor-token], [data-tiptapeditor-raw]';

function sectionOf(row) {
    const value = row.getAttribute(SECTION);
    row.removeAttribute(SECTION);
    return value === 'thead' || value === 'tfoot' ? value : 'tbody';
}

function finishTable(table) {
    const bodyless = table.hasAttribute(BODYLESS);
    table.removeAttribute(BODYLESS);
    const rows = [...table.children].filter((child) => child.localName === 'tr');
    if (!rows.length) {
        return;
    }
    const sections = rows.map(sectionOf);
    let start = 0;
    while (start < rows.length && sections[start] === 'thead') {
        start++;
    }
    let end = rows.length;
    while (end > start && sections[end - 1] === 'tfoot') {
        end--;
    }
    let footFirst = start;
    while (footFirst < end && sections[footFirst] === 'tfoot') {
        footFirst++;
    }
    const doc = table.ownerDocument;
    const group = (tag, list) => {
        if (!list.length) {
            return;
        }
        const section = doc.createElement(tag);
        section.append(...list);
        table.append(section);
    };
    // A footer run directly after the head only counts when body rows follow it.
    const earlyFoot = footFirst < end ? rows.slice(start, footFirst) : [];
    const bodyStart = footFirst < end ? footFirst : start;
    group('thead', rows.slice(0, start));
    group('tfoot', earlyFoot);
    if (bodyless && !start && !earlyFoot.length && end === rows.length) {
        // Rows written directly in <table> (no <tbody> in the source) stay that way.
        table.append(...rows);
        return;
    }
    group('tbody', rows.slice(bodyStart, end));
    group('tfoot', rows.slice(end));
}

function unwrapImplicit(paragraph) {
    paragraph.removeAttribute(IMPLICIT);
    if (paragraph.attributes.length === 0) {
        paragraph.replaceWith(...paragraph.childNodes);
    }
}

function toSentinel(element) {
    const id = element.getAttribute('data-tiptapeditor-token') ?? element.getAttribute('data-tiptapeditor-raw');
    const doc = element.ownerDocument;
    const text = doc.createTextNode(`${OPEN}${id}${CLOSE}`);
    if (element.localName === 'div' && element.hasAttribute('data-tiptapeditor-token')) {
        // A block token stays on a line of its own, so it is read back as a block.
        const parts = [text];
        if (element.previousSibling) {
            parts.unshift(doc.createTextNode('\n'));
        }
        if (element.nextSibling) {
            parts.push(doc.createTextNode('\n'));
        }
        element.replaceWith(...parts);
        return;
    }
    element.replaceWith(text);
}

function protectAttributeTokens(element) {
    for (const name of element.getAttributeNames()) {
        const value = element.getAttribute(name);
        const tokens = findTokens(value);
        if (!tokens.length) {
            continue;
        }
        let result = '';
        let last = 0;
        for (const token of tokens) {
            result += value.slice(last, token.start) + sentinel(token.raw);
            last = token.end;
        }
        element.setAttribute(name, result + value.slice(last));
    }
}

function withoutTextAlign(style) {
    return style.split(';').filter((part) => part.trim() && !/^\s*text-align\s*:/i.test(part)).map((part) => part.trim()).join('; ');
}

function restoreVerbatim(element) {
    for (const name of element.getAttributeNames()) {
        if (name.startsWith(VERBATIM)) {
            let value = element.getAttribute(name);
            const target = name.slice(VERBATIM.length);
            element.removeAttribute(name);
            if (target === 'style' && element.hasAttribute('style')) {
                // An alignment set with the align buttons, on an element whose own style
                // has more than text-align: that style, with the new alignment.
                value = `${withoutTextAlign(value)}; ${element.getAttribute('style')}`;
            }
            element.setAttribute(target, value);
        }
    }
}

/** Links: href first, as it is written almost always (the link mark renders it last). */
function hrefFirst(link) {
    const names = link.getAttributeNames();
    if (!link.hasAttribute('href') || names[0] === 'href') {
        return;
    }
    const values = names.map((name) => [name, link.getAttribute(name)]);
    names.forEach((name) => link.removeAttribute(name));
    link.setAttribute('href', values.find(([name]) => name === 'href')[1]);
    values.filter(([name]) => name !== 'href').forEach(([name, value]) => link.setAttribute(name, value));
}

/** @param {HTMLElement} container element holding the serialized document */
export function finishHtml(container) {
    container.querySelectorAll(PROTECTED).forEach(toSentinel);
    container.querySelectorAll('table').forEach(finishTable);
    container.querySelectorAll('*').forEach((element) => {
        restoreVerbatim(element);
        protectAttributeTokens(element);
    });
    container.querySelectorAll('a[href]').forEach(hrefFirst);
    // Decided on the final structure; adjacency is checked before any unwrapping changes it.
    // Two implicit paragraphs next to each other would run together without their <p>.
    const implicit = [...container.querySelectorAll(`p[${IMPLICIT}]`)];
    const isImplicit = (node) => node?.nodeType === 1 && node.localName === 'p' && node.hasAttribute(IMPLICIT);
    const keep = new Set(implicit.filter((p) => isImplicit(p.previousElementSibling) || isImplicit(p.nextElementSibling)));
    implicit.forEach((p) => {
        if (keep.has(p)) {
            p.removeAttribute(IMPLICIT);
        } else {
            unwrapImplicit(p);
        }
    });
    container.querySelectorAll(`[${SECTION}]`).forEach((el) => el.removeAttribute(SECTION));
}
