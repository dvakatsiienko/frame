/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));

import {
    joinRows,
    joinRowsText,
} from '../../../../.claude/plugin-x/mods/x-mod-stash/hooks/orbit.ts';
import { JOIN_TAKE_MS } from './joins.js';
import { JOINS_OFF, NOTES, createNotes } from './notes.js';
import { createRowModel } from './row-model.js';

const THREAD = '/t/a.jsonl';
const FILE = '/joins/a.jsonl';
const ROW = {
    at: null,
    id: '1a2b3c4d-0000-4000-8000-000000000000',
    kind: 'reply' as const,
};
const passage = (words: string, start = 0, row = ROW) => ({
    parts: [
        {
            block: 0,
            range: { end: start + words.length, start },
            source: words,
            words,
        },
    ],
    row,
});

/** the store, the join file and the transcript, in memory; the stash is played by hand */
function world() {
    const files = new Map<string, string>();
    const kept = new Map<string, string>();
    const locks = new Set<string>();
    const transcript: string[] = [];
    const trial: string[] = [];
    let now = 1_000_000;
    let asked = 0;
    let ids = 0;
    const made = () =>
        createNotes({
            dir: '/joins',
            io: {
                // the first one's program starts late, as a busy mac's may
                lock: async (path) => {
                    if (++asked === 1)
                        for (let i = 0; i < 40; i++) await Promise.resolve();
                    return locks.has(path) ? false : Boolean(locks.add(path));
                },
                lockAge: async () => 0,
                now: () => now,
                read: async (path) => files.get(path) ?? null,
                sleep: async (ms) => {
                    now += ms;
                },
                unlock: async (path) => {
                    locks.delete(path);
                },
                write: async (path, text) => {
                    files.set(path, text);
                },
            },
            linesWith: async (_thread, words) =>
                transcript.filter((line) => line.includes(words)),
            logTrial: (line) => trial.push(line),
            newId: () => `id-${++ids}`,
            store: {
                getItem: (key) => kept.get(key) ?? null,
                removeItem: (key) => kept.delete(key),
                setItem: (key, text) => kept.set(key, text),
            },
        });
    let notes = made();
    const rows = () => joinRows(files.get(FILE) ?? '');
    return {
        /** a turn took these rows: his messages as the transcript's reader draws them */
        arrive(taken = rows()) {
            const entry = {
                attachment: {
                    content: [joinRowsText(taken)],
                    type: 'hook_additional_context',
                },
                type: 'attachment',
                uuid: 'u-1',
            };
            // its real line opens with its parent
            const line = `{"parentUuid":"p-1",${JSON.stringify(entry).slice(1)}`;
            transcript.push(line);
            const model = createRowModel();
            model.add([line]);
            return model.rows.map((row) => row.text);
        },
        /** a note with its words typed, its id */
        draft: async (text: string, on = passage('the retry is cheap')) => {
            const { id } = notes.open(THREAD, on);
            await notes.typed(THREAD, id, text, ON);
            return id;
        },
        files,
        kept,
        locks,
        note: (id: string) => {
            const note = notes.of(THREAD).find((n) => n.id === id);
            if (!note) throw new Error(`no note ${id}`);
            return note;
        },
        get notes() {
            return notes;
        },
        pass(ms: number) {
            now += ms;
        },
        reload() {
            notes = made();
        },
        rows,
        texts: () => rows().map((r) => r.text),
        trial: () => trial.map((line) => JSON.parse(line)),
    };
}
const ON = { joined: [], push: [], taken: [], waiting: [] };

