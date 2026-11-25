import { describe, expect, test } from 'vitest';

import {
    missingNote,
    openViewer,
    viewerAfter,
    viewerCount,
    viewerLevel,
    viewerTakesKeys,
} from './viewer.js';

const three = ['a', 'b', 'c'].map((n) => ({
    file: `/${n}.png`,
    h: 10,
    rel: `s/${n}.png`,
    w: 10,
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

describe('the open viewer takes the keyboard back only from the chat’s own seats', () => {
    const seats = {
        hasKeys: false,
        inQuill: false,
        isOpen: true,
        onList: false,
    };

    test('a click on the chat’s list, or the quill taking focus, hands the keyboard back', () => {
        expect(viewerTakesKeys({ ...seats, onList: true })).toBe(true);
        expect(viewerTakesKeys({ ...seats, inQuill: true })).toBe(true);
    });

    test('a click into another pane or mod (orbit’s steer, a terminal) keeps its focus', () => {
        expect(viewerTakesKeys(seats)).toBe(false);
    });

    test('the viewer already holding the keyboard asks for nothing', () => {
        expect(viewerTakesKeys({ ...seats, hasKeys: true, onList: true })).toBe(
            false,
        );
    });

    test('a closed viewer never takes it', () => {
        expect(viewerTakesKeys({ ...seats, isOpen: false, onList: true })).toBe(
            false,
        );
    });
});

test('a picture no longer on disk is named, with where it was', () => {
    expect(missingNote('/tmp/pad/a.png', false)).toBe(
        'a.png is no longer in /tmp/pad',
    );
    expect(missingNote('/a.png', false)).toBe('a.png is no longer in /');
});

test('a picture on disk that no reader opens is never called gone', () => {
    expect(missingNote('/tmp/a.png', true)).toBe('a.png cannot be read');
});
