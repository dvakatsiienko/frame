import { describe, expect, test } from 'vitest';

import { loopOf, nextStop } from './tab-loop.js';

// FRM-620 slice 5c: Tab walks one loop of stops our mods register, never herdr's hidden ones; a mod joins by
// publishing its stops (his 14:59: later the antenna's threads, the header's gear)
describe('the Tab loop', () => {
    const loop = ['quill', 'steer-a:o1', 'steer-b:o1'];

    test('Tab walks the loop and wraps from the last stop to the first', () => {
        expect(nextStop(loop, 'quill', false)).toBe('steer-a:o1');
        expect(nextStop(loop, 'steer-a:o1', false)).toBe('steer-b:o1');
        expect(nextStop(loop, 'steer-b:o1', false)).toBe('quill');
    });

    test('shift-Tab walks it backwards', () => {
        expect(nextStop(loop, 'quill', true)).toBe('steer-b:o1');
        expect(nextStop(loop, 'steer-a:o1', true)).toBe('quill');
    });

    test('a lone stop keeps the keyboard', () => {
        expect(nextStop(['quill'], 'quill', false)).toBe('quill');
    });

    test('a stop gone from the loop hands the keyboard to its first stop', () => {
        expect(nextStop(loop, 'steer-gone:o9', false)).toBe('quill');
    });

    test('the loop takes each mod’s stops in the mods’ order, a mod with none adding nothing', () => {
        const stops: Record<string, unknown> = {
            'tab.stops.x-herdr-chat': ['quill'],
            'tab.stops.x-herdr-deck': ['steer-a:o1'],
        };
        expect(loopOf((key) => stops[key])).toEqual(['quill', 'steer-a:o1']);
        expect(loopOf(() => 'garbage')).toEqual([]);
    });
});
