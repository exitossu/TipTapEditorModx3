// Stage 8 check: image dialog, image menu and attribute preservation in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/images.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

php('./set-system-settings.php', 'which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.media_url_mode', 'relative',
    'tiptapeditor.toolbar', 'undo redo | bold italic | image file', 'tiptapeditor.image_classes', '{"article-image":"Article"}');
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
page.on('dialog', (d) => { errors.push(`browser dialog: ${d.message()}`); d.dismiss(); });
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
const html = () => page.evaluate(() => window.TipTapEditor.getInstance('ta')?.editor.getHTML() || '');
const dialog = page.locator('.tiptapeditor-dialog');
const field = (label) => dialog.getByLabel(label, { exact: true });
const menu = page.locator('.tiptapeditor__image-menu');
const image = page.locator('[data-tiptapeditor-for="ta"] .ProseMirror img');
const browserWindow = page.locator('.x-window.modx-browser:visible').last();
const pick = async (file) => {
    await browserWindow.waitFor({ timeout: 5000 });
    for (const folder of ['assets', 'e2e', 'img']) {
        await browserWindow.locator('.x-tree-node-anchor', { hasText: new RegExp(`^${folder}$`) }).first().click();
        await page.waitForTimeout(600);
    }
    const thumb = browserWindow.locator(`.modx-browser-thumb-wrap[title="${file}"]`);
    await thumb.waitFor({ timeout: 5000 });
    await thumb.dblclick();
    await page.waitForTimeout(400);
};
const selectImage = async (index = 0) => {
    await image.nth(index).click();
    await page.waitForTimeout(200);
};

// 1. Every attribute of an existing image survives loading and saving.
await open(`/manager/?a=resource/update&id=${resources.images}`);
const mounted = await page.evaluate(() => Boolean(window.TipTapEditor.getInstance('ta')));
check('content with a fully attributed image opens in the editor', mounted);
let content = await html();
for (const part of ['alt="Pic"', 'title="T"', 'width="40"', 'height="30"', 'class="lead align-left"', 'id="pic"',
    'data-fancybox="gallery"', 'loading="lazy"', 'srcset="assets/e2e/img/pic2.png 2x"', 'style="border: 0']) {
    check(`attribute kept: ${part}`, content.includes(part), content);
}
const shown = await image.first().evaluate((img) => ({ src: img.getAttribute('src'), srcset: img.hasAttribute('srcset'), loaded: img.complete && img.naturalWidth > 0 }));
check('editor shows the image from the site, without srcset', shown.src === '/assets/e2e/img/pic.png' && !shown.srcset && shown.loaded, JSON.stringify(shown));
await save();
check('save without edits keeps the image byte for byte', db(resources.images).content === asSubmitted(fixtures.images), db(resources.images).content);

// 2. The image menu appears for a selected image; Edit opens the dialog with its values.
await selectImage();
check('image menu shows over the selected image', await menu.isVisible());
check('menu has Edit, Replace and Remove', await menu.locator('button:visible').count() === 3);
await menu.locator('[data-tiptapeditor-image-action="edit"]').click();
await dialog.waitFor({ timeout: 3000 });
const values = {
    alt: await field('Alternative text (alt)').inputValue(),
    width: await field('Width').inputValue(),
    align: await field('Alignment').inputValue(),
    other: await field('Other CSS classes').inputValue(),
};
check('dialog is filled from the image', values.alt === 'Pic' && values.width === '40' && values.align === 'left' && values.other === 'lead', JSON.stringify(values));

// 3. Edit alt, size, alignment and style; the rest stays.
await field('Alternative text (alt)').fill('Picture');
await field('Width').fill('120');
await field('Height').fill('90');
await field('Alignment').selectOption('right');
await field('Style').selectOption('article-image');
await dialog.getByRole('button', { name: 'Save', exact: true }).click();
content = await html();
check('dialog changes applied', content.includes('alt="Picture"') && content.includes('width="120"') && content.includes('height="90"')
    && content.includes('class="lead article-image align-right"'), content);
check('other attributes untouched by the dialog', ['id="pic"', 'data-fancybox="gallery"', 'loading="lazy"', 'srcset="assets/e2e/img/pic2.png 2x"', 'title="T"']
    .every((part) => content.includes(part)), content);
