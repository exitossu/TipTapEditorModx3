import { DOMSerializer } from '@tiptap/pm/model';
import { finishHtml } from './finishHtml.js';
import { restoreSentinels } from './store.js';

/**
 * Editor document -> textarea value.
 * One canonical value for an empty document: '' (never "<p></p>"). MODX/Fenom tokens and raw
 * HTML blocks are written back exactly as they were (sentinels → original text).
 */
export function serialize(editor) {
    if (isEmptyDocument(editor.state.doc)) {
        return '';
    }
    return restoreSentinels(documentHtml(editor.state.doc, editor.schema));
}

/**
 * Only a document holding a single empty paragraph is empty (editor.isEmpty also counts a
 * table with empty cells as empty).
 */
function isEmptyDocument(doc) {
    const first = doc.firstChild;
    return doc.childCount === 1 && first.type.name === 'paragraph' && first.content.size === 0
        && !first.attrs.textAlign && !first.attrs.id;
}

/**
 * Same as editor.getHTML(), plus the finishing step on the DOM (tokens, table sections,
 * implicit paragraphs) before it becomes a string. Protected parts are still sentinels.
 */
export function documentHtml(doc, schema) {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(doc.content);
    const container = document.implementation.createHTMLDocument('').createElement('div');
    container.append(fragment);
    finishHtml(container);
    return container.innerHTML;
}

/** Textarea value -> content for the editor. NULL, '' and "<p></p>" all mean empty. */
export function prepareContent(value) {
    const html = value ?? '';
    return html.trim() === '' || EMPTY_PARAGRAPH.test(html) ? '' : html;
}

// One paragraph with nothing in it: <p></p>, <p><br></p>, <p>&nbsp;</p>.
const EMPTY_PARAGRAPH = /^\s*<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*$/i;
