import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    type Ahead,
    type LaneAhead,
    type Member,
    type XEnvelope,
    type XRun,
    blockedIds,
    lanesArg,
    openBlockers,
    pickNext,
    readLaneAhead,
    readSignIssues,
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

describe('sealedAhead, the moves a lane owes', () => {
    test('a lane with no member is not red and carries summon in its moves', () => {
        const out = sealedAhead([
            lane('herdr', [sealed('FRM-1'), sealed('FRM-2')], { kind: 'none' }),
        ]);
        expect(out.exit).toBe(0);
        expect(out.lines[0]).toBe(
            '🟢 herdr — 1 FRM-1 sealed · 2 FRM-2 sealed · member none: summon at boot',
        );
        expect(out.lanes[0]).toMatchObject({
            moves: ['summon (clio)'],
            red: false,
        });
    });

    test('a member that is live or parked adds no summon', () => {
        const moves = (member: Member) =>
            sealedAhead([
                lane('herdr', [sealed('FRM-1'), sealed('FRM-2')], member),
            ]).lanes[0]?.moves;
        expect([
            moves({ kind: 'live', name: 'a' }),
            moves({ kind: 'parked', slug: 'b' }),
        ]).toEqual([[], []]);
    });

    test('a slot both blocked and drifted owes both moves, named in the line and in --json', () => {
        const out = sealedAhead([
            lane('speak', [
                { ...blocked('FRM-289', 'FRM-669'), drifted: true },
                sealed('FRM-2'),
            ]),
        ]);
        expect(out.lanes[0]).toMatchObject({
            moves: ['unblock (clio)', 're-sign (dima)'],
            slots: [
                { id: 'FRM-289', moves: ['unblock (clio)', 're-sign (dima)'] },
                { id: 'FRM-2', moves: [] },
            ],
        });
        expect(out.lines[0]).toMatch(/ — unblock \(clio\), re-sign \(dima\)$/);
    });

    test('a blocked chunk that is also unsealed owes the unblock and the seal', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    {
                        ...failed('FRM-2', true, noExits),
                        blockedBy: 'FRM-1',
                    },
                    sealed('FRM-3'),
                ]),
            ]).lanes[0]?.moves,
        ).toEqual(['unblock (clio)', 'seal (clio)']);
    });

    test('a drifted chunk that is also unsealed owes the re-sign first, the seal follows it', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    { ...failed('FRM-2', true, noExits), drifted: true },
                    sealed('FRM-3'),
                ]),
            ]).lanes[0]?.moves,
        ).toEqual(['re-sign (dima)']);
    });

    test('an unsigned chunk owes the sign, not the seal', () => {
        expect(
            sealedAhead([
                lane('mods', [
                    failed('FRM-2', false, noExits),
                    sealed('FRM-3'),
                ]),
            ]).lanes[0]?.moves,
        ).toEqual(['sign (dima)']);
    });

    test('two empty slots owe a queue each', () => {
        expect(
            sealedAhead([lane('herdr', [null, null])]).lanes[0]?.moves,
        ).toEqual(['queue one (clio)', 'queue one (clio)']);
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
            signs: [],
        });
    });
});

describe('sealedAhead, a lane that could not be read', () => {
    test('is a yellow line naming the lane, exit 2, beside the lanes that read', () => {
        const out = sealedAhead([
            lane('speak', [sealed('FRM-1'), sealed('FRM-2')]),
            { failed: 'x linear read FRM-9', name: 'mods' },
        ]);
        expect(out.exit).toBe(2);
        expect(out.lines).toEqual([
            '🟢 speak — 1 FRM-1 sealed · 2 FRM-2 sealed · member live speak-hunt',
            '🟡 mods — not checked: x linear read FRM-9',
        ]);
    });

    test('a failure outranks a red lane: not ready either way, and the exit says which', () => {
        expect(
            sealedAhead([
                lane('herdr', [null, null]),
                { failed: 'x brief preflight FRM-9', name: 'mods' },
            ]).exit,
        ).toBe(2);
    });
});