const displayed = await image.first().evaluate((img) => getComputedStyle(img).float);
check('alignment class shows in the editor', displayed === 'right', displayed);
await save();
check('edited image saved', db(resources.images).content.includes('class="lead article-image align-right"') && db(resources.images).content.includes('data-fancybox="gallery"'), db(resources.images).content);

// 4. Invalid input is refused in the dialog.
await image.first().dblclick();
await dialog.waitFor({ timeout: 3000 });
await field('Width').fill('12px');
await dialog.getByRole('button', { name: 'Save', exact: true }).click();
check('invalid size is refused', await dialog.isVisible() && (await dialog.locator('[role="alert"]').textContent()).length > 0);
await field('Width').fill('120');
await field('Image URL').fill('javascript:alert(1)');
await dialog.getByRole('button', { name: 'Save', exact: true }).click();
check('unsafe URL is refused', await dialog.isVisible());
await page.keyboard.press('Escape');
check('Escape closes the dialog without changes', !(await dialog.isVisible()) && (await html()) === content);

// 5. Remove from the menu, then undo.
await selectImage();
await menu.locator('[data-tiptapeditor-image-action="remove"]').click();
check('Remove deletes the image', !(await html()).includes('<img'));
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
check('undo brings it back', (await html()) === content);

// 6. The image button opens the dialog; the Media Browser fills its URL, natural size is offered.
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror p');
await page.keyboard.press('End');
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="image"]');
await dialog.waitFor({ timeout: 3000 });
check('the image button opens the image dialog', await dialog.locator('h2').textContent() === 'Insert image');
await dialog.getByRole('button', { name: 'Choose in Media Browser…' }).click();
await pick('pic2.png');
check('the picked file fills the URL field', await field('Image URL').inputValue() === 'assets/e2e/img/pic2.png');
const natural = dialog.getByRole('button', { name: /64 × 48/ });
await natural.waitFor({ timeout: 3000 }).catch(() => {});
check('natural size is offered', await natural.isVisible());
await natural.click().catch(() => {});
await field('Alternative text (alt)').fill('New picture');
await field('Alignment').selectOption('center');
await dialog.getByRole('button', { name: 'Save', exact: true }).click();
content = await html();
check('new image inserted with dialog values', content.includes('<img src="assets/e2e/img/pic2.png" alt="New picture" width="64" height="48" class="align-center">'), content);

// 7. Replace from the menu keeps everything but the file.
await selectImage(1);
await menu.locator('[data-tiptapeditor-image-action="replace"]').click();
await browserWindow.waitFor({ timeout: 5000 });
const openTo = await page.evaluate(() => window.Ext.WindowMgr.getActive()?.config?.openTo);
check('replace opens the folder of the current file', openTo === 'assets/e2e/img/', String(openTo));
const thumb = browserWindow.locator('.modx-browser-thumb-wrap[title="pic.png"]');
await thumb.waitFor({ timeout: 5000 });
await thumb.dblclick();
await page.waitForTimeout(400);
content = await html();
check('replace changes only src', content.includes('<img src="assets/e2e/img/pic.png" alt="New picture" width="64" height="48" class="align-center">'), content);
await save();
check('inserted image saved', db(resources.images).content.includes('alt="New picture"'), db(resources.images).content);

// 8. An image with an event handler is never loaded into the editor.
await open(`/manager/?a=resource/update&id=${resources.imagebad}`);
const bad = await page.evaluate(() => ({
    mounted: Boolean(window.TipTapEditor.getInstance('ta')),
    notice: document.querySelector('.tiptapeditor-notice')?.textContent || '',
    raw: document.querySelectorAll('[data-tiptapeditor-for="ta"] .tiptapeditor__raw').length,
    images: document.querySelectorAll('[data-tiptapeditor-for="ta"] .ProseMirror img').length,
}));
// Kept as a raw HTML block: shown as text, the handler never runs in the manager.
check('image with onerror is kept as a raw HTML block', bad.mounted && bad.raw === 1 && bad.images === 0, JSON.stringify(bad));
await save();
check('image with onerror saved unchanged', db(resources.imagebad).content === asSubmitted(fixtures.imagebad), db(resources.imagebad).content);

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
php('./set-system-settings.php', 'tiptapeditor.image_classes', '');
process.exit(failed ? 1 : 0);
