import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { idOf, rawOf } from '../syntax/store.js';

const PRIVATE_MARKS_ALL = /[\uE000\uE001]/g;
import { findTokens } from '../syntax/tokenizer.js';

const TOKEN = 'data-tiptapeditor-token';
const KIND = 'data-tiptapeditor-kind';
const PREVIEW_LENGTH = 60;

function kindOf(raw) {
    return raw.startsWith('[[') ? 'modx' : 'fenom';
}

/** Raw text of a token element: from this page's store, else (pasted from elsewhere) its text. */
function rawFromElement(element) {
    const raw = rawOf(element.getAttribute(TOKEN)) ?? element.textContent;
    return raw ? { raw, kind: kindOf(raw) } : false;
}

function preview(raw) {
    const line = raw.replace(/\s+/g, ' ').trim();
    return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH - 1)}…` : line;
}

const tokenAttributes = () => ({
    raw: { default: '', rendered: false },
    kind: { default: 'modx', rendered: false },
});

/** Shared node view: a badge (inline) or a card (block) showing the source; never HTML. */
function tokenView(block, options) {
    return ({ node, getPos, editor }) => {
        const dom = document.createElement(block ? 'div' : 'span');
        const code = document.createElement(block ? 'pre' : 'code');
        dom.append(code);
        dom.contentEditable = 'false';
        let current = node;
        const apply = (next) => {
            current = next;
            const { raw, kind } = next.attrs;
            dom.className = `tiptapeditor__token tiptapeditor__token--${kind}${block ? ' tiptapeditor__token--block' : ''}`;
            dom.title = raw;
            dom.setAttribute(KIND, kind);
            code.textContent = block ? raw : preview(raw);
        };
        apply(node);
        dom.addEventListener('dblclick', (event) => {
            if (!editor.isEditable || typeof getPos !== 'function') {
                return;
            }
            event.preventDefault();
            editor.chain().setNodeSelection(getPos()).run();
            options.onEdit();
        });
        return {
            dom,
            update(updated) {
                if (updated.type !== current.type) {
                    return false;
                }
                apply(updated);
                return true;
            },
            ignoreMutation: () => true,
            stopEvent: () => false,
        };
    };
}

function enterEdits(name) {
    return function shortcut() {
        const { selection } = this.editor.state;
        if (selection.node?.type.name !== name) {
            return false;
        }
        return this.options.onEdit() !== false;
    };
}

/**
 * A MODX tag or Fenom construct inside text: an atom, shown as a badge, saved exactly as
 * written. It cannot be split, edited inside, escaped or have HTML put into it.
 * Double click or Enter opens the source dialog for it.
 */
export const ModxSyntax = Node.create({
    name: 'modxSyntax',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return { onEdit: () => false };
    },

    addAttributes: tokenAttributes,

    parseHTML() {
        return [{ tag: `span[${TOKEN}]`, getAttrs: rawFromElement }];
    },

    renderHTML({ node }) {
        // The text inside is for copying to other programs; the serializer writes the raw text.
        return ['span', { [TOKEN]: idOf(node.attrs.raw), [KIND]: node.attrs.kind }, node.attrs.raw];
    },

    renderText({ node }) {
        return node.attrs.raw;
    },

    addNodeView() {
        return tokenView(false, this.options);
    },

    addKeyboardShortcuts() {
        return { Enter: enterEdits(this.name).bind(this) };
    },
});

/**
 * A MODX tag or Fenom construct standing on its own between blocks ([[!pdoResources? …]],
 * {if …}, {/foreach}): a block atom, shown as a card with the full source.
 */
export const ModxSyntaxBlock = Node.create({
    name: 'modxSyntaxBlock',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return { onEdit: () => false };
    },

    addAttributes: tokenAttributes,

    parseHTML() {
        return [{ tag: `div[${TOKEN}]`, getAttrs: rawFromElement }];
    },

    renderHTML({ node }) {
        return ['div', { [TOKEN]: idOf(node.attrs.raw), [KIND]: node.attrs.kind }, node.attrs.raw];
    },

    renderText({ node }) {
        return node.attrs.raw;
    },

    addNodeView() {
        return tokenView(true, this.options);
    },

    addKeyboardShortcuts() {
        return { Enter: enterEdits(this.name).bind(this) };
    },
});

/**
 * Turns MODX tags and Fenom constructs typed or pasted as plain text into protected tokens,
 * once they are complete (the closing "]]" or "}" is there). Code blocks are left alone.
 */
export function tokenizeTextPlugin(options) {
    return new Plugin({
        key: new PluginKey('tiptapeditorTokenizeText'),
        appendTransaction(transactions, oldState, state) {
            if (!transactions.some((tr) => tr.docChanged) || transactions.some((tr) => tr.getMeta('tiptapeditorTokenized'))) {
                return null;
            }
            const type = state.schema.nodes.modxSyntax;
            if (!type) {
                return null;
            }
            // Only the text blocks touched by these transactions.
            let ranges = [];
            for (const tr of transactions) {
                ranges = ranges.map(([a, b]) => [tr.mapping.map(a, -1), tr.mapping.map(b, 1)]);
                tr.mapping.maps.forEach((map, index) => {
                    const rest = tr.mapping.slice(index + 1);
                    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
                        ranges.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
                    });
                });
            }
            const from = Math.min(...ranges.map((r) => r[0]), state.doc.content.size);
            const to = Math.max(...ranges.map((r) => r[1]), 0);
            if (from > to) {
                return null;
            }
            const replacements = [];
            state.doc.nodesBetween(from, Math.min(to, state.doc.content.size), (node, pos) => {
                if (!node.isTextblock) {
                    return true;
                }
                if (node.type.spec.code) {
                    return false;
                }
                // Text runs of the block (atoms and other inline nodes split the runs).
                let run = '';
                let runStart = pos + 1;
                const flush = () => {
                    for (const token of findTokens(run, options)) {
                        replacements.push({ from: runStart + token.start, to: runStart + token.end, raw: token.raw, kind: token.kind });
                    }
                    run = '';
                };
                node.forEach((child, offset) => {
                    if (child.isText && !child.marks.some((mark) => mark.type.spec.code)) {
                        if (!run) {
                            runStart = pos + 1 + offset;
                        }
                        run += child.text;
                    } else {
                        flush();
                    }
                });
                flush();
                return false;
            });
            if (!replacements.length) {
                return null;
            }
            const tr = state.tr;
            for (const item of replacements.reverse()) {
                const marks = state.doc.resolve(item.from + 1).marks();
                tr.replaceWith(item.from, item.to, type.create({ raw: item.raw, kind: item.kind }, null, marks));
            }
            return tr.setMeta('tiptapeditorTokenized', true);
        },
    });
}

/** Typing/pasting conversion as an extension, configured with the tokenizer options. */
export const TokenizeText = Extension.create({
    name: 'tokenizeText',

    addOptions() {
        return { modx: true, fenom: true, fenomTags: '' };
    },

    addProseMirrorPlugins() {
        return [tokenizeTextPlugin(this.options)];
    },
});

/**
 * Pasted content never brings private use characters U+E000/U+E001 (the editor's sentinel
 * marks) into the document: content holding them would not open in the editor again.
 */
export const PastePrivateMarks = Extension.create({
    name: 'pastePrivateMarks',

    addProseMirrorPlugins() {
        return [new Plugin({
            key: new PluginKey('tiptapeditorPastePrivateMarks'),
            props: {
                transformPastedHTML: (html) => html.replace(PRIVATE_MARKS_ALL, ''),
                transformPastedText: (text) => text.replace(PRIVATE_MARKS_ALL, ''),
            },
        })];
    },
});
