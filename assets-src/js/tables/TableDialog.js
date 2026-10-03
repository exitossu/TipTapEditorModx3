import { splitImageClasses, updatedImageClass } from '../images/classes.js';
import { parseClassPresets } from '../links/links.js';
import { Dialog } from '../ui/Dialog.js';
import { createElement } from '../utils/dom.js';

export const MAX_ROWS = 100;
export const MAX_COLUMNS = 30;

// Table classes have no alignment part: only a preset and other classes.
const NO_ALIGN = {};

/** Whole number in 1..max, or null. */
export function tableSize(value, max) {
    const text = String(value ?? '').trim();
    if (!/^\d+$/.test(text)) {
        return null;
    }
    const number = parseInt(text, 10);
    return number >= 1 && number <= max ? number : null;
}

/**
 * Table dialog. Outside a table it inserts one (rows, columns, header row, classes); inside a
 * table it edits the table's classes. Class presets come from tiptapeditor.table_classes.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @param {object} context ({ t, config })
 */
export function openTableDialog(editor, context) {
    if (!editor.isEditable) {
        return null;
    }
    const { t, config } = context;
    const editing = editor.isActive('table');
    const current = editing ? editor.getAttributes('table') : {};
    const presets = parseClassPresets(config.tableClasses);
    const parts = splitImageClasses(current.class, presets, NO_ALIGN);

    const dialog = new Dialog({ title: t(editing ? 'table_properties' : 'table_insert'), t, className: 'tiptapeditor-dialog--table' });

    let rows = null;
    let columns = null;
    let header = null;
    if (!editing) {
        const sizeRow = createElement('div', 'tiptapeditor-dialog__row');
        dialog.form.append(sizeRow);
        rows = dialog.field(t('table_rows'), dialog.input('text', { value: '3', inputmode: 'numeric' }));
        columns = dialog.field(t('table_columns'), dialog.input('text', { value: '3', inputmode: 'numeric' }));
        sizeRow.append(rows.parentElement, columns.parentElement);
        header = dialog.field(t('table_header_row'), dialog.input('checkbox'));
        header.checked = true;
    }
    let preset = null;
    if (presets.length) {
        preset = dialog.field(t('table_style'), dialog.select([{ value: '', label: t('table_style_none') }, ...presets], parts.preset));
    }
    const other = dialog.field(t(presets.length ? 'table_other_classes' : 'table_class'), dialog.input('text', { value: parts.other }));

    const apply = () => {
        const cls = updatedImageClass(current.class, { align: '', preset: preset?.value || '', other: other.value }, presets, NO_ALIGN);
        if (editing) {
            dialog.close();
            if ((cls ?? null) !== (current.class ?? null)) {
                editor.chain().focus().updateAttributes('table', { class: cls }).run();
            } else {
                editor.commands.focus();
            }
            return;
        }
        const rowCount = tableSize(rows.value, MAX_ROWS);
        const columnCount = tableSize(columns.value, MAX_COLUMNS);
        if (!rowCount || !columnCount) {
            dialog.error(t('table_size_invalid').replace('{rows}', String(MAX_ROWS)).replace('{columns}', String(MAX_COLUMNS)));
            (rowCount ? columns : rows).focus();
            return;
        }
        dialog.close();
        const chain = editor.chain().focus().insertTable({ rows: rowCount, cols: columnCount, withHeaderRow: header.checked });
        if (cls) {
            chain.updateAttributes('table', { class: cls });
        }
        chain.run();
    };

    dialog.form.addEventListener('submit', (event) => {
        event.preventDefault();
        apply();
    });
    if (editing) {
        dialog.actions.append(dialog.button(t('table_delete'), {
            className: 'tiptapeditor-dialog__button--danger',
            onClick: () => {
                dialog.close();
                editor.chain().focus().deleteTable().run();
            },
        }));
    }
    dialog.actions.append(
        dialog.button(t('cancel'), { onClick: () => dialog.close() }),
        dialog.button(t(editing ? 'save' : 'table_insert_button'), { primary: true, onClick: apply }),
    );
    const submit = createElement('button', '', { type: 'submit', hidden: '', tabindex: '-1' });
    dialog.form.append(submit);
    dialog.open(editing ? (preset || other) : rows);
    return dialog;
}
