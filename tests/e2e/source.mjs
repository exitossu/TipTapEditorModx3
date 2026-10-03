// Stage 11 check: HTML source mode in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/source.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.protect_modx_syntax', '1',
    'tiptapeditor.protect_fenom_syntax', '1', 'tiptapeditor.toolbar', 'undo redo | bold italic | source fullscreen');
const { resources, fixtures } = JSON.parse(php('./fixtures-setup.php'));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const errors = [];
let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
const sourceButton = page.locator(`${editorSel} [data-tiptapeditor-item="source"]`);
const sourceEl = page.locator(`${editorSel} .tiptapeditor__source`);
const content = page.locator(`${editorSel} .tiptapeditor__content`);

// 1. Source mode shows the stored content literally.
await open(`/manager/?a=resource/update&id=${resources.syntax}`);
await sourceButton.click();
check('source button switches to a plain textarea', await sourceEl.isVisible() && !(await content.isVisible())
    && await sourceEl.evaluate((el) => el.localName === 'textarea' && !el.isContentEditable));
check('source shows the content literally (HTML, MODX, Fenom)', (await sourceEl.inputValue()) === fixtures.syntax, await sourceEl.inputValue());
check('source button is pressed, formatting buttons disabled',
    (await sourceButton.getAttribute('aria-pressed')) === 'true'
    && await page.locator(`${editorSel} [data-tiptapeditor-item="bold"]`).isDisabled());
await page.screenshot({ path: process.env.SCREENSHOT || '/tmp/tiptapeditor-stage11.png', clip: await page.locator(editorSel).boundingBox() }).catch(() => {});

// 2. Saving in source mode without changes keeps everything byte for byte.
await save();
check('save in source mode without edits: unchanged', db(resources.syntax).content === asSubmitted(fixtures.syntax), db(resources.syntax).content);

// 3. Edit the source and save while still in source mode: saved exactly as typed.
const edited = fixtures.syntax.replace('<h2>Заголовок</h2>', '<h2 id="title">Новый &amp; [[++site_name]]</h2>')
    + '\n<p>Added {$x|default:"a&b"}</p>';
await sourceEl.fill(edited);
check('typing in source marks the form dirty', await page.evaluate(() => Boolean(window.Ext?.getCmp('modx-panel-resource')?.warnUnsavedChanges)));
await save();
check('source edits saved exactly as typed', db(resources.syntax).content === asSubmitted(edited), db(resources.syntax).content);

// 4. Back to the editor: the new source is shown; saving without edits keeps it.
await sourceButton.click();
check('back in the visual editor', await content.isVisible() && !(await sourceEl.isVisible()));
check('edited heading shown with its token', await page.locator(`${editorSel} .ProseMirror h2#title`).count() === 1
    && (await page.locator(`${editorSel} .ProseMirror h2 .tiptapeditor__token`).count()) === 1);
check('new paragraph with Fenom token shown', await page.locator(`${editorSel} .ProseMirror p`, { hasText: 'Added' }).locator('.tiptapeditor__token--fenom').count() === 1);
await save();
check('save after switching back without edits: unchanged', db(resources.syntax).content === asSubmitted(edited), db(resources.syntax).content);

// 5. Edit in the editor after a source change: tokens and the rest kept.
await page.locator(`${editorSel} .ProseMirror p`, { hasText: 'Added' }).click({ position: { x: 3, y: 8 } });
await page.keyboard.press('Home');
await page.keyboard.type('Just ');
await save();
const after = db(resources.syntax).content;
check('edit after source change saved', after.includes('<p>Just Added {$x|default:"a&b"}</p>'), after);
check('heading from source kept', after.includes('<h2 id="title">Новый &amp; [[++site_name]]</h2>'), after);
check('MODX call kept literally', after.includes('[[!pdoResources?\r\n    &parents=`10`\r\n    &limit=`5`\r\n]]'), after);

// 6. Undo returns to the content before the source change.
await sourceButton.click();
await sourceEl.fill('<p>Replaced</p>');
await sourceButton.click();
check('source replaced the document', (await page.locator(`${editorSel} .ProseMirror`).innerText()).trim() === 'Replaced');
await page.locator(`${editorSel} .ProseMirror`).click();
await page.keyboard.press('Control+z');
check('undo brings back the content before the source change',
    await page.locator(`${editorSel} .ProseMirror h2#title`).count() === 1, await page.locator(`${editorSel} .ProseMirror`).innerText());

// 7. Fullscreen covers the window (visual and source mode); Escape leaves it.
await page.locator(`${editorSel} [data-tiptapeditor-item="fullscreen"]`).click();
const visualFull = await page.locator(editorSel).evaluate((el) => {
    const box = el.getBoundingClientRect();
    return { top: box.top, height: box.height, content: el.querySelector('.tiptapeditor__content').getBoundingClientRect().height };
});
check('fullscreen covers the window', visualFull.top === 0 && visualFull.height === 900 && visualFull.content > 700, JSON.stringify(visualFull));
await page.keyboard.press('Escape');
check('Escape in the text leaves fullscreen', !(await page.locator(editorSel).evaluate((el) => el.classList.contains('tiptapeditor--fullscreen'))));
await sourceButton.click();
await page.locator(`${editorSel} [data-tiptapeditor-item="fullscreen"]`).click();
const full = await page.locator(editorSel).evaluate((el) => ({
    full: el.classList.contains('tiptapeditor--fullscreen'),
    height: el.querySelector('.tiptapeditor__source').getBoundingClientRect().height,
}));
check('fullscreen in source mode fills the window', full.full && full.height > 700, JSON.stringify(full));
await page.keyboard.press('Escape');
check('Escape leaves fullscreen, source stays', !(await page.locator(editorSel).evaluate((el) => el.classList.contains('tiptapeditor--fullscreen')))
    && await sourceEl.isVisible());
await sourceButton.click();

// 8. Private use characters in the source: stays in source mode with a message.
await sourceButton.click();
await sourceEl.fill('<p>ab</p>');
await sourceButton.click();
const blocked = await page.evaluate(() => ({
    dialog: document.querySelector('.tiptapeditor-dialog')?.textContent || '',
    source: !document.querySelector('[data-tiptapeditor-for="ta"] .tiptapeditor__source').hidden,
}));
check('private use characters keep the source mode with a message', blocked.source && blocked.dialog.includes('U+E000'), JSON.stringify(blocked));
await page.keyboard.press('Escape');

// 9. A richtext TV has its own source mode.
await open(`/manager/?a=resource/update&id=${resources.plain}`);
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
const tv = page.locator('.tiptapeditor[data-tiptapeditor-for^="tv"]').first();
await tv.locator('[data-tiptapeditor-item="source"]').click();
const tvSource = tv.locator('.tiptapeditor__source');
const tvValue = await tvSource.inputValue();
check('TV source shows its value', /^<p>rt_\w+ value<\/p>$/.test(tvValue), tvValue);
await tvSource.fill(`${tvValue}\n[[$tvChunk]]`);
check('content editor stays in visual mode', await content.evaluate((el) => !el.hidden));
await save();
const row = db(resources.plain);
check('TV source saved exactly', Object.values(row.tvs).some((v) => v === asSubmitted(`${tvValue}\n[[$tvChunk]]`)), JSON.stringify(row.tvs));
check('content untouched by the TV source', row.content === asSubmitted(fixtures.plain), row.content);

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
