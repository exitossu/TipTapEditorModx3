/**
 * Class presets on paragraphs and headings (tiptapeditor.paragraph_classes). The class lives in
 * the node's preserved attributes ("extra", extensions/PreservedAttributes.js), so classes
 * that are not presets stay as they are.
 */

const TYPES = new Set(['paragraph', 'heading']);

function classesOf(node) {
    return String(node.attrs.extra?.class || '').split(/\s+/).filter(Boolean);
}

function textblocks(state) {
    const result = [];
    const { from, to } = state.selection;
    state.doc.nodesBetween(from, to, (node, pos) => {
        if (TYPES.has(node.type.name)) {
            result.push({ node, pos });
            return false;
        }
        return true;
    });
    return result;
}

/** True when the block at the cursor (or every selected block) has the class. */
export function blockClassActive(editor, value) {
    const blocks = textblocks(editor.state);
    return blocks.length > 0 && blocks.every(({ node }) => classesOf(node).includes(value));
}

/**
 * Sets one preset class on the selected paragraphs and headings, removing the other presets
 * (all). value null removes every preset. A preset that is already set is removed (toggle).
 */
export function setBlockClass(chain, value, all) {
    return chain.command(({ tr, state, dispatch }) => {
        const blocks = textblocks(state);
        if (!blocks.length) {
            return false;
        }
        const toggleOff = value !== null && blocks.every(({ node }) => classesOf(node).includes(value));
        if (dispatch) {
            for (const { node, pos } of blocks) {
                const kept = classesOf(node).filter((cls) => !all.includes(cls));
                const next = value === null || toggleOff ? kept : [...kept, value];
                const extra = { ...(node.attrs.extra || {}) };
                if (next.length) {
                    extra.class = next.join(' ');
                } else {
                    delete extra.class;
                }
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, extra: Object.keys(extra).length ? extra : null });
            }
        }
        return true;
    });
}