describe('sealedAhead, signs that trail their body', () => {
    test('read under the lanes, red, asking dima to re-sign or write a changed line', () => {
        const out = sealedAhead(
            [lane('speak', [sealed('FRM-1'), sealed('FRM-2')])],
            [
                { id: 'FRM-645', sign: 'drifted' },
                { id: 'FRM-9', sign: 'none' },
            ],
        );
        expect(out.exit).toBe(1);
        expect(out.lines).toEqual([
            '🟢 speak — 1 FRM-1 sealed · 2 FRM-2 sealed · member live speak-hunt',
            '🔴 FRM-645 (drifted) — re-sign (dima), or a ✏️ changed line before dispatch',
            '🔴 FRM-9 (none) — re-sign (dima), or a ✏️ changed line before dispatch',
        ]);
        expect(out.signs).toEqual([
            { id: 'FRM-645', move: 're-sign (dima)', sign: 'drifted' },
            { id: 'FRM-9', move: 're-sign (dima)', sign: 'none' },
        ]);
    });

    test('one already a lane slot is left to its lane, so it is not said twice', () => {
        const out = sealedAhead(
            [lane('speak', [drifted('FRM-694'), sealed('FRM-2')])],
            [{ id: 'FRM-694', sign: 'drifted' }],
        );
        expect(out.lines).toHaveLength(1);
        expect(out.signs).toEqual([]);
    });

    test('with no lane at all they still read', () => {
        expect(sealedAhead([], [{ id: 'FRM-9', sign: 'none' }])).toMatchObject({
            exit: 1,
            lines: ['🟢 no lane', expect.stringContaining('FRM-9 (none)')],
        });
    });
});

describe('lanesArg', () => {
    test.each([
        [['--json'], []],
        [
            ['--lanes', 'mods', 'herdr', 'speak'],
            ['mods', 'herdr', 'speak'],
        ],
        [['--lanes', 'mods', '--json'], ['mods']],
        [['--json', '--lanes', 'speak'], ['speak']],
        [['--lanes'], []],
    ])('%j reads %j', (args, names) => {
        expect(lanesArg(args)).toEqual(names);
    });
});

/* readLaneAhead over a stubbed x: the same contract as the real one, a command with no answer fails */

const homeWith = (threads: unknown[] = []) => {
    const home = mkdtempSync(join(tmpdir(), 'sealed-ahead-'));
    mkdirSync(join(home, '.claude/shelf'), { recursive: true });
    writeFileSync(
        join(home, '.claude/shelf/threads.json'),
        JSON.stringify({ threads }),
    );
    return home;
};

type World = {
    handoffs?: string[];
    handoffsFail?: boolean;
    // each id → what its preflight says: 'ok', or the error text
    preflight?: Record<string, string>;
    running?: { id: string; project: string }[];
    signed?: {
        id: string;
        project: string;
        sign?: string;
        stateType?: string;
    }[];
    tickets: Record<string, Partial<TicketRead>>;
};

type TicketRead = {
    description: string;
    labels: string[];
    milestone: string | null;
    project: string;
    relations: { id: string; state: string; type: string }[];
    state: string;
};

const rel = (type: 'blocked by' | 'blocks', id: string, state = 'Todo') => ({
    id,
    state,
    type,
});

const world = (home: string, w: World): XRun => {
    const answers: Record<string, XEnvelope> = {
        'handoff list --for codie': w.handoffsFail
            ? { error: 'store unreadable', ok: false }
            : {
                  data: {
                      entries: (w.handoffs ?? []).map((slug) => ({ slug })),
                  },
                  ok: true,
              },
        'linear list --team BYT --label signed': {
            data: { tickets: [] },
            ok: true,
        },
        'linear list --team BYT --state In Progress': {
            data: { tickets: [] },
            ok: true,
        },
        'linear list --team FRM --label signed': {
            data: {
                tickets: (w.signed ?? []).map((t) => ({
                    sign: 'match',
                    stateType: 'unstarted',
                    ...t,
                })),
            },
            ok: true,
        },
        'linear list --team FRM --state In Progress': {
            data: { tickets: w.running ?? [] },
            ok: true,
        },
    };
    for (const [id, t] of Object.entries(w.tickets)) {
        answers[`linear read ${id} --relations`] = {
            data: {
                tickets: [
                    {
                        description: '',
                        id,
                        labels: ['signed'],
                        milestone: 'm1',
                        project: 'mods: cc',
                        relations: [],
                        state: 'Todo',
                        ...t,
                    },
                ],
            },
            ok: true,
        };
        const verdict = w.preflight?.[id] ?? 'ok';
        answers[`brief preflight --repo ${join(home, 'frame')} ${id}`] =
            verdict === 'ok'
                ? { data: {}, ok: true }
                : { error: verdict, ok: false };
    }
    return (args, mayFail = false) => {
        const key = args.join(' ');
        const envelope = answers[key] ?? {
            error: `no stub: ${key}`,
            ok: false,
        };
        if (!envelope.ok && !mayFail) throw new Error(`x ${key}`);
        return envelope;
    };
};

