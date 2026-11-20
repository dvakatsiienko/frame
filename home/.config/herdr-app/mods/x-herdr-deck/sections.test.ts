import { describe, expect, test } from 'vitest';

import { orbitPinIn, orbitSections, tickAllTakes } from './orbit.js';

// FRM-620 slice 3 (W16, W17): look and 🧪 cards from every thread in one pinned group, at the top or the bottom by his
// setting; then each thread's other asks in the agents list's order, so an arriving ask moves no other row
type Ask = { id: string; text: string };
type Row = { asks: Ask[]; name: string; pid: number };

const clio: Row = {
    asks: [
        { id: 'o1', text: 'push FRM-1' },
        { id: 'o2', text: '⚠️ merge #9' },
        { id: 'o3', text: 'look: the dock' },
    ],
    name: '🦉 clio',
    pid: 10,
};
const wing: Row = {
    asks: [
        { id: 'o1', text: 'rename the band' },
        { id: 'o2', text: 'try a drag' },
    ],
    name: '🦉🪽 clio: wing 1',
    pid: 20,
};

const drawn = (sections: ReturnType<typeof orbitSections<Row>>) =>
    sections.map((s) =>
        s.kind === 'pinned'
            ? `pinned ${s.cards.map((c) => `${c.row.pid}:${c.ask.id}`).join(' ')}`
            : `${s.row.pid} ${s.asks.map((a) => a.id).join(' ')}`,
    );

describe('orbit sections', () => {
    test('the pinned cards lead across threads, then each thread in the agents list order', () => {
        expect(drawn(orbitSections([wing, clio], [10, 20], 'top'))).toEqual([
            'pinned 10:o3 20:o2',
            '10 o1 o2',
            '20 o1',
        ]);
    });

    test('«pin: bottom» puts the same pinned group last, the rest above in their order', () => {
        expect(drawn(orbitSections([wing, clio], [10, 20], 'bottom'))).toEqual([
            '10 o1 o2',
            '20 o1',
            'pinned 10:o3 20:o2',
        ]);
    });

    test('a thread whose asks are all pinned draws no section of its own; no pinned card, no pinned group', () => {
        const looker: Row = {
            asks: [{ id: 'o1', text: 'look: the tabs' }],
            name: 'codie',
            pid: 30,
        };
        expect(drawn(orbitSections([looker, wing], [30, 20], 'top'))).toEqual([
            'pinned 30:o1 20:o2',
            '20 o1',
        ]);
        expect(
            drawn(
                orbitSections(
                    [{ asks: [{ id: 'o1', text: 'push' }], name: 'a', pid: 1 }],
                    [1],
                    'top',
                ),
            ),
        ).toEqual(['1 o1']);
    });

    test('an arriving ask moves no other row, whatever order the rows come in', () => {
        const before = drawn(orbitSections([clio, wing], [10, 20], 'top'));
        const grown: Row = {
            ...wing,
            asks: [...wing.asks, { id: 'o3', text: 'push main' }],
        };
        expect(drawn(orbitSections([grown, clio], [10, 20], 'top'))).toEqual([
            before[0],
            before[1],
            '20 o1 o3',
        ]);
    });

    test('a thread the agents list does not show goes last, by name, never by its status', () => {
        const bg: Row = {
            asks: [{ id: 'o1', text: 'push' }],
            name: '🍀 a bg run',
            pid: 99,
        };
        const other: Row = { ...bg, name: '🍀 z bg run', pid: 98 };
        const order = [
            drawn(orbitSections([other, bg, wing], [20], 'top')),
            drawn(orbitSections([bg, wing, other], [20], 'top')),
        ];
        expect(order[0]).toEqual(order[1]);
        expect(order[0].slice(1)).toEqual(['20 o1', '99 o1', '98 o1']);
    });
});

describe('the pin setting', () => {
    const file = (rows: Record<string, unknown>) =>
        JSON.stringify({ rows, v: 1 });

    test('his «bottom» pins last; no file, no row, a file mid-write or a stray value pin on top', () => {
        expect(orbitPinIn(file({ 'orbit.pin': 'bottom' }))).toBe('bottom');
        expect(orbitPinIn(file({ 'orbit.pin': 'top' }))).toBe('top');
        expect(orbitPinIn(null)).toBe('top');
        expect(orbitPinIn(file({ 'tabs.status': 'hidden' }))).toBe('top');
        expect(orbitPinIn('{"rows": {"orbit.p')).toBe('top');
        expect(orbitPinIn(file({ 'orbit.pin': 'left' }))).toBe('top');
    });
});

describe('«tick all» leaves the pinned cards', () => {
    test("a thread's tick all takes its plain asks, never its look or 🧪 cards, which sit in the pinned group", () => {
        const plain = {
            isGated: false,
            isLocked: false,
            link: null,
            mark: null,
            pick: null,
        };
        const asks = [
            { ...plain, id: 'o1', text: 'push FRM-1' },
            { ...plain, id: 'o2', text: 'look: the dock' },
            { ...plain, id: 'o3', text: 'test: a drag' },
        ];
        expect(tickAllTakes(asks, () => 'open').map((a) => a.id)).toEqual([
            'o1',
        ]);
    });
});
