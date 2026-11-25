/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));

import {
    joinRows,
    joinRowsText,
} from '../../../../.claude/plugin-x/mods/x-mod-stash/hooks/orbit.ts';
import { JOIN_TAKE_MS } from './joins.js';
import type { Joins } from './magic.js';
import { noteMarks } from './note-marks.js';
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

const ON: Joins = { joined: [], push: [], taken: [], waiting: [] };

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
                    at.locked();
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
            joinsOf: () => at.joins,
            linesWith: async (_thread, words) => {
                const lines = transcript.filter((line) => line.includes(words));
                await at.searching;
                return lines;
            },
            logTrial: (line) => trial.push(line),
            newId: () => `id-${++ids}`,
            store: {
                getItem: (key) => kept.get(key) ?? null,
                removeItem: (key) => kept.delete(key),
                setItem: (key, text) => kept.set(key, text),
            },
        });
    const at = {
        joins: ON as Joins | null | undefined,
        /** what happens while the join file is held */
        locked: () => {},
        searching: Promise.resolve(),
    };
    let notes = made();
    const rows = () => joinRows(files.get(FILE) ?? '');
    return Object.assign(at, {
        /** a turn took these rows: his messages as the transcript's reader draws them */
        arrive(taken = rows()) {
            const entry = {
                attachment: {
                    content: [joinRowsText(taken)],
                    type: 'hook_additional_context',
                },
                timestamp: new Date(now).toISOString(),
                type: 'attachment',
                uuid: 'u-1',
            };
            // its real line opens with its parent
            const line = `{"parentUuid":"p-1",${JSON.stringify(entry).slice(1)}`;
            transcript.push(line);
            const model = createRowModel();
            model.add([line]);
            return model.rows.map(({ at, text }) => ({ at, text }));
        },
        /** a note with its words typed, its id */
        draft: async (text: string, on = passage('the retry is cheap')) => {
            const { id } = notes.open(THREAD, on);
            notes.typed(THREAD, id, text);
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
        notes: new Proxy({} as typeof notes, {
            get: (_t, name) => notes[name as keyof typeof notes],
        }),
        pass(ms: number) {
            now += ms;
        },
        reload() {
            notes = made();
        },
        rows,
        /** what the thread's state says of its joins, then the notes settle */
        settle(joins: Joins) {
            at.joins = joins;
            return notes.settle(THREAD);
        },
        stamp: () => new Date(now).toISOString(),
        texts: () => rows().map((r) => r.text),
        trial: () => trial.map((line) => JSON.parse(line)),
        /** his keys rested */
        type: async (id: string, text: string) =>
            notes.typed(THREAD, id, text) && (await notes.write(THREAD, id)),
    });
}

