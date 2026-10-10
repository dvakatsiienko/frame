import { expect, test } from 'vitest';

import { rawHeads } from './cli-census.ts';

test('the census drops a head an x door covers', () => {
    const heads = [
        { calls: 9, cover: 'x linear api', name: 'linear api' },
        { calls: 6, name: 'gh pr' },
    ];

    expect(rawHeads(heads)).toEqual([{ calls: 6, name: 'gh pr' }]);
});

test('the census drops a head under five runs', () => {
    const heads = [
        { calls: 5, name: 'gh pr' },
        { calls: 4, name: 'gh api' },
    ];

    expect(rawHeads(heads)).toEqual([{ calls: 5, name: 'gh pr' }]);
});

test('the census leaves shell basics out', () => {
    const heads = [
        { calls: 9, name: 'grep' },
        { calls: 5, name: 'gh pr' },
    ];

    expect(rawHeads(heads)).toEqual([{ calls: 5, name: 'gh pr' }]);
});

test('the census keeps the top 20', () => {
    const heads = Array.from({ length: 21 }, (_, n) => ({
        calls: 30 - n,
        name: `tool${n}`,
    }));

    expect(rawHeads(heads).map((head) => head.name)).toEqual(
        heads.slice(0, 20).map((head) => head.name),
    );
});
