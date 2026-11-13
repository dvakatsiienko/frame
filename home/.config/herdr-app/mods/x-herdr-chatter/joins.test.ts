import { describe, expect, test } from 'vitest';

import {
    HOLD_PUSH_MS,
    JOIN_TAKE_MS,
    appendJoin,
    holdSend,
    isJoinPending,
    joinStatus,
    pendingJoins,
} from './joins.js';

// a join file and its lock dir in memory, on a fake clock
function fakeIo({ isLockHeld = false, isWriteRefused = false } = {}) {
    const files = new Map<string, string>();
    const locks = new Set<string>(isLockHeld ? ['/j/s1.jsonl.lock'] : []);
    let clock = 0;
    return {
        files,
        io: {
            lock: async (path: string) => {
                if (locks.has(path)) return false;
                locks.add(path);
                return true;
            },
            now: () => clock,
            read: async (path: string) => files.get(path) ?? '',
            sleep: async (ms: number) => {
                clock += ms;
            },
            unlock: async (path: string) => {
                locks.delete(path);
            },
            write: async (path: string, text: string) => {
                if (isWriteRefused) throw new Error('refused');
                files.set(path, text);
            },
        },
        locks,
    };
}

describe('a click joins: one row in the thread’s join file, under its lock (FRM-564)', () => {
    test('writes one row with its id and text', async () => {
        const { files, io, locks } = fakeIo();
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'ship it')).toBe(true);
        expect(files.get('/j/s1.jsonl')).toBe('{"id":"a1","text":"ship it"}\n');
        expect(locks.size).toBe(0);
    });
    test('two clicks before one turn: both rows, in order', async () => {
        const { files, io } = fakeIo();
        await appendJoin(io, '/j/s1.jsonl', 'a1', 'one');
        await appendJoin(io, '/j/s1.jsonl', 'a2', 'two');
        expect(files.get('/j/s1.jsonl')).toBe(
            '{"id":"a1","text":"one"}\n{"id":"a2","text":"two"}\n',
        );
    });
    test('the lock held elsewhere: retried about 2 s, then refused, nothing written', async () => {
        const { files, io } = fakeIo({ isLockHeld: true });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(false);
        expect(io.now()).toBeGreaterThanOrEqual(2000);
        expect(io.now()).toBeLessThan(2500);
        expect(files.size).toBe(0);
    });
    test('a refused write answers false and lets the lock go', async () => {
        const { io, locks } = fakeIo({ isWriteRefused: true });
        expect(await appendJoin(io, '/j/s1.jsonl', 'a1', 'x')).toBe(false);
        expect(locks.size).toBe(0);
    });
});

describe('where a join stands, read off the thread’s herdr state', () => {
    const joins = { joined: ['a1'], push: [] as string[], waiting: ['a2'] };
    test('joined once the turn that took it completed', () => {
        expect(joinStatus(joins, 'a1', 0, 1000)).toBe('joined');
    });
    test('still waiting while the thread lists it', () => {
        expect(joinStatus(joins, 'a2', 0, JOIN_TAKE_MS + 1)).toBe('waiting');
    });
    test('pending until the state lists it', () => {
        expect(joinStatus(joins, 'a3', 0, 1000)).toBe('pending');
    });
    test('listed nowhere 60 s after the write: not taken', () => {
        expect(joinStatus(joins, 'a3', 0, JOIN_TAKE_MS)).toBe('not taken');
        expect(joinStatus(undefined, 'a3', 0, JOIN_TAKE_MS)).toBe('not taken');
    });
});

describe('a join into an idle thread waits as a card, drawn again after a reload', () => {
    const file =
        '{"id":"a1","text":"done one"}\n{"id":"a2","text":"wait for me"}\n{"id":"a2","text":"a second row with a1’s id"}\n{"id":"","text":"no id"}\n{"id":"a3","text":"  "}\nnot json\n{"id":"a4","text":"/compact"}\n';
    const joins = { joined: ['a1'], push: ['a4'], waiting: ['a2'] };
    test('a reload reads the card back from the join file: the rows the thread still lists as waiting', () => {
        expect(pendingJoins(file, joins)).toEqual([
            { id: 'a2', text: 'wait for me' },
        ]);
    });
    test('no state yet, no card: the file alone never says a row waits', () => {
        expect(pendingJoins(file, undefined)).toEqual([]);
        expect(pendingJoins('', joins)).toEqual([]);
    });
    test('a second click with the same words writes no duplicate row', () => {
        const rows = pendingJoins(file, joins);
        expect(isJoinPending(rows, 'wait for me')).toBe(true);
        expect(isJoinPending(rows, ' wait for me\n')).toBe(true);
        expect(isJoinPending(rows, 'something new')).toBe(false);
    });
});

describe('a hold on send: a bar fills over 5 s and pushes; a release before joins; a cut hold does nothing', () => {
    const pressed = holdSend(null, 'press', 1000);
    test('held to 5 s, it pushes once, the bar full', () => {
        const half = holdSend(pressed.hold, 'tick', 1000 + HOLD_PUSH_MS / 2);
        expect(half).toEqual({ act: null, fill: 0.5, hold: pressed.hold });
        const full = holdSend(half.hold, 'tick', 1000 + HOLD_PUSH_MS);
        expect(full.act).toBe('push');
        expect(full.hold).toBeNull();
        expect(
            holdSend(full.hold, 'release', 1000 + HOLD_PUSH_MS + 50).act,
        ).toBeNull();
    });
    test('released before 5 s, it joins and the bar resets', () => {
        expect(
            holdSend(pressed.hold, 'release', 1000 + HOLD_PUSH_MS - 1),
        ).toEqual({
            act: 'join',
            fill: 0,
            hold: null,
        });
    });
    test('cut by focus loss, a blur or a cancelled press: nothing written, the bar resets', () => {
        expect(
            holdSend(pressed.hold, 'cancel', 1000 + HOLD_PUSH_MS - 1),
        ).toEqual({
            act: null,
            fill: 0,
            hold: null,
        });
    });
});
