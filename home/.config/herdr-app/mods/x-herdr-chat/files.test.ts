import { describe, expect, test } from 'vitest';

import {
    fileAt,
    isSentRow,
    isUnsendRow,
    replyIdOf,
    withFileRows,
} from './files.js';
import {
    createNotesByRow,
    noteIdOf,
    noteRows,
    notesBefore,
} from './note-rows.js';
import type { Row } from './row-model.js';

const HOME = '/Users/dima';

describe("a reply's files are rows of their own in the list, so a click on one can open it (FRM-587)", () => {
    const reply = (id: string, text: string, version = 1): Row => ({
        at: null,
        delivery: null,
        files: [],
        id,
        isTurnStart: false,
        isWaiting: false,
        kind: 'reply',
        pictures: [],
        replyId: null,
        text,
        tools: [],
        version,
    });

    test('each file a reply names follows it as a file row', () => {
        const rows = withFileRows(
            [reply('r1', 'see /tmp/a.png and /tmp/b.md')],
            HOME,
            new Map(),
        );
        expect(rows.map((r) => [r.kind, r.id, r.text, r.path])).toEqual([
            ['reply', 'r1', 'see /tmp/a.png and /tmp/b.md', undefined],
            ['file', 'r1#pictures', 'a.png', undefined],
            ['file', 'r1#file-1', 'b.md', '/tmp/b.md'],
        ]);
    });

    test("a reply's pictures are one row of squares, in the order it names them", () => {
        const rows = withFileRows(
            [reply('r1', '/tmp/a.png, /tmp/x.md and /tmp/b.jpg')],
            HOME,
            new Map(),
        );
        expect(rows[1]?.pictures.map((p) => [p.id, p.path])).toEqual([
            ['r1#file-0', '/tmp/a.png'],
            ['r1#file-2', '/tmp/b.jpg'],
        ]);
        expect(rows.map((r) => r.id)).toEqual([
            'r1',
            'r1#pictures',
            'r1#file-1',
        ]);
    });

    test('his own messages and tool rows get no file rows', () => {
        const mine = {
            ...reply('m1', '/tmp/a.png'),
            kind: 'mine' as const,
        };
        expect(withFileRows([mine], HOME, new Map())).toEqual([mine]);
    });

    test('a file row keeps its object while its reply does not change, so its height is kept', () => {
        const cache = new Map();
        const first = withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        const again = withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        expect(again[1]).toBe(first[1]);
    });

    test('a reply that grew is read again', () => {
        const cache = new Map();
        withFileRows([reply('r1', '/tmp/a.png')], HOME, cache);
        const grown = withFileRows(
            [reply('r1', '/tmp/a.png /tmp/c.md', 2)],
            HOME,
            cache,
        );
        expect(grown.map((r) => r.id)).toEqual([
            'r1',
            'r1#pictures',
            'r1#file-1',
        ]);
    });

    test('a click names its file through the row key, a cut half included', () => {
        const rows = withFileRows([reply('r1', '/tmp/a.md')], HOME, new Map());
        expect(fileAt(rows, 'r1#file-0')).toBe('/tmp/a.md');
        expect(fileAt(rows, 'r1#file-0#below')).toBe('/tmp/a.md');
        expect(fileAt(rows, 'r1')).toBeNull();
    });
});

describe('a reading place saved on a file row is found by its reply (wisphunter 14:30)', () => {
    test('a file row names its reply', () => {
        expect(replyIdOf('r1#file-2')).toBe('r1');
    });

    test('any other row is its own', () => {
        expect(replyIdOf('r1')).toBe('r1');
    });
});

describe('his files are a row of their own under his words (wisphunter, slice 5)', () => {
    const his = (pictures: number, version = 1) => ({
        at: null,
        delivery: null,
        files: [],
        id: 'm1',
        isTurnStart: true,
        isWaiting: false,
        kind: 'mine' as const,
        pictures: Array.from({ length: pictures }, (_, n) => ({
            data: null,
            id: `m1-${n}`,
            media: null,
            path: `/tmp/${n}.png`,
        })),
        replyId: null,
        text: 'look',
        tools: [],
        version,
    });

    test('a message with pictures is followed by its squares row, a click there names them', () => {
        const rows = withFileRows([his(2)], HOME, new Map());
        expect(rows.map((r) => [r.id, r.kind])).toEqual([
            ['m1', 'mine'],
            ['m1#sent', 'file'],
        ]);
        expect(isSentRow('m1#sent')).toBe(true);
        expect(rows[1]?.pictures).toHaveLength(2);
    });

    test('words alone get no row, and the squares row keeps its object until the message changes', () => {
        expect(withFileRows([his(0)], HOME, new Map())).toHaveLength(1);
        const cache = new Map();
        const first = withFileRows([his(1)], HOME, cache)[1];
        expect(withFileRows([his(1)], HOME, cache)[1]).toBe(first);
        expect(withFileRows([his(1, 2)], HOME, cache)[1]).not.toBe(first);
    });
});

