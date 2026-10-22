import { describe, expect, test } from 'vitest';

import { citedIds, missingText, uncovered } from './wish-cover.ts';

const item = [
    '## Description',
    '- W1 hunt what feels off',
    '- W2 ❓ can it tour the x cli source?',
    '- W3 plain words, no tech overload',
    '- W4 you gain too',
].join('\n');

describe('wish-cover', () => {
    test('passes a cited line copied verbatim', () => {
        expect(missingText(item, ['Q1 W1 hunt what feels off — why?'])).toEqual(
            [],
        );
    });

    test('reds a cited line that is paraphrased', () => {
        expect(
            missingText(item, ['W1 look for things that seem wrong']).map(
                ([id]) => id,
            ),
        ).toEqual(['W1']);
    });

    test('normalizes quotes, whitespace and case', () => {
        const quoted = '- W1 she said «Go   Now» and “stop”';
        expect(
            missingText(quoted, ['W1 SHE said "go\nnow" and "stop"']),
        ).toEqual([]);
    });

    test('a bulleted line cites its id', () => {
        expect([...citedIds('- W3 plain words, no tech overload')]).toEqual([
            'W3',
        ]);
    });

    test('a source tag is not part of the wish text', () => {
        const tagged = '- W5 (Q1) keep my voice';
        expect(missingText(tagged, ['- W5 keep my voice'])).toEqual([]);
    });

    test('a range cites nothing', () => {
        expect([...citedIds('settles W1–W3, W2-W4')]).toEqual([]);
    });

    test('single ids across a draft are all cited', () => {
        expect([...citedIds('(W1, W2) and W4')]).toEqual(['W1', 'W2', 'W4']);
    });

    test('--all reds a line no draft cites', () => {
        expect(uncovered(item, ['W1 W2', 'W4']).map(([id]) => id)).toEqual([
            'W3',
        ]);
    });
});
