import { beforeEach, describe, expect, test } from 'vitest';

import { createSelections } from './selection.js';

// FRM-699 exit 4
describe('the words he selected, read at a right press', () => {
    let selections = createSelections();
    /** every item in its first drawing */
    const now = (key: string) => `${key}@1`;
    const select = (key: string, block: number, words: string | null) =>
        selections.report(key, now(key), block, words);
    const textFor = (key: string, stampOf = now, blocks = 9) =>
        selections.textFor(key, stampOf, blocks);
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
        selections.report('a', 'a@2', 1, 'second');
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
        selections.keep(new Set(['b']));
        expect(textFor('a', now)).toBeNull();
        expect(textFor('b', now)).toBe('second');
    });

    test('a thread switch clears all', () => {
        select('a', 0, 'first');
        selections.clear();
        expect(textFor('a', now)).toBeNull();
    });
});
