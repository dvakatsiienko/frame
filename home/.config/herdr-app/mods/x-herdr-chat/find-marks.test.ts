import { beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown;
const gpui = vi.hoisted(() => {
    const painted: { color: string; id: string; range: number[] }[] = [];
    /** the markdown each text view was handed */
    const sources: string[] = [];
    const make = (id = ''): unknown => {
        const self: unknown = new Proxy(
            {},
            {
                get:
                    (_target, name) =>
                    (...args: unknown[]) => {
                        if (name === 'highlight_range')
                            painted.push({
                                color: String(args[2]),
                                id,
                                range: args.slice(0, 2) as number[],
                            });
                        if (name === 'when' && args[0])
                            (args[1] as Handler)(self);
                        return self;
                    },
            },
        );
        return self;
    };
    return { make, painted, sources };
});
vi.mock('herdr', () => ({ home: () => '/Users/me' }));
vi.mock('gpui-kit', () => ({
    div: () => gpui.make(),
    image: () => gpui.make(),
}));
vi.mock('gpui-base', () => ({
    TextView: {
        markdown: (id: string, source: string) => {
            gpui.sources.push(source);
            return gpui.make(id);
        },
    },
    h_flex: () => gpui.make(),
    v_flex: () => gpui.make(),
}));

const { createFind } = await import('./find.js');
const { createHeights } = await import('./heights.js');
const { createMessageRows } = await import('./message-row.js');

const t = new Proxy({}, { get: () => '#336699' }) as never;
const reply = (id: string, text: string) => ({
    files: [],
    id,
    kind: 'reply',
    pictures: [],
    text,
    version: 1,
});
const LONG = reply(
    'long',
    Array.from({ length: 80 }, (_, i) => `line ${i} **viewer**`).join('\n\n'),
);
const rows = [
    reply('old', 'the viewer, `viewer`'),
    LONG,
    reply('new', 'one viewer'),
] as never[];

function createRows() {
    const find = createFind();
    /** a picture's square, once it is made */
    const made = new Map<string, string>();
    const notes = new Map<string, object[]>();
    /** the notes he made, by the words their message shows */
    const noted = new Map<string, { quote: string; text: string }>();
    return {
        find,
        made,
        noted,
        notes,
        view: createMessageRows({
            column: () => 700,
            find: () => find,
            isShowMore: () => true,
            look: () => ({ space: 'normal' }),
            noteOf: (row: { text: string }) => noted.get(row.text) ?? null,
            notesOn: (row: { id: string }) => notes.get(row.id) ?? [],
            room: () => 700,
            sent: {
                pathOf: (p: { path: string | null }) => p.path,
                relOf: (p: { id: string }) => made.get(p.id) ?? null,
            },
        } as never),
    };
}

beforeEach(() => {
    gpui.painted.length = 0;
});

// FRM-699 exit 2: the old stepped row was a second drawing with its own height, so each step swapped two rows
describe('find moves no row (FRM-699:W3)', () => {
    test('a folded reply unfolds once when it becomes a hit, and no step changes a height again', () => {
        const { find, view } = createRows();
        const heights = createHeights();
        const sizes = () => heights.sizes(view.booked(rows), () => 1);
        view.markTurn([]);
        for (const row of view.booked(rows)) heights.record(row, 100);
        const looks = () =>
            view.booked(rows).map((r) => (r as { look?: string }).look);
        expect(looks()).toEqual([undefined, 'fold', undefined]);

        find.open();
        find.search(rows, 'viewer');
        expect(looks()).toEqual([undefined, undefined, undefined]);
        for (const row of view.booked(rows))
            heights.record(row, row.id === 'long' ? 900 : 100);
        expect(sizes()).toEqual([100, 900, 100]);
        // the newest row, then the long one, then the oldest: every row was stepped to, none was measured again
        for (let i = 0; i < find.state.hits.length; i++) {
            find.step('older');
            expect(looks()).toEqual([undefined, undefined, undefined]);
            expect(heights.toMeasure(view.booked(rows), null)).toEqual([]);
            expect(sizes()).toEqual([100, 900, 100]);
        }

        find.close();
        expect(looks()).toEqual([undefined, 'fold', undefined]);
    });
});

// FRM-699 exit 5: a reply and his own message alike
test.each([
    ['a reply', 'reply', 2],
    ['his own message', 'mine', 1],
])('each text view of %s can report his selection', (_what, kind, count) => {
    const { view } = createRows();
    const at = {
        ...(reply('a', 'one\n```\ntwo\n```') as object),
        kind,
    } as never;
    const blocks: number[] = [];
    expect(view.hasBody(at)).toBe(true);
    view.texts(at, t, 'p', true, (drawn, block) => {
        blocks.push(block);
        return drawn;
    });
    expect(blocks).toEqual([0, 1].slice(0, count));
    expect(view.textsCount(at)).toBe(count);
});

test('a message’s look changes with what its text views draw, and only then', () => {
    const { find, view } = createRows();
    view.markTurn([]);
    const look = (i: number) => view.bodyLook(rows[i] as never, t, 'p');
    const before = [look(0), look(1)];
    find.open();
    // the newest row is the one shown; the oldest is a match, the long one none
    find.search(rows, 'e viewer');
    expect(look(0)).not.toBe(before[0]);
    expect(look(1)).toBe(before[1]);
    const first = look(0);
    find.step('older');
    expect(look(0)).not.toBe(first);
    view.markTurn([
        { ...(LONG as object), isTurnStart: true, kind: 'mine' } as never,
        LONG as never,
    ]);
    expect(look(1)).not.toBe(before[1]);
});

// FRM-585 A4
test('each text view reports the words it drew, and its place', () => {
    const { view } = createRows();
    const said: [number, string][] = [];
    view.texts(reply('a', 'one\n\n```ts\ntwo\n```') as never, t, 'p', true, ((
        drawn: unknown,
        block: number,
        source: string,
    ) => {
        said.push([block, source]);
        return drawn;
    }) as never);
    expect(said[0]).toEqual([0, expect.stringContaining('one')]);
    expect(said.map(([block]) => block)).toEqual(said.map((_s, i) => i));
    expect(said.map(([, source]) => source).join()).toContain('two');
});

// FRM-585 B4
test('his notes’ words are painted under find’s hits, the stepped one last, and stay once find shuts', () => {
    const { find, notes, view } = createRows();
    const source = 'one viewer';
    const note = (id: string, state: string) => ({
        id,
        passage: {
            parts: [
                {
                    block: 0,
                    range: { end: 10, start: 4 },
                    source,
                    words: 'viewer',
                },
            ],
        },
        state,
    });
    const before = view.bodyLook(rows[2] as never, t, 'p');
    notes.set('new', [note('a', 'waiting'), note('b', 'joined')]);
    expect(view.bodyLook(rows[2] as never, t, 'p')).not.toBe(before);
    const paint = () => {
        gpui.painted.length = 0;
        view.texts(rows[2] as never, t, 'p', true, (drawn) => drawn);
        return gpui.painted.map(({ color, range }) => [
            color.slice(-2),
            ...range,
        ]);
    };
    // drawn inside the newer note's link: «one [viewer](note:a)»
    const mine = [
        ['22', 5, 11],
        ['40', 5, 11],
    ];
    expect(paint()).toEqual(mine);
    find.open();
    find.search(rows, 'viewer');
    expect(paint()).toEqual([...mine, ['b3', 5, 11]]);
    find.close();
    expect(paint()).toEqual(mine);
    gpui.painted.length = 0;
    view.texts(rows[2] as never, t, 'p', false, (drawn) => drawn);
    expect(gpui.painted).toEqual([]);
});

test('the list draws a note’s row under its message', () => {
    const { notes, view } = createRows();
    notes.set('new', [{ id: 'n1', state: 'waiting', text: 'why?' }]);
    const ids = view.shown(rows, { tools: 'show' } as never).map((r) => r.id);
    expect(ids.slice(-2)).toEqual(['new', 'new#note-n1']);
});

// FRM-585 C3
test('a note of his draws his words under its quote; one that only reads like a note stays as typed', () => {
    const { noted, view } = createRows();
    const line = 'dima on "the retry" (reply 1a2b3c4d): why here?';
    noted.set(line, { quote: 'the retry', text: 'why here?' });
    const mine = (id: string, text: string) =>
        ({ ...reply(id, text), kind: 'mine' }) as never;
    const shown = view.shown(
        [mine('m1', line), mine('m2', 'dima on "x" (reply 99): typed')],
        { tools: 'show' } as never,
    );
    expect(shown.map((r) => [r.text, r.quote ?? null])).toEqual([
        ['why here?', 'the retry'],
        ['dima on "x" (reply 99): typed', null],
    ]);
});

test('a folded reply paints no mark past its first lines', () => {
    const { notes, view } = createRows();
    view.markTurn([]);
    const source = (LONG as { text: string }).text;
    const words = 'line 79 **viewer**';
    const start = source.indexOf(words);
    notes.set('long', [
        {
            id: 'n',
            passage: {
                parts: [
                    {
                        block: 0,
                        range: { end: start + words.length, start },
                        source,
                        words,
                    },
                ],
            },
            state: 'draft',
        },
    ]);
    const painted = () => {
        gpui.painted.length = 0;
        view.texts(LONG as never, t, 'p', true, (drawn) => drawn);
        return gpui.painted.length;
    };
    expect(painted()).toBe(0);
    view.press([LONG as never], 'long');
    expect(painted()).toBe(1);
});

/** a note on one text view's words @param {number} block */
const noteOn = (source: string, words: string, block = 0, from = 0) => {
    const start = source.indexOf(words, from);
    return {
        id: 'n',
        passage: {
            parts: [
                {
                    block,
                    range: { end: start + words.length, start },
                    source,
                    words,
                },
            ],
        },
        state: 'draft',
    };
};

// a wisphunter read of c5c8c4cf: a message that turns into a note after it drew
test('a message of his that turns into a note draws again, and find reads its new words', () => {
    const { find, view } = createRows();
    const line = { ...reply('m', 'dima on "x" (reply 1): why'), kind: 'mine' };
    const noted = { ...line, look: 'note', quote: 'x', text: 'why' };
    expect(view.bodyLook(noted as never, t, 'p')).not.toBe(
        view.bodyLook(line as never, t, 'p'),
    );
    find.open();
    find.search([line] as never, 'reply');
    expect(find.rangesOf(line as never)).toHaveLength(1);
    expect(find.rangesOf(noted as never)).toEqual([]);
});

// the 🔎's round 1 on slice B
test('a folded code reply paints no mark on the fence it closes with', () => {
    const { notes, view } = createRows();
    view.markTurn([]);
    const lines = Array.from(
        { length: 60 },
        (_, i) => `l${String(i).padStart(2, '0')}`,
    );
    const source = `\`\`\`js\n${lines.join('\n')}\n\`\`\``;
    const code = reply('code', source);
    notes.set('code', [noteOn(source, 'l22')]);
    gpui.painted.length = 0;
    view.texts(code as never, t, 'p', true, (drawn) => drawn);
    expect(gpui.painted).toEqual([]);
});

test('a mark of one text view never paints another at its offsets', () => {
    const { notes, view } = createRows();
    const text = '```ts\none two\n```\n\none two';
    notes.set('a', [noteOn('one two', 'two', 1)]);
    gpui.painted.length = 0;
    view.texts(reply('a', text) as never, t, 'p', true, (drawn) => drawn);
    expect(gpui.painted.map((p) => p.id)).toEqual(['pa@1-1']);
});

// FRM-585 B5
test('a note’s words are a link to it in what the text view draws, its mark on them there', () => {
    const { notes, view } = createRows();
    notes.set('a', [noteOn('the retry is cheap', 'retry')]);
    gpui.painted.length = 0;
    gpui.sources.length = 0;
    view.texts(
        reply('a', 'the retry is cheap') as never,
        t,
        'p',
        true,
        (drawn) => drawn,
    );
    expect(gpui.sources).toEqual(['the [retry](note:n) is cheap']);
    expect(gpui.painted.map((p) => p.range)).toEqual([[5, 10]]);
});

test('a press on a note’s row names its note', () => {
    const { view } = createRows();
    const row = {
        ...(reply('a#note-n1', 'why?') as object),
        kind: 'note',
    } as never;
    expect(view.press([row], 'a#note-n1')).toEqual({ id: 'n1', kind: 'note' });
});

test('a note’s words are painted in their own text view alone', () => {
    const { notes, view } = createRows();
    const source = '```ts\ntwo\n```';
    notes.set('a', [
        {
            id: 'n',
            passage: {
                parts: [
                    {
                        block: 1,
                        range: { end: 9, start: 6 },
                        source,
                        words: 'two',
                    },
                ],
            },
            state: 'draft',
        },
    ]);
    const row = reply('a', `one\n${source}`) as never;
    view.texts(row, t, 'p', true, (drawn) => drawn);
    expect(gpui.painted.map(({ range }) => range)).toEqual([[6, 9]]);
});

describe('a click on a message’s pictures', () => {
    const squares = {
        ...(reply('a', '') as object),
        kind: 'file',
        pictures: [
            { id: 'p1', path: '/tmp/1.png' },
            { id: 'p2', path: null },
            { id: 'p3', path: '/tmp/3.png' },
        ],
    } as never;
    const open = (picture: string | null) =>
        createRows().view.press([squares], 'a', picture);
    const files = ['/tmp/1.png', '/tmp/3.png'];

    test.each([
        ['the third, the second not on disk', 'p3', 1],
        ['the first, pressed beside them', null, 0],
    ])('opens %s', (_what, picture, at) => {
        expect(open(picture)).toEqual({ at, files, kind: 'pictures' });
    });

    test('never opens a sibling of the one pressed', () => {
        expect(open('p2')).toBeNull();
    });

    test('its row draws again once a square is made', () => {
        const { made, view } = createRows();
        expect(view.hasBody(squares)).toBe(true);
        const before = view.bodyLook(squares, t, 'p');
        made.set('p1', 'sent/p1.png');
        expect(view.bodyLook(squares, t, 'p')).not.toBe(before);
    });
});

describe('each match painted in the drawn message (FRM-699:W3)', () => {
    const draw = (i: number, isShown = true) => {
        gpui.painted.length = 0;
        return (view: ReturnType<typeof createRows>['view']) => {
            view.row(rows[i] as never, t, 'p', isShown);
            return gpui.painted.map((m) => [m.id, ...m.range, m.color]);
        };
    };

    test('every match, the stepped one last and stronger', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows, 'viewer');
        expect(draw(2)(view)).toEqual([['pnew@1-0', 4, 10, '#336699b3']]);
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 4, 10, '#3366994d'],
            ['pold@1-0', 13, 19, '#3366994d'],
        ]);
        find.step('newer');
        // wrapped to the oldest row's last match, then to its first
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 4, 10, '#3366994d'],
            ['pold@1-0', 13, 19, '#336699b3'],
        ]);
        find.step('newer');
        expect(draw(0)(view)).toEqual([
            ['pold@1-0', 13, 19, '#3366994d'],
            ['pold@1-0', 4, 10, '#336699b3'],
        ]);
    });

    test('each block paints its own', () => {
        const { find, view } = createRows();
        const mixed = reply('mix', 'a viewer\n```\nviewer\n```') as never;
        find.open();
        find.search([mixed], 'viewer');
        gpui.painted.length = 0;
        view.row(mixed, t, 'p');
        expect(gpui.painted.map((m) => [m.id, ...m.range])).toEqual([
            ['pmix@1-0', 2, 8],
            ['pmix@1-1', 4, 10],
        ]);
    });

    test('none in the hidden measured copy', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows, 'viewer');
        expect(draw(2, false)(view)).toEqual([]);
    });

    test('none in a row the count left out, though its words match', () => {
        const { find, view } = createRows();
        find.open();
        find.search(rows.slice(0, 2), 'viewer');
        expect(draw(2)(view)).toEqual([]);
        expect(draw(0)(view)).toHaveLength(2);
    });
});
