/**
 * Clean-up of HTML pasted from other programs (Word, Google Docs, web pages).
 *
 * Kept: paragraphs, headings, lists, tables, bold, italic, underline, strike, sub/sup,
 * links (href, title), images with a real URL, line breaks, alignment of paragraphs.
 * Removed: Office XML and namespaced tags, conditional comments, <style>/<meta>, Mso*
 * classes and every other class/style/id/data-* attribute, spans and fonts without meaning,
 * empty Word paragraphs. Word "lists" (paragraphs with mso-list) become real <ul>/<ol>.
 * Formatting expressed only as inline style (Google Docs: font-weight:700) becomes tags.
 *
 * Images whose src is data:, blob:, file: or cid: are removed (never base64 in the content);
 * the caller tells the user. HTML copied inside the editor itself (ProseMirror marks it with
 * data-pm-slice) is not touched, so copying a block keeps its classes and attributes.
 */

const INTERNAL = /data-pm-slice/;
const WORD = /urn:schemas-microsoft-com:office|class="?Mso|mso-[a-z-]+\s*:|<o:p>/i;
const GOOGLE_DOCS = /id="docs-internal-guid/;
const DROP_ELEMENTS = 'style, script, meta, link, title, xml, template, noscript, object, embed, applet, form, input, button, select, textarea';
const LOCAL_IMAGE = /^\s*(data:|blob:|file:|cid:)/i;
const ORDERED_MARKER = /^\s*\(?([0-9]+|[a-z]|[ivxlcdm]+)[.)]/i;
const BLOCKS = /^(P|H[1-6])$/;

// Attributes kept per element (everything else goes).
const KEEP = {
    A: ['href', 'title'],
    IMG: ['src', 'alt', 'title', 'width', 'height'],
    TD: ['colspan', 'rowspan'],
    TH: ['colspan', 'rowspan'],
    OL: ['start', 'type'],
    IFRAME: null, // left to the iframe extension and its whitelist
};

/** Where pasted HTML comes from: 'internal' | 'word' | 'google-docs' | 'html'. */
export function pasteSource(html) {
    if (INTERNAL.test(html)) {
        return 'internal';
    }
    if (WORD.test(html)) {
        return 'word';
    }
    if (GOOGLE_DOCS.test(html)) {
        return 'google-docs';
    }
    return 'html';
}

function stripOfficeMarkup(html) {
    return html
        // Downlevel-hidden conditional comments and plain comments.
        .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // Downlevel-revealed conditionals: keep what is inside.
        .replace(/<!\[(?:if [^\]]*|endif)\]>/gi, '')
        .replace(/<\?xml[^>]*>/gi, '')
        // Office namespaced elements (o:p, v:shape, w:sdt …): the tags go, text stays.
        .replace(/<\/?[a-z]+:[a-z][\w-]*(?:\s[^>]*)?>/gi, '');
}

function unwrap(el) {
    el.replaceWith(...el.childNodes);
}

function rename(el, tag) {
    const next = el.ownerDocument.createElement(tag);
    next.append(...el.childNodes);
    el.replaceWith(next);
    return next;
}

function styleOf(el) {
    return (el.getAttribute('style') || '').toLowerCase();
}

/** Inline formatting written as style (Google Docs, some sites) becomes tags. */
function styleToTags(el) {
    const style = styleOf(el);
    if (!style) {
        return el;
    }
    const wraps = [];
    const weight = /font-weight\s*:\s*(\w+)/.exec(style)?.[1];
    if (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600) {
        wraps.push('strong');
    }
    if (/font-style\s*:\s*italic/.test(style)) {
        wraps.push('em');
    }
    if (/text-decoration[\w-]*\s*:[^;]*underline/.test(style)) {
        wraps.push('u');
    }
    if (/text-decoration[\w-]*\s*:[^;]*line-through/.test(style)) {
        wraps.push('s');
    }
    if (/vertical-align\s*:\s*super/.test(style)) {
        wraps.push('sup');
    }
    if (/vertical-align\s*:\s*sub/.test(style)) {
        wraps.push('sub');
    }
    for (const tag of wraps) {
        const wrap = el.ownerDocument.createElement(tag);
        wrap.append(...el.childNodes);
        el.append(wrap);
    }
    return el;
}

function wordListInfo(el) {
    const match = /mso-list\s*:\s*(l\d+)\s+level(\d+)/i.exec(el.getAttribute('style') || '');
    return match ? { list: match[1], level: Number(match[2]) } : null;
}

