import type { On } from 'claude-code';
import { type Engine, expect, test } from 'claude-code/testing';

import { capLine, roundChunkOf, roundLine, roundOf } from '../hooks/parse.ts';
import { roundKeyOf, roundTaken } from '../hooks/rounds.ts';
import {
    CLIO,
    LANE,
    ROUNDS_FILE,
    ROUND_CODIE,
    SID,
    kept,
    roundsIn,
    roundsRaw,
    send,
    start,
    thread,
    world,
} from './quiet-helpers.ts';
import { THREADS_FILE, recordOf } from './threads.ts';

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
    'BYT-12 slice 10A round 3 on 0abc1234 · P0/P1: 1',
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

const LANE_KEY = `lane-rounds:${LANE}`;

const PLAN_DIR = '/home/.local/state/x/lanes/mods-lane-5';

const ROUND_SENSE = '⚡ 🔎 sixth sense: mods lane 5';

const roundLines = (r: { context?: string[] }) =>
    (r.context ?? []).filter((c) => /\bround \d/.test(c));

// a plan file's mtime is the parse cache's key: each world its own
let planAt = 1;

// a codie on lane 5: a whole-file write lands as the shell's mv would; `plan` is the lane plan's steps as x prints them
function roundWorld(
    on: On,
    {
        files = {} as Record<string, string>,
        greenlit,
        isMvRefused = false,
        name = ROUND_CODIE,
        plan,
        record = {} as Record<string, unknown>,
        refusal,
        role = 'codie',
        sent,
        threads = [],
        unreadable = [],
    }: {
        files?: Record<string, string>;
        // the steps above the plan's «## not greenlit» heading, the rest held by x; all of them when unset
        greenlit?: number;
        // a write the shell's mv refuses
        isMvRefused?: boolean;
        unreadable?: string[];
        name?: string;
        plan?: { done: boolean; ticket?: string; text: string }[];
        record?: Record<string, unknown>;
        // why a mod's own send to a session does not go
        refusal?: string;
        role?: string;
        sent?: Record<string, unknown>;
        // more of x's records, beside this codie's and clio's
        threads?: Record<string, unknown>[];
    } = {},
) {
    const base = JSON.parse(thread(role, record)[THREADS_FILE] ?? '{}') as {
        threads: unknown[];
    };
    const all: Record<string, string> = {
        [THREADS_FILE]: JSON.stringify({
            ...base,
            threads: [...base.threads, ...threads],
        }),
        ...files,
    };
    // x's answer to plan-steps, which a test may change: undefined is x failing; each change is a new mtime
    const planNow = {
        steps: plan?.map((s, i) =>
            greenlit !== undefined && i >= greenlit ? { ...s, held: true } : s,
        ),
    };
    const listed: Record<string, { mtimeMs: number; name: string }[]> = plan
        ? { [PLAN_DIR]: [{ mtimeMs: planAt++, name: 'lane-plan.md' }] }
        : {};
    const setPlan = (steps: typeof plan) => {
        planNow.steps = steps;
        listed[PLAN_DIR] = [{ mtimeMs: planAt++, name: 'lane-plan.md' }];
    };
    const w = world(on, {
        files: all,
        listed,
        name,
        peers: [CLIO],
        run: (argv) => {
            if (argv[0] === 'mv') {
                const [, , from, to] = argv;
                if (isMvRefused || from === undefined || to === undefined)
                    return 1;
                all[to] = all[from] ?? '';
                delete all[from];
                return 0;
            }
            if (argv[0] === 'x' && argv[2] === 'plan-steps')
                return planNow.steps
                    ? JSON.stringify({ data: { steps: planNow.steps } })
                    : 1;
            return undefined;
        },
        unreadable,
        ...(sent ? { sent } : {}),
    });
    on('fs.exists', (_$, e) => ({ value: e.path in all }));
    const told: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        if (refusal) return { isDelivered: false, reason: refusal };
        told.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return { ...w, files: all, setPlan, told };
}

test('a round message counts in the shelf file under its lane and ticket', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345 — pushed');
    await send($, ROUND_SENSE, 'round 2 on def67890');
    expect(kept(w)).toEqual({
        count: 2,
        shas: ['abc12345', 'def67890'],
    });
    expect(Object.keys(roundsIn(w.files))).toEqual([LANE]);
});