describe('a tool call row names its fold for a saved place (wisphunter, slice 6)', () => {
    test('#call-N goes back to its tool row', () => {
        expect(replyIdOf('u-1#call-2')).toBe('u-1');
        expect(replyIdOf('u-1#file-0')).toBe('u-1');
    });
});

describe("a message still in Claude Code's queue carries a × row under it (FRM-563 b+c)", () => {
    test('a waiting message gets its × row, a delivered one none', () => {
        const waiting: Row = {
            at: null,
            delivery: null,
            files: [],
            id: 'w1',
            isTurnStart: false,
            isWaiting: true,
            kind: 'mine',
            pictures: [],
            replyId: null,
            text: 'plain words',
            tools: [],
            version: 1,
        };
        const delivered = { ...waiting, id: 'm1', isWaiting: false };
        const ids = withFileRows([waiting, delivered], HOME, new Map()).map(
            (r) => r.id,
        );
        expect(ids).toEqual(['w1', 'w1#unsend', 'm1']);
        expect(isUnsendRow('w1#unsend')).toBe(true);
    });
});

describe('a message has a quiet row for each note on it (FRM-585 B2)', () => {
    const row = (id: string, over: Partial<Row> = {}): Row => ({
        at: null,
        delivery: null,
        files: [],
        id,
        isTurnStart: false,
        isWaiting: false,
        kind: 'reply',
        pictures: [],
        replyId: null,
        text: 'see ~/a.md',
        tools: [],
        version: 1,
        ...over,
    });
    const note = (id: string, text: string, state = 'joined') =>
        ({ id, state, text }) as never;
    const notes = [
        note('n1', 'one\nline'),
        note('n2', 'two', 'sent'),
        note('n3', '  '),
        note('n4', 'four', 'sending'),
        // still his: their words are highlighted, a click opens them (dima, 26 Nov 15:37, FRM-585:W73)
        note('n5', 'five', 'draft'),
        note('n6', 'six', 'waiting'),
        note('n7', 'seven', 'taken'),
    ];
    const drawn = () =>
        withFileRows(
            [row('r1'), row('tool', { kind: 'tool', text: 'Read' }), row('r2')],
            HOME,
            new Map(),
            (r) => (r.id === 'r1' ? noteRows(r, notes) : []),
        );

    test('after its files, in the order he made them; one not typed yet or still his has none', () => {
        expect(drawn().map((r) => r.id)).toEqual([
            'r1',
            'r1#file-0',
            'r1#note-n1',
            'r1#note-n2',
            'r1#note-n4',
            'tool',
            'r2',
            'r2#file-0',
        ]);
        expect(
            drawn()
                .filter((r) => r.kind === 'note')
                .map((r) => [r.text, r.note?.word]),
        ).toEqual([
            ['one line', 'joined'],
            ['two', 'sent'],
            ['four', 'sending'],
        ]);
    });

    test('each names its note, a saved place on one its message', () => {
        expect(
            drawn()
                .map((r) => noteIdOf(r.id))
                .filter(Boolean),
        ).toEqual(['n1', 'n2', 'n4']);
        expect(replyIdOf('r1#note-0b5c-4d')).toBe('r1');
    });

    test('its row stands where his message does', () => {
        const [mine] = noteRows(row('m', { kind: 'mine' }), notes);
        const [reply] = noteRows(row('r'), notes);
        expect([mine?.note?.isMine, reply?.note?.isMine]).toEqual([
            true,
            false,
        ]);
    });

    // the 🔎's round 1 on 574c7f3c: a waiting note whose words show no mark had no door left
    test('one still his keeps its row while its words show no mark', () => {
        const rows = noteRows(row('r1'), notes, (n) => n.id !== 'n6');
        expect(rows.map((r) => noteIdOf(r.id))).toEqual([
            'n1',
            'n2',
            'n4',
            'n6',
        ]);
    });

    test('how many stand before a row', () => {
        expect([
            notesBefore(drawn(), 'r1'),
            notesBefore(drawn(), 'r2'),
            notesBefore(drawn(), 'gone'),
        ]).toEqual([0, 3, -1]);
    });
});

test('a row’s notes follow it as a page changes its id, and go with their thread (FRM-585 B2)', () => {
    const on = (id: string, line: string) =>
        ({ id, passage: { row: { id: line } } }) as never;
    const at = { row: 'l1' };
    const under = createNotesByRow((line) => (line === 'l1' ? at.row : line));
    const notes = [on('n1', 'l1'), on('n2', 'l2')];
    const ids = (id: string, of = notes, rows = [{ id: at.row }]) =>
        under(id, of, rows).map((n) => (n as { id: string }).id);
    expect([ids('l1'), ids('l2')]).toEqual([['n1'], ['n2']]);
    at.row = 'page';
    expect([ids('l1'), ids('page')]).toEqual([[], ['n1']]);
    // a page that landed with the first row's id kept
    at.row = 'l3';
    expect(ids('l3', notes, [{ id: 'page' }, { id: 'l3' }])).toEqual(['n1']);
    expect(ids('l3', [on('n3', 'l1')], [{ id: 'page' }, { id: 'l3' }])).toEqual(
        ['n3'],
    );
    expect(ids('l3', [])).toEqual([]);
});
