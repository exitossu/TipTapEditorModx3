// Stage 7 check: link dialog and MODX resource links in a real MODX 3 manager.
//   M=/path/to/site MODX_URL=... MODX_USER=... MODX_PASS=... node tests/e2e/links.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const php = (script, ...args) => execFileSync('php', [fileURLToPath(new URL(script, import.meta.url)), ...args], { env: process.env }).toString();
const db = (id) => JSON.parse(php('./read-resource.php', String(id)));
const settings = (...pairs) => php('./set-system-settings.php', ...pairs);

settings('which_editor', 'TipTapEditor', 'use_editor', '1', 'tiptapeditor.toolbar', 'undo redo | heading | bold italic | link modxLink anchor | image file',
    'tiptapeditor.links_across_contexts', '0', 'tiptapeditor.resource_link_format', '[[~{id}]]', 'tiptapeditor.link_classes', '{"button":"Button"}');
const { resources } = JSON.parse(php('./fixtures-setup.php'));

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
const html = (page) => page.evaluate(() => window.TipTapEditor.getInstance('ta')?.editor.getHTML() || '');
const search = (page, query) => page.evaluate(async (q) => {
    const { config } = window.TipTapEditor.getInstance('ta');
    const body = new URLSearchParams({ action: 'TipTapEditor\\Processors\\Resource\\Search', query: q, context: config.resource.context, HTTP_MODAUTH: window.MODx.siteId });
    const response = await fetch(config.connectorUrl, { method: 'POST', body, headers: { modAuth: window.MODx.siteId } });
    return response.json();
}, query);
const selectText = (page, text) => page.evaluate((needle) => {
    const { editor } = window.TipTapEditor.getInstance('ta');
    let range = null;
    editor.state.doc.descendants((node, pos) => {
        if (!range && node.isText && node.text.includes(needle)) {
            const from = pos + node.text.indexOf(needle);
            range = { from, to: from + needle.length };
        }
    });
    editor.chain().focus().setTextSelection(range).run();
}, text);
const dialog = (page) => page.locator('.tiptapeditor-dialog [role="dialog"]');
const field = (page, label) => dialog(page).getByLabel(label, { exact: true });

const page = await login(process.env.MODX_USER || 'admin', process.env.MODX_PASS || '');
await open(page, `/manager/?a=resource/update&id=${resources.plain}`);

// 1. MODX resource via search -> [[~id]].
await selectText(page, 'world');
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="modxLink"]');
await dialog(page).waitFor();
check('modxLink opens the dialog on the resource search', await page.evaluate(() => document.activeElement?.type === 'search'));
await page.keyboard.type('E2E mod');
await dialog(page).locator('[role="option"]').first().waitFor({ timeout: 5000 });
const options = await dialog(page).locator('[role="option"]').allTextContents();
check('search finds the resource by title', options.some((o) => o.startsWith('E2E modx')), options.join(' | '));
await page.keyboard.press('Enter');
check('picking a resource fills [[~id]]', await field(page, 'URL').inputValue() === `[[~${resources.modx}]]`);
await dialog(page).getByRole('button', { name: 'Save' }).click();
let content = await html(page);
check('resource link inserted without target/rel', content.includes(`<a href="[[~${resources.modx}]]"><strong>world</strong></a>`), content);
await save(page);
check('resource link saved literally', db(resources.plain).content.includes(`<a href="[[~${resources.modx}]]"><strong>world</strong></a>`), db(resources.plain).content);

