import { describe, expect, test } from 'vitest';

import { JOIN_TAKE_MS, appendJoin, joinStatus } from './joins.js';

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
    const joins = { joined: ['a1'], push: [], waiting: ['a2'] };
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
