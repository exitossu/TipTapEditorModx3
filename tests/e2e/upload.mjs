// Upload from the computer and copy by link in the image and gallery dialogs, in a real MODX 3 manager: files go through MODX into
// tiptapeditor.upload_path, the URL import refuses internal addresses, the image dialog follows.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/upload.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const site = process.env.M;
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const UPLOADS = 'assets/e2e-uploads/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const settings = (...pairs) => php('./set-system-settings.php', ...pairs);
settings('which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.toolbar', 'bold | image gallery | source',
    'tiptapeditor.upload_enabled', '1', 'tiptapeditor.upload_path', UPLOADS);
rmSync(`${site}/${UPLOADS}`, { recursive: true, force: true });
const { resources } = JSON.parse(php('./fixtures-setup.php'));

let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

// Server side: address rules, type/size checks and the Image/Import processor.
let server = '';
try {
    server = php('./remote-image.php', base);
} catch (error) {
    server = error.stdout?.toString() || String(error);
}
for (const line of server.split('\n').filter((l) => /^(ok |FAIL)/.test(l))) {
    check(`server: ${line.slice(5)}`, line.startsWith('ok'), line);
}
rmSync(`${site}/${UPLOADS}`, { recursive: true, force: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/manager/`);
await page.fill('#modx-login-username', process.env.MODX_USER || 'admin');
await page.fill('#modx-login-password', process.env.MODX_PASS || '');
await Promise.all([page.waitForNavigation(), page.click('#modx-login-btn')]);
const open = async (id) => {
    await page.goto(`${base}/manager/?a=resource/update&id=${id}`);
    await page.waitForLoadState('networkidle');
};
const save = async () => {
    const response = page.waitForResponse((r) => /Resource(%2F|\/)Update/.test(r.request().postData() || ''));
    await page.click('#modx-abtn-save');
    await response;
    await page.waitForTimeout(500);
};
const root = '[data-tiptapeditor-for="ta"]';
const pm = `${root} .ProseMirror`;
const button = (name) => page.locator(`${root} [data-tiptapeditor-item="${name}"]`);
const images = () => page.evaluate(() => window.TipTapEditor.getInstance('ta').editor.getJSON().content.flatMap((b) => b.content || []).filter((n) => n.type === 'image').map((n) => n.attrs));

const dialogButton = (text) => page.locator('.tiptapeditor-dialog--image .tiptapeditor-dialog__button', { hasText: text });
const imageDialogError = () => page.locator('.tiptapeditor-dialog--image .tiptapeditor-dialog__error').textContent().catch(() => '');

await open(resources.assist);
check('one image button on the toolbar', await button('image').getAttribute('aria-label') === 'Image', await button('image').getAttribute('aria-label'));
await page.locator(`${pm} p`).first().click({ position: { x: 3, y: 5 } });
await page.keyboard.press('End');
await button('image').click();
check('the image dialog offers Media Browser, computer and copy by link',
    await dialogButton('Choose in Media Browser…').isVisible() && await dialogButton('Upload from computer…').isVisible() && await dialogButton('Copy to site').isVisible());

// 1. From the computer: file picker -> upload -> URL field of the same dialog -> saved by URL.
const chooser = page.waitForEvent('filechooser');
await dialogButton('Upload from computer…').click();
await (await chooser).setFiles({ name: 'Фото 1.png', mimeType: 'image/png', buffer: PNG });
await page.waitForFunction(() => /e2e-uploads/.test(document.querySelector('.tiptapeditor-dialog--image input')?.value || ''), null, { timeout: 20000 }).catch(() => {});
const field = await page.locator('.tiptapeditor-dialog--image input').first().inputValue();
check('the uploaded file fills the URL field', /^assets\/e2e-uploads\/foto-1-[a-z0-9]+\.png$/.test(field), field);
await page.locator('.tiptapeditor-dialog--image').getByLabel('Alternative text (alt)', { exact: true }).fill('Uploaded photo');
await page.click('.tiptapeditor-dialog--image .tiptapeditor-dialog__button--primary');
let list = await images();
const uploaded = list[0]?.src || '';
const files = existsSync(`${site}/${UPLOADS}`) ? readdirSync(`${site}/${UPLOADS}`) : [];
check('uploaded into upload_path with a safe name', /^assets\/e2e-uploads\/foto-1-[a-z0-9]+\.png$/.test(uploaded) && files.includes(uploaded.split('/').pop()), JSON.stringify({ list, files }));
check('alt from the dialog is applied', list[0]?.alt === 'Uploaded photo', JSON.stringify(list));
await save();
let content = db(resources.assist).content;
check('saved with the file URL, never base64', content.includes(`src="${uploaded}" alt="Uploaded photo"`) && !content.includes('data:image'), content);

// 2. Copy by link: the server refuses internal addresses (the test site itself is on 127.0.0.1).
await page.locator(`${pm} p`).last().click();
await page.keyboard.press('End');
await button('image').click();
await page.locator('.tiptapeditor-dialog--image input').first().fill(`${base}/assets/e2e/img/pic.png`);
await dialogButton('Copy to site').click();
await page.waitForFunction(() => document.querySelector('.tiptapeditor-dialog--image .tiptapeditor-dialog__error')?.textContent, null, { timeout: 20000 }).catch(() => {});
let refused = await imageDialogError();
check('copy by link: an internal address is refused by the server', /only public web sites/.test(refused), refused);
await page.locator('.tiptapeditor-dialog--image input').first().fill('not a url');
await dialogButton('Copy to site').click();
check('copy by link: a malformed address is refused in the dialog', /http:\/\/ or https:/.test(await imageDialogError()));
await page.click('.tiptapeditor-dialog--image .tiptapeditor-dialog__button:has-text("Cancel")');
check('nothing inserted by a refused import', (await images()).length === 1);

// 3. Gallery dialog: the same link row, refused the same way.
await button('gallery').click();
await page.locator('.tiptapeditor-dialog--gallery input[type="url"]').fill(`${base}/assets/e2e/img/pic.png`);
await page.locator('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__button', { hasText: 'Copy to site' }).click();
await page.waitForFunction(() => document.querySelector('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__error')?.textContent, null, { timeout: 20000 }).catch(() => {});
refused = await page.locator('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__error').textContent().catch(() => '');
check('gallery: copy by link refuses an internal address', /only public web sites/.test(refused), refused);
check('gallery: nothing added to the list', await page.locator('.tiptapeditor-gallery-list__item').count() === 0);
await page.click('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__button:has-text("Cancel")');

// 4. Uploads off: the dialog keeps only the Media Browser; the gallery adds links as they are.
settings('tiptapeditor.upload_enabled', '0');
await open(resources.assist);
await button('image').click();
check('without upload_enabled the dialog has no upload or copy buttons',
    await dialogButton('Upload from computer…').count() === 0 && await dialogButton('Copy to site').count() === 0 && await dialogButton('Choose in Media Browser…').count() === 1);
await page.click('.tiptapeditor-dialog--image .tiptapeditor-dialog__button:has-text("Cancel")');
await button('gallery').click();
await page.locator('.tiptapeditor-dialog--gallery input[type="url"]').fill('https://example.com/a.jpg');
await page.locator('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__button', { hasText: /^Add$/ }).click();
check('gallery: without uploads a link is added as it is', await page.locator('.tiptapeditor-gallery-list__name').first().textContent() === 'a.jpg');
await page.click('.tiptapeditor-dialog--gallery .tiptapeditor-dialog__button:has-text("Cancel")');

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
settings('tiptapeditor.upload_enabled', '0', 'tiptapeditor.upload_path', 'assets/uploads/');
rmSync(`${site}/${UPLOADS}`, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
