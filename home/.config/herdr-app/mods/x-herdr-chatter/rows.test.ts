import { describe, expect, test } from 'vitest';

import {
    MAX_ROW_PX,
    MEASURE_MAX,
    MEASURE_NEW,
    fileLinks,
    followAfterWheel,
    measureOrder,
    prevMineIndex,
    rowSizes,
} from './rows.js';

describe('every size the list gets is a real number of pixels', () => {
    test('a measured height wins over the guess', () => {
        expect(rowSizes(['a', 'b'], new Map([['a', 120]]), () => 30)).toEqual([
            120, 30,
        ]);
    });

    test('NaN, zero, a negative or an infinite height falls back to 40', () => {
        const heights = new Map([
            ['a', Number.NaN],
            ['b', 0],
            ['c', -5],
            ['d', Number.POSITIVE_INFINITY],
        ]);
        expect(rowSizes(['a', 'b', 'c', 'd'], heights, () => 30)).toEqual([
            40, 40, 40, 40,
        ]);
    });

    test('a runaway height is capped', () => {
        expect(rowSizes(['a'], new Map([['a', 90000]]), () => 30)).toEqual([
            MAX_ROW_PX,
        ]);
    });

    test('a bad guess is guarded too', () => {
        expect(rowSizes(['a'], new Map(), () => Number.NaN)).toEqual([40]);
    });
});

describe('the measurer draws few rows a pass, the ones that matter first', () => {
    const keys = Array.from({ length: 200 }, (_, i) => `k${i}`);

    test('new rows go nearest the view first, at most MEASURE_NEW', () => {
        const order = measureOrder(keys, new Map(), new Map(), null, 199, 0);
        expect(order).toHaveLength(MEASURE_NEW);
        expect(order[0]).toBe(199);
        expect(order.at(-1)).toBe(199 - MEASURE_NEW + 1);
    });

    test('rows on screen are measured again, two past each edge', () => {
        const heights = new Map(keys.map((k) => [k, 50]));
        const order = measureOrder(
            keys,
            heights,
            new Map(),
            { end: 15, start: 10 },
            12,
            1e9,
        );
        expect(order).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    });

    test('a height measured a moment ago is measured again, an old one is not', () => {
        const heights = new Map([
            ['k3', 50],
            ['k4', 50],
        ]);
        const measuredAt = new Map([
            ['k3', 9000],
            ['k4', 1000],
        ]);
        const order = measureOrder(
            keys.slice(0, 5),
            heights,
            measuredAt,
            null,
            0,
            10000,
        );
        expect(order).toEqual([0, 1, 2, 3]);
    });

    test('a pass never draws more than MEASURE_MAX rows', () => {
        const heights = new Map(keys.slice(0, 150).map((k) => [k, 50]));
        const order = measureOrder(
            keys,
            heights,
            new Map(),
            { end: 150, start: 0 },
            0,
            1e9,
        );
        expect(order.length).toBe(MEASURE_MAX);
        expect(order.slice(0, MEASURE_NEW)).toEqual(
            Array.from({ length: MEASURE_NEW }, (_, i) => 150 + i),
        );
    });
});

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

describe('↑ Previous message goes to his nearest message above the view', () => {
    const rows = [{ mine: true }, {}, { mine: true }, {}, {}];

    test('the nearest one above the first row on screen', () => {
        expect(prevMineIndex(rows, 4)).toBe(2);
    });

    test('the first row on screen itself is not above the view', () => {
        expect(prevMineIndex(rows, 2)).toBe(0);
    });

    test('none above: -1', () => {
        expect(prevMineIndex(rows, 0)).toBe(-1);
        expect(prevMineIndex([{}, {}], 2)).toBe(-1);
    });

    test('a start past the end reads from the last row', () => {
        expect(prevMineIndex(rows, 99)).toBe(2);
    });
});

describe("a reply's file:// links each get a row to press", () => {
    test('a link gives its label and its decoded path', () => {
        expect(
            fileLinks(
                'see [the shot](file:///Users/dima/looks/a%20b.png) here',
            ),
        ).toEqual([{ label: 'the shot', path: '/Users/dima/looks/a b.png' }]);
    });

    test('an autolink and a localhost host read the same', () => {
        expect(
            fileLinks('<file:///tmp/x.md> and [y](file://localhost/tmp/y.md)'),
        ).toEqual([
            { label: 'x.md', path: '/tmp/x.md' },
            { label: 'y', path: '/tmp/y.md' },
        ]);
    });

    test('a link in a code block or an inline code span is not a link', () => {
        const text =
            'run `[a](file:///tmp/a)`\n```\n[b](file:///tmp/b)\n```\n[c](file:///tmp/c)';
        expect(fileLinks(text)).toEqual([{ label: 'c', path: '/tmp/c' }]);
    });

    test('the same file twice is one row, the first label kept', () => {
        expect(fileLinks('[one](file:///tmp/a) [two](file:///tmp/a)')).toEqual([
            { label: 'one', path: '/tmp/a' },
        ]);
    });

    test('web links, a relative file url and a broken escape are left out', () => {
        expect(
            fileLinks(
                '[w](https://x.dev) [r](file://tmp/a) [bad](file:///tmp/%E0%A4%A)',
            ),
        ).toEqual([]);
    });

    test('an angle-bracketed url and a title are read too', () => {
        expect(fileLinks('[d](<file:///tmp/d.md> "the doc")')).toEqual([
            { label: 'd', path: '/tmp/d.md' },
        ]);
    });

    test('an empty label falls back to the file name', () => {
        expect(fileLinks('[](file:///tmp/dir/e.txt)')).toEqual([
            { label: 'e.txt', path: '/tmp/dir/e.txt' },
        ]);
    });
});
