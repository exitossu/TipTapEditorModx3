// Stage 12b check: bubble/floating menus, slash commands, MODX/Fenom autocomplete, paste
// clean-up, embeds, status bar, image upload and Ctrl+S in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/assist.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const site = process.env.M;
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');
const UPLOADS = 'assets/e2e-uploads/';

const TOOLBAR = 'undo redo | heading | bold italic underline | bulletList orderedList | blockquote | link | image table embed | source fullscreen';
const settings = (...pairs) => php('./set-system-settings.php', ...pairs);
settings('which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.toolbar', TOOLBAR,
    'tiptapeditor.statusbar', '1', 'tiptapeditor.fenom_autocomplete', '1',
    'tiptapeditor.upload_enabled', '1', 'tiptapeditor.upload_path', UPLOADS);
rmSync(`${site}/${UPLOADS}`, { recursive: true, force: true });
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
const isUpdate = (r) => /Resource(%2F|\/)Update/.test(r.request().postData() || '');
const save = async () => {
    const response = page.waitForResponse(isUpdate);
    await page.click('#modx-abtn-save');
    await response;
    await page.waitForTimeout(500);
};
const pm = '[data-tiptapeditor-for="ta"] .ProseMirror';
const visible = (selector) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return Boolean(el && !el.hidden && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0);
}, selector);
const suggestions = () => page.locator('.tiptapeditor-suggest__label').allTextContents();

// 1. Bubble menu over selected text.
await open(`/manager/?a=resource/update&id=${resources.assist}`);
const first = page.locator(`${pm} p`).first();
const box = await first.boundingBox();
// Double click selects the first word ("Some").
await page.mouse.dblclick(box.x + 6, box.y + box.height / 2);
await page.waitForFunction(() => {
    const el = document.querySelector('.tiptapeditor__bubble');
    return el && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
}, null, { timeout: 3000 }).catch(() => {});
check('bubble menu shows over selected text', await visible('.tiptapeditor__bubble'));
const bubbleBox = await page.locator('.tiptapeditor__bubble').boundingBox();
check('bubble menu sits above the selection', bubbleBox && bubbleBox.y + bubbleBox.height <= box.y + 2, JSON.stringify({ bubbleBox, box }));
check('bubble menu items', JSON.stringify(await page.locator('.tiptapeditor__bubble [data-tiptapeditor-item]').evaluateAll((els) => els.map((el) => el.dataset.tiptapeditorItem)))
    === JSON.stringify(['bold', 'italic', 'underline', 'strike', 'code', 'link']));
await page.click('.tiptapeditor__bubble [data-tiptapeditor-item="bold"]');
await page.keyboard.press('End');
await page.waitForTimeout(400);
check('bubble menu hides without a selection', !(await visible('.tiptapeditor__bubble')));

// 2. Floating menu on an empty paragraph.
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
check('floating menu shows on an empty paragraph', await visible('.tiptapeditor__floating'));
await page.click('.tiptapeditor__floating [data-tiptapeditor-item="h2"]');
await page.keyboard.type('Heading');
await page.waitForTimeout(300);
check('floating menu hides once there is text', !(await visible('.tiptapeditor__floating')));

// 3. Slash command.
await page.keyboard.press('Enter');
await page.keyboard.type('/');
await page.waitForTimeout(300);
check('"/" opens the block list', (await suggestions()).includes('Quote'), JSON.stringify(await suggestions()));
await page.keyboard.type('quo');
await page.waitForTimeout(300);
check('typing filters the list', JSON.stringify(await suggestions()) === JSON.stringify(['Quote']), JSON.stringify(await suggestions()));
await page.keyboard.press('Enter');
await page.keyboard.type('Quoted');

// 4. MODX and Fenom autocomplete.
await page.keyboard.type(' [[*pagetit');
await page.waitForTimeout(700);
check('[[* suggests resource fields', JSON.stringify(await suggestions()) === JSON.stringify(['pagetitle']), JSON.stringify(await suggestions()));
await page.keyboard.press('Enter');
await page.keyboard.type(' [[$e2eHe');
await page.waitForTimeout(900);
check('[[$ finds chunks through the connector', (await suggestions()).includes('e2eHeader'), JSON.stringify(await suggestions()));
await page.keyboard.press('Enter');
await page.keyboard.type(' {$_modx->resource.longt');
await page.waitForTimeout(700);
check('{$_modx->resource. suggests fields', JSON.stringify(await suggestions()) === JSON.stringify(['longtitle']), JSON.stringify(await suggestions()));
await page.keyboard.press('Tab');
await page.waitForTimeout(200);
check('completed tags are protected tokens', await page.locator(`${pm} blockquote .tiptapeditor__token`).count() === 3);

// 5. Status bar.
const status = await page.locator('[data-tiptapeditor-for="ta"] .tiptapeditor__statusbar').textContent();
check('status bar: element path and counts', /blockquote > p/.test(status) && /Words: \d+/.test(status) && /Characters: \d+/.test(status), status);

