import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

describe('table round trip', () => {
    let manager;
    let instance;
    const start = (html, extra = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'table', ...extra });
        instance = manager.create('ta');
        return instance && serialize(instance.editor);
    };
    afterEach(() => manager?.destroyAll());

    it.each([
        ['plain cells', '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'],
        ['head, body and foot', '<table class="table table--striped" id="prices" data-x="1"><thead><tr><th>Name</th><th>Price</th></tr></thead>'
            + '<tbody><tr class="odd"><td>Tea</td><td align="right" style="color: red;">10</td></tr></tbody><tfoot><tr><td colspan="2">Total</td></tr></tfoot></table>'],
        ['cells with paragraphs', '<table><tbody><tr><td><p>a</p><p>b</p></td><td><ul><li><p>x</p></li></ul></td></tr></tbody></table>'],
        ['inline markup and rowspan', '<table><tbody><tr><td rowspan="2"><strong>a</strong> and <a href="/x">x</a></td><td>b</td></tr><tr><td>c</td></tr></tbody></table>'],
        ['empty cells', '<table><tbody><tr><td></td><th></th></tr></tbody></table>'],
    ])('%s', (_name, html) => {
        expect(start(html)).toBe(html);
    });

    it('keeps tables written without tbody that way', () => {
        expect(start('<table><tr><td>a</td></tr></table>')).toBe('<table><tr><td>a</td></tr></table>');
        expect(instance.editor.state.doc.firstChild.type.name).toBe('table');
        expect(start('<table><tbody><tr><td>a</td></tr></tbody></table><table><tr><td>b</td></tr></table>'))
            .toBe('<table><tbody><tr><td>a</td></tr></tbody></table><table><tr><td>b</td></tr></table>');
    });

    it('keeps tables it cannot represent as raw blocks', () => {
        for (const html of [
            '<table><caption>C</caption><tr><td>a</td></tr></table>',
            '<table><colgroup><col width="100"></colgroup><tr><td>a</td></tr></table>',
            '<table><thead class="h"><tr><th>a</th></tr></thead></table>',
            '<table><tr><td onclick="x()">a</td></tr></table>',
        ]) {
            expect(start(html)).toBe(html);
            expect(instance.editor.state.doc.firstChild.type.name).toBe('rawHtml');
        }
    });

    it('keeps tables as raw blocks when tables are switched off', () => {
        const html = '<table><tr><td>a</td></tr></table>';
        expect(start(html, { features: { tables: false } })).toBe(html);
        expect(instance.editor.state.doc.firstChild.type.name).toBe('rawHtml');
    });
});

