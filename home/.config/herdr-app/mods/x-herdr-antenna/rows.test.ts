import { describe, expect, test } from 'vitest';

import { antennaRows } from './rows.js';

// FRM-618 slice A exit 1: five threads in two spaces, his saved order; each thread once, under its space name, in that
// order, a still dot per row
const threads = [
    { address: 't1', space: 'sA', space_name: 'frame', status: 'working' },
    { address: 't2', space: 'sA', space_name: 'frame', status: 'idle' },
    { address: 't3', space: 'sB', space_name: 'bytes', status: 'blocked' },
    { address: 't4', space: 'sA', space_name: 'frame', status: 'done' },
    { address: 't5', space: 'sB', space_name: 'bytes', status: 'idle' },
];
const names = {
    t1: 'clio',
    t2: 'crow',
    t3: 'codie b',
    t4: 'helga',
    t5: 'codie a',
};
const order = ['t5', 't2', 't1', 't3', 't4'];

describe('antenna rows', () => {
    test('grouped by space: each thread once, under its space name, in the saved order', () => {
        const rows = antennaRows(threads, { isGrouped: true, names, order });
        expect(rows).toEqual([
            { kind: 'space', name: 'bytes', space: 'sB' },
            { address: 't5', dot: 'idle', kind: 'thread', name: 'codie a' },
            { address: 't3', dot: 'blocked', kind: 'thread', name: 'codie b' },
            { kind: 'space', name: 'frame', space: 'sA' },
            { address: 't2', dot: 'idle', kind: 'thread', name: 'crow' },
            { address: 't1', dot: 'working', kind: 'thread', name: 'clio' },
            { address: 't4', dot: 'done', kind: 'thread', name: 'helga' },
        ]);
    });

    test('ungrouped: the same five rows in the one saved order across spaces', () => {
        const rows = antennaRows(threads, { isGrouped: false, names, order });
        expect(rows.map((r) => r.kind === 'thread' && r.address)).toEqual([
            't5',
            't2',
            't1',
            't3',
            't4',
        ]);
    });

    test('a thread his order has not seen joins at the end; a nameless one shows its address', () => {
        const rows = antennaRows(
            [
                ...threads,
                {
                    address: 't6',
                    space: 'sA',
                    space_name: 'frame',
                    status: 'idle',
                },
            ],
            { isGrouped: false, names, order },
        );
        expect(rows.at(-1)).toEqual({
            address: 't6',
            dot: 'idle',
            kind: 'thread',
            name: 't6',
        });
    });

    test('a space with no name gets a plain word, never an empty header', () => {
        const rows = antennaRows(
            [{ address: 't1', space: 'sC', space_name: '', status: 'idle' }],
            { isGrouped: true, names, order },
        );
        expect(rows[0]).toEqual({ kind: 'space', name: 'space', space: 'sC' });
    });
});
