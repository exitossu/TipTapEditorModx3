// Stage 2 check against a running MODX 3 manager.
//   M=/path/to/site MODX_URL=http://127.0.0.1:8080 MODX_USER=admin MODX_PASS=... node tests/e2e/registration.mjs
// Requires Playwright with Chromium (PLAYWRIGHT_CHROMIUM=/path/to/chrome to override the executable).
// Run the PHP dev server with opcache disabled, otherwise settings changes show up late.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MODX_URL || 'http://127.0.0.1:8080';
const helper = fileURLToPath(new URL('./set-system-settings.php', import.meta.url));
const setEditor = (value) => execFileSync('php', [helper, 'which_editor', value, 'use_editor', '1'], { env: process.env });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

await page.goto(`${base}/manager/`);
await page.fill('#modx-login-username', process.env.MODX_USER || 'admin');
await page.fill('#modx-login-password', process.env.MODX_PASS || '');
await Promise.all([page.waitForNavigation(), page.click('#modx-login-btn')]);

const probe = async (path) => {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
    return page.evaluate(() => ({
        script: !!document.querySelector('script[src*="tiptapeditor/dist/tiptapeditor.js"]'),
        css: !!document.querySelector('link[href*="tiptapeditor/dist/tiptapeditor.css"]'),
        config: window.TipTapEditor?.config ?? null,
    }));
};

let failed = 0;
const check = (name, ok, details = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${details ? ` ${details}` : ''}`);
    failed += ok ? 0 : 1;
};

const siteId = await page.evaluate(() => window.MODx.siteId);
const list = await (await page.request.post(`${base}/connectors/index.php`, {
    form: { action: 'System/Rte/GetList', HTTP_MODAUTH: siteId },
})).json();
check('TipTapEditor is offered in which_editor', list.results.some((r) => r.value === 'TipTapEditor'));

setEditor('TipTapEditor');
let r = await probe('/manager/?a=resource/update&id=1');
check('update: bundle and css loaded', r.script && r.css);
check('update: elements from the event', JSON.stringify(r.config?.elements) === '["ta"]', JSON.stringify(r.config?.elements));
check('update: mode and resource', r.config?.mode === 'upd' && r.config?.resource?.id === 1);
r = await probe('/manager/?a=resource/create&parent=0&context_key=web');
check('create: bundle loaded, mode new', r.script && r.config?.mode === 'new');
r = await probe('/manager/?a=welcome');
check('dashboard: nothing loaded', !r.script && !r.css);

for (const other of ['TinyMCE RTE', '']) {
    setEditor(other);
    r = await probe('/manager/?a=resource/update&id=1');
    check(`which_editor="${other}": nothing loaded`, !r.script && !r.css && !r.config);
}

check('no page errors', errors.length === 0, errors.join('; '));
await browser.close();
process.exit(failed ? 1 : 0);
