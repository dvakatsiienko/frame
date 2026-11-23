import { describe, expect, test } from 'vitest';

import {
    type Ahead,
    type LaneAhead,
    type Member,
    blockedIds,
    openBlockers,
    pickNext,
    sealedAhead,
} from './sealed-ahead.ts';

const base = {
    blockedBy: null,
    drifted: false,
    preflightError: '',
    preflightOk: false,
    signed: true,
};
const sealed = (id: string): Ahead => ({ ...base, id, preflightOk: true });
const failed = (
    id: string,
    signed: boolean,
    preflightError: string,
): Ahead => ({ ...base, id, preflightError, signed });
const drifted = (id: string): Ahead => ({ ...sealed(id), drifted: true });
const blocked = (id: string, by: string): Ahead => ({
    ...sealed(id),
    blockedBy: by,
});
const noExits =
    '1 problem in FRM-2\nline 1: lint ## exit — the ticket has no exit lines';
const hashDrift =
    "line 1: lint wish: line — records body a1, the ticket's newest ✍️ line holds body b2: sync the section to the re-sign";
const live: Member = { kind: 'live', name: 'speak-hunt' };
const lane = (
    name: string,
    slots: (Ahead | null)[],
    member: Member = live,
): LaneAhead => ({ member, name, slots });

describe('blockedIds', () => {
    test('a closed or non-blocking relation is no candidate', () => {
        expect(
            blockedIds([
                { id: 'FRM-1', state: 'Done', type: 'blocks' },
                { id: 'FRM-2', state: 'Duplicate', type: 'blocks' },
                { id: 'FRM-3', state: 'Canceled', type: 'blocks' },
                { id: 'FRM-4', state: 'Todo', type: 'blocked by' },
                { id: 'FRM-5', state: 'Todo', type: 'blocks' },
            ]),
        ).toEqual(['FRM-5']);
    });
});

describe('openBlockers', () => {
    test('an open blocker counts, a closed one, a barred one and a blocked ticket do not', () => {
        expect(
            openBlockers(
                [
                    { id: 'FRM-1', state: 'Todo', type: 'blocked by' },
                    { id: 'FRM-2', state: 'Done', type: 'blocked by' },
                    { id: 'FRM-3', state: 'In Progress', type: 'blocked by' },
                    { id: 'FRM-4', state: 'Todo', type: 'blocks' },
                ],
                ['FRM-3'],
            ),
        ).toEqual(['FRM-1']);
    });
});

describe('pickNext', () => {
    test('a sealed candidate beats a lower-id signed one', () => {
        expect(
            pickNext([failed('FRM-645', true, noExits), sealed('FRM-692')])?.id,
        ).toBe('FRM-692');
    });

    test('a signed candidate beats an unsigned one', () => {
        expect(
            pickNext([
                failed('FRM-1', false, noExits),
                failed('FRM-2', true, noExits),
            ])?.id,
        ).toBe('FRM-2');
    });

    test('a tie goes to the lowest id', () => {
        expect(pickNext([sealed('FRM-692'), sealed('FRM-645')])?.id).toBe(
            'FRM-645',
        );
    });

    test('no candidate is none', () => {
        expect(pickNext([])).toBeNull();
    });
});