/** Word writes list items as <p style="mso-list:l0 level1 lfo1"> with the bullet as text. */
function convertWordLists(body) {
    const doc = body.ownerDocument;
    const items = [...body.querySelectorAll('p, h1, h2, h3, h4, h5, h6')].filter(wordListInfo);
    let stack = [];
    let previous = null;
    for (const p of items) {
        const info = wordListInfo(p);
        // A new list starts unless this paragraph follows the previous item directly.
        let sibling = p.previousSibling;
        while (sibling && sibling.nodeType === 3 && !sibling.textContent.trim()) {
            sibling = sibling.previousSibling;
        }
        if (!previous || sibling !== previous.anchor) {
            stack = [];
        }
        const markerEl = [...p.querySelectorAll('span')].find((span) => /mso-list\s*:\s*ignore/i.test(span.getAttribute('style') || ''));
        const marker = markerEl ? markerEl.textContent : '';
        markerEl?.remove();
        const ordered = ORDERED_MARKER.test(marker.replace(/ /g, ' '));
        while (stack.length && stack[stack.length - 1].level > info.level) {
            stack.pop();
        }
        let top = stack[stack.length - 1];
        if (!top || top.level < info.level) {
            const list = doc.createElement(ordered ? 'ol' : 'ul');
            if (top) {
                top.list.lastElementChild.append(list);
            } else {
                p.before(list);
            }
            top = { level: info.level, list };
            stack.push(top);
        }
        const li = doc.createElement('li');
        li.append(...p.childNodes);
        top.list.append(li);
        // The list's root stays where the first paragraph was; the next item must follow it.
        const anchor = stack[0].list;
        p.remove();
        previous = { anchor };
    }
}

function cleanAttributes(el) {
    const keep = KEEP[el.tagName];
    if (keep === null) {
        return;
    }
    let align = null;
    if (BLOCKS.test(el.tagName)) {
        align = /text-align\s*:\s*(left|center|right|justify)/.exec(styleOf(el))?.[1] || null;
    }
    for (const name of el.getAttributeNames()) {
        if (!keep?.includes(name.toLowerCase())) {
            el.removeAttribute(name);
        }
    }
    if (align && align !== 'left') {
        el.setAttribute('style', `text-align: ${align}`);
    }
    if (el.tagName === 'A' && el.hasAttribute('href') && /^\s*(javascript|vbscript|data):/i.test(el.getAttribute('href'))) {
        el.removeAttribute('href');
    }
}

function isEmptyBlock(el) {
    return BLOCKS.test(el.tagName) && !el.querySelector('img, br, iframe') && !el.textContent.replace(/[\s ]/g, '');
}

/**
 * @param {string} html clipboard HTML
 * @returns {{ html: string, source: string, removedImages: number }}
 */
export function cleanPastedHtml(html) {
    const source = pasteSource(html);
    if (source === 'internal') {
        return { html, source, removedImages: 0 };
    }
    const office = source === 'word';
    const doc = new DOMParser().parseFromString(office ? stripOfficeMarkup(html) : html.replace(/<!--[\s\S]*?-->/g, ''), 'text/html');
    const { body } = doc;

    body.querySelectorAll(DROP_ELEMENTS).forEach((el) => el.remove());
    body.querySelectorAll('br.Apple-interchange-newline').forEach((el) => el.remove());

    let removedImages = 0;
    body.querySelectorAll('img').forEach((img) => {
        if (!img.getAttribute('src') || LOCAL_IMAGE.test(img.getAttribute('src'))) {
            img.remove();
            removedImages += 1;
        }
    });

    if (office) {
        convertWordLists(body);
    }

    // Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-…">.
    body.querySelectorAll('b, strong').forEach((el) => {
        if (/font-weight\s*:\s*(normal|[1-5]00)\b/.test(styleOf(el))) {
            unwrap(el);
        }
    });

    // Spans and fonts: their styling becomes tags, then they go.
    body.querySelectorAll('span, font').forEach((el) => unwrap(styleToTags(el)));
    // Links without href (Word bookmarks <a name="_Toc…">).
    body.querySelectorAll('a:not([href])').forEach(unwrap);
    // Old tags with the same meaning as the editor's.
    body.querySelectorAll('b').forEach((el) => rename(el, 'strong'));
    body.querySelectorAll('i').forEach((el) => rename(el, 'em'));
    body.querySelectorAll('strike, del').forEach((el) => rename(el, 's'));
    body.querySelectorAll('ins').forEach((el) => rename(el, 'u'));

    body.querySelectorAll('*').forEach(cleanAttributes);

    if (office) {
        // Word's blank lines are empty paragraphs (<p class=MsoNormal><o:p>&nbsp;</o:p></p>).
        body.querySelectorAll('p').forEach((p) => {
            if (isEmptyBlock(p)) {
                p.remove();
            }
        });
        // Word sections (<div class=WordSection1>) carry nothing.
        body.querySelectorAll('div').forEach(unwrap);
    }

    return { html: body.innerHTML, source, removedImages };
}
