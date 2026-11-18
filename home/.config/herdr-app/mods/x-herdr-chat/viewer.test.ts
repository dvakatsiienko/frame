import { describe, expect, test } from 'vitest';

import { openViewer, viewerAfter, viewerCount, viewerLevel } from './viewer.js';

const three = ['a', 'b', 'c'].map((n) => ({
    file: `/${n}.png`,
    rel: `s/${n}.png`,
}));

describe('the picture viewer steps through a message’s pictures (FRM-638 slice 5)', () => {
    test('opens on the picture clicked, fit, counted among its siblings', () => {
        const state = openViewer(three, 1);
        expect(state?.at).toBe(1);
        expect(state && viewerLevel(state)).toBe('100%');
        expect(state && viewerCount(state)).toBe('2 / 3');
    });

    test('a single picture shows no count', () => {
        const state = openViewer(three.slice(0, 1), 0);
        expect(state && viewerCount(state)).toBe('');
    });

    test('a click past the list opens nothing', () => {
        expect(openViewer(three, 3)).toBeNull();
    });

    test('→ and ← move and stop at the ends, each move back at fit', () => {
        let state = openViewer(three, 0);
        state = viewerAfter(state, 'zoom in');
        state = viewerAfter(state, 'next');
        expect([state?.at, state?.zoom]).toEqual([1, 1]);
        state = viewerAfter(viewerAfter(state, 'next'), 'next');
        expect(state?.at).toBe(2);
        state = viewerAfter(
            viewerAfter(viewerAfter(state, 'previous'), 'previous'),
            'previous',
        );
        expect(state?.at).toBe(0);
    });

    test('zoom steps through its levels and stops at each end; fit goes back to 100%', () => {
        let state = openViewer(three, 0);
        for (let i = 0; i < 9; i++) state = viewerAfter(state, 'zoom in');
        expect(state && viewerLevel(state)).toBe('400%');
        for (let i = 0; i < 9; i++) state = viewerAfter(state, 'zoom out');
        expect(state && viewerLevel(state)).toBe('25%');
        expect(viewerAfter(state, 'fit')?.zoom).toBe(1);
    });

    test('close ends it', () => {
        expect(viewerAfter(openViewer(three, 0), 'close')).toBeNull();
    });
});
