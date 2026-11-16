import { describe, expect, test } from 'vitest';

import {
    edgeScrollStep,
    followAfterWheel,
    isAtTrueEnd,
    pinToRow,
    placeIndex,
    placeOf,
    splitAtPlace,
    topAfterWheel,
} from './follow.js';

describe('the wheel only flips following the newest', () => {
    test('a step up stops following', () => {
        expect(followAfterWheel(true, 12, true)).toBe(false);
    });

    test('a step down at the end follows again', () => {
        expect(followAfterWheel(false, -12, true)).toBe(true);
    });

    test('a step down above the end keeps reading', () => {
        expect(followAfterWheel(false, -12, false)).toBe(false);
    });

    test('a sideways swipe changes nothing', () => {
        expect(followAfterWheel(true, 0, false)).toBe(true);
        expect(followAfterWheel(false, 0, true)).toBe(false);
    });
});

describe('he sits at the end only when the last screen of rows is the one drawn', () => {
    const ten = Array.from({ length: 10 }, () => 100);

    test('the last screen of rows is drawn: the end', () => {
        expect(isAtTrueEnd(ten, { end: 10, start: 7 }, 300)).toBe(true);
    });

    test('the last row is drawn but the view starts a row higher: still reading', () => {
        expect(isAtTrueEnd(ten, { end: 10, start: 6 }, 300)).toBe(false);
    });

    test('the last row is not drawn: still reading', () => {
        expect(isAtTrueEnd(ten, { end: 9, start: 6 }, 300)).toBe(false);
    });

    test('a last row taller than the view tells nothing: he may read its middle', () => {
        expect(
            isAtTrueEnd([100, 100, 100, 900], { end: 4, start: 3 }, 400),
        ).toBe(false);
    });

    test('a tall row heads the last screen: the drawn range cannot tell its top from the end, so not the end', () => {
        expect(isAtTrueEnd([2000, 300], { end: 2, start: 0 }, 400)).toBe(false);
    });

    test('the row heading the last screen hides a few lines at most: the end', () => {
        expect(isAtTrueEnd([500, 150, 300], { end: 3, start: 1 }, 400)).toBe(
            true,
        );
    });

    test('no rows at all: the end', () => {
        expect(isAtTrueEnd([], { end: 0, start: 0 }, 400)).toBe(true);
    });

    test('a conversation shorter than the view is all at the end', () => {
        expect(isAtTrueEnd([100, 100], { end: 2, start: 0 }, 600)).toBe(true);
    });

    test('nothing drawn yet, or no view size: not the end', () => {
        expect(isAtTrueEnd(ten, null, 300)).toBe(false);
        expect(isAtTrueEnd(ten, { end: 10, start: 7 }, 0)).toBe(false);
    });
});

describe('his reading place is a message, found again after the rows change', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    test('the place is where its message sits now', () => {
        expect(placeIndex(rows, 'b')).toBe(1);
        expect(placeIndex([{ id: 'x' }, { id: 'y' }, ...rows], 'b')).toBe(3);
    });

    test('a message not loaded, or no place kept, is nowhere', () => {
        expect(placeIndex(rows, 'gone')).toBe(-1);
        expect(placeIndex(rows, null)).toBe(-1);
    });
});

describe('a dragged text selection scrolls the list only at its edge', () => {
    const list = { bottom: 500, top: 100 };

    test.each([101, 140, 300, 460, 499])(
        'the pointer at %i, inside the list: no scroll',
        (y) => {
            expect(edgeScrollStep(y, list)).toBe(0);
        },
    );

    test('the pointer at the top edge or above it scrolls up one row', () => {
        expect(edgeScrollStep(100, list)).toBe(-1);
        expect(edgeScrollStep(60, list)).toBe(-1);
    });

    test('the pointer at the bottom edge or below it scrolls down one row', () => {
        expect(edgeScrollStep(500, list)).toBe(1);
        expect(edgeScrollStep(540, list)).toBe(1);
    });
});

describe('how far the list is scrolled, counted from his wheel and held to the row the list drew', () => {
    const sizes = [100, 100, 100, 100, 400, 250];

    test('a wheel step moves the count by the step', () => {
        expect(topAfterWheel(570, -30, sizes, 300)).toBe(600);
        expect(topAfterWheel(570, 30, sizes, 300)).toBe(540);
    });

    test('the count never leaves what the list can scroll', () => {
        expect(topAfterWheel(20, 50, sizes, 300)).toBe(0);
        expect(topAfterWheel(700, -200, sizes, 300)).toBe(750);
    });

    test('a count inside the first row drawn says how far into that row he is', () => {
        expect(pinToRow(570, 4, sizes)).toEqual({ offset: 170, top: 570 });
    });

    test("a count above the first row drawn is brought to that row's top", () => {
        expect(pinToRow(120, 4, sizes)).toEqual({ offset: 0, top: 400 });
    });

    test("a count below the first row drawn is brought to that row's last px", () => {
        expect(pinToRow(900, 4, sizes)).toEqual({ offset: 399, top: 799 });
    });
});

describe('a place inside a message is restored to the pixel, not to the message top', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const sizes = [100, 400, 250];

    test('the message is cut in two list items at the place, and the second is what goes to the top', () => {
        expect(splitAtPlace(rows, sizes, { id: 'b', offset: 170 })).toEqual({
            cut: { at: 1, offset: 170 },
            seekAt: 2,
            sizes: [100, 170, 230, 250],
        });
    });

    test('170 pt into a 400 pt message: the rows above the view sum to its top plus 170, never to its top', () => {
        const split = splitAtPlace(rows, sizes, { id: 'b', offset: 170 });
        const above = split.sizes
            .slice(0, split.seekAt)
            .reduce((sum, size) => sum + size, 0);
        expect(above).toBe(100 + 170);
    });

    test('a place at a message top, or past its end, needs no cut', () => {
        expect(splitAtPlace(rows, sizes, { id: 'b', offset: 0 })).toEqual({
            cut: null,
            seekAt: 1,
            sizes,
        });
        expect(
            splitAtPlace(rows, sizes, { id: 'b', offset: 400 }).cut,
        ).toBeNull();
    });

    test('a message that is not loaded is nowhere', () => {
        expect(splitAtPlace(rows, sizes, { id: 'gone', offset: 50 })).toEqual({
            cut: null,
            seekAt: -1,
            sizes,
        });
    });
});

describe('the saved place is read back as a message and the px into it', () => {
    test('what was saved comes back whole', () => {
        expect(placeOf(JSON.stringify({ id: 'b', offset: 170 }))).toEqual({
            id: 'b',
            offset: 170,
        });
    });

    test('a place saved as a bare message id opens at that message top', () => {
        expect(placeOf('u-123')).toEqual({ id: 'u-123', offset: 0 });
    });

    test.each([null, '', '{"offset":3}', '{"id":7}', '{broken'])(
        '%j is no place',
        (text) => {
            expect(placeOf(text)).toBeNull();
        },
    );
});
