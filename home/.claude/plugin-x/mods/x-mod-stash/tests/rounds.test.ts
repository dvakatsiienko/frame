import { expect, test } from 'claude-code/testing';

import { capLine, roundChunkOf, roundLine, roundOf } from '../hooks/parse.ts';
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

// sixth sense round 1 on cf12f156: a lettered slice leading the line read no round at all
for (const line of [
    'FRM-638 slice 6b round 2 on 1dc7e6cb · P0/P1: 1',
    'slice 12c final on adb1fbef',
])
    test(`a lettered slice leading «${line}» still reads its round`, () => {
        expect(roundOf(line)?.sha).toBe(line.match(/[0-9a-f]{8}/)?.[0]);
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

// clio's rule on sixth sense round 1: a «round 1» opens a key fresh only past the cap, so a codie that numbers every
// round 1 still reaches it
test('a round 1 on a key with rounds under the cap counts on', () => {
    expect(
        roundTaken({ count: 2, shas: ['a1', 'b2'] }, { n: 1, sha: 'c3' }, 1, 5)
            ?.count,
    ).toBe(3);
});

test('a codie sending «round 1» each round climbs past the cap', () => {
    let kept = { count: 0, shas: [] as string[] };
    for (const sha of ['a1', 'b2', 'c3', 'd4'])
        kept = roundTaken(kept, { n: 1, sha }, 1, 5) ?? kept;
    expect(roundLine(kept.count)).toContain('past the cap of 3:');
});

test('a bare final after rounds never opens its key fresh', () => {
    expect(
        roundTaken(
            { count: 4, shas: ['a1', 'b2', 'c3', 'd4'] },
            { isFinal: true, n: 1, sha: 'e5' },
            2,
            5,
        )?.count,
    ).toBe(5);
});

test('a later round still never reads back as less than the count kept', () => {
    expect(
        roundTaken({ count: 3, shas: ['a1'] }, { n: 2, sha: 'b2' }, 1, 5)
            ?.count,
    ).toBe(4);
});

// FRM-656: a line with no «P0/P1: n» counts toward the cap, named unknown
test('a round whose line names no P0/P1 counts toward the cap as unknown', () => {
    const kept = { clean: 1, count: 1, shas: ['a1'] };
    expect([
        roundTaken(kept, { n: 2, sha: 'b2' }, undefined, 5),
        roundTaken(kept, { n: 2, sha: 'b2' }, 0, 5),
    ]).toEqual([
        { at: 5, clean: 1, count: 2, shas: ['a1', 'b2'], unknown: 1 },
        { at: 5, clean: 2, count: 2, shas: ['a1', 'b2'] },
    ]);
});

// sixth sense round 1 on cf12f156: two unknown rounds then one with «P0/P1: 2» read «3 with a P0 or P1»
test("the sender's line at the cap counts the chunk's unknown rounds apart", () => {
    expect([roundLine(3, 2), roundLine(4, 4), roundLine(3)]).toEqual([
        'round 3 in this chunk not known clean (1 with a P0 or P1, 2 unknown: no «P0/P1: n» in the line): a next one is past the cap of 3',
        'round 4 in this chunk not known clean (4 unknown: no «P0/P1: n» in the line), past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
        'round 3 with a P0 or P1 in this chunk: a next one is past the cap of 3',
    ]);
});

test("the coordinator's cap line counts the unknown rounds", () => {
    expect(capLine('mods-lane-8 | FRM-656', 4, '⚡ 🔧 mods', 2)).toBe(
        '[escalate] round 4 of mods-lane-8 | FRM-656, past the cap of 3, from ⚡ 🔧 mods (2 unknown: their lines named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»',
    );
});
