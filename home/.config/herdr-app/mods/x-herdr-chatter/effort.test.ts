import { describe, expect, test } from 'vitest';

import { effortKey, pickerLabel, slideEffort } from './effort.js';

describe('effortKey', () => {
    test('a first press opens the popover on the current level', () => {
        expect(effortKey(null, 'high', false)).toEqual({
            apply: null,
            popover: { at: 2, from: 2 },
        });
    });

    test('a second press closes it and applies the picked level', () => {
        expect(effortKey({ at: 3, from: 1 }, 'medium', false)).toEqual({
            apply: 'xhigh',
            popover: null,
        });
    });

    test('a second press on the current level closes it with nothing to apply', () => {
        expect(effortKey({ at: 1, from: 1 }, 'medium', false)).toEqual({
            apply: null,
            popover: null,
        });
    });

    test('a thread blocked on a question gets no popover', () => {
        expect(effortKey(null, 'medium', true)).toEqual({
            apply: null,
            popover: null,
        });
    });

    test('an unknown current level opens on medium', () => {
        expect(effortKey(null, null, false)).toEqual({
            apply: null,
            popover: { at: 1, from: 1 },
        });
    });

    test('an unknown level with the thumb never moved applies nothing', () => {
        const open = effortKey(null, null, false).popover;
        expect(effortKey(open, null, false).apply).toBeNull();
    });

    test('a thumb slid away and back applies nothing', () => {
        const open = effortKey(null, 'high', false).popover;
        const back = slideEffort(slideEffort(open, 'right'), 'left');
        expect(effortKey(back, 'high', false).apply).toBeNull();
    });
});

describe('slideEffort', () => {
    test('opened on medium, → → then the key applies the second stop right of medium', () => {
        const open = effortKey(null, 'medium', false).popover;
        const moved = slideEffort(slideEffort(open, 'right'), 'right');
        expect(effortKey(moved, 'medium', false)).toEqual({
            apply: 'xhigh',
            popover: null,
        });
    });

    test('the track stops at its ends, never wraps', () => {
        expect(slideEffort({ at: 4, from: 2 }, 'right')).toEqual({
            at: 4,
            from: 2,
        });
        expect(slideEffort({ at: 0, from: 2 }, 'left')).toEqual({
            at: 0,
            from: 2,
        });
    });
});

describe("the picker trigger reads like shepherdr's (dima's o13)", () => {
    test('the model and the capitalised effort', () => {
        expect(pickerLabel('Opus 5.5', 'medium', null)).toBe(
            'Opus 5.5 · Medium',
        );
        expect(pickerLabel('Opus 5.5', 'xhigh', null)).toBe('Opus 5.5 · Xhigh');
    });

    test('a part still landing reads with «…»', () => {
        expect(
            pickerLabel('Opus 5.5', 'medium', {
                kind: 'effort',
                value: 'high',
            }),
        ).toBe('Opus 5.5 · High…');
        expect(
            pickerLabel('Opus 5.5', 'medium', {
                kind: 'model',
                value: 'Haiku 5.5',
            }),
        ).toBe('Haiku 5.5… · Medium');
    });

    test('an unknown part names itself', () => {
        expect(pickerLabel(null, null, null)).toBe('Model · Effort');
    });
});