describe('a note joins through the thread’s join file', () => {
    test('ten on one message: a row per live note with its last text, the emptied one out, the taken one closed', async () => {
        const w = world();
        const ids: string[] = [];
        for (let i = 0; i < 10; i++) {
            const id = await w.draft(
                `note ${i}`,
                passage(`words ${i}`, i * 20),
            );
            expect(await w.notes.join(THREAD, id, i)).toBeNull();
            ids.push(id);
        }
        const [edited = '', emptied = '', taken = ''] = ids;
        await w.type(edited, 'edited');
        await w.type(emptied, ' ');
        const takes = { ...ON, taken: [w.note(taken).joinId ?? ''] };
        await w.settle(takes);
        expect(await w.type(taken, 'late')).toBe(false);
        expect(w.note(taken)).toMatchObject({ state: 'taken', text: 'note 2' });
        // its words open a note of their own
        expect(w.notes.open(THREAD, passage('words 2', 40)).id).not.toBe(taken);
        expect(w.texts()).toHaveLength(9);
        expect(w.texts()[0]).toBe('dima on "words 0" (reply 1a2b3c4d): edited');
        expect(w.texts().join()).not.toContain('late');
        expect(w.note(emptied).state).toBe('draft');
    });

    test('words typed as it came back are his draft', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        const back = w.notes.takeBack(THREAD, id);
        expect(await w.type(id, 'mine too')).toBe(true);
        await back;
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'mine too' });
    });

    test('Enter again takes it back, at once too', async () => {
        const w = world();
        const id = await w.draft('why?');
        const joined = w.notes.join(THREAD, id, 0);
        expect(await w.notes.takeBack(THREAD, id)).toBeNull();
        await joined;
        expect(w.rows()).toEqual([]);
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'why?' });
    });

    test('a held join file gives it back, its words kept', async () => {
        const w = world();
        const id = await w.draft('why?');
        w.locks.add(`${FILE}.lock`);
        expect(await w.notes.join(THREAD, id, 0)).toMatch(/Not joined/);
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'why?' });
    });

    test('joins off: it says so, nothing is written', async () => {
        const w = world();
        const id = await w.draft('why?');
        w.joins = null;
        expect(await w.notes.join(THREAD, id, 0)).toBe(JOINS_OFF);
        expect(w.note(id).state).toBe('draft');
        expect(w.rows()).toEqual([]);
    });

    test('a turn that took it first keeps it', async () => {
        const w = world();
        const id = await w.draft('why?');
        await w.notes.join(THREAD, id, 0);
        const takes = { ...ON, taken: [w.note(id).joinId ?? ''] };
        w.joins = takes;
        expect(await w.notes.takeBack(THREAD, id)).toMatch(/first/);
        expect(await w.notes.release(THREAD, id, 0)).toEqual({
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
                await w.notes.join(THREAD, note, 0);
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
            await w.notes.join(THREAD, id, 0);
            const taken = w.rows();
            // the turn took the row, and the file still took the edit
            await w.type(id, 'second');
            const done = { ...ON, joined: [w.note(id).joinId ?? ''] };
            if (isStateFirst) await w.settle(done);
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
        for (const id of [had, lost]) await w.notes.join(THREAD, id, 0);
        w.arrive(w.rows().slice(0, 1));
        await w.notes.settle(THREAD);
        expect(w.note(lost).state).toBe('waiting');
        w.pass(JOIN_TAKE_MS);
        await w.notes.settle(THREAD);
        expect(w.note(had).state).toBe('joined');
        expect(w.note(lost)).toMatchObject({ state: 'draft', text: 'lost' });
        expect(w.texts().join()).not.toContain('lost');
    });

    test('a line as old as another note of the same words is not found for it', async () => {
        const w = world();
        const old = await w.draft('same');
        await w.notes.join(THREAD, old, 0);
        w.notes.arrived(THREAD, w.arrive());
        w.pass(5000);
        const id = await w.draft('same');
        await w.notes.join(THREAD, id, 0);
        w.pass(JOIN_TAKE_MS);
        await w.notes.settle(THREAD);
        expect(w.note(id).state).toBe('draft');
    });

    test('two notes of one quote: the line’s own text picks', async () => {
        const w = world();
        const a = await w.draft('one', passage('same', 0));
        const b = await w.draft('two', passage('same', 100));
        for (const id of [a, b]) await w.notes.join(THREAD, id, 0);
        w.notes.arrived(THREAD, w.arrive(w.rows().slice(1)));
        expect([w.note(a).state, w.note(b).state]).toEqual([
            'waiting',
            'joined',
        ]);
    });
});

