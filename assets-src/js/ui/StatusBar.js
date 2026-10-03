import { NodeSelection } from '@tiptap/pm/state';
import { createElement } from '../utils/dom.js';

const NODE_TAGS = {
    paragraph: 'p',
    blockquote: 'blockquote',
    bulletList: 'ul',
    orderedList: 'ol',
    listItem: 'li',
    codeBlock: 'pre',
    table: 'table',
    tableRow: 'tr',
    tableCell: 'td',
    tableHeader: 'th',
    image: 'img',
    iframe: 'iframe',
    horizontalRule: 'hr',
    rawHtml: 'HTML',
    modxSyntax: 'MODX',
    modxSyntaxBlock: 'MODX',
};

const MARK_TAGS = {
    bold: 'strong',
    italic: 'em',
    underline: 'u',
    strike: 's',
    code: 'code',
    link: 'a',
    highlight: 'mark',
    subscript: 'sub',
    superscript: 'sup',
    textStyle: 'span',
};

function tagOf(node) {
    if (node.type.name === 'heading') {
        return `h${node.attrs.level}`;
    }
    return NODE_TAGS[node.type.name] || node.type.name;
}

/** "p > strong": the blocks around the cursor and the marks at it. */
export function elementPath(state) {
    const { selection } = state;
    const { $from } = selection;
    const parts = [];
    for (let depth = 1; depth <= $from.depth; depth++) {
        parts.push(tagOf($from.node(depth)));
    }
    if (selection instanceof NodeSelection) {
        parts.push(tagOf(selection.node));
    } else {
        for (const mark of (state.storedMarks || $from.marks())) {
            parts.push(MARK_TAGS[mark.type.name] || mark.type.name);
        }
    }
    return parts.join(' > ');
}

/** Words and characters of the text (MODX tags count as written). */
export function countText(doc) {
    const text = doc.textBetween(0, doc.content.size, '\n', (node) => node.type.spec.leafText?.(node) ?? node.attrs?.raw ?? '');
    const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length || 0;
    const characters = [...text.replace(/\n/g, '')].length;
    return { words, characters };
}

/**
 * Status bar under the text (tiptapeditor.statusbar): word and character count and the element
 * path at the cursor. Updates are throttled to one per animation frame.
 */
export class StatusBar {
    constructor(root, editor, t) {
        this.editor = editor;
        this.t = t;
        this.el = createElement('div', 'tiptapeditor__statusbar', { 'aria-live': 'off' });
        this.path = createElement('span', 'tiptapeditor__statusbar-path');
        this.counts = createElement('span', 'tiptapeditor__statusbar-counts');
        this.el.append(this.path, this.counts);
        root.append(this.el);
        this.frame = 0;
        this.lang = document.documentElement.lang || undefined;
        this.schedule = () => {
            if (!this.frame) {
                this.frame = requestAnimationFrame(() => {
                    this.frame = 0;
                    this.update();
                });
            }
        };
        editor.on('transaction', this.schedule);
        this.update();
    }

    format(value) {
        try {
            return value.toLocaleString(this.lang);
        } catch {
            return String(value);
        }
    }

    update() {
        if (this.editor.isDestroyed) {
            return;
        }
        const { words, characters } = countText(this.editor.state.doc);
        this.counts.textContent = `${this.t('statusbar_words').replace('{count}', this.format(words))}   ${this.t('statusbar_characters').replace('{count}', this.format(characters))}`;
        this.path.textContent = this.editor.isEditable ? elementPath(this.editor.state) : '';
    }

    destroy() {
        cancelAnimationFrame(this.frame);
        this.editor.off('transaction', this.schedule);
        this.el.remove();
    }
}