const running = {
    description: '🚀 dispatched 2026-11-23',
    state: 'In Progress',
};
const modsRunning = [{ id: 'FRM-1', project: 'mods: cc' }];

describe('readLaneAhead, the chain', () => {
    test('a running chunk reads its next two chunks along its blocks relations, in order', () => {
        const home = homeWith();
        const lanes = readLaneAhead(
            home,
            ['mods'],
            world(home, {
                preflight: { 'FRM-3': noExits },
                running: modsRunning,
                tickets: {
                    'FRM-1': {
                        ...running,
                        relations: [rel('blocks', 'FRM-2')],
                    },
                    'FRM-2': {
                        relations: [
                            rel('blocked by', 'FRM-1', 'In Progress'),
                            rel('blocks', 'FRM-3'),
                        ],
                    },
                    'FRM-3': { relations: [rel('blocked by', 'FRM-2')] },
                },
            }),
        );
        expect(sealedAhead(lanes).lanes[0]).toMatchObject({
            slots: [
                { id: 'FRM-2', state: 'sealed' },
                { id: 'FRM-3', state: 'signed, not sealed' },
            ],
        });
    });
});

describe('readLaneAhead, a running chunk that blocks two chunks of one chain', () => {
    // FRM-1 runs and blocks FRM-3 and FRM-2; FRM-3 waits on FRM-2 and is the sealed one
    const chain = (home: string) =>
        world(home, {
            preflight: { 'FRM-2': noExits },
            running: modsRunning,
            tickets: {
                'FRM-1': {
                    ...running,
                    relations: [rel('blocks', 'FRM-3'), rel('blocks', 'FRM-2')],
                },
                'FRM-2': {
                    relations: [
                        rel('blocked by', 'FRM-1', 'In Progress'),
                        rel('blocks', 'FRM-3'),
                    ],
                },
                'FRM-3': {
                    relations: [
                        rel('blocked by', 'FRM-1', 'In Progress'),
                        rel('blocked by', 'FRM-2'),
                    ],
                },
            },
        });

    test('takes the chunk nothing else in the chain waits on, though a later one is sealed', () => {
        const home = homeWith();
        const out = sealedAhead(readLaneAhead(home, ['mods'], chain(home)));
        expect(out.lanes[0]).toMatchObject({
            slots: [
                { id: 'FRM-2', state: 'signed, not sealed' },
                { id: 'FRM-3', state: 'sealed' },
            ],
        });
    });
});

describe('readLaneAhead, chunks that wait on each other', () => {
    test('still take one rather than none, so a cycle in the tracker shows as a blocked slot', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    running: modsRunning,
                    tickets: {
                        'FRM-1': {
                            ...running,
                            relations: [
                                rel('blocks', 'FRM-2'),
                                rel('blocks', 'FRM-3'),
                            ],
                        },
                        'FRM-2': { relations: [rel('blocked by', 'FRM-3')] },
                        'FRM-3': { relations: [rel('blocked by', 'FRM-2')] },
                    },
                }),
            ),
        );
        expect(out.lines[0]).toContain('1 FRM-2 blocked by FRM-3');
    });
});

