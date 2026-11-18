import { describe, expect, test } from 'vitest';

import { JOIN_TAKE_MS } from './joins.js';
import { createMagic } from './magic.js';

const THREAD = '/t/a.jsonl';
const SID = 'sid-a';
const FILE = `/joins/${SID}.jsonl`;
const ON = { joined: [], push: [], taken: [], waiting: [] };

/** the join files and the lock dir as herdr reaches them, in memory; the stash is played by hand */
function world() {
    const files = new Map<string, string>();
    const locks = new Set<string>();
    const kept: Record<string, string> = {};
    let now = 1_000;
    let ids = 0;
    const doors = {
        dir: '/joins',
        io: {
            lock: async (path: string) =>
                locks.has(path) ? false : Boolean(locks.add(path)),
            lockAge: async () => 0,
            now: () => now,
            read: async (path: string) => files.get(path) ?? null,
            sleep: async (ms: number) => {
                now += ms;
            },
            unlock: async (path: string) => {
                locks.delete(path);
            },
            write: async (path: string, text: string) => {
                files.set(path, text);
            },
        },
        newId: () => `id-${++ids}`,
        store: {
            getItem: (key: string) => kept[key] ?? null,
            removeItem: (key: string) => {
                delete kept[key];
            },
            setItem: (key: string, value: string) => {
                kept[key] = value;
            },
        },
    };
    return {
        doors,
        locks,
        magic: createMagic(doors),
        pass(ms: number) {
            now += ms;
        },
        rows: () =>
            (files.get(FILE) ?? '')
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line)),
    };
}

describe('a click on send marks the words to join the turn', () => {
    test('the words become one row of the thread’s join file and stay marked', async () => {
        const w = world();
        expect(await w.magic.click(THREAD, SID, 'also the tests', ON)).toEqual({
            act: 'marked',
            note: null,
        });
        expect(w.rows()).toEqual([{ id: 'id-1', text: 'also the tests' }]);
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('the mark shows at once, before the row is written', () => {
        const w = world();
        w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('a second click takes the mark off and the row out', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(
            (await w.magic.click(THREAD, SID, 'also the tests', ON)).act,
        ).toBe('unmarked');
        expect(w.rows()).toEqual([]);
        expect(w.magic.markOf(THREAD)).toBeNull();
    });

    test('a second click right behind the first still takes the row out', async () => {
        const w = world();
        const first = w.magic.click(THREAD, SID, 'also the tests', ON);
        const second = w.magic.click(THREAD, SID, 'also the tests', ON);
        await Promise.all([first, second]);
        expect(w.rows()).toEqual([]);
    });

    test('a turn that took the words first keeps them: the click says so', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const taken = { ...ON, taken: ['id-1'] };
        expect(
            await w.magic.click(THREAD, SID, 'also the tests', taken),
        ).toEqual({ act: 'none', note: 'It joined the turn first' });
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('a slash command starts a turn: nothing is marked', async () => {
        const w = world();
        expect(await w.magic.click(THREAD, SID, '/compact', ON)).toEqual({
            act: 'push',
            note: 'Sent: a slash command starts a turn',
        });
        expect(w.magic.markOf(THREAD)).toBeNull();
        expect(w.rows()).toEqual([]);
    });

    test('a thread whose joins are off gets a plain send', async () => {
        const w = world();
        expect((await w.magic.click(THREAD, SID, 'hello', null)).act).toBe(
            'push',
        );
        expect((await w.magic.click(THREAD, null, 'hello', ON)).act).toBe(
            'push',
        );
        expect(w.rows()).toEqual([]);
    });

    test('a join file held by another writer gives the words back unmarked', async () => {
        const w = world();
        w.locks.add(`${FILE}.lock`);
        expect(await w.magic.click(THREAD, SID, 'also the tests', ON)).toEqual({
            act: 'none',
            note: 'Not joined, still in the box',
        });
        expect(w.magic.markOf(THREAD)).toBeNull();
    });

    test('each thread keeps its own mark', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'for a', ON);
        await w.magic.click('/t/b.jsonl', 'sid-b', 'for b', ON);
        expect(w.magic.markOf(THREAD)?.said).toBe('for a');
        expect(w.magic.markOf('/t/b.jsonl')?.said).toBe('for b');
    });

    test('a mark outlives a reload of the mod', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(createMagic(w.doors).markOf(THREAD)?.id).toBe('id-1');
    });
});

describe('a second click on a mark whose row never landed', () => {
    test('takes the mark off: there is no row to wait for', async () => {
        const w = world();
        w.locks.add(`${FILE}.lock`);
        const first = w.magic.click(THREAD, SID, 'also the tests', ON);
        const second = w.magic.click(THREAD, SID, 'also the tests', ON);
        expect((await second).act).toBe('unmarked');
        await first;
        expect(w.magic.markOf(THREAD)).toBeNull();
    });
});

describe('what he types on rides the same row', () => {
    test('more words rewrite the row, its id kept', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(await w.magic.typed(THREAD, 'also the tests, please', ON)).toBe(
            true,
        );
        expect(w.rows()).toEqual([
            { id: 'id-1', text: 'also the tests, please' },
        ]);
    });

    test('an emptied quill takes the mark off', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        await w.magic.typed(THREAD, '', ON);
        expect(w.magic.markOf(THREAD)).toBeNull();
        expect(w.rows()).toEqual([]);
    });

    test('words typed after a turn took the row stay his next message', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const taken = { ...ON, taken: ['id-1'] };
        expect(await w.magic.typed(THREAD, 'also the tests and', taken)).toBe(
            false,
        );
        expect(w.rows()).toEqual([{ id: 'id-1', text: 'also the tests' }]);
    });
});

