import { describe, expect, test } from 'vitest';

import { linkNotes, noteOfUrl } from './note-links.js';

describe('a note’s words drawn as a link (FRM-585 B5)', () => {
    test('the words link to their note, and every written offset finds them there', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'n1', start: 4 },
        ]);
        expect(linked.source).toBe('the [retry](note:n1) is cheap');
        expect(linked.source.slice(linked.at(4), linked.at(9))).toBe('retry');
        expect(linked.source.slice(linked.at(13), linked.at(18))).toBe('cheap');
    });

    test('a range he selects in the drawn markdown stands back where it was written', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'n1', start: 4 },
        ]);
        // herdr reports a selection over a link in its markup: «try](note:n1) is»
        const start = linked.source.indexOf('try');
        const end = linked.source.indexOf(' is') + ' is'.length;
        expect(linked.back({ end, start })).toEqual({ end: 12, start: 6 });
    });

    test('of two that overlap, the newer is the link', () => {
        const linked = linkNotes('the retry is cheap', [
            { end: 9, id: 'old', start: 4 },
            { end: 12, id: 'new', start: 6 },
        ]);
        expect(linked.source).toBe('the re[try is](note:new) cheap');
    });

    test.each([
        ['in a code block', '```ts\nlet retry\n```', 10, 15],
        ['in a code span', 'the `retry` path', 5, 10],
        ['in a link', 'see [the retry](https://x.io)', 9, 14],
        ['in a table', '| retry | cheap |', 2, 15],
        ['in one cell of a table', '| retry | cheap |', 2, 7],
        ['in an autolink', 'see <https://x.dev/a> now', 13, 18],
        ['in a reference link', 'see [the run][r] now', 5, 12],
        [
            'in a link whose url holds brackets',
            '[t](https://w/Foo_(bar)) x',
            14,
            17,
        ],
    ])(
        'none %s: its mark and its row stay its door',
        (_where, source, start, end) => {
            expect(linkNotes(source, [{ end, id: 'n1', start }]).source).toBe(
                source,
            );
        },
    );

    // dima, 26 Nov 16:23: a draft across bold had a mark and no way to open it but F6
    test.each([
        [
            'across a line break',
            'the re\ntry',
            4,
            10,
            'the [re](note:n1)\n[try](note:n1)',
        ],
        [
            'across bold',
            '**retry** is cheap',
            2,
            14,
            '**[retry](note:n1)** [is c](note:n1)heap',
        ],
        [
            'over half an emphasis',
            'the _retry is_ cheap',
            4,
            9,
            'the _[retr](note:n1)y is_ cheap',
        ],
        [
            'over an underscore inside a word',
            'run snake_case now',
            4,
            14,
            'run [snake_case](note:n1) now',
        ],
        [
            'ending on a line break’s backslash',
            'one\\\ntwo',
            0,
            4,
            '[one](note:n1)\\\ntwo',
        ],
        [
            'over a list item’s marker',
            '- the retry',
            0,
            11,
            '- [the retry](note:n1)',
        ],
        [
            'over a heading’s marks',
            '## the retry',
            0,
            12,
            '## [the retry](note:n1)',
        ],
    ])('linked run by run %s', (_where, source, start, end, linked) => {
        expect(linkNotes(source, [{ end, id: 'n1', start }]).source).toBe(
            linked,
        );
    });

    test('its url names its note, any other names none', () => {
        expect([noteOfUrl('note:n1'), noteOfUrl('path:0')]).toEqual([
            'n1',
            null,
        ]);
    });
});
