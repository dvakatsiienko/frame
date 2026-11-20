import { describe, expect, test } from 'vitest';

import { deckParts } from './deck-parts.js';

// FRM-618 slice B exits 1 and 2, slice C exit 1: no sessions section, orbit first, every thread's phases in one block pinned at the
// deck's bottom, a group per thread in antenna's order
const rows = [
    { name: 'crow', phases: [], pid: 3, sid: 's3' },
    {
        name: '🦉 clio',
        phases: ['read the inbox', 'siesta'],
        pid: 1,
        sid: 's1',
    },
    { name: 'codie', phases: ['probe'], pid: 2, sid: 's2' },
];

describe('the deck parts', () => {
    test('orbit is the scroll part alone: glide draws under antenna, nothing draws the sessions list', () => {
        const parts = deckParts(rows, { asks: 2, order: [2, 1, 3] });
        expect(parts.scroll).toEqual(['orbit']);
    });

    test('phases sit in the pinned block, a group per thread in his order, a thread with none left out', () => {
        const parts = deckParts(rows, { asks: 0, order: [2, 1, 3] });
        expect(parts.pinned).toEqual([
            { name: 'codie', phases: ['probe'], sid: 's2' },
            {
                name: '🦉 clio',
                phases: ['read the inbox', 'siesta'],
                sid: 's1',
            },
        ]);
    });

    test('with no asks the scroll part is empty, the phases still pinned', () => {
        const parts = deckParts(rows, { asks: 0, order: [] });
        expect(parts.scroll).toEqual([]);
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1', 's2']);
    });
});

// FRM-618 slice D exit 4b (his o10, 17:30): the phases are the plan of the thread focused in antenna
describe("the pinned phases follow antenna's focus", () => {
    test('a focused thread shows its own plan alone', () => {
        const parts = deckParts(rows, { asks: 0, focusedPid: 2, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s2']);
    });

    test('a focus change swaps the plan', () => {
        const parts = deckParts(rows, { asks: 0, focusedPid: 1, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1']);
    });

    test('a focused thread with no phases pins nothing', () => {
        const parts = deckParts(rows, { asks: 0, focusedPid: 3, order: [] });
        expect(parts.pinned).toEqual([]);
    });

    test('a focus on no known thread (a plain terminal) pins every plan', () => {
        const parts = deckParts(rows, { asks: 0, focusedPid: null, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1', 's2']);
    });
});
