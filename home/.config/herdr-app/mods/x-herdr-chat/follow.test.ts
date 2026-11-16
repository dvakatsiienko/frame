import { describe, expect, test } from 'vitest';

import {
    edgeScrollStep,
    followAfterWheel,
    isAtTrueEnd,
    placeIndex,
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
