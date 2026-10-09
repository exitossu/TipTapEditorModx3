/**
 * Detects markup that would be silently lost by loading HTML into the editor.
 *
 * The editor output is compared with the input: every element (by tag), every attribute
 * (tag + name + value), every HTML comment and all text of the input must still be present.
 * Additions are fine (Tiptap wraps list item text in <p>, adds <tbody>), and tags Tiptap
 * renders under another name for the same meaning are mapped (b -> strong, i -> em, ...).
 * This catches unsupported elements (div, figure, video, ...), dropped classes and data-*
 * attributes, removed comments and lost text.
 */

const EQUIVALENT_TAGS = {
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
};

// Elements whose presence Tiptap guarantees by itself or which are pure wrappers.
const IGNORED_TAGS = new Set(['html', 'head', 'body', 'tbody']);
/**
 * The editor's own old gallery marker (data-tiptapeditor-gallery, earlier data-tiptaprte-gallery):
 * a gallery is known by its template now, and the marker is not written again.
 */
const DROPPED_ATTRIBUTES = new Set(['data-tiptapeditor-gallery', 'data-tiptaprte-gallery']);

function canonicalTag(el) {
    const tag = el.localName;
    return EQUIVALENT_TAGS[tag] || tag;
}

function parse(html) {
    return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html').body;
}

function styleDeclarations(value) {
    return value
        .split(';')
        .map((part) => {
            const colon = part.indexOf(':');
            if (colon === -1) {
                return '';
            }
            const property = part.slice(0, colon).trim().toLowerCase();
            const val = part.slice(colon + 1).trim().replace(/\s+/g, ' ').toLowerCase();
            return property && val ? `${property}: ${val}` : '';
        })
        .filter(Boolean);
}

let scratch = null;
/** The browser's own spelling of a style value ("border: 0" -> "border: 0px;"). */
function cssText(value) {
    scratch = scratch || document.createElement('span');
    scratch.style.cssText = value;
    return scratch.style.cssText;
}

/**
 * Keys for a style attribute. ProseMirror writes styles through element.style, so the browser
 * respells them ("border: 0" becomes "border: 0px;"): the same CSS, compared by the browser's
 * canonical text. A declaration the browser does not understand (a template tag, a typo) would
 * be dropped by that write, so it keeps a key of its own and is reported as lost.
 */
function styleKeys(value) {
    const declarations = styleDeclarations(value);
    if (typeof document === 'undefined' || !document.createElement('span').style) {
        return declarations;
    }
    const keys = declarations.filter((declaration) => cssText(declaration) === '').map((declaration) => `raw ${declaration}`);
    const canonical = cssText(value);
    if (canonical) {
        keys.push(`css ${canonical}`);
    }
    return keys;
}

function inventory(body, { ignoreStyle = false } = {}) {
    const tags = new Map();
    const attributes = new Map();
    let comments = 0;
    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === Node.COMMENT_NODE) {
            comments++;
            continue;
        }
        const tag = canonicalTag(node);
        if (IGNORED_TAGS.has(tag)) {
            continue;
        }
        add(tags, tag);
        for (const attr of node.attributes) {
            if (attr.name === 'style' && ignoreStyle) {
                continue;
            }
            if (attr.name === 'style') {
                // Compare the CSS, not its spelling: "color:red" == "color: red;".
                for (const declaration of styleKeys(attr.value)) {
                    add(attributes, `${tag}[style ${declaration}]`);
                }
            } else if (!DROPPED_ATTRIBUTES.has(attr.name)) {
                add(attributes, `${tag}[${attr.name}="${attr.value}"]`);
            }
        }
    }
    const text = (body.textContent || '').replace(/\s+/g, '');

    return { tags, attributes, comments, text };
}

/**
 * @param {string} input  HTML before loading into the editor
 * @param {string} output HTML the editor produces for it
 * @param {{ ignoreStyle?: boolean }} [options] ignoreStyle: style attributes may be dropped
 *        (tiptapeditor.preserve_style_attribute off)
 * @returns {string[]} human readable list of what was lost; empty when nothing was
 */
export function findLosses(input, output, options = {}) {
    if (!input || !input.trim()) {
        return [];
    }
    const before = inventory(parse(input), options);
    const after = inventory(parse(output), options);
    const lost = [];

    for (const [tag, count] of before.tags) {
        const missing = count - (after.tags.get(tag) || 0);
        if (missing > 0) {
            lost.push(`<${tag}> x${missing}`);
        }
    }
    for (const [attribute, count] of before.attributes) {
        const missing = count - (after.attributes.get(attribute) || 0);
        if (missing > 0) {
            lost.push(`${attribute} x${missing}`);
        }
    }
    if (before.comments > after.comments) {
        lost.push(`<!-- comment --> x${before.comments - after.comments}`);
    }
    if (before.text !== after.text) {
        lost.push('text content');
    }

    return lost;
}