// one row a state; each is red when the state's branch in aheadState is swapped (x verify red)
describe('sealedAhead, a row per state', () => {
    test('two sealed chunks and a live member is green', () => {
        expect(
            sealedAhead([
                lane('speak', [sealed('FRM-289'), sealed('FRM-694')]),
            ]),
        ).toMatchObject({
            exit: 0,
            lines: [
                '🟢 speak — 1 FRM-289 sealed · 2 FRM-694 sealed · member live speak-hunt',
            ],
        });
    });

    test('signed, not sealed asks clio to seal', () => {
        expect(
            sealedAhead([
                lane('mods', [failed('FRM-2', true, noExits), sealed('FRM-3')]),
            ]).lines,
        ).toEqual([
            '🔴 mods — 1 FRM-2 signed, not sealed · 2 FRM-3 sealed · member live speak-hunt — seal (clio)',
        ]);
    });

    test('a hash trailing the newest sign reads reseal', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    failed('FRM-692', true, hashDrift),
                    sealed('FRM-3'),
                ]),
            ]).lines[0],
        ).toContain('1 FRM-692 reseal');
    });

    test('a body off its last sign reads drifted and asks dima to re-sign', () => {
        expect(
            sealedAhead([lane('speak', [drifted('FRM-694'), sealed('FRM-3')])])
                .lines[0],
        ).toMatch(/1 FRM-694 drifted .* — re-sign \(dima\)$/);
    });

    test('an unsigned chunk asks dima to sign', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    failed('FRM-2', false, noExits),
                    sealed('FRM-3'),
                ]),
            ]).lines[0],
        ).toMatch(/1 FRM-2 unsigned .* — sign \(dima\)$/);
    });

    test('a chunk behind an open ticket reads blocked by it and asks clio to unblock', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    sealed('FRM-692'),
                    blocked('FRM-670', 'FRM-645'),
                ]),
            ]).lines[0],
        ).toMatch(/2 FRM-670 blocked by FRM-645 .* — unblock \(clio\)$/);
    });

    test('no chunk queued asks clio to queue one', () => {
        expect(sealedAhead([lane('herdr', [null, null])]).lines[0]).toMatch(
            /1 none queued · 2 none queued .* — queue one \(clio\)$/,
        );
    });
});

describe('sealedAhead, the member', () => {
    test.each([
        [
            { kind: 'live', name: 'mods-lane-9' } as Member,
            'member live mods-lane-9',
        ],
        [
            { kind: 'parked', slug: 'herdr-lane-3-24' } as Member,
            'member parked, handoff herdr-lane-3-24',
        ],
        [{ kind: 'none' } as Member, 'member none: summon at boot'],
    ])('%j reads %s', (member, text) => {
        const out = sealedAhead([
            lane('x', [sealed('FRM-1'), sealed('FRM-2')], member),
        ]);
        expect(out.lines[0]).toContain(text);
        expect(out.exit).toBe(0);
    });
});

describe('sealedAhead, the whole answer', () => {
    test('every owed move of a lane is listed, in slot order, for the skill that walks them', () => {
        const out = sealedAhead([
            lane('mods', [
                failed('FRM-692', true, hashDrift),
                blocked('FRM-670', 'FRM-645'),
            ]),
        ]);
        expect(out.lanes[0]).toMatchObject({
            moves: ['seal (clio)', 'unblock (clio)'],
            name: 'mods',
            red: true,
            slots: [
                { id: 'FRM-692', state: 'reseal' },
                { id: 'FRM-670', state: 'blocked by FRM-645' },
            ],
        });
    });

    test('a green lane owes no move', () => {
        expect(
            sealedAhead([lane('speak', [sealed('FRM-1'), sealed('FRM-2')])])
                .lanes[0]?.moves,
        ).toEqual([]);
    });

    test('one red lane among green ones exits 1 and keeps every line', () => {
        const out = sealedAhead([
            lane('speak', [sealed('FRM-1'), sealed('FRM-2')]),
            lane('herdr', [null, null], { kind: 'none' }),
        ]);
        expect(out.exit).toBe(1);
        expect(out.lines).toEqual([
            '🟢 speak — 1 FRM-1 sealed · 2 FRM-2 sealed · member live speak-hunt',
            '🔴 herdr — 1 none queued · 2 none queued · member none: summon at boot — queue one (clio)',
        ]);
    });

    test('no lane is green', () => {
        expect(sealedAhead([])).toEqual({
            exit: 0,
            lanes: [],
            lines: ['🟢 no lane'],
        });
    });
});
