import { describe, expect, test } from 'vitest';

import { deckParts, orbitHeader } from './deck-parts.js';

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
    test('phases sit in the pinned block, a group per thread in his order, a thread with none left out', () => {
        const parts = deckParts(rows, { order: [2, 1, 3] });
        expect(parts.pinned).toEqual([
            { name: 'codie', phases: ['probe'], sid: 's2' },
            {
                name: '🦉 clio',
                phases: ['read the inbox', 'siesta'],
                sid: 's1',
            },
        ]);
    });

    test('with no asks the phases still pinned', () => {
        const parts = deckParts(rows, { order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1', 's2']);
    });
});

// FRM-618 slice D exit 4b (his o10, 17:30): the phases are the plan of the thread focused in antenna
describe("the pinned phases follow antenna's focus", () => {
    test('a focused thread shows its own plan alone', () => {
        const parts = deckParts(rows, { focusedPid: 2, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s2']);
    });

    test('a focus change swaps the plan', () => {
        const parts = deckParts(rows, { focusedPid: 1, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1']);
    });

    test('a focused thread with no phases pins nothing', () => {
        const parts = deckParts(rows, { focusedPid: 3, order: [] });
        expect(parts.pinned).toEqual([]);
    });

    test('a focus on no known thread (a plain terminal) pins every plan', () => {
        const parts = deckParts(rows, { focusedPid: null, order: [] });
        expect(parts.pinned.map((g) => g.sid)).toEqual(['s1', 's2']);
    });
});

// FRM-618 slice D rider 4c (his o1, 18:13): orbit's header always shows, so nothing below it moves when the last ask goes
describe("orbit's header", () => {
    test('counts the asks', () => {
        expect(orbitHeader(1)).toBe('🪐 orbit: 1 ask');
        expect(orbitHeader(3)).toBe('🪐 orbit: 3 asks');
    });

    test('at zero is the bare name, a calm line under it says there are none', () => {
        expect(orbitHeader(0)).toBe('🪐 orbit');
    });
});