// 2. Reopen: the editor still loads content with a resource link; editing shows the resource.
await open(page, `/manager/?a=resource/update&id=${resources.plain}`);
const mounted = await page.evaluate(() => Boolean(window.TipTapEditor.getInstance('ta')));
check('content with [[~id]] links opens in the editor', mounted);
const beforeSave = db(resources.plain).content;
await save(page);
check('save without edits keeps the content byte for byte', db(resources.plain).content === beforeSave, db(resources.plain).content);
await page.click('[data-tiptapeditor-for="ta"] .ProseMirror a');
await page.waitForTimeout(200); // ProseMirror reads the new DOM selection asynchronously
await page.keyboard.press('Control+k');
await dialog(page).waitFor();
await page.waitForTimeout(600);
const info = await dialog(page).locator('.tiptapeditor-dialog__resource').textContent();
check('editing shows which resource is linked', info.includes('E2E modx') && info.includes(`ID ${resources.modx}`), info);
await field(page, 'Open in').selectOption('_blank');
check('new window fills a safe rel', await field(page, 'Rel').inputValue() === 'noopener noreferrer');
await field(page, 'CSS class').selectOption('button');
await field(page, 'Title').fill('Read more');
await dialog(page).getByRole('button', { name: 'Save' }).click();
content = await html(page);
check('link attributes updated', content.includes(`<a target="_blank" rel="noopener noreferrer" class="button" href="[[~${resources.modx}]]" title="Read more"><strong>world</strong></a>`), content);

// 3. Anchors and plain URLs.
await page.evaluate(() => {
    const { editor } = window.TipTapEditor.getInstance('ta');
    editor.chain().focus().setTextSelection(2).run();
});
await page.click('[data-tiptapeditor-for="ta"] [data-tiptapeditor-item="anchor"]');
await field(page, 'Anchor name (id)').fill('intro');
await page.keyboard.press('Enter');
await selectText(page, 'two');
await page.keyboard.press('Control+k');
await dialog(page).locator('select[aria-label="Anchor in this text…"]').selectOption('#intro');
await page.keyboard.press('Enter');
content = await html(page);
check('heading anchor and #anchor link', content.includes('<h2 id="intro">') && content.includes('<a href="#intro">two</a>'), content);
await selectText(page, 'one');
await page.keyboard.press('Control+k');
await field(page, 'URL').fill('javascript:alert(1)');
await page.keyboard.press('Enter');
check('javascript: URL is refused', (await dialog(page).locator('[role="alert"]').textContent()).length > 0 && !(await html(page)).includes('javascript'));
await page.keyboard.press('Escape');
check('Escape closes the dialog and returns focus to the editor', await dialog(page).count() === 0
    && await page.evaluate(() => document.activeElement?.closest('.ProseMirror') !== null));
await save(page);
check('anchors saved', db(resources.plain).content.includes('<a href="#intro">two</a>'), db(resources.plain).content);

// 4. Search respects ACL and contexts.
let result = await search(page, 'E2E secret');
check('admin finds a resource of a protected group', result.results?.some((r) => r.id === resources.secret), JSON.stringify(result));
result = await search(page, 'E2E other');
check('other contexts are not searched by default', result.success && !result.results.some((r) => r.id === resources.other), JSON.stringify(result));
settings('tiptapeditor.links_across_contexts', '1');
result = await search(page, 'E2E other');
check('links_across_contexts searches other contexts', result.results?.some((r) => r.id === resources.other && r.context_key === 'e2eother'), JSON.stringify(result));
settings('tiptapeditor.links_across_contexts', '0');
result = await search(page, String(resources.modx));
check('search by ID puts that resource first', result.results?.[0]?.id === resources.modx, JSON.stringify(result));
result = await search(page, 'E');
check('one-letter queries return nothing', result.success && result.results.length === 0, JSON.stringify(result));

const editorPage = await login('e2e_editor', 'editor12345');
await open(editorPage, `/manager/?a=resource/update&id=${resources.plain}`);
result = await search(editorPage, 'E2E secret');
check('a user outside the resource group does not find it', result.success && !result.results.some((r) => r.id === resources.secret), JSON.stringify(result));
result = await search(editorPage, 'E2E plain');
check('the same user finds resources they may see', result.results?.some((r) => r.id === resources.plain), JSON.stringify(result));

const anonymous = await browser.newPage();
await anonymous.goto(`${base}/manager/`);
const anonymousResult = await anonymous.evaluate(async (url) => {
    const response = await fetch(url, { method: 'POST', body: new URLSearchParams({ action: 'TipTapEditor\\Processors\\Resource\\Search', query: 'E2E' }) });
    return { status: response.status, text: (await response.text()).slice(0, 200) };
}, `${base}/assets/components/tiptapeditor/connector.php`);
check('connector refuses requests without a manager session', !anonymousResult.text.includes('"success":true'), JSON.stringify(anonymousResult));

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
