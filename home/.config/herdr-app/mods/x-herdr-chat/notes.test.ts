/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));

import { JOIN_TAKE_MS } from './joins.js';
import { noteMarks } from './note-marks.js';
import { JOINS_OFF, NEW_NOTE, NOTES } from './notes.js';
import { FILE, ON, ROW, THREAD, passage, world } from './notes-world.ts';
import { linkPaths } from './path-links.js';

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

    test('a prompt of its words is not its join', async () => {
        const w = world();
        const id = await w.draft('why?');
        await w.notes.join(THREAD, id, 0);
        const rows = w.arrive().map((r) => ({ ...r, isJoin: false }));
        expect(w.notes.arrived(THREAD, rows)).toBe(false);
        expect(w.note(id).state).toBe('waiting');
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
        'are a draft of their own once it is %s, a reload after it too',
        async (list) => {
            const w = world();
            const id = await w.draft('mine');
            await w.notes.join(THREAD, id, 0);
            w.notes.typed(THREAD, id, 'mine too');
            await w.settle({ ...ON, [list]: [w.note(id).joinId ?? ''] });
            expect(w.note(id)).toMatchObject({ state: list, text: 'mine' });
            w.reload();
            expect(w.notes.of(THREAD).at(-1)).toMatchObject({
                passage: w.note(id).passage,
                reason: NEW_NOTE,
                state: 'draft',
                text: 'too',
            });
            expect(w.moved).toEqual([
                [id, w.notes.of(THREAD).at(-1)?.id, 'mine '.length],
            ]);
        },
    );

    test.each([
        ['a word cut by the take is whole', 'the ret', 'the retry', 'retry'],
        ['a one-word note', 'ret', 'retry now', 'retry now'],
        ['a sentence after a stop', 'one.', 'one. two', 'two'],
        ['a line under it', 'one', 'one\ntwo', 'two'],
        ['a word right after a sign', 'see:', 'see:x', 'x'],
        ['a letter doubled inside', 'aXa', 'aXXa', 'aXXa'],
        ['words changed inside are all of them', 'a b c', 'a x c', 'a x c'],
        ['a shorter note in its place', 'a long one', 'no', 'no'],
        ['words only taken out leave none', 'not cheap', 'cheap', null],
        ['nor does a space', 'one', 'one  ', null],
        ['nor an emptied one', 'one', '', null],
        ['nor spaces in its place', 'one', '   ', null],
    ])('%s', async (_what, got, typed, past) => {
        const w = world();
        const id = await w.draft(got);
        await w.notes.join(THREAD, id, 0);
        w.notes.typed(THREAD, id, typed);
        await w.settle({ ...ON, taken: [w.note(id).joinId ?? ''] });
        expect(
            w.notes
                .of(THREAD)
                .filter((n) => n.id !== id)
                .map((n) => n.text),
        ).toEqual(past === null ? [] : [past]);
    });

    test('his row was rewritten as the turn took it: the words it did not get are his', async () => {
        const w = world();
        const id = await w.draft('first');
        await w.notes.join(THREAD, id, 0);
        const taken = w.rows();
        await w.type(id, 'second');
        w.notes.arrived(THREAD, w.arrive(taken));
        expect(w.notes.of(THREAD).map((n) => [n.state, n.text])).toEqual([
            ['joined', 'first'],
            ['draft', 'second'],
        ]);
    });

    // the 🔎's round 2 on 51feed3b, v6
    test('joined, its later words joined as their own note stay that note’s', async () => {
        const w = world();
        const id = await w.draft('hello world');
        await w.notes.join(THREAD, id, 0);
        const taken = w.rows();
        await w.type(id, 'hello brave world');
        w.notes.arrived(THREAD, w.arrive(taken));
        const next = w.notes.of(THREAD).find((n) => n.id !== id)?.id ?? '';
        w.pass(1000);
        await w.notes.join(THREAD, next, 0);
        const own = w.rows().filter((r) => r.id === w.note(next).joinId);
        w.pass(1000);
        w.notes.arrived(THREAD, w.arrive(own));
        expect(w.notes.of(THREAD).map((n) => [n.state, n.text])).toEqual([
            ['joined', 'hello world'],
            ['joined', 'hello brave world'],
        ]);
    });

    test('a reload before his keys rested: its row has them at the next settle', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        w.notes.typed(THREAD, id, 'mine too');
        w.reload();
        await w.settle({ ...ON, waiting: [w.note(id).joinId ?? ''] });
        expect(w.texts()).toEqual([expect.stringMatching(/: mine too$/)]);
    });

    test('a settle under his fingers writes none', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        for (let i = 0; i < 80; i++) await Promise.resolve();
        w.pass(5000);
        w.notes.typed(THREAD, id, 'mine t');
        await w.settle({ ...ON, waiting: [w.note(id).joinId ?? ''] });
        expect(w.texts()).toEqual([expect.stringMatching(/: mine$/)]);
    });

    test('emptied, its take back refused once: its row is out at the next settle', async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        w.locks.add(`${FILE}.lock`);
        expect(await w.type(id, '')).toBe(false);
        expect(w.notes.isRefused(id)).toBe(true);
        w.locks.clear();
        expect(
            await w.settle({ ...ON, waiting: [w.note(id).joinId ?? ''] }),
        ).toBe(true);
        expect([w.rows(), w.note(id).state, w.notes.isRefused(id)]).toEqual([
            [],
            'draft',
            false,
        ]);
    });
});

