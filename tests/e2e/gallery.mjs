// Figures with captions, "open larger" links and galleries in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/gallery.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

const settings = (...pairs) => php('./set-system-settings.php', ...pairs);
settings('which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.toolbar', 'bold | image gallery | source',
    'tiptapeditor.lightbox', '1', 'tiptapeditor.lightbox_attribute', 'data-fancybox', 'tiptapeditor.gallery_template', 'slider');
const { resources, fixtures } = JSON.parse(php('./fixtures-setup.php'));

let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details && !ok ? ` -> ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

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
const types = () => page.evaluate(() => {
    const names = [];
    window.TipTapEditor.getInstance('ta').editor.state.doc.descendants((node) => { names.push(node.type.name); });
    return names;
});
const dialog = page.locator('.tiptapeditor-dialog');
const field = (label) => dialog.getByLabel(label, { exact: true });
const browserWindow = page.locator('.x-window.modx-browser:visible').last();

// 1. The figure from the request: editable, saved byte for byte when not edited.
await open(resources.figure);
check('figure with link and caption opens as a figure, not an HTML block', JSON.stringify(await types()) === JSON.stringify(['paragraph', 'text', 'figure', 'figureImage', 'figcaption', 'text']), JSON.stringify(await types()));
check('the link is shown as "opens larger"', await page.locator(`${root} .tiptapeditor__figure-zoom`).isVisible());
await save();
check('unchanged figure saved exactly as written', db(resources.figure).content === asSubmitted(fixtures.figure), db(resources.figure).content);

// Caption edited in the text, then a new alt text in the dialog.
await page.locator(`${root} figcaption`).click();
await page.keyboard.press('End');
await page.keyboard.type(' (2024)');
await page.locator(`${root} .tiptapeditor__figure-image`).dblclick();
await field('Alternative text (alt)').fill('Poster');
await dialog.locator('.tiptapeditor-dialog__button--primary').click();
await save();
let content = db(resources.figure).content;
check('edited figure keeps its attributes and gets the new caption and alt',
    content.includes('<figure><a href="#" aria-label="Open image: Poster" data-fancybox=""><img src="assets/e2e/img/pic.png" alt="Poster" width="1024" height="576" srcset="https://media.ixbt.games/fit-in/320x/ixbt-data/1379953/media-5be047fe.gif 320w')
    && content.includes('loading="eager" fetchpriority="high" decoding="async"></a><figcaption>Источник изображения: Sony Pictures (2024)</figcaption></figure>'), content);

// 2. A gallery of two files picked together in the Media Browser.
await open(resources.gallery);
await page.locator(`${root} .ProseMirror p`).first().click({ position: { x: 3, y: 5 } });
await page.keyboard.press('End');
await page.locator(`${root} [data-tiptapeditor-item="gallery"]`).click();
check('the gallery dialog opens first', await dialog.locator('h2').textContent() === 'Insert gallery');
await dialog.locator('.tiptapeditor-dialog__button', { hasText: 'Add from Media Browser…' }).click();
await browserWindow.waitFor({ timeout: 5000 });
for (const folder of ['assets', 'e2e', 'img']) {
    await browserWindow.locator('.x-tree-node-anchor', { hasText: new RegExp(`^${folder}$`) }).first().click();
    await page.waitForTimeout(600);
}
await browserWindow.locator('.modx-browser-thumb-wrap[title="pic.png"]').click();
await browserWindow.locator('.modx-browser-thumb-wrap[title="pic2.png"]').click({ modifiers: ['Control'] });
await browserWindow.locator('button', { hasText: /^OK$/ }).click();
await page.locator('.tiptapeditor-gallery-list__item').nth(1).waitFor({ timeout: 5000 }).catch(() => {});
check('both selected files are in the gallery dialog', await page.locator('.tiptapeditor-gallery-list__item').count() === 2);
check('the template from tiptapeditor.gallery_template is preselected', await field('Template').inputValue() === 'slider');
check('"open larger" is on from tiptapeditor.lightbox', await field('Open larger on click').isChecked());
const rows = page.locator('.tiptapeditor-gallery-list__item');
await rows.nth(0).locator('input').nth(0).fill('First');
await rows.nth(0).locator('input').nth(1).fill('First caption');
await rows.nth(1).locator('[data-move="up"]').click();
await dialog.locator('.tiptapeditor-dialog__button--primary').click();
check('gallery card shows in the editor', /2 images/.test(await page.locator(`${root} .tiptapeditor__gallery-label`).textContent()));
await save();
content = db(resources.gallery).content;
const group = /data-fancybox="(gallery-[a-z0-9]+)"/.exec(content)?.[1] || '';
check('gallery saved with the slider template, order, captions and one lightbox group',
    content === '<p>Gallery below.</p><div class="swiper gallery-slider" data-tiptapeditor-gallery="slider"><div class="swiper-wrapper">'
    + `<div class="swiper-slide"><figure><a href="assets/e2e/img/pic2.png" data-fancybox="${group}" aria-label="Open image:"><img src="assets/e2e/img/pic2.png" alt=""></a></figure></div>`
    + `<div class="swiper-slide"><figure><a href="assets/e2e/img/pic.png" data-fancybox="${group}" aria-label="Open image: First"><img src="assets/e2e/img/pic.png" alt="First"></a><figcaption>First caption</figcaption></figure></div>`
    + '</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>', content);

// 3. Reopened: the same gallery, editable; switching the template rewrites the markup.
await open(resources.gallery);
check('saved gallery opens as a gallery again', (await types()).includes('gallery'));
await page.locator(`${root} .tiptapeditor__gallery`).dblclick();
check('gallery dialog lists the saved pictures', await page.locator('.tiptapeditor-gallery-list__item').count() === 2);
await field('Template').selectOption('grid');
await field('Open larger on click').uncheck();
await dialog.locator('.tiptapeditor-dialog__button--primary').click();
await save();
content = db(resources.gallery).content;
check('template switched to grid without links', content === '<p>Gallery below.</p><div class="gallery" data-tiptapeditor-gallery="grid">'
    + '<figure class="gallery__item"><img src="assets/e2e/img/pic2.png" alt=""></figure>'
    + '<figure class="gallery__item"><img src="assets/e2e/img/pic.png" alt="First"><figcaption>First caption</figcaption></figure></div>', content);
check('no gallery image is loaded from the manager directory', !errors.some((e) => /404/.test(e)));

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
settings('tiptapeditor.lightbox', '0', 'tiptapeditor.lightbox_attribute', '', 'tiptapeditor.gallery_template', 'grid');
process.exit(failed ? 1 : 0);