test('a resend of one round counts once, its sha long or short', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    await send($, ROUND_SENSE, 'round 1 on abc1234567890');
    expect(kept(w)).toEqual({ count: 1, shas: ['abc12345'] });
});

for (const message of [
    'BYT-116 round 4 on e4fa48a. Fixed: the replace',
    'coder: round 2 on 78c130b9 — all 7 addressed',
    'final — round 3 on 6381739f, the pr',
    'round 1 on **fc54774**, branch codie/x',
    'sixth sense, round 2 on 7c90198',
    'sixth sense, final round 2 on 7c90198',
    'FRM-504: round 2 on 7c90198',
    'BYT-1 #127 round 2 on 7c90198',
    'BYT-1 slice 01 round 2 on 7c90198',
    'round 4, final, on 7c90198',
    'round 2 pushed: 7c90198 holds the fix',
])
    test(`a real lead counts: ${message}`, async ($, on) => {
        const w = roundWorld(on);
        await start($);
        await send($, ROUND_SENSE, message);
        expect(
            Object.values(roundsIn(w.files)).flatMap(
                (r) => (r as { shas: string[] }).shas,
            ).length,
        ).toBe(1);
    });

for (const message of [
    'your round 2 on abc12345 still stands',
    'final: base 7c90198, head 6381739f',
    'final word, your round 2 on 7c90198 stands',
    'BYT-105: clean — «round 4 on dbc4c111 — verdict: clean»',
    'parked: nothing new since the review',
    'round 2 needs a look, nothing pushed yet',
    'round 2 defaced the old row',
])
    test(`no round in this line: ${message}`, async ($, on) => {
        const w = roundWorld(on);
        await start($);
        const r = await send($, ROUND_SENSE, message);
        expect([kept(w), roundLines(r)]).toEqual([undefined, []]);
    });

for (const [name, sender, to] of [
    ["sixth sense's own verdict", ROUND_SENSE, ROUND_CODIE],
    ['a session outside a lane', '🦉 clio', ROUND_SENSE],
    [
        'a thread that only names codie past its colon',
        '🔎 helper: codie round',
        ROUND_SENSE,
    ],
    ['a report to the coordinator', ROUND_CODIE, '🦉 clio'],
] as const)
    test(`not counted: ${name}`, async ($, on) => {
        const w = roundWorld(on, {
            name: sender,
            role:
                sender === ROUND_CODIE
                    ? 'codie'
                    : sender === ROUND_SENSE
                      ? 'sixth-sense'
                      : 'none',
        });
        await start($);
        await send($, to, 'round 1 on abc12345');
        expect([w.files[ROUNDS_FILE], w.told]).toEqual([undefined, []]);
    });

