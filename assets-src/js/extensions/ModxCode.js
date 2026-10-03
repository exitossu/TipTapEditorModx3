import { InputRule, PasteRule } from '@tiptap/core';
import Code from '@tiptap/extension-code';

/** True when `pos` is inside a MODX tag that is still being written ("[[!snippet? &a=`1"). */
function insideOpenTag(state, pos) {
    const $pos = state.doc.resolve(pos);
    const before = $pos.parent.textBetween(0, $pos.parentOffset, undefined, '￼');
    return before.lastIndexOf('[[') > before.lastIndexOf(']]');
}

/**
 * Inline code mark whose `text` shortcut does not fire inside a MODX tag: property values are
 * written in backticks ([[!snippet? &tpl=`row`]]), and the tag becomes a token only once it
 * is complete (extensions/ModxSyntax.js).
 */
export const ModxCode = Code.extend({
    addInputRules() {
        return (this.parent?.() || []).map((rule) => new InputRule({
            find: rule.find,
            handler: (props) => (insideOpenTag(props.state, props.range.from) ? null : rule.handler(props)),
        }));
    },

    addPasteRules() {
        return (this.parent?.() || []).map((rule) => new PasteRule({
            find: rule.find,
            handler: (props) => (insideOpenTag(props.state, props.range.from) ? null : rule.handler(props)),
        }));
    },
});
