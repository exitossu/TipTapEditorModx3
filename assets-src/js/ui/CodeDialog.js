import { NodeSelection } from '@tiptap/pm/state';
import { createElement } from '../utils/dom.js';
import { Dialog } from './Dialog.js';

const NODES = {
    modxSyntax: { attr: 'raw', title: 'token_edit', hint: 'token_hint' },
    modxSyntaxBlock: { attr: 'raw', title: 'token_edit', hint: 'token_hint' },
    rawHtml: { attr: 'html', title: 'raw_edit', hint: 'raw_hint' },
};

/**
 * Source dialog for the selected MODX/Fenom token or raw HTML block: a plain textarea (never
 * contenteditable). The text is stored exactly as typed; emptying it removes the node.
 */
export function openCodeDialog(editor, context) {
    const { selection } = editor.state;
    const node = selection instanceof NodeSelection ? selection.node : null;
    const spec = node && NODES[node.type.name];
    if (!spec || !editor.isEditable) {
        return null;
    }
    const { t } = context;
    const pos = selection.from;
    const dialog = new Dialog({ title: t(spec.title), t, className: 'tiptapeditor-dialog--code' });
    const code = dialog.field(t('source_code'), createElement('textarea', 'tiptapeditor-dialog__input tiptapeditor-dialog__code', {
        spellcheck: 'false',
        autocomplete: 'off',
        rows: '10',
    }), { hint: t(spec.hint) });
    code.value = node.attrs[spec.attr];

    const apply = () => {
        const value = code.value;
        dialog.close();
        const current = editor.state.doc.nodeAt(pos);
        if (!current || current.type !== node.type) {
            return;
        }
        if (value === current.attrs[spec.attr]) {
            editor.commands.focus();
            return;
        }
        const chain = editor.chain().focus().setNodeSelection(pos);
        if (!value.trim()) {
            chain.deleteSelection().run();
            return;
        }
        const attrs = spec.attr === 'raw'
            ? { raw: value, kind: value.startsWith('[[') ? 'modx' : 'fenom' }
            : { html: value };
        chain.updateAttributes(node.type.name, attrs).run();
    };
    // In the textarea Enter is a new line; Ctrl/Cmd+Enter saves.
    code.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            apply();
        }
    });
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t('save'), { primary: true, onClick: apply }),
    );
    dialog.open(code);
    return dialog;
}