test('a send that went nowhere is no round', async ($, on) => {
    const w = roundWorld(on, {
        sent: { message: 'no such session', success: false },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(w.files[ROUNDS_FILE]).toBeUndefined();
});

test('no round is written to the private store', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect([
        [...w.store.keys()].filter((k) => k.startsWith('lane-rounds:')),
        kept(w),
    ]).toEqual([[], { count: 1, shas: ['abc12345'] }]);
});

const sendRounds = async ($: Engine, n: number) => {
    const out = [];
    for (let i = 0; i < n; i++)
        out.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${i + 1} on abcdef${i} · P0/P1: 1`,
            ),
        );
    return out;
};

const PLAN_NEXT = [
    { done: true, text: 'the round store', ticket: 'FRM-9' },
    { done: true, text: 'reviewed and closed', ticket: 'FRM-9' },
    { done: false, text: 'the next chunk', ticket: 'FRM-10' },
];

// FRM-649: the count keys on the lane record's ticket, as the card does: each chunk opens with clio's dispatch, which
// moves the record; a plan's first open step can be an old chunk's leftover (a false «round 9» on FRM-605)
test('a next chunk the dispatch moved the record to starts its own count at 1, with no cap line', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: {
                    [LANE]: { count: 4, shas: ['a1', 'b2', 'c3', 'd4'] },
                },
                v: 1,
            }),
        },
        record: { ticket: 'FRM-10' },
    });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([
        kept(w, 'mods-lane-5 | FRM-10'),
        kept(w),
        roundLines(r),
        w.told,
    ]).toEqual([
        { count: 1, shas: ['ccccccc'] },
        { count: 4, shas: ['a1', 'b2', 'c3', 'd4'] },
        [],
        [],
    ]);
});

test("a stale open step in the lane plan never keys the count, the record's ticket does", async ($, on) => {
    const w = roundWorld(on, {
        plan: [
            { done: false, text: 'an old chunk left open', ticket: 'FRM-605' },
            ...PLAN_NEXT,
        ],
        record: { ticket: 'FRM-10' },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect(Object.keys(roundsIn(w.files))).toEqual(['mods-lane-5 | FRM-10']);
});

test('a record with no ticket counts nothing and asks a resend', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: undefined } });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r), w.told]).toEqual([
        undefined,
        [
            "round 1 on ccccccc not counted (x's record names no ticket): resend the same line once clio's dispatch writes one",
        ],
        [],
    ]);
});

test("with no lane plan the count keys on x's record's ticket", async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-10' } });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect(kept(w, 'mods-lane-5 | FRM-10')).toEqual({
        count: 1,
        shas: ['ccccccc'],
    });
});

// the cap is per chunk: herdr lane 2's codie named «FRM-638 slice 5» after the sha while x's record held FRM-625, and its
// slices 4 and 5 counted as one, escalating a «round 4» its chunk never reached
test('two chunks a round line names count apart, the record trailing both, and the cap line names the chunk', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-625' } });
    await start($);
    for (const [n, sha] of [
        [1, 'a1a1a1a'],
        [2, 'b2b2b2b'],
    ] as const)
        await send(
            $,
            ROUND_SENSE,
            `round ${n} on ${sha} (slice 4, base main:1234567)`,
        );
    const r = [];
    for (const [n, sha] of [
        [1, 'c3c3c3c'],
        [2, 'd4d4d4d'],
        [3, 'e5e5e5e'],
    ] as const)
        r.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${n} on ${sha} (FRM-638 slice 05, base main:1234567) · P0/P1: 1`,
            ),
        );
    expect([
        Object.keys(roundsIn(w.files)),
        kept(w, 'mods-lane-5 | FRM-638 slice 5'),
        r.flatMap(roundLines),
        w.told,
    ]).toEqual([
        ['mods-lane-5 | FRM-625 slice 4', 'mods-lane-5 | FRM-638 slice 5'],
        { count: 3, shas: ['c3c3c3c', 'd4d4d4d', 'e5e5e5e'] },
        [
            'round 3 with a P0 or P1 in this chunk: a next one is past the cap of 3',
        ],
        [],
    ]);
    await send(
        $,
        ROUND_SENSE,
        'round 4 on f6f6f6f (FRM-638 slice 5) · P0/P1: 1',
    );
    expect(w.told.map((t) => t.text)).toEqual([
        `[escalate] round 4 of mods-lane-5 | FRM-638 slice 5, past the cap of 3, from ${ROUND_CODIE}: ask dima «go on, or stop the lane»`,
    ]);
});

test('a lone slice joins the key a fuller line gave it, and a ticket the line only mentions keys nothing', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-625' } });
    await start($);
    await send(
        $,
        ROUND_SENSE,
        'round 1 on a1a1a1a (FRM-638 slice 5, base main:1234567)',
    );
    await send($, ROUND_SENSE, 'round 2 on b2b2b2b (slice 5)');
    await send(
        $,
        ROUND_SENSE,
        'round 1 on c3c3c3c, fixes the FRM-617 regression',
    );
    expect(roundsIn(w.files)).toEqual({
        'mods-lane-5 | FRM-625': { count: 1, shas: ['c3c3c3c'] },
        'mods-lane-5 | FRM-638 slice 5': {
            count: 2,
            shas: ['a1a1a1a', 'b2b2b2b'],
        },
    });
});