describe('a note joins through the thread’s join file', () => {
    test('ten on one message: a row per live note with its last text, the emptied one out, the taken one closed', async () => {
        const w = world();
        const ids: string[] = [];
        for (let i = 0; i < 10; i++) {
            const id = await w.draft(
                `note ${i}`,
                passage(`words ${i}`, i * 20),
            );
            expect(await w.notes.join(THREAD, id, ON, i)).toBeNull();
            ids.push(id);
        }
        const [edited = '', emptied = '', taken = ''] = ids;
        await w.notes.typed(THREAD, edited, 'edited', ON);
        await w.notes.typed(THREAD, emptied, ' ', ON);
        const takes = { ...ON, taken: [w.note(taken).joinId ?? ''] };
        await w.notes.settle(THREAD, takes);
        expect(await w.notes.typed(THREAD, taken, 'late', takes)).toBe(false);
        expect(w.note(taken)).toMatchObject({ state: 'taken', text: 'note 2' });
        // its words open a note of their own
        expect(w.notes.open(THREAD, passage('words 2', 40)).id).not.toBe(taken);
        expect(w.texts()).toHaveLength(9);
        expect(w.texts()[0]).toBe('dima on "words 0" (reply 1a2b3c4d): edited');
        expect(w.texts().join()).not.toContain('late');
        expect(w.note(emptied).state).toBe('draft');
    });

    test('Enter again takes it back, at once too', async () => {
        const w = world();
        const id = await w.draft('why?');
        const joined = w.notes.join(THREAD, id, ON, 0);
        expect(await w.notes.takeBack(THREAD, id, ON)).toBeNull();
        await joined;
        expect(w.rows()).toEqual([]);
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'why?' });
    });

    test('a held join file gives it back, its words kept', async () => {
        const w = world();
        const id = await w.draft('why?');
        w.locks.add(`${FILE}.lock`);
        expect(await w.notes.join(THREAD, id, ON, 0)).toMatch(/Not joined/);
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'why?' });
    });

    test('joins off: it says so, nothing is written', async () => {
        const w = world();
        const id = await w.draft('why?');
        expect(await w.notes.join(THREAD, id, null, 0)).toBe(JOINS_OFF);
        expect(w.note(id).state).toBe('draft');
        expect(w.rows()).toEqual([]);
    });

    test('a turn that took it first keeps it', async () => {
        const w = world();
        const id = await w.draft('why?');
        await w.notes.join(THREAD, id, ON, 0);
        const takes = { ...ON, taken: [w.note(id).joinId ?? ''] };
        expect(await w.notes.takeBack(THREAD, id, takes)).toMatch(/first/);
        expect(await w.notes.release(THREAD, id, takes, 0)).toEqual({
            reason: 'It joined the turn first',
        });
        expect(w.texts()).toHaveLength(1);
    });
});

describe('a note knows when the thread has it', () => {
    test.each([
        ['a plain one', 'the retry', 'why here?'],
        ['a quote holding «yes»', 'say «yes» now', 'no'],
        ['a note holding «»', 'the retry', 'say «no» instead»'],
        ['a note with a line break', 'the retry', 'one\ntwo'],
        ['a note holding "', 'the "retry"', 'drop "cheap"'],
        ['a note ending in a path', 'the retry', 'see this\n/tmp/a/b.md'],
        ['a note that reads as two', 'the retry', 'say »\n« so'],
    ])(
        '%s settles as joined by its transcript line, three under one head',
        async (_what, words, text) => {
            const w = world();
            const first = await w.draft('before', passage('before', 100));
            const id = await w.draft(text, passage(words));
            const last = await w.draft('after', passage('after', 200));
            for (const note of [first, id, last])
                await w.notes.join(THREAD, note, ON, 0);
            expect(w.notes.arrived(THREAD, w.arrive())).toBe(true);
            expect(
                [first, id, last].map((n) => [w.note(n).state, w.note(n).text]),
            ).toEqual([
                ['joined', 'before'],
                ['joined', text],
                ['joined', 'after'],
            ]);
        },
    );

    test('an edit that lost the race shows what the thread got, whichever tells first', async () => {
        for (const isStateFirst of [true, false]) {
            const w = world();
            const id = await w.draft('first');
            await w.notes.join(THREAD, id, ON, 0);
            const taken = w.rows();
            // the turn took the row, and the file still took the edit
            await w.notes.typed(THREAD, id, 'second', ON);
            const done = { ...ON, joined: [w.note(id).joinId ?? ''] };
            if (isStateFirst) await w.notes.settle(THREAD, done);
            w.notes.arrived(THREAD, w.arrive(taken));
            expect(w.note(id)).toMatchObject({
                state: 'joined',
                text: 'first',
            });
        }
    });

    test('listed nowhere: joined when the transcript holds its line, else his draft with its row out', async () => {
        const w = world();
        const had = await w.draft('had', passage('had', 0));
        const lost = await w.draft('lost', passage('lost', 100));
        for (const id of [had, lost]) await w.notes.join(THREAD, id, ON, 0);
        w.arrive(w.rows().slice(0, 1));
        await w.notes.settle(THREAD, ON);
        expect(w.note(lost).state).toBe('waiting');
        w.pass(JOIN_TAKE_MS);
        await w.notes.settle(THREAD, ON);
        expect(w.note(had).state).toBe('joined');
        expect(w.note(lost)).toMatchObject({ state: 'draft', text: 'lost' });
        expect(w.texts().join()).not.toContain('lost');
    });

    test('two notes of one quote: the line’s own text picks', async () => {
        const w = world();
        const a = await w.draft('one', passage('same', 0));
        const b = await w.draft('two', passage('same', 100));
        for (const id of [a, b]) await w.notes.join(THREAD, id, ON, 0);
        w.notes.arrived(THREAD, w.arrive(w.rows().slice(1)));
        expect([w.note(a).state, w.note(b).state]).toEqual([
            'waiting',
            'joined',
        ]);
    });
});

