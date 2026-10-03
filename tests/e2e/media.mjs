// Stage 6 check: Media Browser integration in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/media.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));

php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.media_url_mode', 'relative',
    'tiptapeditor.toolbar', 'undo redo | bold italic | link | image file');
const { resources, tvs, source } = JSON.parse(php('./fixtures-setup.php'));

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const errors = [];
let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

async function login(user, pass) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/manager/`);
    await page.fill('#modx-login-username', user);
    await page.fill('#modx-login-password', pass);
    await Promise.all([page.waitForNavigation(), page.click('#modx-login-btn')]);
    return page;
}

const open = async (page, path) => {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
};
const save = async (page) => {
    const response = page.waitForResponse((r) => /Resource(%2F|\/)Update/.test(r.request().postData() || ''));
    await page.click('#modx-abtn-save');
    await response;
    await page.waitForTimeout(500);
};
const browserWindow = (page) => page.locator('.x-window.modx-browser:visible').last();
const openFolder = async (page, name) => {
    await browserWindow(page).locator('.x-tree-node-anchor', { hasText: new RegExp(`^${name}$`) }).first().click();
    await page.waitForTimeout(600);
};
const browseFromDialog = async (page) => {
    await page.locator('.tiptapeditor-dialog button', { hasText: 'Choose in Media Browser…' }).click();
    await browserWindow(page).waitFor({ timeout: 5000 });
};
const saveDialog = async (page) => {
    await page.click('.tiptapeditor-dialog .tiptapeditor-dialog__button--primary');
    await page.waitForTimeout(200);
};
const pick = async (page, file) => {
    const thumb = browserWindow(page).locator(`.modx-browser-thumb-wrap[title="${file}"]`);
    await thumb.waitFor({ timeout: 5000 });
    await thumb.dblclick();
    await page.waitForTimeout(400);
};
const html = (page, id = 'ta') => page.evaluate((field) => window.TipTapEditor.getInstance(field)?.editor.getHTML() || '', id);

const page = await login(process.env.MODX_USER || 'admin', process.env.MODX_PASS || '');

// 1. Insert an image into the content from the in-page browser.
await open(page, `/manager/?a=resource/update&id=${resources.plain}`);
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror h2');
await page.keyboard.press('End');
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="image"]');
await browseFromDialog(page);
check('"Choose in Media Browser…" opens the MODX browser in the page', await browserWindow(page).isVisible());
const sourceId = await page.evaluate(() => window.Ext.WindowMgr.getActive()?.config?.source);
check('content browses its Media Source', Number(sourceId) === 1, String(sourceId));
await openFolder(page, 'assets');
await openFolder(page, 'e2e');
await openFolder(page, 'img');
await pick(page, 'pic.png');
// The picked file fills the URL field of the image dialog; Save inserts it.
check('the picked file fills the URL field', await page.locator('.tiptapeditor-dialog input').first().inputValue() === 'assets/e2e/img/pic.png');
await saveDialog(page);
let content = await html(page);
check('image inserted with the URL MODX returned', content.includes('<img src="assets/e2e/img/pic.png" alt="">'), content);
const preview = await page.evaluate(() => {
    const img = document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror img');
    return img && { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 };
});
check('editor shows the image resolved against the site', preview?.src === '/assets/e2e/img/pic.png' && preview.loaded, JSON.stringify(preview));
await save(page);
check('image saved', db(resources.plain).content.includes('<img src="assets/e2e/img/pic.png" alt="">'), db(resources.plain).content);

// 2. Replace the file of the selected image: browser opens in its folder, other attributes stay.
await page.evaluate(() => {
    const { editor } = window.TipTapEditor.getInstance('ta');
    let pos = null;
    editor.state.doc.descendants((node, p) => { if (node.type.name === 'image') { pos = p; } });
    editor.chain().setNodeSelection(pos).updateAttributes('image', { alt: 'Kept alt' }).run();
});
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror img');
check('clicking an image selects it', await page.evaluate(() => window.TipTapEditor.getInstance('ta').editor.isActive('image')));
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="image"]');
await browseFromDialog(page);
const openTo = await page.evaluate(() => window.Ext.WindowMgr.getActive()?.config?.openTo);
check('replace opens the folder of the current file', openTo === 'assets/e2e/img/', String(openTo));
await page.waitForTimeout(600);
await pick(page, 'pic2.png');
await saveDialog(page);
content = await html(page);
check('replace changes only src', content.includes('<img src="assets/e2e/img/pic2.png" alt="Kept alt">') && !content.includes('pic.png"'), content);

// 3. Link to a file: the file name becomes the link text.
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror li:last-child');
await page.keyboard.press('End');
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="file"]');
await browserWindow(page).waitFor({ timeout: 5000 });
await openFolder(page, 'assets');
await openFolder(page, 'e2e');
await pick(page, 'price.pdf');
content = await html(page);
check('file link inserted', content.includes('<a href="assets/e2e/price.pdf">price.pdf</a>'), content);
await save(page);
check('file link saved', db(resources.plain).content.includes('<a href="assets/e2e/price.pdf">price.pdf</a>'), db(resources.plain).content);

// 4. A TV browses the Media Source assigned to it; a non-image is refused for <img>.
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
const tv = `tv${tvs.rt_two}`;
await page.click(`[data-tiptapeditor-for="${tv}"] .ProseMirror`);
await page.click(`[data-tiptapeditor-for="${tv}"] [data-tiptapeditor-item="image"]`);
await browseFromDialog(page);
const tvSource = await page.evaluate(() => window.Ext.WindowMgr.getActive()?.config?.source);
check('TV browses its own Media Source', Number(tvSource) === source, `${tvSource} vs ${source}`);
await pick(page, 'price.pdf');
const tvState = await page.evaluate((id) => ({
    html: window.TipTapEditor.getInstance(id).editor.getHTML(),
    message: document.querySelector('.tiptapeditor-dialog .tiptapeditor-dialog__error')?.textContent || '',
}), tv);
await page.keyboard.press('Escape');
check('a PDF is not inserted as an image', !tvState.html.includes('<img') && tvState.message.length > 0, JSON.stringify(tvState));

// 5. Dropping a file never stores base64.
const dropped = await page.evaluate(() => {
    const target = document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror');
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'drop.png', { type: 'image/png' }));
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: rect.left + 5, clientY: rect.top + 5 }));
    return {
        html: window.TipTapEditor.getInstance('ta').editor.getHTML(),
        message: document.querySelector('[data-tiptapeditor-for="ta"] .tiptapeditor__message')?.textContent || '',
    };
});
check('dropped image is not embedded and the user is told why', !dropped.html.includes('data:') && !dropped.html.includes('drop.png') && dropped.message.length > 0, JSON.stringify(dropped).slice(0, 200));

// 6. Fallback: standalone browser page in a popup.
await open(page, `/manager/?a=resource/update&id=${resources.plain}`);
await page.evaluate(() => {
    const original = window.Ext.ComponentMgr.isRegistered;
    window.Ext.ComponentMgr.isRegistered = (xtype) => xtype !== 'modx-browser' && original.call(window.Ext.ComponentMgr, xtype);
});
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror li:first-child');
const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="file"]'),
]);
await popup.waitForLoadState('networkidle');
const callback = await popup.evaluate(() => typeof window.MODx.onBrowserReturn === 'function' && window.MODx.onBrowserReturn === window.TipTapEditor?.browserCallback);
check('popup page uses the TipTapEditor callback', callback);
await popup.locator('.x-tree-node-anchor', { hasText: /^assets$/ }).first().click();
await popup.waitForTimeout(600);
await popup.locator('.x-tree-node-anchor', { hasText: /^e2e$/ }).first().click();
await popup.waitForTimeout(600);
// The popup closes itself once the file is posted back, possibly before the dblclick returns.
await popup.locator('.modx-browser-thumb-wrap[title="price.pdf"]').dblclick().catch(() => {});
await page.waitForTimeout(800);
content = await html(page);
check('file chosen in the popup is linked', content.includes('href="assets/e2e/price.pdf"'), content);
await open(page, '/manager/?a=browser&source=1');
check('browser page without the flag is left alone', await page.evaluate(() => typeof window.TipTapEditor === 'undefined'));

// 7. A manager user without file_manager: buttons disabled, no source sent to the page.
const editorPage = await login('e2e_editor', 'editor12345');
await open(editorPage, `/manager/?a=resource/update&id=${resources.plain}`);
const restricted = await editorPage.evaluate(() => ({
    mounted: Boolean(window.TipTapEditor?.getInstance('ta')),
    source: window.TipTapEditor?.getInstance('ta')?.config.mediaSource ?? null,
    image: document.querySelector('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="image"]')?.disabled,
    file: document.querySelector('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="file"]')?.disabled,
}));
check('without file_manager no source is sent and the file button is disabled', restricted.mounted && restricted.source === null && restricted.file === true, JSON.stringify(restricted));
// The image button still works: the dialog takes a URL, without the Media Browser button.
await editorPage.click('[data-tiptapeditor-for="ta"] .ProseMirror h2');
await editorPage.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="image"]');
const urlOnly = await editorPage.evaluate(() => ({
    dialog: Boolean(document.querySelector('.tiptapeditor-dialog')),
    browse: [...document.querySelectorAll('.tiptapeditor-dialog button')].some((b) => b.textContent.includes('Media Browser')),
}));
check('without file_manager the image button asks for a URL only', restricted.image === false && urlOnly.dialog && !urlOnly.browse, JSON.stringify({ ...restricted, ...urlOnly }));

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