// FRM-656 exit 2: 18 Nov's herdr lane read «round 6» over three chunks each clean at round 1
test('three chunks each clean at round 1 keep three keys at count 1 and tell no one', async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-648' } });
    await start($);
    const r = [];
    for (const line of [
        'round 1 on 1dc7e6cb (FRM-638 slice 6b) · P0/P1: 0',
        'round 1 on adb1fbef (FRM-638 slice 12c) · P0/P1: 0',
        'round 1 on b89b8bea',
    ])
        r.push(await send($, ROUND_SENSE, line));
    expect([
        Object.values(roundsIn(w.files)).map(
            (k) => (k as { count: number }).count,
        ),
        r.flatMap(roundLines).filter((l) => l.includes('cap')),
        w.told,
    ]).toEqual([[1, 1, 1], [], []]);
});

// FRM-656 exit 5: the five round lines the herdr codie sent its sixth sense on 18 Nov (transcript 52af0793), as sent
const HERDR_18_NOV = [
    'round 4 on 721588be (FRM-638 slice 5, scoped): the each-path-once row, attachments.test.ts',
    'round 2 on 1dc7e6cb (FRM-638 slice 6b), main:9d387640 base, on origin/main.',
    'round 3 on 35a13429 (FRM-638 end step, slices.md 12 + FRM-633), base d4ccf50d.',
    "round 4 on adb1fbef (FRM-648) · P0/P1: 0 open — slice 12b, base 3f2f4bc5, dima's 21:42 tick + vote via clio.",
    'round 2 on b89b8bea (FRM-638 slice 12c) · P0/P1: 0',
];

test("18 Nov's herdr round lines count per chunk: no round 6, only slice 5's unknown round 4 warns", async ($, on) => {
    const w = roundWorld(on, { record: { ticket: 'FRM-648' } });
    await start($);
    const r = [];
    for (const line of HERDR_18_NOV) r.push(await send($, ROUND_SENSE, line));
    expect([
        Object.fromEntries(
            Object.entries(roundsIn(w.files)).map(([k, v]) => [
                k,
                (v as { count: number }).count,
            ]),
        ),
        r.flatMap(roundLines),
        w.told.map((t) => t.text),
    ]).toEqual([
        {
            'mods-lane-5 | FRM-638 slice 12c': 2,
            'mods-lane-5 | FRM-638 slice 5': 4,
            'mods-lane-5 | FRM-638 slice 6b': 2,
            'mods-lane-5 | FRM-648': 3,
            'mods-lane-5 | FRM-648 slice 12b': 4,
        },
        [
            'round 4 in this chunk not known clean (3 with a P0 or P1, 1 unknown: no «P0/P1: n» in the line), past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
            'round 3 in this chunk not known clean (2 with a P0 or P1, 1 unknown: no «P0/P1: n» in the line): a next one is past the cap of 3',
        ],
        [
            `[escalate] round 4 of mods-lane-5 | FRM-638 slice 5, past the cap of 3, from ${ROUND_CODIE} (1 unknown: their lines named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»`,
        ],
    ]);
});

test('a round file that does not parse moves aside and the count starts over', async ($, on) => {
    const w = roundWorld(on, { files: { [ROUNDS_FILE]: '{"rounds": [torn' } });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[`${ROUNDS_FILE}.bad`], kept(w), roundLines(r)]).toEqual([
        '{"rounds": [torn',
        { count: 1, shas: ['ccccccc'] },
        [],
    ]);
});

test('a round file that is there but will not read is never written over', async ($, on) => {
    const w = roundWorld(on, {
        files: { [ROUNDS_FILE]: 'kept' },
        unreadable: [ROUNDS_FILE],
    });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r)]).toEqual([
        'kept',
        [
            'round 1 on ccccccc not counted (the round file would not read): resend the same line to count it',
        ],
    ]);
});

test('a resend of a round past the cap says nothing and tells clio nothing again', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 4);
    const r = await send($, ROUND_SENSE, 'round 4 on abcdef3');
    expect([roundLines(r), w.told.length]).toEqual([[], 1]);
});

test('an entry missing its shas reads as none', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { [LANE]: { count: 2 } },
                v: 1,
            }),
        },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 3 on ccccccc');
    expect(kept(w)).toEqual({ count: 3, shas: ['ccccccc'] });
});

test('a round that could not be written tells the sender to resend it', async ($, on) => {
    const w = roundWorld(on, { isMvRefused: true });
    await start($);
    const r = await send($, ROUND_SENSE, 'round 1 on ccccccc');
    expect([w.files[ROUNDS_FILE], roundLines(r), r.result.success]).toEqual([
        undefined,
        [
            'round 1 on ccccccc not counted (mv failed): resend the same line to count it',
        ],
        true,
    ]);
});