describe('a look that could not be made decides nothing', () => {
    const late = async () => {
        const w = world();
        const id = await w.draft('mine');
        await w.notes.join(THREAD, id, 0);
        w.pass(JOIN_TAKE_MS);
        return { id, w };
    };

    test('its row could not be taken out: no draft of it', async () => {
        const { id, w } = await late();
        w.locks.add(`${FILE}.lock`);
        await w.notes.settle(THREAD);
        expect([w.note(id).state, w.texts().length]).toEqual(['waiting', 1]);
        w.locks.clear();
        await w.notes.settle(THREAD);
        expect([w.note(id).state, w.texts().length]).toEqual(['draft', 0]);
    });

    test('its row is gone by itself: his draft', async () => {
        const { id, w } = await late();
        w.files.set(FILE, '');
        await w.notes.settle(THREAD);
        expect(w.note(id).state).toBe('draft');
    });

    test('its transcript could not be searched: no draft of it', async () => {
        const { id, w } = await late();
        w.isSearchBroken = true;
        await w.notes.settle(THREAD);
        expect([w.note(id).state, w.texts().length]).toEqual(['waiting', 1]);
    });

    test('its file is held: Enter and ⌘Enter say so, never that it joined', async () => {
        const { id, w } = await late();
        w.locks.add(`${FILE}.lock`);
        expect(await w.notes.takeBack(THREAD, id)).toMatch(/held/);
        expect(await w.notes.release(THREAD, id, 0)).toEqual({
            reason: expect.stringMatching(/held/),
        });
        expect(w.note(id).state).toBe('waiting');
    });

    test('its thread’s state is not read yet: it joins', async () => {
        const w = world();
        const id = await w.draft('mine');
        w.joins = undefined;
        expect(await w.notes.join(THREAD, id, 0)).toBeNull();
        expect(w.texts()).toHaveLength(1);
    });
});

// FRM-585:W72
test('the line a note joins with carries the sentence its words sit in, and a far message’s first words', async () => {
    const w = world();
    const source = 'One thing. So the retry is cheap here. Next.';
    const far = { ...ROW, head: 'One thing. So the retry…' };
    const id = await w.draft(
        'why here?',
        passage('retry', source.indexOf('retry'), far, source),
    );
    await w.notes.join(THREAD, id, 20);
    expect(w.texts()).toEqual([
        'dima on "So the ⟦retry⟧ is cheap here." (reply 1a2b3c4d, 20 back, «One thing. So the retry…»): why here?',
    ]);
});

test('the line of words over two text views quotes all of them', async () => {
    const w = world();
    const first = passage('More', 0, ROW, 'More here.');
    const second = passage('Second block', 0, ROW, 'Second block holds.');
    const id = await w.draft('both', {
        ...first,
        parts: [...first.parts, { ...second.parts[0], block: 1 }],
    });
    await w.notes.join(THREAD, id, 0);
    expect(w.texts()).toEqual([
        'dima on "More … Second block" (reply 1a2b3c4d): both',
    ]);
});

// FRM-585 C3
test('a message of his is a note by the lines written for it, never by how it reads', async () => {
    const w = world();
    const id = await w.draft('why here?', passage('the retry'));
    await w.notes.join(THREAD, id, 0);
    const [row] = w.arrive();
    w.notes.arrived(THREAD, row ? [row] : []);
    expect(w.notes.noteOf(THREAD, row?.text ?? '')).toEqual({
        isJoined: true,
        quote: 'the retry',
        text: 'why here?',
    });
    expect(
        w.notes.noteOf(THREAD, 'dima on "the retry" (reply 1a2b3c4d): typed'),
    ).toBeNull();
});

