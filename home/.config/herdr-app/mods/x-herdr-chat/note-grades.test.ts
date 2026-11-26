/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));

import { withGrade } from './grades.js';
import { noteRows } from './note-rows.js';
import { gradeLine } from './note-text.js';
import { FILE, ON, ROW, THREAD, passage, world } from './notes-world.ts';

const at = new Date(2026, 10, 26, 17, 20).toISOString();

// FRM-630 exits 1–3
describe('a graded note joins as a case to log', () => {
    test('a thumb down: the fixed line with its quote, short id, time and why', () => {
        expect(
            gradeLine({
                grade: 'bad',
                isWhole: false,
                parts: ['the retry is cheap'],
                row: { ...ROW, at },
                text: ' restates the plan ',
            }),
        ).toBe(
            '🎚️ grade: dima graded 👎🏼 "the retry is cheap" (reply 1a2b3c4d 17:20): restates the plan (a case for the comms log, not a request)',
        );
    });

    test('a thumb with no words joins as «no why»', async () => {
        const w = world();
        const { id } = w.notes.open(THREAD, passage('the retry is cheap'));
        w.notes.graded(THREAD, id, 'good');
        expect(await w.notes.join(THREAD, id, 0)).toBeNull();
        expect(w.texts()).toEqual([
            '🎚️ grade: dima graded 👍🏼 "the retry is cheap" (reply 1a2b3c4d): no why (a case for the comms log, not a request)',
        ]);
    });

    test('one thumb at a time: the other takes its place, the lit one again is none', async () => {
        const w = world();
        const id = await w.draft('why here?');
        w.notes.graded(THREAD, id, 'good');
        w.notes.graded(THREAD, id, 'bad');
        expect(w.note(id).grade).toBe('bad');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        // no thumb: the line a note joined as before grades
        expect(w.texts()).toEqual([
            'dima on "the retry is cheap" (reply 1a2b3c4d): why here?',
        ]);
    });

    test('the whole message is quoted by its first words', async () => {
        const w = world();
        const id = await w.draft(
            'too long',
            passage('cheap', 10, { ...ROW, head: 'So the retry is…' }),
        );
        w.notes.graded(THREAD, id, 'bad');
        w.notes.wholeSet(THREAD, id, true);
        await w.notes.join(THREAD, id, 0);
        expect(w.texts()[0]).toBe(
            '🎚️ grade: dima graded 👎🏼 "So the retry is…" (reply 1a2b3c4d, the whole message): too long (a case for the comms log, not a request)',
        );
    });

    test('a thumb pressed on a waiting note rewrites its row', async () => {
        const w = world();
        const id = await w.draft('why here?');
        await w.notes.join(THREAD, id, 0);
        w.notes.graded(THREAD, id, 'bad');
        expect(await w.notes.write(THREAD, id)).toBe(true);
        expect(w.texts()[0]).toMatch(/^🎚️ grade: dima graded 👎🏼/);
        await w.settle({ ...ON, taken: [w.note(id).joinId ?? ''] });
        expect(w.note(id)).toMatchObject({ grade: 'bad', state: 'taken' });
    });

    test('a grade’s join row is marked a grade, so the stash hands it apart from his words', async () => {
        const kinds = (w: ReturnType<typeof world>) =>
            (w.files.get(FILE) ?? '')
                .trim()
                .split('\n')
                .map((line) => JSON.parse(line).kind ?? null);
        const graded = world();
        const id = await graded.draft('why here?');
        graded.notes.graded(THREAD, id, 'bad');
        await graded.notes.join(THREAD, id, 0);
        expect(kinds(graded)).toEqual(['grade']);
        const plain = world();
        const later = await plain.draft('just a note');
        await plain.notes.join(THREAD, later, 0);
        expect(kinds(plain)).toEqual([null]);
        plain.notes.graded(THREAD, later, 'good');
        expect(await plain.notes.write(THREAD, later)).toBe(true);
        expect(kinds(plain)).toEqual(['grade']);
    });

    test('a thumb pressed after the row was written: a turn that took it keeps the grade it got', async () => {
        const w = world();
        const id = await w.draft('why here?');
        await w.notes.join(THREAD, id, 0);
        w.notes.graded(THREAD, id, 'good');
        await w.settle({ ...ON, taken: [w.note(id).joinId ?? ''] });
        expect(w.note(id)).toMatchObject({ grade: null, state: 'taken' });
    });
});