describe('a turn that takes it while its file is written (wisphunter, 25 Nov)', () => {
    const held = async () => {
        const w = world();
        const id = await w.draft('once');
        await w.notes.join(THREAD, id, 0);
        w.locked = () => {
            w.joins = { ...ON, taken: [w.note(id).joinId ?? ''] };
        };
        return { id, w };
    };

    test('⌘Enter sends nothing', async () => {
        const { id, w } = await held();
        expect(await w.notes.release(THREAD, id, 0)).toEqual({
            reason: 'It joined the turn first',
        });
        expect(w.note(id).state).toBe('waiting');
    });

    test('Enter leaves it the turn’s', async () => {
        const { id, w } = await held();
        expect(await w.notes.takeBack(THREAD, id)).toMatch(/first/);
        expect(w.note(id).state).toBe('waiting');
    });

    test('while it is looked for: no draft of it', async () => {
        const w = world();
        const id = await w.draft('once');
        await w.notes.join(THREAD, id, 0);
        w.pass(JOIN_TAKE_MS);
        w.searching = Promise.resolve().then(() => {
            w.joins = { ...ON, taken: [w.note(id).joinId ?? ''] };
        });
        await w.notes.settle(THREAD);
        expect(w.note(id).state).toBe('waiting');
        expect(w.texts()).toHaveLength(1);
    });

    test('nor of one taken back and joined again meanwhile', async () => {
        const w = world();
        const id = await w.draft('once');
        await w.notes.join(THREAD, id, 0);
        w.pass(JOIN_TAKE_MS);
        w.searching = w.notes
            .takeBack(THREAD, id)
            .then(() => w.notes.join(THREAD, id, 0))
            .then(() => {});
        await w.notes.settle(THREAD);
        expect(w.note(id).state).toBe('waiting');
        expect(w.texts()).toHaveLength(1);
    });

    test('nor once another thread is shown', async () => {
        const w = world();
        const id = await w.draft('once');
        await w.notes.join(THREAD, id, 0);
        w.pass(JOIN_TAKE_MS);
        w.joins = undefined;
        expect(await w.notes.settle(THREAD)).toBe(false);
        expect(w.note(id).state).toBe('waiting');
    });
});

describe('words its row has not got', () => {
    test('go with a send, and come back with the note', async () => {
        for (const isSent of [true, false]) {
            const w = world();
            const id = await w.draft('mine');
            await w.notes.join(THREAD, id, 0);
            w.notes.typed(THREAD, id, 'mine too');
            if (isSent)
                expect(await w.notes.release(THREAD, id, 0)).toEqual({
                    line: expect.stringMatching(/: mine too$/),
                });
            else await w.notes.takeBack(THREAD, id);
            expect(w.note(id).text).toBe('mine too');
        }
    });

    test('refused by a held file, they go in as the thread’s state changes', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        w.locks.add(`${FILE}.lock`);
        expect(await w.type(id, 'mine too')).toBe(false);
        w.locks.clear();
        w.joins = { ...ON, waiting: [w.note(id).joinId ?? ''] };
        await w.notes.settle(THREAD);
        for (let i = 0; i < 80; i++) await Promise.resolve();
        expect(w.texts()).toEqual([expect.stringMatching(/: mine too$/)]);
    });

    test('a lock that broke is a refusal, never an error', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        w.locked = () => {
            throw new Error('no shell');
        };
        expect(await w.type(id, 'mine too')).toBe(false);
        w.locked = () => {};
        w.joins = { ...ON, waiting: [w.note(id).joinId ?? ''] };
        await w.notes.settle(THREAD);
        for (let i = 0; i < 80; i++) await Promise.resolve();
        expect(w.texts()).toEqual([expect.stringMatching(/: mine too$/)]);
    });

    test('undone, the row stays as it was', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        let writes = 0;
        w.locked = () => {
            writes += 1;
        };
        w.notes.typed(THREAD, id, 'mine too');
        expect(await w.type(id, 'mine')).toBe(true);
        expect(writes).toBe(0);
    });

    test.each(['taken', 'joined'] as const)(
        'are not shown as the thread’s once it is %s',
        async (list) => {
            const w = world();
            const id = await w.draft('mine');
            await w.notes.join(THREAD, id, 0);
            w.notes.typed(THREAD, id, 'mine too');
            await w.settle({ ...ON, [list]: [w.note(id).joinId ?? ''] });
            expect(w.note(id)).toMatchObject({ state: list, text: 'mine' });
        },
    );
});

test('a line as old as another note of the same words is not this one’s', async () => {
    const w = world();
    const old = w.stamp();
    w.pass(5000);
    const id = await w.draft('why?');
    await w.notes.join(THREAD, id, 0);
    const [row] = w.arrive();
    expect(w.notes.arrived(THREAD, [{ at: old, text: row?.text ?? '' }])).toBe(
        false,
    );
    expect(w.notes.arrived(THREAD, [{ at: null, text: row?.text ?? '' }])).toBe(
        false,
    );
    expect(w.note(id).state).toBe('waiting');
    expect(w.notes.arrived(THREAD, row ? [row] : [])).toBe(true);
});

