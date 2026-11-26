/// <reference types="node" />
import { describe, expect, test, vi } from 'vitest';

vi.mock('herdr', () => ({ exec: vi.fn() }));

import { withGrade } from './grades.js';
import { gradeLine } from './note-text.js';
import { ON, ROW, THREAD, passage, world } from './notes-world.ts';

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
            'dima graded 👎🏼 "the retry is cheap" (reply 1a2b3c4d 17:20): restates the plan (a case for the comms log, not a request)',
        );
    });

    test('a thumb with no words joins as «no why»', async () => {
        const w = world();
        const { id } = w.notes.open(THREAD, passage('the retry is cheap'));
        w.notes.graded(THREAD, id, 'good');
        expect(await w.notes.join(THREAD, id, 0)).toBeNull();
        expect(w.texts()).toEqual([
            'dima graded 👍🏼 "the retry is cheap" (reply 1a2b3c4d): no why (a case for the comms log, not a request)',
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
            'dima graded 👎🏼 "So the retry is…" (reply 1a2b3c4d, the whole message): too long (a case for the comms log, not a request)',
        );
    });

    test('a thumb pressed on a waiting note rewrites its row', async () => {
        const w = world();
        const id = await w.draft('why here?');
        await w.notes.join(THREAD, id, 0);
        w.notes.graded(THREAD, id, 'bad');
        expect(await w.notes.write(THREAD, id)).toBe(true);
        expect(w.texts()[0]).toMatch(/^dima graded 👎🏼/);
        await w.settle({ ...ON, taken: [w.note(id).joinId ?? ''] });
        expect(w.note(id)).toMatchObject({ grade: 'bad', state: 'taken' });
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
        const was = withGrade('not json\n', line);
        expect(withGrade(was, { ...line, why: 'second' })).toBe(
            `not json\n${JSON.stringify({ ...line, why: 'second' })}\n`,
        );
    });
});
