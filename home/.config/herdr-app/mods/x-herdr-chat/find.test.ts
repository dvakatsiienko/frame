import { describe, expect, test } from 'vitest';

import { drawnBlocks } from './drawn.js';
import { createFind, findCount, findRanges, hitsOf, readOf } from './find.js';

const row = (id: string, text: string, kind = 'reply') =>
    ({ id, kind, text }) as never;
const plainOf = (source: string) =>
    readOf(source)
        .map((line) => line.text)
        .join('\n');
/** each hit of `q` as the drawn source holds it */
const sliced = (at: never, q: string) =>
    findRanges(at, q).map((r) =>
        (drawnBlocks(at)[r.block] ?? '').slice(r.start, r.end),
    );
const rows = [
    row('a', 'Ship the viewer'),
    row('b', 'tests pass'),
    row('c', 'the VIEWER opens'),
    row('d', 'viewer again'),
];

describe('find in the chat (FRM-638 slice 6)', () => {
    test('hits are the rows holding the query, any case, newest first', () => {
        expect(hitsOf(rows, 'viewer').map((h) => h.id)).toEqual([
            'd',
            'c',
            'a',
        ]);
        expect(hitsOf(rows, '  ')).toEqual([]);
    });

    test('his query in capitals finds the same rows (sixth sense, round 1)', () => {
        expect(hitsOf(rows, 'Viewer').map((h) => h.id)).toEqual([
            'd',
            'c',
            'a',
        ]);
    });

    test('a search shows the newest hit and counts it', () => {
        const find = createFind();
        find.open();
        find.search(rows, 'viewer');
        expect(find.current()).toBe('d');
        expect(findCount(find.state)).toBe('1 / 3');
    });

    test('Enter steps older, ⇧Enter newer, both wrap', () => {
        const find = createFind();
        find.search(rows, 'viewer');
        expect(find.step('older')).toBe('c');
        expect(find.step('older')).toBe('a');
        expect(find.step('older')).toBe('d');
        expect(find.step('newer')).toBe('a');
        expect(findCount(find.state)).toBe('3 / 3');
    });

    test('no match says so; no query says nothing; a step with no hit shows nothing', () => {
        const find = createFind();
        find.search(rows, 'zebra');
        expect(findCount(find.state)).toBe('No match');
        expect(find.step('older')).toBeNull();
        find.search(rows, '');
        expect(findCount(find.state)).toBe('');
    });

    test('close forgets the query and the hits', () => {
        const find = createFind();
        find.open();
        find.search(rows, 'tests');
        find.close();
        expect(find.state).toEqual({ at: 0, hits: [], isOpen: false, q: '' });
    });
});

describe('find steps match by match (word marks probe)', () => {
    test('two matches in one row are two hits, in reading order', () => {
        expect(hitsOf([row('x', 'slice and Slice')], 'slice')).toEqual([
            { id: 'x', n: 0 },
            { id: 'x', n: 1 },
        ]);
    });
});