// the cap counts rounds with a P0 or P1 (crew-dna § the loop): a line naming «P0/P1: 0» is a clean round, a line naming
// none is unknown, counted toward the cap; four rounds with one P1 among them reach no cap
const fourRounds = async ($: Engine, severe: string[]) => {
    const out = [];
    for (const [i, p] of severe.entries())
        out.push(
            await send(
                $,
                ROUND_SENSE,
                `round ${i + 1} on abcdef${i} (FRM-9 slice 5, ${p})`,
            ),
        );
    return out;
};

test('four rounds with one P1 among them reach no cap and tell no one', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const r = await fourRounds($, [
        'P0/P1: 0',
        'p0/p1: 0',
        'p0/p1: 0',
        'P0/P1: 1',
    ]);
    expect([r.flatMap(roundLines), w.told]).toEqual([[], []]);
});

test('four rounds each with a P1, the last one naming none, escalate at the fourth, and a clean fifth tells no one', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const r = await fourRounds($, [
        'P0/P1: 1',
        'P0/P1: 2',
        'P0/P1: 1',
        'base main:1234567',
    ]);
    r.push(
        await send(
            $,
            ROUND_SENSE,
            'round 5 on abcdef5 (FRM-9 slice 5, P0/P1: 0)',
        ),
    );
    expect([
        r.map((x) => roundLines(x).length),
        w.told.map((t) => t.text),
    ]).toEqual([
        [0, 0, 1, 1, 0],
        [
            `[escalate] round 4 of mods-lane-5 | FRM-9 slice 5, past the cap of 3, from ${ROUND_CODIE} (1 unknown: their lines named no «P0/P1: n», ask for the count): ask dima «go on, or stop the lane»`,
        ],
    ]);
});

// FRM-656 exit 3: a round naming no «P0/P1: n» counts, and the sender hears it called unknown
test('a round line naming no P0/P1 reaches the cap called unknown, never one with a P0 or P1', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abcdef7');
    await send($, ROUND_SENSE, 'round 2 on abcdef8');
    const line = roundLines(
        await send($, ROUND_SENSE, 'round 3 on abcdef9'),
    ).join('');
    expect([
        line.includes('3 unknown'),
        line.includes('with a P0 or P1'),
        roundsRaw(w.files)[LANE]?.unknown,
    ]).toEqual([true, false, 3]);
});

// FRM-570 exit 15: the count reads x's record, so a rename keeps it and a name alone starts none
for (const name of ['⚡ 🔧 mods 6 | FRM-574', 'mods six'])
    test(`a codie named «${name}» counts its rounds by its record`, async ($, on) => {
        const w = roundWorld(on, { name });
        await start($);
        await send($, ROUND_SENSE, 'round 1 on abc12345');
        expect(kept(w)).toEqual({ count: 1, shas: ['abc12345'] });
    });

test('a codie name with no thread record counts no round', async ($, on) => {
    const w = roundWorld(on, { role: 'none' });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(w.files[ROUNDS_FILE]).toBeUndefined();
});

test('a count follows the number sent, a lane opening past round 1', async ($, on) => {
    roundWorld(on);
    await start($);
    const lines: string[] = [];
    for (const [n, sha] of [
        [2, 'aaaaaaa'],
        [3, 'bbbbbbb'],
        [4, 'ccccccc'],
    ] as const)
        lines.push(
            roundLines(await send($, ROUND_SENSE, `round ${n} on ${sha}`)).join(
                '',
            ),
        );
    expect(lines[0]).toBe('');
    expect(lines[1]).toContain('past the cap');
    expect(lines[2]).toContain('the coordinator has the count');
});

test('a final leading a numbered round counts that round', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final FRM-9 round 3 on abc1234');
    expect((kept(w) as { count: number }).count).toBe(3);
});

test('a final with no number counts as round 1', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final on 6381739f, the pr');
    await send($, ROUND_SENSE, 'round 2 on 7c90198');
    expect(kept(w)).toEqual({
        count: 2,
        shas: ['6381739f', '7c90198'],
    });
});

