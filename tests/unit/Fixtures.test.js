import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorManager } from '../../assets-src/js/editor/EditorManager.js';
import { findLosses } from '../../assets-src/js/syntax/LossDetector.js';
import { serialize } from '../../assets-src/js/syntax/serialize.js';
import { findTokens } from '../../assets-src/js/syntax/tokenizer.js';
import { createLogger } from '../../assets-src/js/utils/logger.js';

// Acceptance fixtures (tests/fixtures/*.html): input -> parse -> editor document -> serialize.
const dir = join(dirname(__filename), '../fixtures/');
const fixtures = readdirSync(dir).filter((name) => name.endsWith('.html')).sort();
const count = (list) => list.reduce((map, raw) => map.set(raw, (map.get(raw) || 0) + 1), new Map());
// Whitespace between blocks (and at the start and end of a block) is not kept once the
// content is edited; inside text it is.
const BLOCK_TAG = /\s*(<\/?(?:p|h[1-6]|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|div|blockquote|pre|hr|style|script|figure|figcaption|section|article|aside|nav|header|footer|video|audio|iframe|form|details|summary)\b[^>]*>|<!--[\s\S]*?-->)\s*/g;
// A bare "&" in text is written as "&amp;" (the same HTML); in MODX/Fenom tokens it stays.
const AMP = /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g;
// Boolean attributes are written as name="" (the same HTML).
const collapse = (html) => html.replace(/(\s[\w:-]+)(?=[\s>])(?!=)/g, '$1=""').replace(/=""=""/g, '=""').replace(/\s+/g, ' ').replace(BLOCK_TAG, '$1')
    .replace(/(\]\]|\}) (?=\[\[|\{|<)/g, '$1').replace(/> (?=\[\[|\{)/g, '>').trim();

describe.each(fixtures)('%s', (name) => {
    const input = readFileSync(dir + name, 'utf8').trim();
    let manager;
    const load = (html) => {
        document.body.innerHTML = '<textarea id="ta"></textarea>';
        document.getElementById('ta').value = html;
        manager?.destroyAll();
        manager = new EditorManager(createLogger(false));
        manager.configure({ toolbar: 'bold' });
        return manager.create('ta');
    };
    afterEach(() => manager?.destroyAll());

    it('opens in the editor and keeps everything', () => {
        const instance = load(input);
        expect(instance).not.toBeNull();
        const output = serialize(instance.editor);
        // Semantic equivalence: same elements, attributes, comments and text.
        expect(findLosses(input, output)).toEqual([]);
        expect(findLosses(output, input)).toEqual([]);
        // MODX/Fenom constructs literally, as many times as in the input.
        expect(count(findTokens(output).map((t) => t.raw))).toEqual(count(findTokens(input).map((t) => t.raw)));
        // Apart from whitespace between blocks, nothing changed.
        let escaped = '';
        let last = 0;
        for (const token of findTokens(input)) {
            escaped += input.slice(last, token.start).replace(AMP, '&amp;') + token.raw;
            last = token.end;
        }
        escaped += input.slice(last).replace(AMP, '&amp;');
        expect(collapse(output)).toBe(collapse(escaped));
    });

    it('is stable: loading the output gives the same output', () => {
        const once = serialize(load(input).editor);
        expect(serialize(load(once).editor)).toBe(once);
    });

    it('typing in one paragraph changes only that paragraph', () => {
        const instance = load(input);
        const before = serialize(instance.editor);
        let target = null;
        instance.editor.state.doc.descendants((node, pos) => {
            if (target === null && node.type.name === 'paragraph' && node.firstChild?.isText) {
                target = pos + 1;
            }
        });
        if (target === null) {
            return;
        }
        instance.editor.chain().setTextSelection(target).insertContent('Ж').run();
        const after = serialize(instance.editor);
        expect(after.replace('Ж', '')).toBe(before);
    });
});
