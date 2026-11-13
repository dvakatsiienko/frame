import { describe, expect, test } from 'vitest';

import {
    LEFT_STRIP_COVER,
    MAX_ROW_PX,
    MEASURE_MAX,
    MEASURE_NEW,
    fileLinks,
    followAfterLostRow,
    followAfterWheel,
    isPressUnderStrip,
    isRowClipped,
    measureOrder,
    prevMineIndex,
    rowSizes,
    unlinkFiles,
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
        const order = measureOrder(keys, new Map(), new Map(), 199);
        expect(order).toHaveLength(MEASURE_NEW);
        expect(order[0]).toBe(199);
        expect(order.at(-1)).toBe(199 - MEASURE_NEW + 1);
    });

    test('a settled chat draws nothing out of sight: every frame lays out what the measurer holds', () => {
        const heights = new Map(keys.map((k) => [k, 50]));
        expect(
            measureOrder(keys, heights, new Map(keys.map((k) => [k, 2])), 12),
        ).toEqual([]);
    });

    test('a height not yet read the same twice is measured again, a settled one is not', () => {
        const heights = new Map([
            ['k3', 50],
            ['k4', 50],
        ]);
        const sameReads = new Map([
            ['k3', 1],
            ['k4', 2],
        ]);
        expect(measureOrder(keys.slice(0, 5), heights, sameReads, 0)).toEqual([
            0, 1, 2, 3,
        ]);
    });

    test('a pass never draws more than MEASURE_MAX rows', () => {
        const heights = new Map(keys.slice(0, 150).map((k) => [k, 50]));
        const sameReads = new Map(keys.slice(0, 150).map((k) => [k, 0]));
        const order = measureOrder(keys, heights, sameReads, 0);
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

describe('a row clips only while its size is not its own height', () => {
    test('a measured row draws unclipped, so a text drag in it never scrolls the chat', () => {
        expect(isRowClipped('a', new Map([['a', 120]]))).toBe(false);
    });
    test('a row still on its guess clips', () => {
        expect(isRowClipped('a', new Map())).toBe(true);
    });
    test('a runaway height cut to the cap clips', () => {
        expect(isRowClipped('a', new Map([['a', MAX_ROW_PX + 1]]))).toBe(true);
    });
});

describe('a press under a strip over the log is the strip’s, never the row’s', () => {
    test('a press on Take it, inside «Still in Claude’s box», never forks the row under it', () => {
        expect(isPressUnderStrip(580, 600, LEFT_STRIP_COVER)).toBe(true);
    });
    test('a press above the strip reaches the row', () => {
        expect(isPressUnderStrip(500, 600, LEFT_STRIP_COVER)).toBe(false);
    });
    test('with no strip every press reaches the row', () => {
        expect(isPressUnderStrip(600, 600, 0)).toBe(false);
    });
});

describe('a file link in a reply reads as plain text, its 📂 row the one door (FRM-562:W60)', () => {
    test('the link keeps its label and loses its link look', () => {
        expect(
            unlinkFiles('📐 [mock-1.png](file:///Users/dima/a%20b.png) here'),
        ).toBe('📐 mock-1.png here');
    });

    test('an autolink keeps its file name', () => {
        expect(unlinkFiles('see <file:///tmp/x.md>')).toBe('see x.md');
    });

    test('web links and code stay as they are', () => {
        const text =
            '[site](https://x.dev) `[a](file:///tmp/a)`\n```\n[b](file:///tmp/b)\n```\n[c](file:///tmp/c)';
        expect(unlinkFiles(text)).toBe(
            '[site](https://x.dev) `[a](file:///tmp/a)`\n```\n[b](file:///tmp/b)\n```\nc',
        );
    });
});

describe("a reply's bare file paths get the same 📂 row (FRM-562, his 15:02 «a dead line»)", () => {
    test('an absolute path in prose or in backticks', () => {
        expect(
            fileLinks(
                'Shot: /Users/dima/looks/a.png. and `~/.local/state/b.md` here',
            ),
        ).toEqual([
            { label: 'a.png', path: '/Users/dima/looks/a.png' },
            { label: 'b.md', path: '~/.local/state/b.md' },
        ]);
    });

    test('a path a link already names is listed once', () => {
        expect(fileLinks('[a](file:///tmp/a.png) and /tmp/a.png')).toEqual([
            { label: 'a', path: '/tmp/a.png' },
        ]);
    });

    test('never a code block, a folder, a url, or a bare word', () => {
        expect(
            fileLinks(
                '```\n/tmp/x.png\n```\n/Users/dima/frame and https://x.dev/tmp/y.png and tmp/z.png',
            ),
        ).toEqual([]);
    });
});

describe('a home path and its full form are one file', () => {
    test('~ expands before the dedupe', () => {
        expect(
            fileLinks('see ~/a/x.png and /Users/dima/a/x.png', '/Users/dima'),
        ).toEqual([{ label: 'x.png', path: '/Users/dima/a/x.png' }]);
    });
});

describe('a held row that vanished never moves him to the newest unless he came back to the thread', () => {
    test('reading mid-thread, a row that changed under him leaves him where he is (dima, 21:16)', () => {
        expect(followAfterLostRow({ isRestore: false })).toBe(false);
    });
    test('back to a thread whose row is gone (a /clear, a trimmed transcript): the newest', () => {
        expect(followAfterLostRow({ isRestore: true })).toBe(true);
    });
});
