// Stage 12 check: profiles, external config, content CSS and class presets in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/config.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const site = process.env.M;
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const asSubmitted = (value) => value.replace(/\r?\n/g, '\r\n');

// Test files: external config in core/config/, site CSS in assets/e2e/, a config outside the site.
mkdirSync(`${site}/assets/e2e/css`, { recursive: true });
writeFileSync(`${site}/assets/e2e/css/content.css`, [
    'body { background: rgb(250, 240, 230); }',
    'p { color: rgb(1, 2, 3); }',
    '.lead { font-size: 21px; }',
    '@media (min-width: 1px) { h2 { color: rgb(4, 5, 6); } }',
    'button { color: rgb(7, 8, 9); }',
    '.box { background: url(img/x.png); }',
].join('\n'));
writeFileSync(`${site}/core/config/tiptapeditor-e2e.json`, JSON.stringify({
    editorProps: { attributes: { spellcheck: 'false', onclick: 'alert(1)' } },
    extensions: { highlight: false },
    profiles: { simple: { toolbar: ['bold', 'italic'] } },
    debug: true,
}));
writeFileSync('/tmp/tiptapeditor-outside.json', JSON.stringify({ toolbar: 'bold' }));

const settings = (...pairs) => php('./set-system-settings.php', ...pairs);
settings('which_editor', 'TipTapEditor', 'use_editor', '1',
    'tiptapeditor.toolbar', 'undo redo | paragraphClass bold italic highlight | source',
    'tiptapeditor.profiles', JSON.stringify({ article: { toolbar: 'paragraphClass bold italic underline link | source', minHeight: 240 } }),
    'tiptapeditor.content_profile', 'article',
    'tiptapeditor.tv_profiles', 'rt_one=simple',
    'tiptapeditor.external_config', '{core_path}config/tiptapeditor-e2e.json',
    'tiptapeditor.content_css', '{assets_url}e2e/css/content.css',
    'tiptapeditor.paragraph_classes', '{"lead": "Lead", "note": "Note"}');
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
const items = (selector) => page.locator(`${selector} .tiptapeditor__toolbar:not(.tiptapeditor__toolbar--table) [data-tiptapeditor-item]`)
    .evaluateAll((els) => els.map((el) => el.dataset.tiptapeditorItem));

// 1. Content field: content profile; external config applied; site CSS scoped to the editor.
await open(`/manager/?a=resource/update&id=${resources.article}`);
check('content field uses the content profile', JSON.stringify(await items(editorSel)) === JSON.stringify(['paragraphClass', 'bold', 'italic', 'underline', 'link', 'source']),
    JSON.stringify(await items(editorSel)));
check('profile height applied', await page.locator(`${editorSel} .tiptapeditor__content`).evaluate((el) => el.style.minHeight === '240px'));
const attrs = await page.locator(`${editorSel} .ProseMirror`).evaluate((el) => ({ spellcheck: el.getAttribute('spellcheck'), onclick: el.getAttribute('onclick') }));
check('external config: safe editor attributes only', attrs.spellcheck === 'false' && attrs.onclick === null, JSON.stringify(attrs));
check('external config: unknown keys ignored (debug stays off)', await page.evaluate(() => window.TipTapEditor.config.debug === false));
await page.waitForFunction(() => document.querySelector('style[data-tiptapeditor-css]'));
const css = await page.evaluate(() => {
    const pm = document.querySelector('[data-tiptapeditor-for="ta"] .ProseMirror');
    const style = (el, prop) => el && getComputedStyle(el)[prop];
    const css = document.querySelector('style[data-tiptapeditor-css]').textContent;
    return {
        editorBackground: style(pm, 'backgroundColor'),
        paragraph: style(pm.querySelector('p'), 'color'),
        lead: style(pm.querySelector('p.lead'), 'fontSize'),
        heading: style(pm.querySelector('h2'), 'color'),
        managerBody: style(document.body, 'backgroundColor'),
        managerButton: style(document.querySelector('#modx-abtn-save'), 'color'),
        managerParagraph: [...document.querySelectorAll('p')].filter((p) => !p.closest('.ProseMirror')).map((p) => style(p, 'color')).includes('rgb(1, 2, 3)'),
        absoluteUrl: css.includes('/assets/e2e/css/img/x.png'),
    };
});
check('content CSS styles the editing area', css.editorBackground === 'rgb(250, 240, 230)' && css.paragraph === 'rgb(1, 2, 3)'
    && css.lead === '21px' && css.heading === 'rgb(4, 5, 6)', JSON.stringify(css));
