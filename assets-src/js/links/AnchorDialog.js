import { ANCHOR_ID } from '../extensions/HeadingAnchor.js';
import { Dialog } from '../ui/Dialog.js';

/** Small dialog to set or clear the anchor (id) of the current heading. */
export function openAnchorDialog(editor, context) {
    if (!editor.isEditable || !editor.isActive('heading')) {
        return null;
    }
    const { t } = context;
    const current = editor.getAttributes('heading').id || '';
    const dialog = new Dialog({ title: t('anchor'), t, className: 'tiptapeditor-dialog--anchor' });
    const input = dialog.field(t('anchor_id'), dialog.input('text', { value: current }), { hint: t('anchor_hint') });

    const apply = () => {
        const id = input.value.trim();
        if (id && !ANCHOR_ID.test(id)) {
            dialog.error(t('anchor_invalid'));
            input.focus();
            return;
        }
        dialog.close();
        editor.chain().focus().setHeadingId(id).run();
    };
    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t('save'), { primary: true, onClick: apply }),
    );
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.hidden = true;
    submit.tabIndex = -1;
    dialog.form.append(submit);
    dialog.open(input);
    input.select();
    return dialog;
}