describe('a note sent now', () => {
    test('its waiting row is out first, its line is the prompt, and it is closed', async () => {
        const w = world();
        const id = await w.draft('now');
        await w.notes.join(THREAD, id, 3);
        expect(await w.notes.release(THREAD, id, 2)).toEqual({
            line: 'dima on "the retry is cheap" (reply 1a2b3c4d, 2 back): now',
        });
        expect(w.rows()).toEqual([]);
        expect(w.notes.typed(THREAD, id, 'late')).toBe(false);
    });

    test('a × on it makes it his draft, one that waits to join keeps its row', async () => {
        const w = world();
        const id = await w.draft('why?');
        await w.notes.join(THREAD, id, 3);
        const [line] = w.texts();
        expect(w.notes.pulled(THREAD, `${line}`)).toBe(false);
        expect([w.note(id).state, w.texts()]).toEqual(['waiting', [line]]);
        await w.notes.release(THREAD, id, 3);
        expect(w.notes.pulled(THREAD, `${line}`)).toBe(true);
        expect(w.note(id)).toMatchObject({ state: 'draft', text: 'why?' });
    });

    test('one that did not go is a draft with its words and the reason', async () => {
        const w = world();
        const id = await w.draft('now');
        await w.notes.release(THREAD, id, 0);
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
        await w.notes.join(THREAD, id, 0);
        expect(w.trial()).toEqual([]);
        const done = { ...ON, joined: [w.note(id).joinId ?? ''] };
        await w.settle(done);
        w.notes.arrived(THREAD, w.arrive());
        w.reload();
        await w.settle(done);
        w.notes.arrived(THREAD, w.arrive());
        expect(w.trial()).toMatchObject([
            { isCut: true, note: 'why?', short: '1a2b3c4d', sid: 'a' },
        ]);
    });

    test('a sent one once its line lands', async () => {
        const w = world();
        const id = await w.draft('now');
        const out = await w.notes.release(THREAD, id, 0);
        expect(w.trial()).toEqual([]);
        if ('line' in out)
            w.notes.arrived(THREAD, [{ at: w.stamp(), text: out.line }]);
        expect(w.trial()).toHaveLength(1);
    });
});

describe('the notes he keeps', () => {
    test('come back after a reload, a thread’s own; an emptied draft leaves no record', async () => {
        const w = world();
        const id = await w.draft('kept');
        await w.draft('gone', passage('gone', 100));
        const gone = w.notes.of(THREAD).at(-1)?.id ?? '';
        w.notes.typed(THREAD, gone, '');
        w.notes.tidy(THREAD);
        w.reload();
        expect(w.notes.of(THREAD).map((n) => [n.id, n.text])).toEqual([
            [id, 'kept'],
        ]);
        expect(w.notes.of('/t/b.jsonl')).toEqual([]);
        w.notes.typed(THREAD, id, '');
        expect(w.kept.has(NOTES + THREAD)).toBe(false);
    });

    test('of two unsent on the same words the newer opens', async () => {
        const w = world();
        const old = await w.draft('old');
        await w.notes.release(THREAD, old, 0);
        const id = await w.draft('new');
        w.notes.returned(THREAD, old);
        expect(w.notes.open(THREAD, passage('the retry is cheap')).id).toBe(id);
    });

    test('words that share a character with an unsent note open it, a joined one’s words a new note', async () => {
        const w = world();
        const id = await w.draft('why?', passage('0123456789', 10));
        expect(w.notes.open(THREAD, passage('89ab', 18)).id).toBe(id);
        expect(w.notes.open(THREAD, passage('abcd', 20)).id).not.toBe(id);
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.notes.open(THREAD, passage('0123456789', 10)).id).not.toBe(id);
    });

    test('an older page that joined the row: the same words still open it, that page’s text before them', async () => {
        const w = world();
        const on = passage('0123456789', 10);
        const id = await w.draft('why?', on);
        const [part] = on.parts;
        const moved = {
            parts: [
                {
                    block: 3,
                    range: { end: 10 + 12 + 10, start: 10 + 12 },
                    source: `older text\n\n${part?.source}`,
                    words: '0123456789',
                },
            ],
            row: { ...ROW, id: 'page-row' },
        };
        const rowOf = () => 'page-row';
        expect(w.notes.open(THREAD, moved, rowOf).id).toBe(id);
        const before = {
            ...moved,
            parts: moved.parts.map((p) => ({
                ...p,
                range: { end: 10, start: 0 },
            })),
        };
        expect(w.notes.open(THREAD, before, rowOf).id).not.toBe(id);
    });

    test('a store that holds no list reads as none', () => {
        const w = world();
        w.kept.set(NOTES + THREAD, '{"broken"');
        expect(w.notes.of(THREAD)).toEqual([]);
    });
});

