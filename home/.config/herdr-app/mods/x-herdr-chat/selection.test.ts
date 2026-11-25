import { beforeEach, describe, expect, test } from 'vitest';

import { createSelections } from './selection.js';

// FRM-699 exit 4
describe('the words he selected, read at a right press', () => {
    let selections = createSelections();
    /** every item in its first drawing */
    const now = (key: string) => `${key}@1`;
    const select = (key: string, block: number, words: string | null) =>
        selections.report(key, now(key), block, words);
    beforeEach(() => {
        selections = createSelections();
    });

    test('a message’s blocks join in their order, whichever reported first', () => {
        select('a', 2, 'third');
        select('a', 0, 'first');
        expect(selections.textFor('a', now)).toBe('first\n\nthird');
    });

    test('another message’s selection is not its own', () => {
        select('a', 0, 'first');
        expect(selections.textFor('b', now)).toBeNull();
    });

    test('a block that lost its selection gives none', () => {
        select('a', 0, 'first');
        select('a', 0, null);
        expect(selections.textFor('a', now)).toBeNull();
    });

    test('a message drawn anew holds none of the old drawing’s', () => {
        select('a', 0, 'first');
        expect(selections.textFor('a', () => 'a@2')).toBeNull();
        selections.report('a', 'a@2', 1, 'second');
        expect(selections.textFor('a', () => 'a@2')).toBe('second');
    });

    test('the pressed half’s own words, else the other half’s', () => {
        select('a#below', 0, 'lower');
        expect(selections.textFor('a#above', now)).toBe('lower');
        select('a#above', 0, 'upper');
        expect(selections.textFor('a#above', now)).toBe('upper');
    });

    test('a half’s words are gone once its message is drawn whole', () => {
        select('a#above', 0, 'upper');
        expect(selections.textFor('a', now)).toBeNull();
    });

    test('a message off the screen holds none when it comes back', () => {
        select('a', 0, 'first');
        select('b', 0, 'second');
        selections.keep(new Set(['b']));
        expect(selections.textFor('a', now)).toBeNull();
        expect(selections.textFor('b', now)).toBe('second');
    });

    test('a thread switch clears all', () => {
        select('a', 0, 'first');
        selections.clear();
        expect(selections.textFor('a', now)).toBeNull();
    });
});
