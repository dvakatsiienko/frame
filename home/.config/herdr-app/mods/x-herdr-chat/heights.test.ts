import { describe, expect, test } from 'vitest';

import { MAX_ROW_PX, createHeights, guessHeight } from './heights.js';

const row = (id: string, version = 1, text = 'hello') => ({
    id,
    kind: 'reply' as const,
    text,
    version,
});
const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => row(`r${i}`));
const guess = () => 50;

describe("each row's height is kept by its id", () => {
    test('a row never measured takes the guess, a measured one its height', () => {
        const heights = createHeights();
        const [a, b] = [row('a'), row('b')];
        heights.record(a, 120);
        expect(heights.sizes([a, b], guess)).toEqual([120, 50]);
    });

    test('a row whose text grew keeps its last height until it is measured again', () => {
        const heights = createHeights();
        heights.record(row('a', 1), 120);
        const grown = row('a', 2);
        expect(heights.sizes([grown], guess)).toEqual([120]);
        expect(heights.toMeasure([grown], null)).toEqual([grown]);
        heights.record(grown, 180);
        expect(heights.sizes([grown], guess)).toEqual([180]);
    });

    test('recording says whether the height changed', () => {
        const heights = createHeights();
        expect(heights.record(row('a'), 120)).toBe(true);
        expect(heights.record(row('a'), 120)).toBe(false);
        expect(heights.record(row('a'), 121)).toBe(true);
    });

    test('a height is whole pixels between 1 and the most a list row may be', () => {
        const heights = createHeights();
        const [a, b, c] = [row('a'), row('b'), row('c')];
        heights.record(a, 0);
        heights.record(b, 99_999);
        heights.record(c, 20.4);
        expect(heights.sizes([a, b, c], guess)).toEqual([1, MAX_ROW_PX, 21]);
    });

    test('a new width forgets every height', () => {
        const heights = createHeights();
        const a = row('a');
        heights.record(a, 120);
        heights.clear();
        expect(heights.sizes([a], guess)).toEqual([50]);
    });
});

describe('what is measured in one frame', () => {
    test('rows never measured come nearest the view first, thirty at most', () => {
        const heights = createHeights();
        const order = heights.toMeasure(rows(200), { end: 110, start: 100 });
        const distances = order
            .slice(0, 30)
            .map((r) => Math.abs(Number(r.id.slice(1)) - 100));
        expect(Math.max(...distances)).toBe(15);
        expect(order.length).toBe(30);
    });

    test('rows on screen are measured again: rich text can lay out a frame late', () => {
        const heights = createHeights();
        const all = rows(20);
        for (const r of all) heights.record(r, 40);
        expect(
            heights.toMeasure(all, { end: 8, start: 5 }).map((r) => r.id),
        ).toEqual(['r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);
    });

    test('nothing drawn yet: the newest rows first', () => {
        const heights = createHeights();
        const order = heights.toMeasure(rows(100), null);
        expect(order[0]?.id).toBe('r99');
        expect(order.length).toBe(30);
    });

    test('the look for unmeasured rows stops a few screens from the view', () => {
        const heights = createHeights();
        const all = rows(10_000);
        for (const r of all.slice(1)) heights.record(r, 40);
        expect(
            heights.toMeasure(all, { end: 5010, start: 5000 }).map((r) => r.id),
        ).not.toContain('r0');
    });

    test('a thread of 10,000 measured rows asks for the screen only', () => {
        const heights = createHeights();
        const all = rows(10_000);
        for (const r of all) heights.record(r, 40);
        expect(heights.toMeasure(all, { end: 5010, start: 5000 }).length).toBe(
            14,
        );
    });
});

describe('the guess before a row is measured', () => {
    test('more text is taller, a narrower list is taller', () => {
        const short = guessHeight(row('a', 1, 'x'.repeat(40)), 600);
        const long = guessHeight(row('a', 1, 'x'.repeat(4000)), 600);
        const narrow = guessHeight(row('a', 1, 'x'.repeat(4000)), 300);
        expect(long).toBeGreaterThan(short);
        expect(narrow).toBeGreaterThan(long);
    });

    test('a tool row is one line whatever its text', () => {
        const tool = {
            id: 't',
            kind: 'tool' as const,
            text: 'Bash',
            version: 1,
        };
        expect(guessHeight(tool, 300)).toBe(guessHeight(tool, 900));
    });
});

describe('a row drawn another way is measured apart: find’s word marks never jump the list (FRM-638 slice 6, dima 17:51)', () => {
    test('its marked height is its own, beside the plain one', () => {
        const heights = createHeights();
        const plain = row('a');
        const marked = { ...plain, look: 'find:tool' };
        heights.record(plain, 120);
        expect(heights.has(marked)).toBe(false);
        expect(heights.toMeasure([marked], null)).toEqual([marked]);
        heights.record(marked, 150);
        expect(heights.has(marked)).toBe(true);
        expect(heights.sizes([marked], guess)).toEqual([150]);
        expect(heights.sizes([plain], guess)).toEqual([120]);
    });

    test('until the marked height is known the row keeps its plain one', () => {
        const heights = createHeights();
        heights.record(row('a'), 120);
        expect(heights.sizes([{ ...row('a'), look: 'find:x' }], guess)).toEqual(
            [120],
        );
    });
});