describe('a note sent now', () => {
    test('its waiting row is out first, its line is the prompt, and it is closed', async () => {
        const w = world();
        const id = await w.draft('now');
        await w.notes.join(THREAD, id, ON, 3);
        expect(await w.notes.release(THREAD, id, ON, 2)).toEqual({
            line: 'dima on "the retry is cheap" (reply 1a2b3c4d, 2 back): now',
        });
        expect(w.rows()).toEqual([]);
        expect(await w.notes.typed(THREAD, id, 'late', ON)).toBe(false);
    });

    test('one that did not go is a draft with its words and the reason', async () => {
        const w = world();
        const id = await w.draft('now');
        await w.notes.release(THREAD, id, ON, 0);
        w.notes.returned(THREAD, id, 'Not sent: refused');
        expect(w.note(id)).toMatchObject({
            reason: 'Not sent: refused',
            state: 'draft',
            text: 'now',
        });
    });
});

describe('the trial line', () => {
    test('once at joined, none while waiting, not again after a reload', async () => {
        const w = world();
        const id = await w.draft('why?', passage('word '.repeat(40)));
        await w.notes.join(THREAD, id, ON, 0);
        expect(w.trial()).toEqual([]);
        const done = { ...ON, joined: [w.note(id).joinId ?? ''] };
        await w.notes.settle(THREAD, done);
        w.notes.arrived(THREAD, w.arrive());
        w.reload();
        await w.notes.settle(THREAD, done);
        w.notes.arrived(THREAD, w.arrive());
        expect(w.trial()).toMatchObject([
            { isCut: true, note: 'why?', short: '1a2b3c4d', sid: 'a' },
        ]);
    });

    test('a sent one once its line lands', async () => {
        const w = world();
        const id = await w.draft('now');
        const out = await w.notes.release(THREAD, id, ON, 0);
        expect(w.trial()).toEqual([]);
        if ('line' in out) w.notes.arrived(THREAD, [out.line]);
        expect(w.trial()).toHaveLength(1);
    });
});

describe('the notes he keeps', () => {
    test('come back after a reload, a thread’s own; an emptied draft leaves no record', async () => {
        const w = world();
        const id = await w.draft('kept');
        await w.draft('gone', passage('gone', 100));
        const gone = w.notes.of(THREAD).at(-1)?.id ?? '';
        await w.notes.typed(THREAD, gone, '', ON);
        w.notes.tidy(THREAD);
        w.reload();
        expect(w.notes.of(THREAD).map((n) => [n.id, n.text])).toEqual([
            [id, 'kept'],
        ]);
        expect(w.notes.of('/t/b.jsonl')).toEqual([]);
        await w.notes.typed(THREAD, id, '', ON);
        expect(w.kept.has(NOTES + THREAD)).toBe(false);
    });

    test('words that share a character with an unsent note open it, a joined one’s words a new note', async () => {
        const w = world();
        const id = await w.draft('why?', passage('0123456789', 10));
        expect(w.notes.open(THREAD, passage('89ab', 18)).id).toBe(id);
        expect(w.notes.open(THREAD, passage('abcd', 20)).id).not.toBe(id);
        await w.notes.join(THREAD, id, ON, 0);
        await w.notes.settle(THREAD, {
            ...ON,
            joined: [w.note(id).joinId ?? ''],
        });
        expect(w.notes.open(THREAD, passage('0123456789', 10)).id).not.toBe(id);
    });

    test('a store that holds no list reads as none', () => {
        const w = world();
        w.kept.set(NOTES + THREAD, '{"broken"');
        expect(w.notes.of(THREAD)).toEqual([]);
    });
});
