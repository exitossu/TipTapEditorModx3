// Stage 9 check: tables in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/tables.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.enable_tables', '1',
    'tiptapeditor.toolbar', 'undo redo | bold italic | table', 'tiptapeditor.table_classes', '{"table table--striped":"Striped"}');
const { resources, fixtures } = JSON.parse(php('./fixtures-setup.php'));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const errors = [];
let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/manager/`);
await page.fill('#modx-login-username', process.env.MODX_USER || 'admin');
await page.fill('#modx-login-password', process.env.MODX_PASS || '');
await Promise.all([page.waitForNavigation(), page.click('#modx-login-btn')]);

const open = async (path) => {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
};
const save = async () => {
    const response = page.waitForResponse((r) => /Resource(%2F|\/)Update/.test(r.request().postData() || ''));
    await page.click('#modx-abtn-save');
    await response;
    await page.waitForTimeout(500);
};
const editorSel = '[data-tiptapeditor-for="ta"]';
const html = () => page.evaluate(() => window.TipTapEditor.getInstance('ta')?.editor.getHTML() || '');
const textarea = () => page.evaluate(() => {
    window.TipTapEditor.syncAll();
    return document.getElementById('ta').value;
});
const bar = page.locator(`${editorSel} .tiptapeditor__toolbar--table`);
const barButton = (name) => bar.locator(`[data-tiptapeditor-item="${name}"]`);
const cell = (text) => page.locator(`${editorSel} .ProseMirror :is(td, th)`, { hasText: new RegExp(`^${text}$`) });
const dialog = page.locator('.tiptapeditor-dialog');
const field = (label) => dialog.getByLabel(label, { exact: true });

// 1. An existing table with head, body, foot and attributes opens and saves unchanged.
await open(`/manager/?a=resource/update&id=${resources.tables}`);
check('table content opens in the editor', await page.evaluate(() => Boolean(window.TipTapEditor.getInstance('ta'))));
check('editor shows the table', await page.locator(`${editorSel} .ProseMirror table`).count() === 1);
check('table toolbar hidden outside the table', !(await bar.isVisible()));
await save();
check('save without edits keeps the table byte for byte', db(resources.tables).content === asSubmitted(fixtures.tables), db(resources.tables).content);

// 2. The table toolbar follows the cursor; add a row and type into it.
await cell('Coffee').click();
await page.waitForTimeout(150);
check('table toolbar shows in the table', await bar.isVisible());
check('table toolbar is an accessible toolbar', await bar.getAttribute('role') === 'toolbar'
    && (await barButton('addRowAfter').getAttribute('aria-label')).length > 0);
await barButton('addRowAfter').click();
const rows = page.locator(`${editorSel} .ProseMirror tr`);
check('row added below the cursor row', await rows.count() === 5);
await rows.nth(3).locator('td').first().click();
await page.keyboard.type('Milk');
await page.keyboard.press('Tab');
await page.keyboard.type('9');
let value = await textarea();
check('new row typed in, sections kept', value.includes('<thead><tr><th>Name</th><th>Price</th></tr></thead>')
    && value.includes('<td>Coffee</td><td align="right">12</td></tr><tr><td><p>Milk</p></td><td><p>9</p></td></tr></tbody>')
    && value.includes('<tfoot><tr><td colspan="2">Total</td></tr></tfoot>'), value);
check('table attributes kept', value.includes('<table class="table" data-x="1">'), value);

// 3. Merge two cells by dragging across them, then split again.
const from = await cell('Tea').boundingBox();
const to = await cell('10').boundingBox();
await page.mouse.move(from.x + 5, from.y + from.height / 2);
await page.mouse.down();
await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(150);
check('dragging selects cells', await page.locator(`${editorSel} .selectedCell`).count() === 2);
await barButton('mergeCells').click();
value = await textarea();
check('cells merged', /<tr><td colspan="2"><p>Tea<\/p><p>10<\/p><\/td><\/tr>/.test(value), value);
await barButton('splitCell').click();
value = await textarea();
check('cell split again', /<tr><td><p>Tea<\/p><p>10<\/p><\/td><td><p><\/p><\/td><\/tr>/.test(value), value);
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');

// 4. Table properties: class preset.
await cell('Coffee').click();
await barButton('tableProperties').click();
await dialog.waitFor({ timeout: 3000 });
check('properties dialog shows the classes', await field('Other CSS classes').inputValue() === 'table');
await field('Style').selectOption('table table--striped');
await field('Other CSS classes').fill('');
await dialog.getByRole('button', { name: 'Save', exact: true }).click();
value = await textarea();
check('class preset applied', value.includes('<table class="table table--striped" data-x="1">'), value);
await save();
const saved = db(resources.tables).content;
check('edited table saved', saved.includes('table--striped') && saved.includes('<p>Milk</p>') && saved.includes('<tfoot>'), saved);

// 5. Insert a new table from the toolbar.
await page.locator(`${editorSel} .ProseMirror > p`, { hasText: 'After' }).click();
await page.keyboard.press('End');
await page.click(`${editorSel} .tiptapeditor__toolbar [data-tiptapeditor-item="table"]`);
await dialog.waitFor({ timeout: 3000 });
check('insert dialog opens', await dialog.locator('h2').textContent() === 'Insert table');
await field('Rows').fill('2');
await field('Columns').fill('3');
await dialog.getByRole('button', { name: 'Insert', exact: true }).click();
await page.keyboard.type('Head');
value = await textarea();
check('new table inserted with a header row', value.includes('<table><tbody><tr><th><p>Head</p></th><th><p></p></th><th><p></p></th></tr>'
    + '<tr><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table>'), value);
await page.keyboard.press('Tab');
const inSecondCell = await page.evaluate(() => {
    const { editor } = window.TipTapEditor.getInstance('ta');
    const { $from } = editor.state.selection;
    return document.activeElement?.classList.contains('ProseMirror') && $from.node(-1).type.name === 'tableHeader' && $from.index(-2) === 1;
});
check('Tab moves to the next cell', inSecondCell);

// 6. Delete the new table from the table toolbar.
await barButton('deleteTable').click();
value = await textarea();
check('table deleted', (value.match(/<table/g) || []).length === 1, value);

// 7. A table with a caption stays in the textarea.
await open(`/manager/?a=resource/update&id=${resources.tablebad}`);
const bad = await page.evaluate(() => ({
    mounted: Boolean(window.TipTapEditor.getInstance('ta')),
    notice: document.querySelector('.tiptapeditor-notice')?.textContent || '',
    raw: document.querySelectorAll('[data-tiptapeditor-for="ta"] .tiptapeditor__raw').length,
}));
check('table with <caption> is kept as a raw HTML block', bad.mounted && bad.raw === 1, JSON.stringify(bad));
await save();
check('table with <caption> saved unchanged', db(resources.tablebad).content === asSubmitted(fixtures.tablebad), db(resources.tablebad).content);

// 8. Tables switched off: no table button, tables stay in the textarea.
php('./set-system-settings.php', 'tiptapeditor.enable_tables', '0');
await open(`/manager/?a=resource/update&id=${resources.tables}`);
const off = await page.evaluate(() => ({
    mounted: Boolean(window.TipTapEditor.getInstance('ta')),
    button: Boolean(document.querySelector('[data-tiptapeditor-item="table"]')),
    raw: document.querySelectorAll('[data-tiptapeditor-for="ta"] .tiptapeditor__raw').length,
}));
check('with tables off, tables are raw HTML blocks and there is no table button', off.mounted && !off.button && off.raw > 0, JSON.stringify(off));
const stored = db(resources.tables).content;
await save();
check('with tables off, content saved unchanged', db(resources.tables).content === stored, db(resources.tables).content);

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
php('./set-system-settings.php', 'tiptapeditor.enable_tables', '1', 'tiptapeditor.table_classes', '');
process.exit(failed ? 1 : 0);
