import { describe, expect, test } from 'vitest';

import { citedIds, uncovered } from './wish-cover.ts';

const item = [
    '## Description',
    '- W1 hunt what feels off',
    '- W2 ❓ can it tour the x cli source?',
    '- W3 plain words, no tech overload',
    '- W4 you gain too',
].join('\n');

describe('wish-cover', () => {
    test('passes when every W-line is cited', () => {
        expect(
            uncovered(item, ['Q1 (W1, W2)', 'settled by the wish: W3 W4']),
        ).toEqual([]);
    });

    test('reds a W-line no draft cites', () => {
        expect(uncovered(item, ['Q1 (W1, W2, W4)']).map(([id]) => id)).toEqual([
            'W3',
        ]);
    });

    test('reads a range as every line inside it', () => {
        expect([...citedIds('settles W2–W4')]).toEqual(['W2', 'W3', 'W4']);
    });

    test('reads citations across several drafts', () => {
        expect(uncovered(item, ['W1 W2', 'W3', 'W4'])).toEqual([]);
    });
});
