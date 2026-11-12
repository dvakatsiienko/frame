import { describe, expect, test } from 'vitest';

import { ORDER_CAP, heirs, inOrder, moved, nextOrder } from './order.js';

const live = (...a: string[]) => new Set(a);

describe("the agents list keeps dima's order", () => {
    test('a new agent joins at the end, the rest keep their places', () => {
        expect(
            nextOrder(['t2', 't1'], ['t1', 't3', 't2'], live('t1', 't2', 't3')),
        ).toEqual(['t2', 't1', 't3']);
    });

    test('an agent whose terminal is gone keeps its place, so a read that misses it never reorders', () => {
        expect(nextOrder(['t2', 't1'], ['t1'], live('t1'))).toEqual([
            't2',
            't1',
        ]);
    });

    test('a start that reads no agents and no live terminals keeps the whole order', () => {
        expect(nextOrder(['t2', 't1', 't3'], [], live())).toEqual([
            't2',
            't1',
            't3',
        ]);
    });

    test('past the cap, the oldest gone agents leave and every live one stays', () => {
        const gone = Array.from({ length: ORDER_CAP }, (_, i) => `g${i}`);
        const next = nextOrder(['t1', ...gone], ['t1', 't2'], live('t1', 't2'));
        expect(next).toHaveLength(ORDER_CAP);
        expect(next.slice(0, 2)).toEqual(['t1', 'g2']);
        expect(next.at(-1)).toBe('t2');
    });

    test('with no live terminal read, nothing leaves even past the cap', () => {
        const gone = Array.from({ length: ORDER_CAP + 3 }, (_, i) => `g${i}`);
        expect(nextOrder(gone, [], live())).toEqual(gone);
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

describe('a thread restarted in a new terminal keeps its place', () => {
    const names = { t1: 'clio', t2: 'crow', t9: 'clio' };

    test('the new terminal takes the gone one of the same name', () => {
        expect(heirs(['t1', 't2', 't9'], names, live('t2', 't9'))).toEqual([
            't9',
            't2',
        ]);
    });

    test('a twin whose old terminal still lives stays where it joined', () => {
        expect(
            heirs(['t1', 't2', 't9'], names, live('t1', 't2', 't9')),
        ).toEqual(['t1', 't2', 't9']);
    });

    test('a terminal with no name yet waits at the end', () => {
        expect(heirs(['t1', 't9'], { t1: 'clio' }, live('t9'))).toEqual([
            't1',
            't9',
        ]);
    });

    test('with no live terminal read, nothing moves', () => {
        expect(heirs(['t1', 't9'], names, live())).toEqual(['t1', 't9']);
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
