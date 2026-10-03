import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Localization: every UI string exists in en and ru, the JS fallbacks match the lexicon,
// every t('key') used in the code has a string, and every system setting has a name and
// description in both languages.
const root = join(__dirname, '../..');
const lexicon = (lang, topic) => [...readFileSync(join(root, `core/components/tiptapeditor/lexicon/${lang}/${topic}.inc.php`), 'utf8')
    .matchAll(/\$_lang\['([^']+)'\]\s*=\s*'((?:[^'\\]|\\.)*)'/g)].reduce((map, m) => map.set(m[1], m[2]), new Map());
const files = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
});

describe('localization', () => {
    for (const topic of ['default', 'setting']) {
        it(`${topic}: en and ru have the same keys, none empty`, () => {
            const en = lexicon('en', topic);
            const ru = lexicon('ru', topic);
            expect([...ru.keys()].sort()).toEqual([...en.keys()].sort());
            for (const [key, value] of [...en, ...ru]) {
                expect(value.trim(), key).not.toBe('');
            }
        });
    }

    it('JS fallback strings are the English lexicon strings', async () => {
        const source = readFileSync(join(root, 'assets-src/js/utils/i18n.js'), 'utf8');
        const fallback = [...source.matchAll(/^ {4}([a-z0-9_]+): /gm)].map((m) => m[1]);
        const en = lexicon('en', 'default');
        for (const key of fallback) {
            expect(en.has(`tiptapeditor.${key}`), key).toBe(true);
        }
    });

    it('every t("key") in the code has a string', () => {
        const en = lexicon('en', 'default');
        const used = new Set();
        for (const file of files(join(root, 'assets-src/js')).filter((f) => f.endsWith('.js'))) {
            for (const m of readFileSync(file, 'utf8').matchAll(/\bt\('([a-z0-9_]+)'\)/g)) {
                used.add(m[1]);
            }
        }
        for (const key of used) {
            expect(en.has(`tiptapeditor.${key}`), key).toBe(true);
        }
    });

    it('every system setting has a name and a description in en and ru', () => {
        const settings = [...readFileSync(join(root, '_build/elements/settings.php'), 'utf8').matchAll(/^\s*'([a-z_]+)' => \[/gm)].map((m) => m[1]);
        expect(settings.length).toBeGreaterThan(30);
        for (const lang of ['en', 'ru']) {
            const strings = lexicon(lang, 'setting');
            for (const key of settings) {
                expect(strings.has(`setting_tiptapeditor.${key}`), `${lang} ${key}`).toBe(true);
                expect(strings.has(`setting_tiptapeditor.${key}_desc`), `${lang} ${key}_desc`).toBe(true);
            }
        }
    });
});