check('content CSS does not touch the manager', css.managerBody !== 'rgb(250, 240, 230)' && css.managerButton !== 'rgb(7, 8, 9)' && !css.managerParagraph,
    JSON.stringify(css));
check('content CSS urls resolved against the stylesheet', css.absoluteUrl);

// 2. Paragraph class presets.
check('p.lead opens as an editable paragraph', await page.locator(`${editorSel} .ProseMirror p.lead`).count() === 1
    && await page.locator(`${editorSel} .tiptapeditor__raw`).count() === 0);
await page.locator(`${editorSel} .ProseMirror h1`).click();
await page.locator(`${editorSel} [data-tiptapeditor-item="paragraphClass"]`).click();
await page.locator('.tiptapeditor__menu-item', { hasText: 'Note' }).click();
await save();
const article = db(resources.article).content;
check('class preset saved on the heading', /<h1 id="top" class="note">Article title<\/h1>/.test(article), article.slice(0, 200));
check('rest of the article kept', ['<p class="lead">A lead paragraph', '<h2 id="section-1">Section</h2>', 'href="[[~12]]#comments"']
    .every((part) => article.includes(part)), article);

// 3. A TV with its own profile from the external config; highlight switched off there.
await open(`/manager/?a=resource/update&id=${resources.plain}`);
await page.click('#modx-resource-tabs__modx-panel-resource-tv, li[id$="modx-panel-resource-tv"], a:has-text("Template Variables")').catch(() => {});
await page.waitForTimeout(500);
const tvItems = await page.evaluate(() => [...document.querySelectorAll('.tiptapeditor[data-tiptapeditor-for^="tv"]')].map((root) => ({
    name: window.TipTapEditor.getInstance(root.dataset.tiptapeditorFor)?.field?.name,
    items: [...root.querySelectorAll('.tiptapeditor__toolbar:not(.tiptapeditor__toolbar--table) [data-tiptapeditor-item]')].map((el) => el.dataset.tiptapeditorItem),
})));
const one = tvItems.find((tv) => tv.name === 'rt_one');
const two = tvItems.find((tv) => tv.name === 'rt_two');
check('TV with a profile from tv_profiles', JSON.stringify(one?.items) === JSON.stringify(['bold', 'italic']), JSON.stringify(tvItems));
check('other TV: default toolbar without the switched-off highlight', two && !two.items.includes('highlight') && two.items.includes('paragraphClass'), JSON.stringify(tvItems));

// 4. External config outside core_path/base_path is not read.
settings('tiptapeditor.external_config', '/tmp/tiptapeditor-outside.json');
await open(`/manager/?a=resource/update&id=${resources.plain}`);
check('external config outside the site is ignored', (await items(editorSel)).includes('underline'), JSON.stringify(await items(editorSel)));

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
settings('tiptapeditor.profiles', '', 'tiptapeditor.content_profile', '', 'tiptapeditor.tv_profiles', '', 'tiptapeditor.external_config', '',
    'tiptapeditor.content_css', '', 'tiptapeditor.paragraph_classes', '');
rmSync(`${site}/core/config/tiptapeditor-e2e.json`, { force: true });
rmSync('/tmp/tiptapeditor-outside.json', { force: true });
process.exit(failed ? 1 : 0);
