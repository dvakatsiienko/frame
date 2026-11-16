import { describe, expect, test } from 'vitest';

import { pages, rowWords } from './settings-model.js';

const rowOf = (key: string) => {
    const row = pages
        .flatMap((page) => page.groups.flatMap((group) => group.rows))
        .find((candidate) => candidate.key === key);
    if (!row) throw new Error(`no row ${key}`);
    return row;
};

describe('a second wind note is titled by when its thread reads it', () => {
    test('with nothing stored the titles carry the default lines', () => {
        expect(rowWords(rowOf('stash.wind.text.notice'), {}).title).toBe(
            'At 55 % context: the heads-up',
        );
        expect(rowWords(rowOf('stash.wind.text.at'), {}).title).toBe(
            'At 65 % context: the must',
        );
    });

    test("a moved line moves the title of its note, and the line named in the other note's why", () => {
        const values = { 'stash.wind.must': 70, 'stash.wind.notice': 45 };
        expect(rowWords(rowOf('stash.wind.text.notice'), values)).toEqual({
            title: 'At 45 % context: the heads-up',
            why: 'What the thread reads then. {fill} = its context now, {wind} = the 70 % line.',
        });
    });

    test('a row with no number in its words reads as written', () => {
        expect(rowWords(rowOf('stash.wind.text.press'), {}).title).toBe(
            'When you press 🐦‍🔥',
        );
    });
});
