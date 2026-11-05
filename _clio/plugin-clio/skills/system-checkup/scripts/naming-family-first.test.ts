import { expect, test } from 'vitest';

import { type Name, breaches } from './naming-family-first.ts';

const list = (names: string[], separator: '-' | ':' = '-', kind = 'skill x') =>
    names.map((name): Name => ({ kind, name, separator }));

test('a name whose shared word went last is a breach', () => {
    expect(breaches(list(['crew-lead', 'crew-dna', 'codie-crew']))).toEqual([
        'skill x · codie-crew',
    ]);
});

test('dima’s own example: every crew skill named *-crew, with no crew head at all, is a breach', () => {
    expect(breaches(list(['codie-crew', 'lead-crew', 'dna-crew']))).toEqual([
        'skill x · codie-crew',
        'skill x · lead-crew',
        'skill x · dna-crew',
    ]);
});

test('two names sharing a last word are no family yet', () => {
    expect(breaches(list(['clio-mode', 'mobile-mode']))).toEqual([]);
});

test('a script list keeps its member tails: three lone heads on one verb pass', () => {
    expect(
        breaches(list(['mcp:build', 'sline:build', 'chords:build'], ':')),
    ).toEqual([]);
});

test('a script head holds its whole area, hyphen included', () => {
    expect(
        breaches(
            list(['x-ray:test', 'x-go:build', 'test:watch', 'test:unit'], ':'),
        ),
    ).toEqual(['skill x · x-ray:test']);
});

test('a family head that is a verb passes: part of speech never decides', () => {
    expect(
        breaches(
            list(['audit-codie', 'audit-clio', 'shape-lane', 'shape-idea']),
        ),
    ).toEqual([]);
});

test('a grid name passes: its own head has a family too', () => {
    expect(
        breaches(
            list(['speak:test', 'speak:build', 'test:watch', 'test:unit'], ':'),
        ),
    ).toEqual([]);
});

test('a script with a lone head and a family tail is a breach', () => {
    expect(
        breaches(list(['mcp:test', 'test:watch', 'test:unit'], ':')),
    ).toEqual(['skill x · mcp:test']);
});

test('a family in another list does not count', () => {
    expect(
        breaches([
            ...list(['crew-lead', 'crew-dna']),
            ...list(['codie-crew'], '-', 'recipe'),
        ]),
    ).toEqual([]);
});

test('a one-word name and a lone name pass', () => {
    expect(breaches(list(['crew', 'crew-lead', 'crew-dna', 'siesta']))).toEqual(
        [],
    );
});