test('a final with no sha in it is no round', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await send($, ROUND_SENSE, 'final word: defaced is not a sha');
    expect(kept(w)).toBeUndefined();
});

// clio's call 9: the old private keys are read at the land, only the shelf file is written
for (const [shape, old] of [
    ['the first build', ['aaaaaaa', 'bbbbbbb']],
    ['the second build', { count: 2, shas: ['aaaaaaa', 'bbbbbbb'] }],
] as const)
    test(`a key ${shape} kept privately seeds the shelf count`, async ($, on) => {
        const w = roundWorld(on);
        w.store.set(LANE_KEY, old);
        await start($);
        await send($, ROUND_SENSE, 'round 3 on ccccccc');
        expect([kept(w), w.store.get(LANE_KEY)]).toEqual([
            { count: 3, shas: ['aaaaaaa', 'bbbbbbb', 'ccccccc'] },
            old,
        ]);
    });

test('the shelf file outranks a private key of the same lane', async ($, on) => {
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { [LANE]: { count: 1, shas: ['aaaaaaa'] } },
                v: 1,
            }),
        },
    });
    w.store.set(LANE_KEY, { count: 5, shas: ['x1', 'x2', 'x3', 'x4', 'x5'] });
    await start($);
    await send($, ROUND_SENSE, 'round 2 on bbbbbbb');
    expect(kept(w)).toEqual({ count: 2, shas: ['aaaaaaa', 'bbbbbbb'] });
});

test("another lane's rounds in the file stay as they were", async ($, on) => {
    const other = { count: 2, shas: ['e1', 'e2'] };
    const w = roundWorld(on, {
        files: {
            [ROUNDS_FILE]: JSON.stringify({
                rounds: { 'herdr-lane-2 | FRM-1': other },
                v: 1,
            }),
        },
    });
    await start($);
    await send($, ROUND_SENSE, 'round 1 on abc12345');
    expect(roundsIn(w.files)).toEqual({
        [LANE]: { count: 1, shas: ['abc12345'] },
        'herdr-lane-2 | FRM-1': other,
    });
});

test('below the cap the sender hears no round line', async ($, on) => {
    roundWorld(on);
    await start($);
    const sent = await sendRounds($, 2);
    expect(sent.flatMap(roundLines)).toEqual([]);
});

test('at the cap the sender hears that a next round is past it, and clio hears nothing', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const sent = await sendRounds($, 3);
    expect([roundLines(sent[2] ?? {}).join(''), w.told]).toEqual([
        expect.stringContaining(
            'with a P0 or P1 in this chunk: a next one is past the cap',
        ),
        [],
    ]);
});

test('round 4 tells the coordinator the lane and the count, once, and warns the sender', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    const sent = await sendRounds($, 4);
    await send($, ROUND_SENSE, 'round 4 on abcdef3');
    expect([w.told, roundLines(sent[3] ?? {})]).toEqual([
        [
            {
                text: `[escalate] round 4 of ${LANE}, past the cap of 3, from ${ROUND_CODIE}: ask dima «go on, or stop the lane»`,
                to: CLIO.sessionId,
            },
        ],
        [
            'round 4 with a P0 or P1 in this chunk, past the cap of 3: the coordinator has the count and says go on or stop; nothing is refused, keep working',
        ],
    ]);
});

// a wing that runs the lane by its glide card hears the line, not main clio
const WING = {
    hostSessionId: 'local_wing',
    name: '🦉🪽 clio: wing 2',
    pid: 71,
    sessionId: 'wing-sid',
};

const wingLane = (over: Record<string, unknown> = {}) => ({
    '/home/.claude/shelf/lanes.json': JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id: 'l1',
                items: [{ done: false, text: 'the round store' }],
                members: { codie: SID },
                movedAt: 0,
                runner: WING.name,
                title: 'mods lane 5',
                ...over,
            },
        ],
    }),
});

