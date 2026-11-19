import { expect, test } from 'claude-code/testing';

import { roundChunkOf } from '../hooks/parse.ts';
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
        roundTaken(left, { n: 1, sha: 'feedf00d' }, true, 5),
        roundTaken(left, { n: 1, sha: 'b89b8bea' }, true, 5),
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
        roundTaken({ count: 3, shas: ['a1'] }, { n: 2, sha: 'b2' }, false, 5)
            ?.count,
    ).toBe(4);
});
