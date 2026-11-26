import { beforeEach, describe, expect, test } from 'vitest';

import type { Row } from './row-model.js';
import { createSelections, passageOf, wordsOf } from './selection.js';

const part = (words: string) => ({
    position: { x: 10, y: 20 },
    range: { end: words.length, start: 0 },
    source: words,
    words,
});

// FRM-699 exit 4
describe('the words he selected, read at a right press', () => {
    let selections = createSelections();
    /** every item in its first drawing */
    const now = (key: string) => `${key}@1`;
    const select = (key: string, block: number, words: string | null) =>
        selections.report(key, now(key), block, words ? part(words) : null, 0);
    const textFor = (key: string, stampOf = now, blocks = 9) => {
        const parts = selections.partsFor(
            key,
            (k, stamp) => stampOf(k) === stamp,
            blocks,
        );
        return parts && wordsOf(parts);
    };
    beforeEach(() => {
        selections = createSelections();
    });

    test('a message’s blocks join in their order, whichever reported first', () => {
        select('a', 2, 'third');
        select('a', 0, 'first');
        expect(textFor('a', now)).toBe('first\n\nthird');
    });

    test('another message’s selection is not its own', () => {
        select('a', 0, 'first');
        expect(textFor('b', now)).toBeNull();
    });

    test('a block that lost its selection gives none', () => {
        select('a', 0, 'first');
        select('a', 0, null);
        expect(textFor('a', now)).toBeNull();
    });

    test('a block its message’s fold left out gives none', () => {
        select('a', 0, 'first');
        select('a', 3, 'fourth');
        expect(textFor('a', now, 3)).toBe('first');
    });

    test('a message drawn anew holds none of the old drawing’s', () => {
        select('a', 0, 'first');
        expect(textFor('a', () => 'a@2')).toBeNull();
        selections.report('a', 'a@2', 1, part('second'), 0);
        expect(textFor('a', () => 'a@2')).toBe('second');
    });

    test('the pressed half’s own words, else the other half’s', () => {
        select('a#below', 0, 'lower');
        expect(textFor('a#above', now)).toBe('lower');
        select('a#above', 0, 'upper');
        expect(textFor('a#above', now)).toBe('upper');
    });

    test('a half’s words are gone once its message is drawn whole', () => {
        select('a#above', 0, 'upper');
        expect(textFor('a', now)).toBeNull();
    });

    test('a message off the screen holds none when it comes back', () => {
        select('a', 0, 'first');
        select('b', 0, 'second');
        selections.keep(new Set(['b']), 0);
        expect(textFor('a', now)).toBeNull();
        expect(textFor('b', now)).toBe('second');
    });
});

// FRM-585 A4, as amended 25 Nov 17:22
describe('what stood selected at a press', () => {
    let selections = createSelections();
    const stamp = '@1';
    const select = (key: string, words: string | null, at: number, block = 0) =>
        selections.report(key, stamp, block, words ? part(words) : null, at);
    const words = (at: number) =>
        selections.current(at)?.parts.map((p) => p.words) ?? null;
    beforeEach(() => {
        selections = createSelections();
    });

    test('words, then a null: a press between the two gets the words, one after it nothing', () => {
        select('a', 'first', 100);
        select('a', null, 200);
        expect([words(99), words(150), words(200)]).toEqual([
            null,
            ['first'],
            null,
        ]);
    });

    test('a press while they stand gets them, with their place and drawing', () => {
        select('a', 'first', 100);
        expect(selections.current(5000)).toEqual({
            at: { x: 10, y: 20 },
            key: 'a',
            parts: [{ ...part('first'), block: 0 }],
            stamp,
        });
    });

    test('of two messages, the one reported last; a late null of the first changes nothing', () => {
        select('a', 'first', 100);
        select('b', 'second', 200);
        select('a', null, 300);
        expect([words(150), words(400)]).toEqual([['first'], ['second']]);
    });

    test('a drag over two blocks is both, whichever reported first; one let go leaves the other', () => {
        select('a', 'third', 100, 2);
        select('a', 'first', 100, 0);
        expect(words(150)).toEqual(['first', 'third']);
        select('a', null, 200, 2);
        expect(words(250)).toEqual(['first']);
    });

    test('a message scrolled away drops its words', () => {
        select('a', 'first', 100);
        selections.keep(new Set(['a']), 150);
        expect(words(160)).toEqual(['first']);
        selections.keep(new Set(['b']), 200);
        expect(words(300)).toBeNull();
    });

    test('a select-all has no place', () => {
        selections.report('a', stamp, 0, { ...part('all'), position: null }, 1);
        expect(selections.current(2)?.at).toBeNull();
    });

    test('a stand long gone is let go, the one standing never', () => {
        select('a', 'first', 100);
        expect(words(99_999)).toEqual(['first']);
        select('a', null, 200);
        select('b', 'second', 10_000);
        expect(words(150)).toBeNull();
    });
});

describe('the passage a note is written on', () => {
    const row = {
        at: '2026-11-25T18:00:00Z',
        id: 'r1',
        isWaiting: false,
        kind: 'reply',
        text: 'one two three four five six seven eight nine',
    } as Row;
    const parts = [{ ...part('first'), block: 0 }];

    test.each(['reply', 'mine'] as const)('in a %s', (kind) => {
        expect(passageOf({ ...row, kind }, parts)).toEqual({
            parts: [
                {
                    block: 0,
                    range: { end: 5, start: 0 },
                    source: 'first',
                    words: 'first',
                },
            ],
            row: {
                at: row.at,
                head: 'one two three four five six seven eight…',
                id: 'r1',
                kind,
            },
        });
    });

    test.each([
        ['a message still in the queue', { ...row, isWaiting: true }, parts],
        ['a tool run', { ...row, kind: 'tool' as const }, parts],
        ['a file row', { ...row, kind: 'file' as const }, parts],
        ['no row', undefined, parts],
        ['a message with nothing selected', row, null],
        ['a message whose words are gone', row, []],
    ])('none in %s', (_what, at, words) => {
        expect(passageOf(at, words)).toBeNull();
    });
});