// the 🔎's round 1 on 154: a line he wrote is a note only once the thread has it
test('a note whose line the thread has not taken yet is not a note of his message', async () => {
    const w = world();
    const id = await w.draft('why here?', passage('the retry'));
    await w.notes.join(THREAD, id, 0);
    const [row] = w.arrive();
    expect(w.note(id).state).not.toBe('joined');
    expect(w.notes.noteOf(THREAD, row?.text ?? '')).toBeNull();
    w.notes.arrived(THREAD, row ? [row] : []);
    expect(w.notes.noteOf(THREAD, row?.text ?? '')).not.toBeNull();
});

describe('a reload as a note was sent', () => {
    const cut = async () => {
        const w = world();
        const id = await w.draft('mine');
        const out = await w.notes.release(THREAD, id, 0);
        expect(w.note(id).state).toBe('sending');
        w.pass(1000);
        w.reload();
        return { id, line: 'line' in out ? out.line : '', w };
    };

    test('it is his draft, and says why', async () => {
        const { id, w } = await cut();
        expect(w.note(id)).toMatchObject({
            reason: expect.stringMatching(/reloaded/),
            state: 'draft',
            text: 'mine',
        });
    });

    test('its line in the transcript says it went, what he typed since a draft of its own', async () => {
        const { id, line, w } = await cut();
        w.notes.typed(THREAD, id, 'mine and more');
        expect(w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }])).toBe(
            true,
        );
        expect(w.notes.of(THREAD).map((n) => [n.state, n.text])).toEqual([
            ['sent', 'mine'],
            ['draft', 'and more'],
        ]);
    });

    test('joined since, the lost line is no word of its own', async () => {
        const { id, w } = await cut();
        await w.notes.join(THREAD, id, 0);
        expect(w.note(id).said).toHaveLength(1);
    });

    // the 🔎's round 2 on 51feed3b, v7
    test('joined since, the cut send landing first sends it once: its row leaves', async () => {
        const { id, line, w } = await cut();
        await w.notes.join(THREAD, id, 0);
        w.pass(1000);
        w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }]);
        expect(w.note(id)).toMatchObject({ state: 'sent', text: 'mine' });
        await vi.waitFor(() => expect(w.rows()).toEqual([]));
    });

    test('joined since at another place under the reply, the cut send still sends it once', async () => {
        const { id, line, w } = await cut();
        await w.notes.join(THREAD, id, 1);
        w.pass(1000);
        w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }]);
        expect(w.note(id).state).toBe('sent');
    });

    test('joined since, its row’s words joining a turn are the join, its state not read yet', async () => {
        const { id, w } = await cut();
        await w.notes.join(THREAD, id, 0);
        w.joins = undefined;
        w.pass(1000);
        w.notes.arrived(THREAD, w.arrive());
        expect(w.note(id).state).toBe('joined');
    });

    test('joined since, its join refused by a held file as the cut send lands, it stays sent', async () => {
        const { id, line, w } = await cut();
        w.locks.add(`${FILE}.lock`);
        const joined = w.notes.join(THREAD, id, 0);
        w.pass(1000);
        w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }]);
        expect(await joined).toBeNull();
        expect(w.note(id).state).toBe('sent');
    });

    test('a send of its own since, which did not go, ends the cut send: that line landing later joins nothing', async () => {
        const { id, line, w } = await cut();
        await w.notes.join(THREAD, id, 0);
        await w.notes.takeBack(THREAD, id);
        await w.notes.release(THREAD, id, 0);
        w.notes.returned(THREAD, id);
        await w.notes.join(THREAD, id, 0);
        w.pass(1000);
        w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }]);
        expect(w.note(id).state).toBe('waiting');
    });

    test('joined since, a held file keeps the sent one’s row until the next settle takes it out', async () => {
        const { id, line, w } = await cut();
        await w.notes.join(THREAD, id, 0);
        w.locks.add(`${FILE}.lock`);
        w.pass(1000);
        w.notes.arrived(THREAD, [{ at: w.stamp(), text: line }]);
        // its file work is done once a take back, queued after it, answers
        await w.notes.takeBack(THREAD, id);
        expect(w.rows()).toHaveLength(1);
        w.locks.clear();
        await w.notes.settle(THREAD);
        await vi.waitFor(() => expect(w.rows()).toEqual([]));
        expect(w.note(id)).toMatchObject({ joinId: null, state: 'sent' });
    });
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
    const TEXT = 'qrst wxyz0123456789abcd efgh';
    const part = (words: string) =>
        passage(words, TEXT.indexOf(words), ROW, TEXT);
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
        const id = await w.draft('why?', part('0123456789'));
        expect(w.notes.open(THREAD, part('89ab')).id).toBe(id);
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.notes.open(THREAD, part('0123456789')).id).not.toBe(id);
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

    test('ranges that only touch are two notes', async () => {
        const w = world();
        const id = await w.draft('why?', part('0123456789'));
        expect(w.notes.open(THREAD, part('abcd')).id).not.toBe(id);
        expect(w.notes.open(THREAD, part('wxyz')).id).not.toBe(id);
    });

    describe('a path above his words became a link, or a link its words again', () => {
        const plain = 'see /tmp/a.md first\n\nthe retry is cheap, so is this';
        const linked = linkPaths(plain, ['/tmp/a.md']);
        const on = (source: string, words: string) => {
            const start = source.indexOf(words);
            return {
                parts: [
                    {
                        block: 0,
                        range: { end: start + words.length, start },
                        source,
                        words,
                    },
                ],
                row: ROW,
            };
        };
        test.each([
            ['linked', plain, linked],
            ['unlinked', linked, plain],
        ])(
            '%s: the same words open their note, others do not',
            async (_how, was, now) => {
                const w = world();
                const id = await w.draft('why?', on(was, 'retry is'));
                expect(w.notes.open(THREAD, on(now, 'is cheap')).id).toBe(id);
                const before = on(now, 'retry is').parts[0]?.range.start ?? 0;
                const old = on(was, 'retry is').parts[0]?.range.start ?? 0;
                expect(before).not.toBe(old);
                expect(w.notes.open(THREAD, on(now, 'so is this')).id).not.toBe(
                    id,
                );
                expect(w.notes.open(THREAD, on(now, 'first')).id).not.toBe(id);
            },
        );

        test('its text changed above: by its words alone', async () => {
            const w = world();
            const id = await w.draft('why?', on(plain, 'retry is'));
            const now = `so ${plain}`;
            expect(w.notes.open(THREAD, on(now, 'retry is')).id).toBe(id);
            expect(w.notes.open(THREAD, on(now, 'is cheap')).id).not.toBe(id);
        });

        test('its own words, the link in them', async () => {
            const w = world();
            const id = await w.draft('why?', on(plain, '/tmp/a.md first'));
            expect(
                w.notes.open(THREAD, on(linked, '[/tmp/a.md](path:0)')).id,
            ).toBe(id);
        });

        test('a row an older page joined, and a link in it', async () => {
            const w = world();
            const id = await w.draft('why?', on(plain, 'retry is'));
            const page = {
                ...on(`older\n\n${linked}`, 'is cheap'),
                row: { ...ROW, id: 'page-row' },
            };
            expect(w.notes.open(THREAD, page, () => 'page-row').id).toBe(id);
        });
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

    // the 🔎's round 1 on slice B, b1b
    test('a path in its words that is a link by now: painted over the link', () => {
        const before = 'see foo/bar.ts here';
        const now = 'see [foo/bar.ts](path:0) here';
        const passage = {
            parts: [
                {
                    block: 0,
                    range: { end: 19, start: 4 },
                    source: before,
                    words: 'foo/bar.ts here',
                },
            ],
            row: ROW,
        };
        expect(slices(passage, [now])).toEqual([
            [0, '[foo/bar.ts](path:0) here'],
        ]);
    });

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

    test('the same words at its old place in another text: not those', () => {
        const fence = '```ts\nconst a = 1;\n```';
        const other = '```ts\nconst b = 2;\n```';
        const onConst = {
            parts: [
                {
                    block: 0,
                    range: { end: 11, start: 6 },
                    source: fence,
                    words: 'const',
                },
            ],
            row: ROW,
        };
        expect(noteMarks([note(onConst)], [other, fence])).toEqual([]);
        expect(noteMarks([note(onConst)], [fence, other])).toMatchObject([
            { block: 0, end: 11, start: 6 },
        ]);
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
