import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_KEYS, DEFAULT_TOOLBAR, defaults } from '../../assets-src/js/editor/config.js';

// The system settings (core/components/tiptapeditor/src/Config/Settings.php) and the JS
// configuration must agree: same defaults for every setting passed to JS, and the same list of
// keys profiles and the external config may set (SettingParser::CONFIG_KEYS).
const root = join(__dirname, '../..');

function phpSettings() {
    try {
        const json = execFileSync('php', ['-r', `require '${join(root, 'core/components/tiptapeditor/src/Config/Settings.php')}'; echo json_encode(TipTapEditor\\Config\\Settings::all());`], { encoding: 'utf8' });
        return JSON.parse(json);
    } catch {
        return null;
    }
}

const settings = phpSettings();

describe('system settings and JS configuration', () => {
    it.skipIf(!settings)('every setting passed to JS has the same default as the bundle', () => {
        const passed = Object.entries(settings).filter(([, setting]) => setting.js);
        expect(passed.length).toBeGreaterThan(10);
        for (const [key, setting] of passed) {
            expect(Object.hasOwn(defaults, setting.js), `${key} -> ${setting.js}`).toBe(true);
            // An empty toolbar setting is the bundle's toolbar.
            const value = setting.js === 'toolbar' && setting.value === '' ? DEFAULT_TOOLBAR : setting.value;
            expect(value, key).toEqual(defaults[setting.js]);
        }
    });

    it.skipIf(!settings)('uses the documented areas', () => {
        const areas = new Set(Object.values(settings).map((setting) => setting.area));
        expect([...areas].sort()).toEqual(['tiptapeditor.content', 'tiptapeditor.main', 'tiptapeditor.modx', 'tiptapeditor.system', 'tiptapeditor.tuning']);
    });

    it('profiles and the external config accept the same keys in PHP and JS', () => {
        const source = readFileSync(join(root, 'core/components/tiptapeditor/src/Config/SettingParser.php'), 'utf8');
        const list = source.match(/CONFIG_KEYS = \[([\s\S]*?)\];/)[1];
        const php = [...list.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
        expect(php).toEqual([...CONFIG_KEYS]);
    });
});
