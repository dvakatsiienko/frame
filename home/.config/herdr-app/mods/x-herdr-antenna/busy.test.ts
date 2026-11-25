import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { busyCounts, busyHint, dotsOf } from './busy.js';
import { antennaRows } from './rows.js';

const NOW = 1_000_000;
type State = 'working' | 'waiting' | 'idle';
/** ten threads over two spaces, four working: t1 t2 in frame, t6 t7 in bytes */
const threads = Array.from({ length: 10 }, (_, i) => ({
    address: `t${i + 1}`,
    space: i < 5 ? 'frame' : 'bytes',
    space_name: i < 5 ? 'frame' : 'bytes',
    status: 'done',
}));
const WORKING = ['t1', 't2', 't6', 't7'];
const states = (working = WORKING) =>
    new Map<string, State>(
        threads.map((t) => [
            t.address,
            working.includes(t.address) ? 'working' : 'waiting',
        ]),
    );
const counted = (of = states(), list = threads) =>
    busyCounts(
        list,
        dotsOf(
            list,
            (address) => {
                const state = of.get(address);
                return state ? { since: NOW, state } : null;
            },
            NOW,
        ),
    );
const spaces = (counts: ReturnType<typeof counted>) =>
    Object.fromEntries(counts.spaces);

describe("antenna's head counts its threads, busy of all (FRM-620:W86)", () => {
    test('four of ten work', () => {
        expect(counted().all).toBe('4/10');
    });

    test('as many as the rows antenna draws, pinned ones among them', () => {
        const rows = antennaRows(threads, {
            isGrouped: true,
            names: {},
            order: [],
            pins: ['t1', 't9'],
        }).filter((r) => r.kind === 'thread');
        expect(counted().all).toBe(`4/${rows.length}`);
    });

    test("nothing running, and one whose state file was never read: herdr's own word for it is no work", () => {
        expect(counted(states([])).all).toBe('0/10');
        expect(
            counted(
                new Map(),
                threads.map((t) => ({ ...t, status: 'working' })),
            ).all,
        ).toBe('0/10');
    });

    test('one that asks him is no work: its dot says it needs him', () => {
        const list = threads.map((t) =>
            t.address === 't1' ? { ...t, status: 'blocked' } : t,
        );
        expect(counted(states(), list).all).toBe('3/10');
    });

    test('no thread, no pill', () => {
        expect(counted(states(), []).all).toBeNull();
    });
});

describe('each space carries its own count (FRM-620:W87)', () => {
    test('of its own threads alone', () => {
        expect(spaces(counted())).toEqual({ bytes: '2/5', frame: '2/5' });
        expect(spaces(counted(states(['t1'])))).toEqual({
            bytes: '0/5',
            frame: '1/5',
        });
    });
});

test('a thread that stops working moves its dot and the counts in one read', () => {
    const dots = (state: State) =>
        dotsOf(threads.slice(0, 1), () => ({ since: NOW, state }), NOW);
    for (const [state, all] of [
        ['working', '1/1'],
        ['idle', '0/1'],
    ] as const) {
        const read = dots(state);
        expect(read.get('t1')?.dot).toBe(state);
        expect(busyCounts(threads.slice(0, 1), read).all).toBe(all);
    }
});

test('the view reads each state once, through the dots the counts read', () => {
    const main = readFileSync(`${import.meta.dirname}/main.js`, 'utf8');
    expect(main).not.toContain('activityShown');
    expect(main.match(/\bfactsOf\(/g)).toHaveLength(1);
    expect(main.match(/\bdotsOf\(/g)).toHaveLength(1);
});

test.each([
    ['4/10', '4 working of 10 threads'],
    ['0/1', '0 working of 1 thread'],
])('a hover names %s', (count, hint) => {
    expect(busyHint(count)).toBe(hint);
});
