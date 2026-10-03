// Stage 10 check: MODX/Fenom syntax protection in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/syntax.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { findTokens } from '../../assets-src/js/syntax/tokenizer.js';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');
const count = (text) => findTokens(text).reduce((map, t) => map.set(t.raw, (map.get(t.raw) || 0) + 1), new Map());
const sameTokens = (a, b) => JSON.stringify([...count(a)].sort()) === JSON.stringify([...count(b)].sort());

php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.protect_modx_syntax', '1',
    'tiptapeditor.protect_fenom_syntax', '1', 'tiptapeditor.toolbar', 'undo redo | bold italic | link');
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
const textarea = () => page.evaluate(() => {
    window.TipTapEditor.syncAll();
    return document.getElementById('ta').value;
});
const tokens = page.locator(`${editorSel} .tiptapeditor__token`);
const raws = page.locator(`${editorSel} .tiptapeditor__raw`);
const dialog = page.locator('.tiptapeditor-dialog');
const code = dialog.locator('textarea');

// 1. The acceptance fixture opens in the editor; tokens are badges and cards.
await open(`/manager/?a=resource/update&id=${resources.syntax}`);
const mounted = await page.evaluate(() => ({
    instance: Boolean(window.TipTapEditor.getInstance('ta')),
    notice: document.querySelector('.tiptapeditor-notice')?.textContent || '',
}));
check('MODX/Fenom content opens in the editor', mounted.instance && !mounted.notice, JSON.stringify(mounted));
check('tokens are shown as badges', await tokens.count() >= 8, String(await tokens.count()));
check('tokens alone on a line are cards', await page.locator(`${editorSel} .tiptapeditor__token--block`).count() === 3,
    String(await page.locator(`${editorSel} .tiptapeditor__token--block`).count()));
check('Fenom tokens are marked as Fenom', await page.locator(`${editorSel} .tiptapeditor__token--fenom`).count() >= 4);
check('nothing of the template logic is rendered', await page.locator(`${editorSel} .ProseMirror`).evaluate((el) => !el.querySelector('script')));
await page.screenshot({ path: process.env.SCREENSHOT || '/tmp/tiptapeditor-stage10.png', clip: await page.locator(editorSel).boundingBox() }).catch(() => {});

// 2. Save without edits: byte for byte.
await save();
check('save without edits keeps content byte for byte', db(resources.syntax).content === asSubmitted(fixtures.syntax), db(resources.syntax).content);

// 3. Edit one paragraph: every token stays exactly as written ("&" included).
await open(`/manager/?a=resource/update&id=${resources.syntax}`);
await page.locator(`${editorSel} .ProseMirror p`, { hasText: 'Текст' }).click();
await page.keyboard.press('End');
await page.keyboard.type(' Добавлено');
await save();
const edited = db(resources.syntax).content;
check('edit is saved', edited.includes('Добавлено'), edited);
check('every MODX/Fenom construct is kept exactly, as many times', sameTokens(edited, asSubmitted(fixtures.syntax)),
    JSON.stringify([...count(edited)].filter(([raw, n]) => count(asSubmitted(fixtures.syntax)).get(raw) !== n)));
for (const literal of ['[[!snippet? &a=`1` &b=`x&y`]]', '{$a|replace:"&":"and"}', 'href="[[~5? &amp;scheme=`abs`]]"',
    'href="[[~12]]"', '{if $resource.published}', '{/if}']) {
    check(`kept literally: ${literal}`, edited.includes(literal), edited);
}
check('no editor markers or private characters in the saved content',
    !/data-tiptapeditor|[]/.test(edited), edited);

// 4. A Fenom loop between table rows is a raw HTML block, saved unchanged.
await open(`/manager/?a=resource/update&id=${resources.fenomtable}`);
check('Fenom loop in a table is a raw HTML block', await raws.count() === 1, String(await raws.count()));
check('raw block preview is text only', await raws.first().evaluate((el) => !el.querySelector('table, tr, td')));
await raws.first().dblclick();
await dialog.waitFor();
check('double click opens the raw block source', (await code.inputValue()) === fixtures.fenomtable.slice(fixtures.fenomtable.indexOf('<table')),
    await code.inputValue());
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'detached' });
await page.locator(`${editorSel} .ProseMirror p`, { hasText: 'Rows' }).click();
await page.keyboard.press('End');
await page.keyboard.type('!');
await save();
// Only the line break between the two blocks is not kept once the content is edited.
check('raw block saved byte for byte after an edit elsewhere',
    db(resources.fenomtable).content === asSubmitted(fixtures.fenomtable.replace('<p>Rows</p>\n', '<p>Rows!</p>')), db(resources.fenomtable).content);

// 5. Typing a MODX tag turns it into a token once it is complete; the dialog edits it.
await open(`/manager/?a=resource/update&id=${resources.syntaxtype}`);
await page.locator(`${editorSel} .ProseMirror p`).click();
await page.keyboard.press('End');
await page.keyboard.type(' [[*pagetitle');
check('an unfinished tag stays text', await tokens.count() === 0);
await page.keyboard.type(']] and [[!snippet? &a=`1`]]');
check('a completed tag becomes a token', await tokens.count() === 2, String(await tokens.count()));
check('typed tags are kept exactly (no code mark from the backticks)', (await textarea()) === '<p>Start [[*pagetitle]] and [[!snippet? &a=`1`]]</p>', await textarea());
await tokens.first().dblclick();
await dialog.waitFor();
check('double click opens the token source', (await code.inputValue()) === '[[*pagetitle]]', await code.inputValue());
await code.fill('[[*longtitle:default=`[[*pagetitle]]`]]');
await page.keyboard.press('Control+Enter');
await dialog.waitFor({ state: 'detached' });
check('token edited in the dialog', (await textarea()) === '<p>Start [[*longtitle:default=`[[*pagetitle]]`]] and [[!snippet? &a=`1`]]</p>', await textarea());
await save();
check('typed and edited tokens saved', db(resources.syntaxtype).content === '<p>Start [[*longtitle:default=`[[*pagetitle]]`]] and [[!snippet? &a=`1`]]</p>',
    db(resources.syntaxtype).content);

// Clicked at the start of the line: a click on a badge selects the token, typing replaces it.
await page.locator(`${editorSel} .ProseMirror p`).click({ position: { x: 3, y: 8 } });
await page.keyboard.press('End');
await page.keyboard.type(' and `code`');
check('backticks outside a tag still make inline code', (await textarea()).endsWith(' and <code>code</code></p>'), await textarea());

// 6. Paste: a tag in pasted text becomes a token; private use characters are dropped.
await page.locator(`${editorSel} .ProseMirror p`).click({ position: { x: 3, y: 8 } });
await page.keyboard.press('End');
await page.evaluate(() => {
    const target = document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror');
    const data = new DataTransfer();
    data.setData('text/html', '<p> pasted [[$chunk? &x=`1`]] zz-1</p>');
    data.setData('text/plain', ' pasted [[$chunk? &x=`1`]]');
    target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(200);
const pasted = await textarea();
check('pasted tag is a token and kept exactly', pasted.includes('[[$chunk? &x=`1`]]') && !/[]/.test(pasted), pasted);

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
