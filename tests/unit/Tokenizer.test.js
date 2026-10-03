import { describe, expect, it } from 'vitest';
import { findTokens, parseFenomTags } from '../../assets-src/js/syntax/tokenizer.js';

const raws = (src, options) => findTokens(src, options).map((t) => t.raw);

describe('MODX tokens', () => {
    it.each([
        '[[*content]]', '[[++site_name]]', '[[~123]]', '[[$chunk]]', '[[%lexicon_key]]', '[[+placeholder]]',
        '[[-comment]]', '[[#12.pagetitle]]', '[[*pagetitle:default=`Untitled`]]',
        '[[!pdoResources?\n    &parents=`10`\n    &limit=`10`\n]]', '[[getImageList?\n    &tvname=`gallery`\n]]',
    ])('%s is one token', (tag) => {
        expect(raws(`a ${tag} b`)).toEqual([tag]);
    });

    it('counts nested tags', () => {
        const tag = '[[!pdoResources? &parents=`[[*id]]` &tpl=`@INLINE <a href="[[~[[+id]]]]">[[+pagetitle]]</a>`]]';
        expect(raws(`<p>${tag}</p>`)).toEqual([tag]);
    });

    it('keeps HTML and Fenom inside a MODX tag in the token', () => {
        const tag = '[[+x:is=`1`:then=`<b>{$y}</b>`]]';
        expect(raws(tag)).toEqual([tag]);
    });

    it('leaves an unclosed tag and single brackets as text', () => {
        expect(raws('[[*pagetitle')).toEqual([]);
        expect(raws('[1] [a]] ]] [x')).toEqual([]);
        expect(raws('[[a]] [[b')).toEqual(['[[a]]']);
    });

    it('can be switched off', () => {
        expect(raws('[[*id]] {$x}', { modx: false })).toEqual(['{$x}']);
    });
});

describe('Fenom tokens', () => {
    it.each([
        '{$pagetitle}', '{$resource.id}', '{$_modx->resource.id}', '{if $price}', '{elseif $a > 1}', '{else}', '{/if}',
        '{foreach $items as $item}', '{/foreach}', "{set $foo = 'bar'}", "{include 'chunkName'}", '{* comment {$x} *}',
        "{$_modx->runSnippet('pdoResources', [\n    'parents' => 10\n])}", "{'@INLINE {$x}' | chunk}", '{$a|default:"}"}',
        '{ignore}{$x} {if}{/ignore}', '{switch $x}', '{case 1}', '{break}',
    ])('%s is one token', (tag) => {
        expect(raws(`a ${tag} b`)).toEqual([tag]);
    });

    it('treats braces followed by a space, CSS and JSON as text', () => {
        expect(raws('a { b } .x{color:red} {"a": 1}x')).toEqual(['{"a": 1}']);
        expect(raws('.x{color:red} { $y }')).toEqual([]);
        expect(raws('{iffy} {foreachx} {setup}')).toEqual([]);
    });

    it('skips braces inside quoted strings', () => {
        const tag = "{$_modx->runSnippet('x', ['tpl' => '@INLINE {$a}}{'])}";
        expect(raws(tag)).toEqual([tag]);
    });

    it('accepts configured tag names', () => {
        expect(raws('{myTag 1} {other}', { fenomTags: 'myTag' })).toEqual(['{myTag 1}']);
        expect(parseFenomTags('a, b c, 1x, _ok')).toEqual(new Set(['a', '_ok']));
    });

    it('leaves unclosed tags as text and can be switched off', () => {
        expect(raws('{$x')).toEqual([]);
        expect(raws('{* open')).toEqual([]);
        expect(raws('{$x} [[*id]]', { fenom: false })).toEqual(['[[*id]]']);
    });
});