describe('where a note’s words are painted (FRM-585 B1)', () => {
    const TEXT = 'the **retry** is cheap, see [the run](path:0) and `x run`.';
    const on = (slice: string, over: Record<string, unknown> = {}) => {
        const start = TEXT.indexOf(slice);
        return {
            parts: [
                {
                    block: 0,
                    range: { end: start + slice.length, start },
                    source: TEXT,
                    words: slice.trim(),
                    ...over,
                },
            ],
            row: ROW,
        };
    };
    const note = (passage: object, state = 'waiting', id = 'n') =>
        ({ id, passage, state }) as never;
    const slices = (passage: object, sources: string[]) =>
        noteMarks([note(passage)], sources).map(({ block, end, start }) => [
            block,
            sources[block]?.slice(start, end),
        ]);

    test.each([
        ['bold', 'the **retry** is'],
        ['a link', '[the run](path:0) and'],
        ['a code span', 'and `x run`'],
        ['a space at each edge', ' is cheap, '],
    ])('over %s, the passage’s own text', (_what, slice) => {
        expect(slices(on(slice), [TEXT])).toEqual([[0, slice.trim()]]);
    });

    test.each([
        ['a reply that grew', [`${TEXT}\n\nand more`], 0],
        ['a page landed above', [`older\n\n${TEXT}`], 0],
        ['a block cut before it', ['```\ncode\n```', TEXT], 1],
    ])('%s: found again', (_what, sources, block) => {
        expect(slices(on('is cheap'), sources)).toEqual([[block, 'is cheap']]);
    });

    test('a missing range: by its words', () => {
        expect(slices(on('is cheap', { range: null }), [TEXT])).toEqual([
            [0, 'is cheap'],
        ]);
    });

    test('a phrase held twice: at its range while it stands there, nowhere once moved', () => {
        const source = 'yes, then yes';
        const twice = {
            parts: [
                {
                    block: 0,
                    range: { end: 13, start: 9 },
                    source,
                    words: 'yes',
                },
            ],
            row: ROW,
        };
        expect(noteMarks([note(twice)], [source])).toMatchObject([
            { end: 13, start: 10 },
        ]);
        expect(noteMarks([note(twice)], [`so ${source}`])).toEqual([]);
    });

    test('words no longer there: none, the other part’s kept', () => {
        const both = on('is cheap');
        both.parts.push({ ...both.parts[0], words: 'gone' } as never);
        Object.assign(both.parts[1] as object, { range: null });
        expect(slices(both, [TEXT])).toEqual([[0, 'is cheap']]);
        expect(slices(on('is cheap'), ['another text'])).toEqual([]);
    });

    test('one the thread has is the quieter, under the others', () => {
        const marks = noteMarks(
            [
                note(on('is cheap'), 'draft', 'a'),
                note(on('is cheap'), 'joined', 'b'),
                note(on('is cheap'), 'sent', 'c'),
            ],
            [TEXT],
        );
        expect(marks.map(({ id, isStrong }) => [id, isStrong])).toEqual([
            ['b', false],
            ['c', false],
            ['a', true],
        ]);
    });
});
