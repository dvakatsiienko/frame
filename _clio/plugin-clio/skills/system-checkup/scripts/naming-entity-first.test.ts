import { describe, expect, test } from 'vitest';

import { breaches, isVerbFirst } from './naming-entity-first.ts';

describe('isVerbFirst', () => {
    test.each([
        ['delete-handoff', '-'],
        ['sync-pocket', '-'],
        ['update:deps', ':'],
    ] as const)('flags %s', (name, separator) => {
        expect(isVerbFirst(name, separator)).toBe(true);
    });

    test.each([
        ['handoff-delete', '-'],
        ['shape-idea', '-'],
        ['author-memory', '-'],
        ['step-by-step', '-'],
        ['seed', '-'],
        ['deploy-watch', '-'],
        ['dev:cv', ':'],
        ['build:trophy-sys', ':'],
        ['x-changedetector:watch-add', ':'],
    ] as const)('passes %s', (name, separator) => {
        expect(isVerbFirst(name, separator)).toBe(false);
    });
});

test('breaches prints kind and name for each verb-first name', () => {
    expect(
        breaches([
            { kind: 'skill x', name: 'make-icon', separator: '-' },
            { kind: 'skill x', name: 'icon-make', separator: '-' },
        ]),
    ).toEqual(['skill x · make-icon']);
});
