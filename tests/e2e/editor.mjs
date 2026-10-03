// Stage 3 check: the editor in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/editor.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
// Browsers submit textarea values with CRLF line breaks (HTML spec); MODX saves them as
// received, with or without an editor. "Unchanged" therefore means unchanged up to that.
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

const DEFAULT_TOOLBAR = 'undo redo | heading | bold italic underline strike code | color highlight | superscript subscript'
    + ' | align | bulletList orderedList | blockquote horizontalRule | link modxLink anchor | image file table'
    + ' | codeBlock | clearFormatting | source fullscreen';
php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.toolbar', DEFAULT_TOOLBAR);
const { resources, fixtures, templates } = JSON.parse(php('./fixtures-setup.php'));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

await page.goto(`${base}/manager/`);
await page.fill('#modx-login-username', process.env.MODX_USER || 'admin');
await page.fill('#modx-login-password', process.env.MODX_PASS || '');
await Promise.all([page.waitForNavigation(), page.click('#modx-login-btn')]);

const open = async (path) => {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
};
const save = async () => {
    const response = page.waitForResponse((r) => r.url().includes('connectors/index.php') && r.request().postData()?.includes('Resource%2FUpdate') || r.request().postData()?.includes('Resource%2FCreate') || r.request().postData()?.includes('Resource/Update') || r.request().postData()?.includes('Resource/Create'));
    await page.click('#modx-abtn-save');
    const r = await response;
    await page.waitForTimeout(500);
    return r.json().catch(() => ({}));
};
const state = () => page.evaluate(() => ({
    editors: document.querySelectorAll('.tiptapeditor').length,
    taHidden: document.getElementById('ta')?.classList.contains('tiptapeditor-source--hidden'),
    notice: document.querySelector('.tiptapeditor-notice')?.textContent || null,
    instances: window.TipTapEditor ? window.TipTapEditor.instances.size : -1,
    dirty: window.Ext?.getCmp('modx-panel-resource')?.warnUnsavedChanges ?? null,
}));

// 1. Open and save without edits: content stays byte for byte.
await open(`/manager/?a=resource/update&id=${resources.plain}`);
let s = await state();
check('content editor replaces #ta', s.taHidden && s.instances >= 1, JSON.stringify(s));
check('nothing is dirty after opening', !s.dirty, JSON.stringify(s));
await save();
check('save without edits keeps content byte for byte', db(resources.plain).content === asSubmitted(fixtures.plain), db(resources.plain).content);

// 2. Edit, dirty state, save.
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror h2');
await page.keyboard.press('End');
await page.keyboard.type(' edited');
await page.waitForTimeout(300);
s = await state();
check('typing marks the resource dirty', s.dirty === true, JSON.stringify(s));
const saved = await save();
check('save request succeeds', saved.success !== false, JSON.stringify(saved).slice(0, 200));
let row = db(resources.plain);
check('edited content saved', row.content.includes('<h2>Title edited</h2>') && row.content.includes('class="button"'), row.content);
s = await state();
check('editor still works after save', s.instances >= 1 && s.taHidden && !s.dirty, JSON.stringify(s));

// 3. Richtext TVs (on the TV tab: mounted lazily when shown).
s = await state();
check('TVs on a hidden tab are not initialised yet', s.instances === 1, JSON.stringify(s));
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
s = await state();
check('two richtext TVs get editors', s.instances === 3, JSON.stringify(s));
const tvEditor = page.locator('.tiptapeditor[data-tiptapeditor-for^="tv"] .ProseMirror').first();
await tvEditor.click();
await page.keyboard.press('End');
await page.keyboard.type(' plus');
await page.waitForTimeout(300);
s = await state();
check('typing in a TV marks the resource dirty', s.dirty === true, JSON.stringify(s));
await save();
row = db(resources.plain);
check('TV value saved', Object.values(row.tvs).some((v) => v.endsWith('value plus</p>')), JSON.stringify(row.tvs));
check('other TV untouched', Object.values(row.tvs).filter((v) => /^<p>rt_\w+ value<\/p>$/.test(v)).length === 1, JSON.stringify(row.tvs));