for (const [why, lanes, peer, to] of [
    ['a live wing runs its card', wingLane(), true, WING.sessionId],
    [
        'a later card of a gone wing links it too',
        {
            '/home/.claude/shelf/lanes.json': JSON.stringify({
                lanes: [
                    ...JSON.parse(wingLane()['/home/.claude/shelf/lanes.json'])
                        .lanes,
                    ...JSON.parse(
                        wingLane({ id: 'l2', runner: '🦉🪽 clio: wing 9' })[
                            '/home/.claude/shelf/lanes.json'
                        ],
                    ).lanes,
                ],
            }),
        },
        true,
        WING.sessionId,
    ],
    ['the card is ended', wingLane({ endedAt: 1 }), true, CLIO.sessionId],
    ["the card's wing is gone", wingLane(), false, CLIO.sessionId],
    [
        'the card links another codie',
        wingLane({ members: { codie: 'other-sid' } }),
        true,
        CLIO.sessionId,
    ],
    // a real card keeps its codie by registry name (sixth sense, FRM-504 exit 2)
    [
        'the card names its codie as the registry does',
        wingLane({ members: { codie: ROUND_CODIE } }),
        true,
        WING.sessionId,
    ],
    [
        'the card names its codie by a name it has since left, linked by id',
        wingLane({
            linkedIds: { codie: SID },
            members: { codie: '⚡ 🔧 codie: mods lane 5 | FRM-1' },
        }),
        true,
        WING.sessionId,
    ],
    [
        'the card names another codie, linked by another id',
        wingLane({
            linkedIds: { codie: 'other-sid' },
            members: { codie: '⚡ 🔧 codie: herdr | FRM-2' },
        }),
        true,
        CLIO.sessionId,
    ],
    // a resume under a new id leaves the linked one behind: the name still finds the card
    [
        'the card names its codie as the registry does, linked by an id it left',
        wingLane({
            linkedIds: { codie: 'left-sid' },
            members: { codie: ROUND_CODIE },
        }),
        true,
        WING.sessionId,
    ],
] as const)
    test(`past the cap the line goes to ${to === WING.sessionId ? 'the wing' : 'main clio'}: ${why}`, async ($, on) => {
        const w = roundWorld(on, {
            files: {
                ...lanes,
                ...(peer
                    ? {
                          [`/home/.claude/sessions/${WING.pid}.json`]:
                              JSON.stringify(WING),
                      }
                    : {}),
            },
            threads: peer
                ? [
                      {
                          pid: WING.pid,
                          sessionId: WING.sessionId,
                          ...recordOf(WING.name),
                      },
                  ]
                : [],
        });
        await start($);
        await sendRounds($, 4);
        expect(w.told.map((t) => t.to)).toEqual([to]);
    });

test('each round past the cap tells the coordinator again', async ($, on) => {
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 5);
    expect(w.told.map((t) => t.text.match(/round (\d)/)?.[1])).toEqual([
        '4',
        '5',
    ]);
});

test('a round past the cap is still delivered', async ($, on) => {
    roundWorld(on);
    await start($);
    const sent = await sendRounds($, 4);
    expect(sent[3]?.result.success).toBe(true);
});

test('a coordinator line that cannot go says so in the sender’s turn', async ($, on) => {
    const w = roundWorld(on, { refusal: 'not reachable' });
    await start($);
    const sent = await sendRounds($, 4);
    expect([
        roundLines(sent[3] ?? {}).join(''),
        sent[3]?.result.success,
    ]).toEqual([
        expect.stringContaining(
            'the line to the coordinator did not go (not reachable)',
        ),
        true,
    ]);
    expect(w.told).toEqual([]);
});

test('the past-the-cap line still fires across a compact and a reload, read from the shelf file', async ($, on) => {
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    const w = roundWorld(on);
    await start($);
    await sendRounds($, 3);
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    } as never);
    w.store.clear();
    const r = await send($, ROUND_SENSE, 'round 4 on ddddddd');
    expect([roundLines(r).join(''), w.told.length]).toEqual([
        expect.stringContaining('the coordinator has the count'),
        1,
    ]);
});

test('🎛️ rounds switched off: no count, no coordinator line', async ($, on) => {
    const w = roundWorld(on, { plan: PLAN_NEXT });
    w.store.set('shown', { 'stash.rounds': false });
    await start($);
    for (let i = 0; i < 4; i++)
        await send($, ROUND_SENSE, `round ${i + 1} on abcdef${i}`);
    expect([w.files[ROUNDS_FILE], w.told]).toEqual([undefined, []]);
});