describe('each match placed in the markdown drawn (FRM-699)', () => {
    const REPLY = [
        '## The viewer',
        '**viewer** and `the viewer` 🐬 viewer, [viewer docs](https://viewer.dev)',
        '<i title="viewer">plain</i> \\*viewer\\*',
        '- a viewer here',
        '```ts',
        'const viewer = "**viewer**";',
        '```',
        'bye, **view**er',
    ].join('\n');

    test('a range covers its match in the source, over bold, code, a link, a list, a fence and an emoji', () => {
        const at = row('a', REPLY);
        // counted by hand: the heading, bold, code, after the emoji, the link's label, the escaped one, the list, two in
        // the fence, the one bold splits; never the link's address nor the html tag's title
        expect(sliced(at, 'viewer')).toEqual([
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'viewer',
            'view**er',
        ]);
        expect(hitsOf([at], 'viewer')).toHaveLength(10);
        expect(findRanges(at, 'viewer').map((r) => r.n)).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
        expect(new Set(findRanges(at, 'viewer').map((r) => r.block))).toEqual(
            new Set([0, 1, 2]),
        );
    });

    test('the mark after an emoji starts on its own first letter', () => {
        const at = row('a', '🐬 ok **go**');
        const [range] = findRanges(at, 'go');
        expect(range).toEqual({ block: 0, end: 10, n: 0, start: 8 });
    });

    test('his message is read as typed: every mark he typed is there to find', () => {
        const at = row(
            'm',
            'a **bold** <b>tag</b> and `code`\nsecond line\n\nC:\\dir',
            'mine',
        );
        expect(plainOf(drawnBlocks(at)[0] ?? '')).toBe(
            'a **bold** <b>tag</b> and `code`\nsecond line\n\nC:\\dir',
        );
        expect(hitsOf([at], '**bold**')).toEqual([{ id: 'm', n: 0 }]);
        expect(sliced(at, '<b>tag')).toEqual(['<b\\>tag']);
        expect(sliced(at, 'bold')).toEqual(['bold']);
        expect(sliced(at, 'C:\\dir')).toEqual(['C:\\\\dir']);
    });

    test('a query of regexp signs is searched as typed, any case, and one longer in capitals shifts nothing', () => {
        expect(hitsOf([row('a', 'what (now)? a.b')], '(NOW)?')).toHaveLength(1);
        expect(hitsOf([row('a', 'axb')], 'a.b')).toEqual([]);
        expect(hitsOf([row('a', 'x-y / [z]')], 'x-y / [z]')).toHaveLength(1);
        expect(sliced(row('a', 'İİ the go'), 'go')).toEqual(['go']);
    });

    test('a row drawn as labels is searched as it stands, an open call’s card in its json', () => {
        expect(hitsOf([row('t', 'Bash 2, **x**', 'tool')], '**x')).toHaveLength(
            1,
        );
        expect(findRanges(row('t', 'Bash 2', 'tool'), 'bash')).toEqual([]);
    });

    test('an empty query, or one over two lines, matches nothing', () => {
        expect(findRanges(row('a', 'x'), '  ')).toEqual([]);
        expect(hitsOf([row('a', 'one\ntwo')], 'one\ntwo')).toEqual([]);
    });

    test('a match over a link’s end or a tag is found as it reads', () => {
        expect(
            sliced(row('a', '[docs](https://x.y) here'), 'docs here'),
        ).toEqual(['docs](https://x.y) here']);
        expect(sliced(row('a', 'a<b>b</b>c'), 'abc')).toEqual(['a<b>b</b>c']);
    });

    test('raw html draws nothing to find, the words between its tags do; a bare < stays', () => {
        expect(
            plainOf(
                'a <span class="x">b</span> <!-- c --> 1 < 2 > 0 <https://x.y>',
            ),
        ).toBe('a b  1 < 2 > 0 <https://x.y>');
    });

    test('code in a fence is read as written, the fence lines left out', () => {
        expect(plainOf('```ts\n**a** [b](c) \\* <d>\n```')).toBe(
            '**a** [b](c) \\* <d>',
        );
        expect(plainOf('~~~\n```\nx\n~~~\ny')).toBe('```\nx\ny');
    });

    test('the same ranges are handed out again until the row or the query changes', () => {
        const find = createFind();
        const at = { id: 'a', kind: 'reply', text: 'go', version: 1 } as never;
        find.search([at], 'go');
        expect(find.rangesOf(at)).toBe(find.rangesOf(at));
        const grown = {
            id: 'a',
            kind: 'reply',
            text: 'go go',
            version: 2,
        } as never;
        expect(find.rangesOf(grown)).toHaveLength(2);
        find.search([grown], 'g');
        expect(find.rangesOf(grown)[0]).toMatchObject({ end: 1, start: 0 });
    });
});

