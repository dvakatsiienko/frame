import { describe, expect, test } from 'vitest';

import { inOrder, moved, nextOrder } from './order.js';

const live = (...a: string[]) => new Set(a);

describe("the agents list keeps dima's order", () => {
    test('a new agent joins at the end, the rest keep their places', () => {
        expect(
            nextOrder(['t2', 't1'], ['t1', 't3', 't2'], live('t1', 't2', 't3')),
        ).toEqual(['t2', 't1', 't3']);
    });

    test('an agent whose terminal is gone leaves the order', () => {
        expect(nextOrder(['t2', 't1'], ['t1'], live('t1'))).toEqual(['t1']);
    });

    test('an agent idle in a live terminal keeps its place while not listed', () => {
        expect(nextOrder(['t2', 't1'], ['t1'], live('t1', 't2'))).toEqual([
            't2',
            't1',
        ]);
    });

    test('a status change never moves a row: the list sorts by the order alone', () => {
        const rows = [
            { address: 't1', status: 'working' },
            { address: 't2', status: 'done' },
        ];
        expect(inOrder(rows, ['t2', 't1']).map((r) => r.address)).toEqual([
            't2',
            't1',
        ]);
    });
});

describe('his drag sets the order', () => {
    test('a row dragged up lands in the place it was dropped on', () => {
        expect(moved(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual([
            'a',
            'd',
            'b',
            'c',
        ]);
    });

    test('a row dragged down lands after the row it was dropped on', () => {
        expect(moved(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual([
            'b',
            'c',
            'a',
            'd',
        ]);
    });

    test('a drop on itself or on an unknown row changes nothing', () => {
        expect(moved(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
        expect(moved(['a', 'b'], 'a', 'z')).toEqual(['a', 'b']);
    });
});
