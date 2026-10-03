import { describe, expect, it } from 'vitest';
import { icon } from '../../assets-src/js/ui/icons.js';

describe('icons', () => {
    it('sizes the root svg and keeps the sizes of its shapes', () => {
        const svg = icon('table');
        expect(svg.getAttribute('width')).toBe('18');
        expect(svg.getAttribute('class')).toBe('tiptapeditor__icon');
        const rect = svg.querySelector('rect');
        expect(rect.getAttribute('width')).toBe('18');
        expect(rect.getAttribute('height')).toBe('18');
        expect(icon('rowDelete').querySelector('rect').getAttribute('height')).toBe('7');
    });
});