describe('the thread’s state settles a mark', () => {
    test('a turn took it: the words leave the quill, what he typed after them stays', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const joined = { ...ON, joined: ['id-1'] };
        expect(
            w.magic.settle(THREAD, joined, 'also the tests\nand one more'),
        ).toEqual({ id: 'id-1', note: null, quill: 'and one more' });
        expect(w.magic.markOf(THREAD)?.state).toBe('joined');
    });

    test('a quill he rewrote meanwhile is left as it is', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const joined = { ...ON, taken: ['id-1'] };
        expect(
            w.magic.settle(THREAD, joined, 'something else')?.quill,
        ).toBeNull();
    });

    test('still waiting: nothing changes', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const waiting = { ...ON, waiting: ['id-1'] };
        w.pass(JOIN_TAKE_MS * 2);
        expect(w.magic.settle(THREAD, waiting, 'also the tests')).toBeNull();
    });

    test('listed nowhere a minute on: the mark goes, the row too, the words stay', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(w.magic.settle(THREAD, ON, 'also the tests')).toBeNull();
        w.pass(JOIN_TAKE_MS);
        expect(w.magic.settle(THREAD, ON, 'also the tests')).toEqual({
            id: 'id-1',
            note: 'Not taken, still in the box',
            quill: null,
        });
        await Promise.resolve();
        expect(w.magic.markOf(THREAD)).toBeNull();
        await w.doors.io.sleep(0);
        expect(w.rows()).toEqual([]);
    });

    test('a joined mark is forgotten once it was shown', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        w.magic.settle(THREAD, { ...ON, joined: ['id-1'] }, '');
        w.magic.forget('id-1');
        expect(w.magic.markOf(THREAD)).toBeNull();
    });
});

describe('a push of words still marked to join', () => {
    test('their row leaves the join file first', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(await w.magic.release(THREAD, ON)).toBeNull();
        expect(w.rows()).toEqual([]);
        expect(w.magic.markOf(THREAD)).toBeNull();
    });

    test('a row a turn took already is never pushed again', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        // the stash keeps a taken row in the join file: only the state says a turn has it
        const taken = { ...ON, taken: ['id-1'] };
        expect(await w.magic.release(THREAD, taken)).toBe(
            'It joined the turn first',
        );
        expect(w.rows()).toHaveLength(1);
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('a second click that wins the lock before the first row landed still waits for it', async () => {
        const w = world();
        // the append's lock is slow to come: the take-back must not run ahead of it
        const { lock } = w.doors.io;
        let isFirst = true;
        w.doors.io.lock = async (path: string) => {
            if (isFirst) {
                isFirst = false;
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
            return lock(path);
        };
        const first = w.magic.click(THREAD, SID, 'also the tests', ON);
        const second = w.magic.click(THREAD, SID, 'also the tests', ON);
        expect((await second).act).toBe('unmarked');
        await first;
        expect(w.rows()).toEqual([]);
    });

    test('with no mark there is nothing to wait for', async () => {
        expect(await world().magic.release(THREAD, ON)).toBeNull();
    });
});

describe('his words arriving in the chat settle the mark at once', () => {
    test('the joined words show as his message: the quill empties in the same draw', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'what tails do you have atm?', ON);
        expect(
            w.magic.arrived(
                THREAD,
                ['what tails do you have atm?'],
                'what tails do you have atm?',
            ),
        ).toEqual({ id: 'id-1', note: null, quill: '' });
        expect(w.magic.markOf(THREAD)?.state).toBe('joined');
    });

    test('what he typed after them stays', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(
            w.magic.arrived(
                THREAD,
                ['also the tests'],
                'also the tests\nand one more',
            )?.quill,
        ).toBe('and one more');
    });

    test('another message arriving leaves the mark waiting', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(
            w.magic.arrived(THREAD, ['something else'], 'also the tests'),
        ).toBeNull();
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('no mark, nothing to settle', () => {
        const w = world();
        expect(w.magic.arrived(THREAD, ['hi'], 'hi')).toBeNull();
    });
});