// 3b. Template switch: MODX reloads the page with unsaved values, the TV set changes.
await page.click('#modx-resource-tabs__modx-resource-settings, li[id$="modx-resource-settings"], a:has-text("Document")').catch(() => {});
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror h2');
await page.keyboard.press('End');
await page.keyboard.type(' switched');
await page.evaluate((id) => {
    const combo = window.Ext.getCmp('modx-resource-template');
    combo.setValue(id);
    combo.fireEvent('select', combo);
}, templates.alt);
await page.waitForTimeout(300);
await Promise.all([
    page.waitForURL(/reload=/, { timeout: 10000 }),
    page.click('.x-window-dlg button:has-text("Yes")'),
]).catch((e) => check('template switch dialog', false, e.message));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
s = await state();
const switched = await page.evaluate(() => window.TipTapEditor.getInstance('ta')?.editor.getHTML() || '');
check('template switch keeps unsaved content in the editor', s.taHidden && switched.includes('Title edited switched'), switched.slice(0, 120));
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
s = await state();
check('new template gets editors for its TVs only', s.instances === 2 && s.editors === 2, JSON.stringify(s));
await save();
row = db(resources.plain);
check('template switch saved', row.template === templates.alt && row.content.includes('Title edited switched'), JSON.stringify({ t: row.template, c: row.content.slice(0, 60) }));

// 4. MODX tags and HTML the editor has no node for: opened in the editor (tokens, raw block).
for (const [key, selector] of [['modx', '.tiptapeditor__token'], ['unsupported', '.tiptapeditor__raw']]) {
    await open(`/manager/?a=resource/update&id=${resources[key]}`);
    s = await state();
    const shown = await page.locator(`[data-tiptapeditor-for="ta"] ${selector}`).count();
    check(`${key}: opens in the editor, protected parts shown`, s.taHidden && !s.notice && shown > 0, JSON.stringify({ ...s, shown }));
    await save();
    check(`${key}: content unchanged after save`, db(resources[key]).content === asSubmitted(fixtures[key]), db(resources[key]).content);
}

// 4b. "Rich text" switched off on the resource: content stays a textarea, TVs still get editors.
await open(`/manager/?a=resource/update&id=${resources.norichtext}`);
s = await state();
check('rich text off: content stays a textarea', !s.taHidden && s.instances === 0, JSON.stringify(s));
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
s = await state();
check('rich text off: TVs still get editors', !s.taHidden && s.instances === 2, JSON.stringify(s));

// 5. Create a resource.
await open('/manager/?a=resource/create&parent=0&context_key=web');
await page.fill('#modx-resource-pagetitle', 'E2E created');
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror');
await page.keyboard.type('Brand new');
const created = await save();
const newId = created?.object?.id;
check('create saves content', newId && db(newId)?.content === '<p>Brand new</p>', JSON.stringify(newId && db(newId)));

// 6. Toolbar and keyboard save.
await open(`/manager/?a=resource/update&id=${resources.plain}`);
const toolbar = page.locator('[data-tiptapeditor-for="ta"] [role="toolbar"]:not(.tiptapeditor__toolbar--table)');
check('toolbar is rendered', await toolbar.count() === 1);
check('table toolbar stays hidden outside tables', await page.locator('[data-tiptapeditor-for="ta"] .tiptapeditor__toolbar--table').isHidden());
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror h2');
await page.keyboard.press('End');
await page.keyboard.press('Shift+Home');
await toolbar.locator('[data-tiptapeditor-item="italic"]').click();
check('toolbar button shows active state', await toolbar.locator('[data-tiptapeditor-item="italic"]').getAttribute('aria-pressed') === 'true');
const saveRequest = page.waitForRequest((r) => r.url().includes('connectors') && (r.postData() || '').includes('Update'), { timeout: 5000 }).then(() => true).catch(() => false);
await page.keyboard.press('Control+s');
check('Ctrl+S saves through MODX', await saveRequest);
await page.waitForTimeout(800);
check('toolbar formatting saved', /<h2><em>Title[^<]*<\/em><\/h2>/.test(db(resources.plain).content), db(resources.plain).content.slice(0, 80));

// 7. Public API.
const api = await page.evaluate(() => {
    const T = window.TipTapEditor;
    const before = T.instances.size;
    T.mount();
    T.mount('ta');
    return { before, after: T.instances.size, hasSyncAll: typeof T.syncAll === 'function' };
});
check('mount() is idempotent', api.before === api.after, JSON.stringify(api));

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
