import { describe, expect, test } from 'vitest';

import { contrastRatio, readableBackground } from './contrast.js';

describe('contrastRatio', () => {
    test('black on white is 21, a colour on itself is 1', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
        expect(contrastRatio('#21252b', '#21252b')).toBeCloseTo(1, 5);
    });

    test('a colour that is not a 6-digit hex has no ratio', () => {
        expect(contrastRatio('red', '#ffffff')).toBeNull();
        expect(contrastRatio('#fff', '#000000')).toBeNull();
    });
});

describe('readableBackground', () => {
    test('a background his text reads on is kept', () => {
        expect(readableBackground('#ffffff', '#1b1b1e', ['#fafaf9'])).toBe(
            '#ffffff',
        );
        expect(readableBackground('#21252b', '#eeeeef', ['#1c1f24'])).toBe(
            '#21252b',
        );
    });

    test('win98 paints the terminal black under black text: the first readable fallback takes over', () => {
        expect(
            readableBackground('#000000', '#000000', ['#000000', '#fafaf9']),
        ).toBe('#fafaf9');
    });

    test('a colour it cannot measure is kept as it is', () => {
        expect(readableBackground('#000000aa', '#000000', ['#fafaf9'])).toBe(
            '#000000aa',
        );
    });
});
