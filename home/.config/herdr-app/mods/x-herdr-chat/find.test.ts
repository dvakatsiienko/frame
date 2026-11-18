import { describe, expect, test } from 'vitest';

import { createFind, findCount, findSpans, hitsOf, plainOf } from './find.js';

const row = (id: string, text: string) => ({ id, text }) as never;
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

describe('a matched message cut into words and marks (word marks probe)', () => {
    test('every match is its own span, numbered in the message, any case, lines kept', () => {
        expect(findSpans('Slice 6 and slice 7\nno', 'slice')).toEqual([
            [
                { match: 0, text: 'Slice' },
                { match: null, text: ' 6 and ' },
                { match: 1, text: 'slice' },
                { match: null, text: ' 7' },
            ],
            [{ match: null, text: 'no' }],
        ]);
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
        expect(findSpans('**Ship** it', 'ship')[0]).toEqual([
            { match: 0, text: 'Ship' },
            { match: null, text: ' it' },
        ]);
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