describe('the stepped row reads clean, no markdown marks (dima o14)', () => {
    test('bold, code, fences, links, headings and quotes drop their marks; snake_case stays', () => {
        expect(
            plainOf(
                '## Plan\n> **ship** the `viewer`, *now*\n```ts\nrun_it()\n```\nsee [the spec](https://x.y/spec)',
            ),
        ).toBe('Plan\nship the viewer, now\nrun_it()\nsee the spec');
    });

    test('a match only in a link address is no hit: he finds what he reads', () => {
        expect(
            hitsOf([row('l', '[docs](https://viewer.dev)')], 'viewer'),
        ).toEqual([]);
        expect(sliced(row('b', '**Ship** it'), 'ship')).toEqual(['Ship']);
    });

    test.each([
        ['[a](https://x.y/A_(b)_viewer)', 'a'],
        ['[[docs] a](https://viewer.dev)', '[docs] a'],
        ['[![b](i.png)](https://viewer.dev)', 'b'],
    ])(
        'a link of brackets or a picture draws its words alone: %s',
        (source, read) => {
            expect(plainOf(source)).toBe(read);
        },
    );

    test.each([
        [
            'a table’s line under its head',
            '| a | b |\n| --- | :-: |\n| c | d |',
            '| a | b |\n| c | d |',
        ],
        ['a rule', 'a\n\n---\n* * *\nb', 'a\n\nb'],
        ['a link’s definition', '[ref]: https://secret.io\nb', 'b'],
        [
            'but a footnote and a note that only looks like one are read',
            '[^1]: the flicker\n[note]: the list flickers',
            '[^1]: the flicker\n[note]: the list flickers',
        ],
        ['a struck word’s marks', '~~gone~~ and a ~ b', 'gone and a ~ b'],
        ['an entity’s spelling', 'a &amp; b &lt;c&gt;', 'a & b <c>'],
    ])('never %s', (_what, source, read) => {
        expect(plainOf(source)).toBe(read);
    });

    test('a match over an entity covers the source between its ends', () => {
        expect(sliced(row('e', 'x a &amp; b'), 'a & b')).toEqual(['a &amp; b']);
    });

    test('a line that opens with inline triple backticks is no fence', () => {
        expect(plainOf('```npm x``` then\n[docs](https://viewer.dev)')).toBe(
            'npm x then\ndocs',
        );
    });

    test('a code span keeps a shorter run of backticks', () => {
        expect(plainOf('see ``a`b`` and `c`')).toBe('see a`b and c');
        expect(plainOf('``a` b`` end')).toBe('a` b end');
        expect(plainOf('`a``b` end')).toBe('a``b end');
    });

    test('a code span opens right after an escaped backtick', () => {
        expect(plainOf('\\``**x**` end')).toBe('`**x** end');
    });
});

describe('find over history as pages land (FRM-638 slice 6b)', () => {
    test('a page above re-counts the hits and keeps the stepped one', () => {
        const find = createFind();
        find.open();
        find.search(rows, 'viewer');
        find.step('older');
        expect(find.current()).toBe('c');
        find.recount([
            row('o1', 'an old viewer'),
            row('o2', 'viewer, older'),
            ...rows,
        ]);
        expect(find.current()).toBe('c');
        expect(findCount(find.state)).toBe('2 / 5');
    });

    test('a transcript read anew paints its own matches, never the old row’s at the same id and version', () => {
        const find = createFind();
        find.search([row('r', 'a viewer')], 'viewer');
        find.rangesOf(row('r', 'a viewer'));
        find.recount([row('r', 'viewer')]);
        expect(find.rangesOf(row('r', 'viewer'))).toMatchObject([
            { end: 6, start: 0 },
        ]);
    });

    test('a stepped match whose waiting message a turn took keeps its place', () => {
        const find = createFind();
        find.search([row('w1', 'viewer'), row('w2', 'viewer')], 'viewer');
        find.step('older');
        find.recount([row('m1', 'viewer'), row('w2', 'viewer')]);
        expect(findCount(find.state)).toBe('2 / 2');
    });

    test('with no query or no hit left, a recount shows the newest', () => {
        const find = createFind();
        find.search(rows, '');
        find.recount(rows);
        expect(findCount(find.state)).toBe('');
        find.search(rows, 'viewer');
        find.recount([row('x', 'nothing')]);
        expect(findCount(find.state)).toBe('No match');
    });
});

describe('plain words keep what he reads (slice 6b review)', () => {
    test('inline code and a mid-word __ keep their marks; a bare __init__ reads as markdown draws it, bold init', () => {
        expect(
            plainOf('call `__init__` and `a*b*c`, then __init__ and a__b__c'),
        ).toBe('call __init__ and a*b*c, then init and a__b__c');
        expect(hitsOf([row('d', 'see `__init__` here')], '__init__')).toEqual([
            { id: 'd', n: 0 },
        ]);
    });

    test('emphasis around code, a quoted heading and __bold__ drop their marks', () => {
        expect(plainOf('*see `x` now*\n> ## Title\n__bold__ text')).toBe(
            'see x now\nTitle\nbold text',
        );
    });
});

describe('find over a page that joins a row (sixth sense, slice 6b round 1)', () => {
    test('the stepped hit follows its row onto the joined id, its place shifted by the page’s matches', () => {
        const find = createFind();
        find.open();
        find.search(
            [row('top', 'tail viewer here'), row('new', 'viewer now')],
            'viewer',
        );
        find.step('older');
        expect(find.current()).toBe('top');
        find.recount(
            [
                row('page-1', 'head viewer once\ntail viewer here'),
                row('new', 'viewer now'),
            ],
            { from: 'top', to: 'page-1' },
        );
        expect(find.currentHit()).toEqual({ id: 'page-1', n: 1 });
        expect(findCount(find.state)).toBe('3 / 3');
    });
});