describe('readLaneAhead, a lane with no running chunk', () => {
    // the chain FRM-10 → FRM-30 → FRM-20: the ids run against the chain
    const chain = (home: string, more: Partial<World> = {}) =>
        world(home, {
            signed: [
                { id: 'FRM-10', project: 'mods: cc' },
                { id: 'FRM-20', project: 'mods: cc' },
                { id: 'FRM-30', project: 'mods: cc' },
            ],
            tickets: {
                'FRM-10': { relations: [rel('blocks', 'FRM-30')] },
                'FRM-20': { relations: [rel('blocked by', 'FRM-30')] },
                'FRM-30': {
                    relations: [
                        rel('blocked by', 'FRM-10'),
                        rel('blocks', 'FRM-20'),
                    ],
                },
            },
            ...more,
        });

    test('queues the first unblocked chunk, then the one it blocks, never a chunk behind the second', () => {
        const home = homeWith();
        const out = sealedAhead(readLaneAhead(home, ['mods'], chain(home)));
        expect(out.lanes[0]).toMatchObject({
            slots: [
                { id: 'FRM-10', state: 'sealed' },
                { id: 'FRM-30', state: 'sealed' },
            ],
        });
    });

    test("the second slot is not «blocked by» the first: the chain's own earlier link is barred", () => {
        const home = homeWith();
        const out = sealedAhead(readLaneAhead(home, ['mods'], chain(home)));
        expect(out.lines[0]).not.toContain('blocked by');
    });

    test('prefers the chunk the first blocks over a lower-id one that has no tie to it', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [
                        { id: 'FRM-10', project: 'mods: cc' },
                        { id: 'FRM-20', project: 'mods: cc' },
                        { id: 'FRM-40', project: 'mods: cc' },
                    ],
                    tickets: {
                        'FRM-10': { relations: [rel('blocks', 'FRM-40')] },
                        'FRM-20': {},
                        'FRM-40': { relations: [rel('blocked by', 'FRM-10')] },
                    },
                }),
            ),
        );
        expect(out.lanes[0]).toMatchObject({
            slots: [{ id: 'FRM-10' }, { id: 'FRM-40' }],
        });
    });

    test('starts at a chunk that waits on nothing in the area, though a lower id waits', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [
                        { id: 'FRM-5', project: 'mods: cc' },
                        { id: 'FRM-30', project: 'mods: cc' },
                    ],
                    tickets: {
                        'FRM-30': { relations: [rel('blocks', 'FRM-5')] },
                        'FRM-5': { relations: [rel('blocked by', 'FRM-30')] },
                    },
                }),
            ),
        );
        expect(out.lanes[0]).toMatchObject({
            slots: [{ id: 'FRM-30' }, { id: 'FRM-5' }],
        });
    });

    test('skips a chunk that waits on one behind the first', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [
                        { id: 'FRM-10', project: 'mods: cc' },
                        { id: 'FRM-20', project: 'mods: cc' },
                        { id: 'FRM-30', project: 'mods: cc' },
                        { id: 'FRM-40', project: 'mods: cc' },
                    ],
                    tickets: {
                        'FRM-10': {},
                        'FRM-20': { relations: [rel('blocked by', 'FRM-30')] },
                        'FRM-30': { relations: [rel('blocked by', 'FRM-40')] },
                        'FRM-40': {},
                    },
                }),
            ),
        );
        expect(out.lanes[0]).toMatchObject({
            slots: [{ id: 'FRM-10' }, { id: 'FRM-40' }],
        });
    });

    test("keeps the second chunk in the first one's milestone", () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [
                        { id: 'FRM-10', project: 'mods: cc' },
                        { id: 'FRM-20', project: 'mods: cc' },
                    ],
                    tickets: {
                        'FRM-10': { milestone: 'm1' },
                        'FRM-20': { milestone: 'm2' },
                    },
                }),
            ),
        );
        expect(out.lanes[0]).toMatchObject({
            slots: [
                { id: 'FRM-10', state: 'sealed' },
                { id: null, state: 'none queued' },
            ],
        });
    });

    test('a chunk with an open blocker outside the area reads blocked by it', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [{ id: 'FRM-10', project: 'mods: cc' }],
                    tickets: {
                        'FRM-10': {
                            relations: [
                                rel('blocked by', 'FRM-99', 'In Progress'),
                            ],
                        },
                    },
                }),
            ),
        );
        expect(out.lines[0]).toContain('1 FRM-10 blocked by FRM-99');
    });
});

