/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

// the pure half of attach.js is what this reads; its herdr door stays shut
vi.mock('herdr', () => ({ exec: vi.fn() }));

import { JOIN_TAKE_MS } from './joins.js';
import { RETEXT_MS, createMagic, retextWait } from './magic.js';
import { createQuills } from './quill.js';

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
    };
    const store = {
        getItem: (key: string) => kept[key] ?? null,
        removeItem: (key: string) => {
            delete kept[key];
        },
        setItem: (key: string, value: string) => {
            kept[key] = value;
        },
    };
    const quills = createQuills(store);
    return {
        doors,
        locks,
        magic: createMagic({ ...doors, quills }),
        pass(ms: number) {
            now += ms;
        },
        quills,
        /** a reload of the mod: the quills and the marks read back from the store */
        reload: () => createMagic({ ...doors, quills: createQuills(store) }),
        rows: () =>
            (files.get(FILE) ?? '')
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line)),
        /** what the quill holds, typed by him */
        type(text: string) {
            quills.apply(THREAD, { text, type: 'typed' });
        },
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

    test('a slash command starts a turn: nothing is marked, nothing said, its bubble is the reply (dima, 18:01)', async () => {
        const w = world();
        expect(await w.magic.click(THREAD, SID, '/compact', ON)).toEqual({
            act: 'push',
            note: null,
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
        expect(w.reload().markOf(THREAD)?.id).toBe('id-1');
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

    // dima's wisp, 15:34: Enter marks 🍕, a full clear left 🍕 for about a second
    test('an emptied quill drops its mark before the file write, so 🍕 goes at once', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const done = w.magic.typed(THREAD, '', ON);
        expect(w.magic.markOf(THREAD)).toBeNull();
        await done;
    });

    test('an emptied quill waits for no rest of the keys, words still do', () => {
        expect(retextWait('')).toBe(0);
        expect(retextWait('   ')).toBe(0);
        expect(retextWait('also')).toBe(RETEXT_MS);
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
        w.type('also the tests\nand one more');
        expect(w.magic.settle(THREAD, joined)).toEqual({
            files: [],
            id: 'id-1',
            note: null,
        });
        expect(w.quills.get(THREAD).text).toBe('and one more');
        expect(w.magic.markOf(THREAD)?.state).toBe('joined');
    });

    test('a quill he rewrote meanwhile is left as it is', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const joined = { ...ON, taken: ['id-1'] };
        w.type('something else');
        w.magic.settle(THREAD, joined);
        expect(w.quills.get(THREAD).text).toBe('something else');
    });

    test('still waiting: nothing changes', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        const waiting = { ...ON, waiting: ['id-1'] };
        w.pass(JOIN_TAKE_MS * 2);
        expect(w.magic.settle(THREAD, waiting)).toBeNull();
    });

    test('listed nowhere a minute on: the mark goes, the row too, the words stay', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        w.type('also the tests');
        expect(w.magic.settle(THREAD, ON)).toBeNull();
        w.pass(JOIN_TAKE_MS);
        expect(w.magic.settle(THREAD, ON)).toEqual({
            id: 'id-1',
            note: 'Not taken, still in the box',
        });
        expect(w.quills.get(THREAD).text).toBe('also the tests');
        await Promise.resolve();
        expect(w.magic.markOf(THREAD)).toBeNull();
        await w.doors.io.sleep(0);
        expect(w.rows()).toEqual([]);
    });

    test('a joined mark is forgotten once it was shown', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        w.magic.settle(THREAD, { ...ON, joined: ['id-1'] });
        w.magic.forget(THREAD, 'id-1');
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
    // the world's clock: a mark is made at its now; his message lands a moment after
    const LATER = new Date(2_000_000_000_000).toISOString();
    const EARLIER = new Date(500).toISOString();

    test('an older message of his with the same words never settles it: a re-read after a switch brings them all back', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'yes', ON);
        expect(
            w.magic.arrived(THREAD, [{ at: EARLIER, text: 'yes' }]),
        ).toBeNull();
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('a row with no time never settles it', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'yes', ON);
        expect(w.magic.arrived(THREAD, [{ at: null, text: 'yes' }])).toBeNull();
    });

    test('the joined words show as his message: the quill empties in the same draw', async () => {
        const w = world();
        w.type('what tails do you have atm?');
        await w.magic.click(THREAD, SID, 'what tails do you have atm?', ON);
        expect(
            w.magic.arrived(THREAD, [
                { at: LATER, text: 'what tails do you have atm?' },
            ]),
        ).toEqual({ files: [], id: 'id-1', note: null });
        expect(w.quills.get(THREAD).text).toBe('');
        expect(w.magic.markOf(THREAD)?.state).toBe('joined');
    });

    test('what he typed after them stays', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        w.type('also the tests\nand one more');
        w.magic.arrived(THREAD, [{ at: LATER, text: 'also the tests' }]);
        expect(w.quills.get(THREAD).text).toBe('and one more');
    });

    // dima's wisp 15:50: he typed « fix pls» after 🍕, the turn took the words before that retext; they sat in the
    // quill ~2 s after showing in the chat, until the state settled the mark
    test('words a turn took before his retext settle the mark at once, his later words stay', async () => {
        const w = world();
        w.type('hold 1s');
        await w.magic.click(THREAD, SID, 'hold 1s', ON);
        w.type('hold 1s fix pls');
        await w.magic.typed(THREAD, 'hold 1s fix pls', ON);
        expect(
            w.magic.arrived(THREAD, [{ at: LATER, text: 'hold 1s' }]),
        ).toEqual({ files: [], id: 'id-1', note: null });
        expect(w.quills.get(THREAD).text).toBe('fix pls');
    });

    test('another message arriving leaves the mark waiting', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'also the tests', ON);
        expect(
            w.magic.arrived(THREAD, [{ at: LATER, text: 'something else' }]),
        ).toBeNull();
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
    });

    test('no mark, nothing to settle', () => {
        const w = world();
        expect(w.magic.arrived(THREAD, [{ at: LATER, text: 'hi' }])).toBeNull();
    });
});

