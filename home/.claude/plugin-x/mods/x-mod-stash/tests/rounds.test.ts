import { expect, test } from 'claude-code/testing';

import { capLine, roundChunkOf, roundLine } from '../hooks/parse.ts';
import { roundKeyOf, roundTaken } from '../hooks/rounds.ts';

// 18 Nov's herdr lane: a lettered slice is a chunk of its own (FRM-656)
for (const [line, chunk] of [
    [
        'round 2 on 1dc7e6cb (FRM-638 slice 6b) · P0/P1: 0',
        { slice: '6b', ticket: 'FRM-638' },
    ],
    [
        'round 1 on adb1fbef (FRM-638 slice 12c)',
        { slice: '12c', ticket: 'FRM-638' },
    ],
    ['round 1 on adb1fbef (slice 06B)', { slice: '6b', ticket: undefined }],
    [
        'round 3 on adb1fbef (FRM-638 slice 05)',
        { slice: '5', ticket: 'FRM-638' },
    ],
    [
        'round 1 on adb1fbef (FRM-638 slice 6bc)',
        { slice: undefined, ticket: undefined },
    ],
] as const)
    test(`«${line}» keys ${chunk.ticket ?? 'the record'} slice ${chunk.slice ?? 'none'}`, () => {
        expect(roundChunkOf(line)).toEqual(chunk);
    });

test('two lettered slices of one ticket key apart', () => {
    const at = (line: string) => {
        const chunk = roundChunkOf(line);
        return roundKeyOf({}, 'herdr-lane-2', chunk.ticket ?? 'FRM-648', chunk);
    };
    expect([
        at('round 1 on 1dc7e6cb (FRM-638 slice 6b) · P0/P1: 0'),
        at('round 1 on adb1fbef (FRM-638 slice 12c) · P0/P1: 0'),
        at('round 1 on b89b8bea'),
    ]).toEqual([
        'herdr-lane-2 | FRM-638 slice 6b',
        'herdr-lane-2 | FRM-638 slice 12c',
        'herdr-lane-2 | FRM-648',
    ]);
});

// the leftover «herdr-lane-2 | FRM-648» at 8: a new chunk opens with round 1, so its count starts over
test('a round 1 on a new sha opens its key fresh, the old shas kept for a resend', () => {
    const left = {
        clean: 2,
        count: 8,
        shas: ['721588be', 'a', 'b', 'c', 'b89b8bea'],
    };
    expect([
        roundTaken(left, { n: 1, sha: 'feedf00d' }, 0, 5),
        roundTaken(left, { n: 1, sha: 'b89b8bea' }, 0, 5),
    ]).toEqual([
        {
            at: 5,
            clean: 1,
            count: 1,
            shas: [...left.shas, 'feedf00d'],
        },
        undefined,
    ]);
});

test('a later round still never reads back as less than the count kept', () => {
    expect(
        roundTaken({ count: 3, shas: ['a1'] }, { n: 2, sha: 'b2' }, 1, 5)
            ?.count,
    ).toBe(4);
});

// FRM-656: a line with no «P0/P1: n» counts toward the cap, named unknown
test('a round whose line names no P0/P1 counts toward the cap, never as clean', () => {
    const kept = { clean: 1, count: 1, shas: ['a1'] };
    expect([
        roundTaken(kept, { n: 2, sha: 'b2' }, undefined, 5),
        roundTaken(kept, { n: 2, sha: 'b2' }, 0, 5),
    ]).toEqual([
        { at: 5, clean: 1, count: 2, shas: ['a1', 'b2'] },
        { at: 5, clean: 2, count: 2, shas: ['a1', 'b2'] },
    ]);
});

test("the sender's line at the cap names an unknown round unknown", () => {
    expect([roundLine(3, true), roundLine(4, true)]).toEqual([
        'round 3 in this chunk not known clean, this one unknown (no «P0/P1: n» in its line): a next one is past the cap of 3',
        'round 4 in this chunk not known clean, this one unknown (no «P0/P1: n» in its line), past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
    ]);
});

test("the coordinator's cap line names an unknown round", () => {
    expect(capLine('mods-lane-8 | FRM-656', 4, '⚡ 🔧 mods', true)).toBe(
        '[escalate] round 4 of mods-lane-8 | FRM-656, past the cap of 3, from ⚡ 🔧 mods (this round unknown: its line named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»',
    );
});
