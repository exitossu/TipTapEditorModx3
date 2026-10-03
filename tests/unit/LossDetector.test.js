import { describe, expect, it } from 'vitest';
import { findLosses } from '../../assets-src/js/syntax/LossDetector.js';

describe('findLosses', () => {
    it('accepts identical and equivalent markup', () => {
        expect(findLosses('<p>a <b>b</b> <i>i</i></p>', '<p>a <strong>b</strong> <em>i</em></p>')).toEqual([]);
        expect(findLosses('<ul><li>a</li></ul>', '<ul><li><p>a</p></li></ul>')).toEqual([]);
        expect(findLosses('', '')).toEqual([]);
    });

    it('reports unsupported elements, attributes, comments and text', () => {
        expect(findLosses('<div class="box"><p>x</p></div>', '<p>x</p>')).toEqual(['<div> x1', 'div[class="box"] x1']);
        expect(findLosses('<p class="lead" data-x="1">x</p>', '<p>x</p>')).toEqual(['p[class="lead"] x1', 'p[data-x="1"] x1']);
        expect(findLosses('<p>x</p><!-- note -->', '<p>x</p>')).toEqual(['<!-- comment --> x1']);
        expect(findLosses('<p>a</p><script>b()</script>', '<p>a</p>')).toContain('text content');
    });

    it('compares styles as CSS, and reports declarations the browser would drop', () => {
        expect(findLosses('<p style="color:red">x</p>', '<p style="color: red;">x</p>')).toEqual([]);
        expect(findLosses('<p><img src="a" style="border: 0"></p>', '<p><img src="a" style="border: 0px;"></p>')).toEqual([]);
        expect(findLosses('<p style="color: red">x</p>', '<p style="color: blue;">x</p>')).not.toEqual([]);
        expect(findLosses('<p style="color: red; [[+c]]: 1">x</p>', '<p style="color: red;">x</p>')).not.toEqual([]);
    });
});