await save();
let content = db(resources.assist).content;
check('menus, slash command and autocomplete saved', content === '<p><strong>Some</strong> text to format.</p><h2>Heading</h2>'
    + '<blockquote><p>Quoted [[*pagetitle]] [[$e2eHeader]] {$_modx->resource.longtitle}</p></blockquote>', content);

// 6. Ctrl+S saves the resource through the manager.
await page.locator(`${pm} h2`).click();
await page.keyboard.press('End');
await page.keyboard.type('!');
const saved = page.waitForResponse(isUpdate, { timeout: 5000 }).then(() => true).catch(() => false);
await page.keyboard.press('Control+s');
check('Ctrl+S in the editor saves the resource', await saved);
await page.waitForTimeout(500);
check('Ctrl+S saved the latest text', db(resources.assist).content.includes('<h2>Heading!</h2>'));

// 7. Paste from Word.
const WORD = '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body><!--StartFragment-->'
    + '<p class=MsoNormal style="margin:0"><b><span style="font-size:12pt">Word</span></b><span lang=RU> text<o:p></o:p></span></p>'
    + '<p class=MsoListParagraph style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore">1.<span>&nbsp;</span></span><![endif]>First<o:p></o:p></p>'
    + '<p class=MsoListParagraph style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore">2.<span>&nbsp;</span></span><![endif]>Second<o:p></o:p></p>'
    + '<p class=MsoNormal><img src="file:///C:/x/clip_image001.png"></p><!--EndFragment--></body></html>';
await page.locator(`${pm} h2`).click();
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.evaluate(({ selector, html }) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'Word text\nFirst\nSecond');
    document.querySelector(selector).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}, { selector: pm, html: WORD });
await page.waitForTimeout(300);
const pasted = await page.evaluate(() => window.TipTapEditor.getInstance('ta').editor.getHTML());
check('Word paste: structure kept, Office markup gone', pasted.includes('<p><strong>Word</strong> text</p><ol><li><p>First</p></li><li><p>Second</p></li></ol>')
    && !/Mso|mso-|file:|o:p/.test(pasted), pasted);
check('Word paste: the user is told about left out images', /left out/.test(await page.locator('[data-tiptapeditor-for="ta"] .tiptapeditor__message').textContent()));

// 8. Upload a dropped image into the Media Source.
await page.evaluate((selector) => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([png], 'Скриншот 1.png', { type: 'image/png' }));
    const target = document.querySelector(`${selector} h2`);
    target.scrollIntoView({ block: 'center' });
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true, clientX: rect.right - 2, clientY: rect.top + 5 }));
}, pm);
await page.waitForFunction(() => document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror img:not(.ProseMirror-separator)'), null, { timeout: 15000 }).catch(() => {});
const uploadedSrc = await page.evaluate(() => document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror img:not(.ProseMirror-separator)')?.getAttribute('src') || '');
const uploadedFiles = existsSync(`${site}/${UPLOADS}`) ? readdirSync(`${site}/${UPLOADS}`) : [];
check('dropped image uploaded through MODX into upload_path', /^\/?assets\/e2e-uploads\/skrinshot-1-[a-z0-9]+\.png$/.test(uploadedSrc)
    && uploadedFiles.includes(uploadedSrc.split('/').pop()), JSON.stringify({ uploadedSrc, uploadedFiles }));
await save();
content = db(resources.assist).content;
check('uploaded image saved by URL, never base64', content.includes(`src="${UPLOADS}${uploadedSrc.split('/').pop()}"`) && !content.includes('data:image'), content);

// 9. Embeds: existing iframes are editable cards, never loaded; one more from a YouTube URL.
await open(`/manager/?a=resource/update&id=${resources.iframe}`);
const cards = await page.locator(`${pm} .tiptapeditor__embed`).count();
check('iframes open as embed cards, not raw blocks', cards === 2 && await page.locator(`${pm} .tiptapeditor__raw`).count() === 0, String(cards));
check('no iframe is loaded in the manager', await page.locator(`${pm} iframe`).count() === 0);
await save();
check('embeds unchanged when not edited', db(resources.iframe).content === asSubmitted(fixtures.iframe), db(resources.iframe).content);
const last = page.locator(`${pm} p`).first();
const lastBox = await last.boundingBox();
await page.mouse.click(lastBox.x + 3, lastBox.y + lastBox.height / 2);
await page.keyboard.press('End');
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="embed"]');
await page.fill('.tiptapeditor-dialog input', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await page.click('.tiptapeditor-dialog__button--primary');
await save();
content = db(resources.iframe).content;
check('embed dialog inserts the YouTube player', content.includes('<p>Video below.<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"'), content);
check('the other embeds are kept', content.includes('https://www.youtube.com/embed/xyz') && content.includes('https://vk.com/video_ext.php?oid=1&amp;id=2'), content);

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
settings('tiptapeditor.statusbar', '0', 'tiptapeditor.fenom_autocomplete', '0', 'tiptapeditor.upload_enabled', '0', 'tiptapeditor.upload_path', 'assets/uploads/');
rmSync(`${site}/${UPLOADS}`, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