describe('readSignIssues', () => {
    const signed = [
        { id: 'FRM-1', project: 'mods: cc', sign: 'match' },
        { id: 'FRM-2', project: 'mods: cc', sign: 'drifted' },
        { id: 'FRM-3', project: 'mods: herdr', sign: 'none' },
        {
            id: 'FRM-4',
            project: 'mods: cc',
            sign: 'drifted',
            stateType: 'started',
        },
        { id: 'FRM-5', project: 'speak', sign: 'stale' },
    ];

    test('keeps the unstarted chunks whose sign is not match, any sign word, any milestone', () => {
        const home = homeWith();
        expect(
            readSignIssues(home, [], world(home, { signed, tickets: {} })).map(
                (t) => t.id,
            ),
        ).toEqual(['FRM-2', 'FRM-3', 'FRM-5']);
    });

    test("with lane names, only those lanes' areas", () => {
        const home = homeWith();
        expect(
            readSignIssues(
                home,
                ['mods', 'speak'],
                world(home, { signed, tickets: {} }),
            ).map((t) => t.id),
        ).toEqual(['FRM-2', 'FRM-5']);
    });

    test('a tracker read that fails throws, so the entry exits 2', () => {
        const home = homeWith();
        expect(() =>
            readSignIssues(home, [], () => {
                throw new Error('x linear list --team FRM --label signed');
            }),
        ).toThrow('x linear list');
    });
});

describe('readLaneAhead, the sign of a slot', () => {
    test('a signed chunk whose sign is not match, none included, reads drifted', () => {
        const home = homeWith();
        const out = sealedAhead(
            readLaneAhead(
                home,
                ['mods'],
                world(home, {
                    signed: [
                        { id: 'FRM-10', project: 'mods: cc', sign: 'none' },
                        { id: 'FRM-20', project: 'mods: cc' },
                    ],
                    tickets: {
                        'FRM-10': { relations: [rel('blocks', 'FRM-20')] },
                        'FRM-20': { relations: [rel('blocked by', 'FRM-10')] },
                    },
                }),
            ),
        );
        expect(out.lanes[0]).toMatchObject({
            slots: [
                { id: 'FRM-10', state: 'drifted' },
                { id: 'FRM-20', state: 'sealed' },
            ],
        });
    });
});

describe('readLaneAhead, a read that fails', () => {
    test('names the lane and exits 2, and the lanes that read stay on the page', () => {
        const home = homeWith();
        const lanes = readLaneAhead(
            home,
            ['mods', 'speak'],
            world(home, {
                running: [{ id: 'FRM-1', project: 'mods: cc' }],
                tickets: {
                    'FRM-1': {
                        ...running,
                        relations: [rel('blocks', 'FRM-2')],
                    },
                },
            }),
        );
        const out = sealedAhead(lanes);
        expect(out.exit).toBe(2);
        expect(out.lines[0]).toBe(
            '🟡 mods — not checked: x linear read FRM-2 --relations',
        );
        expect(out.lines[1]).toContain('🔴 speak — 1 none queued');
    });

    test('a handoff list that fails is not «member none»', () => {
        const home = homeWith();
        const lanes = readLaneAhead(
            home,
            ['speak'],
            world(home, { handoffsFail: true, tickets: {} }),
        );
        expect(sealedAhead(lanes).lines[0]).toBe(
            '🟡 speak — not checked: x handoff list --for codie',
        );
    });
});

describe('the entry', () => {
    test('with no x to read the tracker it prints one yellow line and exits 2, never a ready 0', () => {
        const home = mkdtempSync(join(tmpdir(), 'sealed-ahead-bare-'));
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'sealed-ahead.ts'), '--lanes', 'mods'],
            {
                encoding: 'utf8',
                env: { ...process.env, HOME: home },
                timeout: 20_000,
            },
        );
        expect(out.stdout).toMatch(
            /^🟡 x linear list .* failed, the lanes are not checked/,
        );
        expect(out.status).toBe(2);
    });
});
