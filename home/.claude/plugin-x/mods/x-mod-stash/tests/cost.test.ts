import { expect, test } from 'claude-code/testing';

import { COST_WORDS } from '../hooks/register.tsx';

// todo 17 (o171): the words that send clio to model-cards.md, and the near misses that must not
const HITS = [
    'how many tokens does a lane burn?',
    'is the cache still warm',
    'what does a cached read cost',
    'ctx cost of the board',
    'the context costs of a handoff',
    'opus pricing',
    'price per MTok',
];
const MISSES = [
    'the ctx meter is red',
    'open the context menu',
    'tick the ask',
    'a tokenizer bug',
    'cachet of the brand',
];

for (const text of HITS)
    test(`«${text}» reads as a cost question`, () => {
        expect(COST_WORDS.test(text)).toBe(true);
    });

for (const text of MISSES)
    test(`«${text}» is no cost question`, () => {
        expect(COST_WORDS.test(text)).toBe(false);
    });