describe('table toolbar and dialog', () => {
    let manager;
    let instance;
    const dialog = () => document.querySelector('.tiptapeditor-dialog');
    const field = (label) => {
        const el = [...dialog().querySelectorAll('label')].find((l) => l.textContent === label);
        return el && document.getElementById(el.htmlFor);
    };
    const click = (text) => [...dialog().querySelectorAll('button')].find((b) => b.textContent === text).click();
    const item = (name) => instance.root.querySelector(`[data-tiptapeditor-item="${name}"]`);
    // Toolbar state follows the selection on the next frame.
    const press = async (name) => {
        await new Promise((r) => requestAnimationFrame(r));
        item(name).click();
    };
    const bar = () => instance.root.querySelector('.tiptapeditor__toolbar--table');
    const html = () => serialize(instance.editor);
    const start = (value, extra = {}) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = value;
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold table', tableClasses: '{"table table--striped":"Striped"}', ...extra });
        instance = manager.create('ta');
    };
    const cellPos = (index) => {
        let found = null;
        let n = 0;
        instance.editor.state.doc.descendants((node, pos) => {
            if (found === null && (node.type.name === 'tableCell' || node.type.name === 'tableHeader')) {
                if (n++ === index) {
                    found = pos + 2; // inside the cell's paragraph
                }
            }
        });
        return found;
    };
    afterEach(() => {
        document.querySelectorAll('.tiptapeditor-dialog').forEach((el) => el.remove());
        manager?.destroyAll();
    });

    it('inserts a table from the dialog', () => {
        start('<p>Text</p>');
        instance.editor.commands.setTextSelection(5);
        item('table').click();
        expect(dialog().querySelector('h2').textContent).toBe('Insert table');
        field('Rows').value = '2';
        field('Columns').value = '2';
        field('Style').value = 'table table--striped';
        click('Insert');
        expect(html()).toBe('<p>Text</p><table class="table table--striped"><tbody><tr><th><p></p></th><th><p></p></th></tr>'
            + '<tr><td><p></p></td><td><p></p></td></tr></tbody></table>');
    });

    it('refuses sizes out of range', () => {
        start('<p>Text</p>');
        item('table').click();
        field('Rows').value = '0';
        click('Insert');
        expect(dialog()).not.toBeNull();
        expect(dialog().querySelector('[role="alert"]').textContent).toContain('1 to 100');
        field('Rows').value = '2';
        field('Columns').value = '31';
        click('Insert');
        expect(dialog()).not.toBeNull();
    });

    it('shows the table toolbar only inside a table', async () => {
        start('<p>Text</p><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        instance.editor.commands.setTextSelection(2);
        await new Promise((r) => requestAnimationFrame(r));
        expect(bar().hidden).toBe(true);
        instance.editor.commands.setTextSelection(cellPos(0));
        expect(bar().hidden).toBe(false);
        expect(bar().getAttribute('role')).toBe('toolbar');
        expect([...bar().querySelectorAll('button')].map((b) => b.dataset.tiptapeditorItem)).toEqual([
            'addRowBefore', 'addRowAfter', 'deleteRow', 'addColumnBefore', 'addColumnAfter', 'deleteColumn',
            'toggleHeaderRow', 'toggleHeaderColumn', 'mergeCells', 'splitCell', 'tableProperties', 'deleteTable',
        ]);
    });

    it('edits rows and columns and keeps the sections', async () => {
        start('<table class="t"><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        const { editor } = instance;
        editor.commands.setTextSelection(cellPos(3));
        await press('addRowAfter');
        await press('addColumnAfter');
        expect(html()).toBe('<table class="t"><thead><tr><th>H1</th><th>H2</th><th><p></p></th></tr></thead><tbody>'
            + '<tr><td>a</td><td>b</td><td><p></p></td></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table>');
        editor.commands.setTextSelection(cellPos(2) + 1);
        await press('deleteColumn');
        editor.commands.setTextSelection(cellPos(4));
        await press('deleteRow');
        expect(html()).toBe('<table class="t"><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
    });

    it('merges and splits cells', async () => {
        start('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        const { editor } = instance;
        editor.commands.setCellSelection({ anchorCell: cellPos(0) - 2, headCell: cellPos(1) - 2 });
        await press('mergeCells');
        expect(html()).toBe('<table><tbody><tr><td colspan="2"><p>a</p><p>b</p></td></tr></tbody></table>');
        editor.commands.setTextSelection(cellPos(0));
        await press('splitCell');
        expect(html()).toBe('<table><tbody><tr><td><p>a</p><p>b</p></td><td><p></p></td></tr></tbody></table>');
    });

    it('typing in a plain cell keeps it without paragraphs', () => {
        start('<table><tbody><tr><td>a</td></tr></tbody></table>');
        instance.editor.chain().setTextSelection(cellPos(0) + 1).insertContent('bc').run();
        expect(html()).toBe('<table><tbody><tr><td>abc</td></tr></tbody></table>');
    });

    it('changes the classes in the table properties and can delete the table', async () => {
        start('<p>x</p><table class="lead table" data-id="7"><tbody><tr><td>a</td></tr></tbody></table>');
        instance.editor.commands.setTextSelection(cellPos(0));
        await press('tableProperties');
        expect(dialog().querySelector('h2').textContent).toBe('Table properties');
        expect(field('Other CSS classes').value).toBe('lead table');
        field('Style').value = 'table table--striped';
        field('Other CSS classes').value = 'lead';
        click('Save');
        expect(html()).toBe('<p>x</p><table class="lead table table--striped" data-id="7"><tbody><tr><td>a</td></tr></tbody></table>');
        await press('deleteTable');
        expect(html()).toBe('<p>x</p>');
    });

    it('has no table controls when tables are switched off', () => {
        start('<p>x</p>', { features: { tables: false } });
        expect(item('table')).toBeNull();
        expect(bar()).toBeNull();
    });
});