describe('files waiting join the turn with the words (FRM-638 slice 5, dima’s wisps 16:36 and 16:37)', () => {
    const PIC = '/app/shots/shot 1.png';

    test('a click with files waiting marks: 🍕, and the row carries each path after the words', async () => {
        const w = world();
        w.type('look');
        expect(await w.magic.click(THREAD, SID, 'look', ON, [PIC])).toEqual({
            act: 'marked',
            note: null,
        });
        expect(w.magic.markOf(THREAD)?.state).toBe('pending');
        expect(w.rows()).toEqual([
            { id: 'id-1', text: 'look\n/app/shots/shot\\ 1.png' },
        ]);
    });

    test('files alone, no words, still mark', async () => {
        const w = world();
        expect((await w.magic.click(THREAD, SID, '', ON, [PIC])).act).toBe(
            'marked',
        );
        expect(w.rows()).toEqual([
            { id: 'id-1', text: '/app/shots/shot\\ 1.png' },
        ]);
    });

    test('a file added or taken off under the mark rides the same row; the last one gone with no words unmarks', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'look', ON, [PIC]);
        expect(await w.magic.typed(THREAD, 'look', ON, [PIC, '/b.png'])).toBe(
            true,
        );
        expect(w.rows()).toEqual([
            { id: 'id-1', text: 'look\n/app/shots/shot\\ 1.png\n/b.png' },
        ]);
        expect(await w.magic.typed(THREAD, 'look', ON, [PIC, '/b.png'])).toBe(
            false,
        );
        expect(await w.magic.typed(THREAD, '', ON, [])).toBe(true);
        expect(w.magic.markOf(THREAD)).toBeNull();
        expect(w.rows()).toEqual([]);
    });

    test('a turn took it: the settle names the files that went, so the quill lets them go', async () => {
        const w = world();
        w.type('look');
        await w.magic.click(THREAD, SID, 'look', ON, [PIC]);
        expect(
            w.magic.arrived(THREAD, [
                { at: new Date(2_000).toISOString(), text: 'look' },
            ]),
        ).toEqual({ files: [PIC], id: 'id-1', note: null });
    });

    test('a reload keeps the mark’s files', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'look', ON, [PIC]);
        expect(w.reload().markOf(THREAD)?.files).toEqual([PIC]);
    });
});

describe('retexts under one mark run one at a time (sixth sense, slice 5 round 1)', () => {
    test('a × right after an add leaves the row without the file', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'look', ON, ['/a.png']);
        const add = w.magic.typed(THREAD, 'look', ON, ['/a.png', '/b.png']);
        const remove = w.magic.typed(THREAD, 'look', ON, ['/a.png']);
        await Promise.all([add, remove]);
        expect(w.rows()).toEqual([{ id: 'id-1', text: 'look\n/a.png' }]);
        expect(w.magic.markOf(THREAD)?.files).toEqual(['/a.png']);
    });
});

describe('a queued edit stays with its own mark (macroscope, slice 6)', () => {
    test('an edit queued under one mark never rewrites the mark set after it', async () => {
        const w = world();
        await w.magic.click(THREAD, SID, 'first', ON, []);
        const running = w.magic.typed(THREAD, 'first more', ON, []);
        const queued = w.magic.typed(THREAD, 'first even more', ON, []);
        w.quills.apply(THREAD, { id: 'id-1', type: 'unmarked' });
        const marked = w.magic.click(THREAD, SID, 'second', ON, []);
        await Promise.all([running, queued, marked]);
        expect(w.magic.markOf(THREAD)?.said).toBe('second');
        expect(w.rows().find((r) => r.id === 'id-2')?.text).toBe('second');
    });
});