// FRM-630 exits 1, 3, 4
describe('a grade’s raw line in the grades file', () => {
    test('a joined grade: one line with its id, message id, passage, grade and why', async () => {
        const w = world();
        const id = await w.draft('restates the plan');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        expect(w.grades()).toEqual([]);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.grades()).toEqual([
            {
                at: w.stamp(),
                grade: 'bad',
                id,
                messageId: ROW.id,
                passage: 'the retry is cheap',
                sid: 'a',
                whole: false,
                why: 'restates the plan',
            },
        ]);
    });

    test('a plain note writes none', async () => {
        const w = world();
        const id = await w.draft('why here?');
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.files.has('/grades.jsonl')).toBe(false);
    });

    test('three graded: the edit that won the race is the line, the one taken back none, each once past a reload', async () => {
        const w = world();
        const ids: string[] = [];
        for (const [i, words] of ['one', 'two', 'three'].entries()) {
            const id = await w.draft(`why ${words}`, passage(words, i * 10));
            w.notes.graded(THREAD, id, 'good');
            await w.notes.join(THREAD, id, 0);
            ids.push(id);
        }
        const [kept = '', edited = '', back = ''] = ids;
        await w.type(edited, 'why two, edited');
        expect(await w.notes.takeBack(THREAD, back)).toBeNull();
        const done = {
            ...ON,
            joined: [kept, edited].map((id) => w.note(id).joinId ?? ''),
        };
        await w.settle(done);
        w.notes.arrived(THREAD, w.arrive());
        w.reload();
        await w.settle(done);
        w.notes.arrived(THREAD, w.arrive());
        expect(w.grades().map((g) => [g.id, g.why])).toEqual([
            [kept, 'why one'],
            [edited, 'why two, edited'],
        ]);
    });

    test('a grades file held as the thread had it: the line goes at the next settle, once', async () => {
        const w = world();
        const id = await w.draft('why');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        const done = { ...ON, joined: [w.note(id).joinId ?? ''] };
        w.isGradesHeld = true;
        await w.settle(done);
        expect(w.grades()).toEqual([]);
        w.isGradesHeld = false;
        await new Promise((go) => setTimeout(go, 0));
        await w.settle(done);
        await new Promise((go) => setTimeout(go, 0));
        await w.settle(done);
        expect(w.grades().map((g) => g.id)).toEqual([id]);
    });

    test('a grade sent as its own message reads as its thumb and why', async () => {
        const w = world();
        const { id } = w.notes.open(THREAD, passage('the retry is cheap'));
        w.notes.graded(THREAD, id, 'good');
        const out = await w.notes.release(THREAD, id, 0);
        if ('line' in out)
            w.notes.arrived(THREAD, [{ at: w.stamp(), text: out.line }]);
        const line = 'line' in out ? out.line : '';
        expect(w.notes.noteOf(THREAD, line)?.text).toBe('👍🏼 no why');
    });

    test('«whole message» ticked: the raw line says so, with the message id', async () => {
        const w = world();
        const id = await w.draft('too long');
        w.notes.graded(THREAD, id, 'bad');
        w.notes.wholeSet(THREAD, id, true);
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.grades()).toMatchObject([{ messageId: ROW.id, whole: true }]);
    });

    test('a thumb on a note the thread has changes nothing', async () => {
        const w = world();
        const id = await w.draft('why');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        expect(w.notes.graded(THREAD, id, 'good')).toBe(false);
        expect(w.notes.wholeSet(THREAD, id, true)).toBe(false);
    });

    test('the thread’s own line read late wins: the file is written again with the why it got', async () => {
        const w = world();
        const id = await w.draft('why first');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        const got = w.arrive();
        await w.type(id, 'why second');
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades().map((g) => g.why)).toEqual(['why second']);
        w.notes.arrived(THREAD, got);
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades().map((g) => g.why)).toEqual(['why first']);
    });

    test('a thumb only the losing rewrite carried: its line leaves the file, the thumb is a new note’s', async () => {
        const w = world();
        const id = await w.draft('why first');
        await w.notes.join(THREAD, id, 0);
        const got = w.arrive();
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.write(THREAD, id);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades().map((g) => g.grade)).toEqual(['bad']);
        w.notes.arrived(THREAD, got);
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades()).toEqual([]);
        expect(w.notes.of(THREAD).map((n) => [n.state, n.grade])).toEqual([
            ['joined', null],
            ['draft', 'bad'],
        ]);
    });

    test('a grade held in one thread goes at another thread’s settle', async () => {
        const w = world();
        const id = await w.draft('why');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        w.isGradesHeld = true;
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        await new Promise((go) => setTimeout(go, 0));
        w.isGradesHeld = false;
        await w.notes.settle('/t/b.jsonl');
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades().map((g) => g.id)).toEqual([id]);
    });

    test('its time is when the thread had it, kept past a later write', async () => {
        const w = world();
        const id = await w.draft('why');
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        w.isGradesHeld = true;
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        const had = w.stamp();
        await new Promise((go) => setTimeout(go, 0));
        w.pass(60_000);
        w.isGradesHeld = false;
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades()[0]?.at).toBe(had);
    });

    test('its time is the join’s in the transcript, not when the chat read it', async () => {
        const w = world();
        const id = await w.draft('why');
        w.notes.graded(THREAD, id, 'good');
        await w.notes.join(THREAD, id, 0);
        const joinedAt = w.stamp();
        const got = w.arrive();
        w.pass(60_000);
        w.notes.arrived(THREAD, got);
        await new Promise((go) => setTimeout(go, 0));
        expect(w.grades()[0]?.at).toBe(joinedAt);
    });

    test('a line of the same id replaces the one in the file, a broken row stays', () => {
        const line = {
            at: '',
            grade: 'good' as const,
            id: 'n-1',
            messageId: ROW.id,
            passage: 'p',
            sid: 'a',
            whole: false,
            why: 'first',
        };
        const was = withGrade('not json\n', 'n-1', line);
        expect(withGrade(was, 'n-1', { ...line, why: 'second' })).toBe(
            `not json\n${JSON.stringify({ ...line, why: 'second' })}\n`,
        );
    });
});

describe('a graded note’s row under its message', () => {
    test('leads with its thumb, «no why» for no words', async () => {
        const w = world();
        const { id } = w.notes.open(THREAD, passage('the retry is cheap'));
        w.notes.graded(THREAD, id, 'bad');
        await w.notes.join(THREAD, id, 0);
        await w.settle({ ...ON, joined: [w.note(id).joinId ?? ''] });
        const row = { ...ROW, at: null, text: '' } as never;
        expect(
            noteRows(row, w.notes.of(THREAD)).map((r) => [
                r.note?.mark,
                r.text,
            ]),
        ).toEqual([['👎🏼', 'no why']]);
    });
});
