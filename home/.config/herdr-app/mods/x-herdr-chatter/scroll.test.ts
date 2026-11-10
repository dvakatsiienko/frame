import { describe, expect, test } from 'vitest';

import { afterReflow, afterWheel, farRows, keptFirst } from './scroll.js';

// `up` is how far above the newest message the log shows, in px; `follow` is his «I am at the end» state
const reading = { follow: false, up: 900 };
const following = { follow: true, up: 0 };

describe('once he scrolls up, nothing but his own hand moves his view', () => {
    test('a new reply, a tool line or a plugin line keeps his place', () => {
        expect(afterReflow(reading, { from: 4000, to: 4300 })).toEqual({
            follow: false,
            up: 1200,
        });
    });

    test('a reflow while he reads near the end never pulls him to it', () => {
        expect(
            afterReflow({ follow: false, up: 20 }, { from: 4000, to: 4300 }),
        ).toEqual({ follow: false, up: 320 });
    });

    test('a reload refilling the log leaves his place to the restore', () => {
        expect(
            afterReflow(reading, { from: 1200, isFilling: true, to: 2400 }),
        ).toEqual(reading);
    });

    test('a first measure after a tab switch adds nothing', () => {
        expect(afterReflow(reading, { from: null, to: 4300 })).toEqual(reading);
    });

    test('while he follows, new content keeps him at the newest', () => {
        expect(afterReflow(following, { from: 4000, to: 4300 })).toEqual(
            following,
        );
    });
});

describe('he leaves and enters following by his own scroll', () => {
    test('a scroll up leaves following', () => {
        expect(afterWheel(following, 120, 5000)).toEqual({
            follow: false,
            up: 120,
        });
    });

    test('a scroll down to the end enters following', () => {
        expect(afterWheel({ follow: false, up: 30 }, -60, 5000)).toEqual(
            following,
        );
    });

    test('a scroll that stops short of the end keeps him reading', () => {
        expect(afterWheel(reading, -300, 5000)).toEqual({
            follow: false,
            up: 600,
        });
    });
});

describe('the rows above his place stay drawn while he reads', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    test('a new row grows the window instead of dropping the first', () => {
        expect(keptFirst(ids, 3, 'c', false)).toBe(3);
        expect(keptFirst([...ids, 'f'], 3, 'c', false)).toBe(4);
    });

    test('while he follows, the window slides', () => {
        expect(keptFirst([...ids, 'f'], 3, 'c', true)).toBe(3);
    });
});

describe('a row far out of view draws as its measured height alone', () => {
    // ten rows of 100 px, newest last, 10 px apart; the view is 300 px tall
    const heights = Array.from({ length: 10 }, () => 100 as number | undefined);
    const view = { gap: 10, up: 0, viewH: 300 };

    test('at the newest, the rows two views up and more go flat', () => {
        expect([...farRows(heights, view)].sort()).toEqual([0, 1, 2, 3]);
    });

    test('scrolled up, rows far below go flat too', () => {
        expect([...farRows(heights, { ...view, up: 660 })].sort()).toEqual([
            7, 8, 9,
        ]);
    });

    test('a row not measured yet always draws whole', () => {
        const unmeasured = heights.map((h, i) => (i === 0 ? undefined : h));
        expect(farRows(unmeasured, view).has(0)).toBe(false);
    });

    test('a short chat that fits draws every row whole', () => {
        expect(farRows([100, 100], view).size).toBe(0);
    });
});
