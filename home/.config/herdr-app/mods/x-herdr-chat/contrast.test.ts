import { describe, expect, test } from 'vitest';

import {
    contrastRatio,
    readableBackground,
    readableTheme,
} from './contrast.js';

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

describe('the chat reads its theme through a readable background (FRM-659 wisp: lost in the swap)', () => {
    test('a terminal painted in the text colour hands the chat the canvas', () => {
        const win98 = {
            background: '#000000',
            canvas: '#c0c0c0',
            foreground: '#000000',
            surface: '#ffffff',
        };
        expect(readableTheme(win98).background).toBe('#c0c0c0');
    });

    test('a readable theme keeps its own background', () => {
        const dark = {
            background: '#121212',
            canvas: '#000000',
            foreground: '#e0e0e0',
            surface: '#1e1e1e',
        };
        expect(readableTheme(dark)).toEqual(dark);
    });
});
