import { expect, test } from 'claude-code/testing';

import {
    CLIO,
    CODIE,
    CODIE_NAME,
    PID,
    SID,
    type Step,
    codieAt,
    create,
    kept,
    keptLane,
    lane,
    marked,
    plant,
    poll,
    shelf,
    start,
    world,
} from './lane-world.ts';
import { THREADS_FILE, recordOf, threadsFile } from './threads.ts';

/* FRM-602: a dispatch opens its lane's card — x's thread record names the lane, the stash draws the card */
const DISPATCHED = '/home/.local/state/x/lanes/mods-lane-9/lane-plan.md';
const dispatched = (
    codies: {
        sessionId: string;
        pid: number;
        lane?: string;
        coordinator?: string;
        at?: number;
        dispatchedAt?: number;
        ticket?: string;
    }[],
    self = recordOf(CLIO),
) => ({
    files: {
        [THREADS_FILE]: threadsFile([
            { pid: PID, sessionId: SID, ...self },
            ...codies.map((c) => ({
                coordinator: 'clio-main',
                ...c,
                role: 'codie',
            })),
        ]),
    },
    peers: codies.map((c) => codieAt(c.sessionId, { pid: c.pid })),
});
const titled = (w: ReturnType<typeof world>, steps: Step[]) => {
    plant(w, steps, DISPATCHED);
    w.files[DISPATCHED] = `# mods lane 9 — lane plan\n\n${w.files[DISPATCHED]}`;
};

test('a live codie dispatched into a lane with a plan opens its card on the next poll, codie linked', async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('x  '));
    await start($);
    await poll(w);
    const cards = kept(w).filter((l) => !l.endedAt);
    expect(cards.map((l) => [l.title, l.plan, l.members.codie])).toEqual([
        [
            'mods lane 9',
            '~/.local/state/x/lanes/mods-lane-9/lane-plan.md',
            CODIE_NAME,
        ],
    ]);
    expect(cards[0]?.items.map((i) => [i.text, i.isDone])).toEqual([
        ['step 1', true],
        ['step 2', false],
        ['step 3', false],
    ]);
});

// FRM-649 exit 2 (FRM-616:W36–W38), W39: the card's title is the lane record's «<scope> — <ticket> <what>», the ticket the
// codie runs, never the plan's heading
test("a dispatched lane's card reads «<scope> — <ticket> <what>» from x lane show, the heading only when the record has none", async ($, on) => {
    const w = world(
        on,
        dispatched([
            {
                lane: 'mods-lane-9',
                pid: 5001,
                sessionId: CODIE,
                ticket: 'FRM-9',
            },
        ]),
    );
    titled(w, marked('x  '));
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'one ask counter, cards from the lane record',
    };
    await start($);
    await poll(w);
    // the card opens under its record's title, never the heading first
    const opened = kept(w).find((l) => !l.endedAt)?.title;
    await poll(w);
    const cards = kept(w).filter((l) => !l.endedAt);
    expect([
        opened,
        cards.map((l) => [l.title, l.ticket, l.members.codie]),
        w.showRuns,
    ]).toEqual([
        'mods — FRM-9 one ask counter, cards from the lane record',
        [
            [
                'mods — FRM-9 one ask counter, cards from the lane record',
                'FRM-9',
                CODIE_NAME,
            ],
        ],
        // read once for the dispatch, never each poll
        ['mods-lane-9'],
    ]);
});

test('the sixth sense x lane show names joins the card beside the codie, once it runs', async ($, on) => {
    const SIXTH_SID = 'sx6sx6sx-sixth';
    const setup = dispatched([
        { lane: 'mods-lane-9', pid: 5001, sessionId: CODIE },
    ]);
    const w = world(on, {
        ...setup,
        peers: [
            ...setup.peers,
            codieAt(SIXTH_SID, { name: '⚡ 🔎 mods | FRM-9', pid: 5002 }),
        ],
    });
    titled(w, marked('x  '));
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie', [SIXTH_SID]: 'sixth-sense' },
        scope: 'mods',
        what: 'one ask counter',
    };
    await start($);
    await poll(w);
    await poll(w);
    const card = kept(w).find((l) => !l.endedAt);
    expect([card?.members.codie, card?.members['sixth-sense']]).toEqual([
        CODIE_NAME,
        '⚡ 🔎 mods | FRM-9',
    ]);
});

test("a lane's next dispatch retitles its open card from the record", async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('x  '));
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'the first chunk',
    };
    await start($);
    await poll(w);
    // the next dispatch rewrites the codie's record: a new time, the next ticket
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'the next chunk',
    };
    Object.assign(
        w.files,
        dispatched([
            { at: 2, lane: 'mods-lane-9', pid: 5001, sessionId: CODIE },
        ]).files,
    );
    await poll(w);
    expect(
        kept(w)
            .filter((l) => !l.endedAt)
            .map((l) => l.title),
    ).toEqual(['mods — the next chunk']);
});

test('an x lane show that fails is read again on the next poll', async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('x  '));
    await start($);
    await poll(w);
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'read on the second try',
    };
    await poll(w);
    expect([
        kept(w)
            .filter((l) => !l.endedAt)
            .map((l) => l.title),
        w.showRuns,
    ]).toEqual([
        ['mods — read on the second try'],
        ['mods-lane-9', 'mods-lane-9'],
    ]);
});

test("a title clio gave the card by hand stands until the lane's records change", async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('x  '));
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'the record title',
    };
    await start($);
    await poll(w);
    const id = kept(w).find((l) => !l.endedAt)?.id;
    await lane($, { act: 'edit', id, title: 'mods — her own words' });
    await poll(w);
    expect(
        kept(w)
            .filter((l) => !l.endedAt)
            .map((l) => l.title),
    ).toEqual(['mods — her own words']);
});

test('a sixth sense x records after the dispatch joins the card on a later poll', async ($, on) => {
    const SIXTH_SID = 'sx6sx6sx-sixth';
    const setup = dispatched([
        { lane: 'mods-lane-9', pid: 5001, sessionId: CODIE },
    ]);
    const w = world(on, {
        ...setup,
        peers: [
            ...setup.peers,
            codieAt(SIXTH_SID, { name: '⚡ 🔎 mods | FRM-9', pid: 5002 }),
        ],
    });
    titled(w, marked('x  '));
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie' },
        scope: 'mods',
        what: 'one ask counter',
    };
    await start($);
    await poll(w);
    // the summon of the sixth sense writes its record into the lane; the codie's stays as it was
    w.files[THREADS_FILE] = threadsFile([
        { pid: PID, sessionId: SID, ...recordOf(CLIO) },
        {
            coordinator: 'clio-main',
            lane: 'mods-lane-9',
            pid: 5001,
            role: 'codie',
            sessionId: CODIE,
        },
        {
            lane: 'mods-lane-9',
            pid: 5002,
            role: 'sixth-sense',
            sessionId: SIXTH_SID,
        },
    ]);
    w.shows['mods-lane-9'] = {
        lane: 'mods-lane-9',
        members: { [CODIE]: 'codie', [SIXTH_SID]: 'sixth-sense' },
        scope: 'mods',
        what: 'one ask counter',
    };
    await poll(w);
    await poll(w);
    expect(kept(w).find((l) => !l.endedAt)?.members['sixth-sense']).toBe(
        '⚡ 🔎 mods | FRM-9',
    );
});

// FRM-649 step 119: a card ended before the lane's next dispatch leaves the plan free for a new card; one ended after it
// holds, so a lane clio closed never comes back. x's sync moves the record's `at` each poll (here 400, after every end),
// so the end is read against `dispatchedAt` (200) alone (flyway f57); the end is per lane, never per thread
for (const [name, endedAt, plan, open] of [
    ['ended before the dispatch opens a new card', 100, 'mods-lane-9', 1],
    [
        'ended after the dispatch, its record synced since, opens none',
        300,
        'mods-lane-9',
        0,
    ],
    ['of another lane leaves this lane its card', 300, 'mods-lane-8', 1],
] as const)
    test(`a lane card ${name}`, async ($, on) => {
        const d = dispatched([
            {
                at: 400,
                dispatchedAt: 200,
                lane: 'mods-lane-9',
                pid: 5001,
                sessionId: CODIE,
            },
        ]);
        const w = world(on, {
            ...d,
            files: {
                ...d.files,
                ...shelf(
                    keptLane({
                        endedAt,
                        plan: `~/.local/state/x/lanes/${plan}/lane-plan.md`,
                    }),
                ),
            },
        });
        titled(w, marked('x  '));
        await start($);
        await poll(w);
        expect(kept(w).filter((l) => !l.endedAt).length).toBe(open);
    });

test('a dispatch opens no card for a gone codie, a record with no lane, or a lane with no plan', async ($, on) => {
    const w = world(on, {
        ...dispatched([
            { lane: 'mods-lane-9', pid: 5001, sessionId: CODIE },
            { pid: 5002, sessionId: 'n0n0n0n0-no-lane' },
            { lane: 'mods-lane-10', pid: 5003, sessionId: 'p0p0p0p0-no-plan' },
        ]),
        peers: [
            codieAt('n0n0n0n0-no-lane', { pid: 5002 }),
            codieAt('p0p0p0p0-no-plan', { pid: 5003 }),
        ],
    });
    titled(w, marked('   '));
    await start($);
    await poll(w);
    expect(kept(w)).toEqual([]);
});

test('a session that is not the coordinator opens no card from a dispatch', async ($, on) => {
    const w = world(on, {
        ...dispatched(
            [{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }],
            {},
        ),
        name: '⚡ 🔧 herdr | FRM-1',
    });
    titled(w, marked('   '));
    await start($);
    await poll(w);
    expect(kept(w)).toEqual([]);
});

test('a second dispatch into the lane keeps one card and links its codie', async ($, on) => {
    const w = world(on, {
        ...dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
        peers: [
            codieAt(CODIE),
            codieAt('j0j0j0j0-joiner', {
                name: '⚡ 🔧 mods | FRM-9',
                pid: 5002,
            }),
        ],
    });
    titled(w, marked('   '));
    await start($);
    await poll(w);
    // the first codie lives on and keeps its record, listed after the joiner: only the newest dispatch holds the link
    w.files[THREADS_FILE] = threadsFile([
        { pid: PID, sessionId: SID, ...recordOf(CLIO) },
        {
            at: 2,
            coordinator: 'clio-main',
            lane: 'mods-lane-9',
            pid: 5002,
            role: 'codie',
            sessionId: 'j0j0j0j0-joiner',
        },
        {
            at: 1,
            coordinator: 'clio-main',
            lane: 'mods-lane-9',
            pid: 5001,
            role: 'codie',
            sessionId: CODIE,
        },
    ]);
    titled(w, marked('    '));
    await poll(w);
    const links = () =>
        kept(w)[0]?.history.filter((h) => h.act === 'link codie').length;
    const after = links();
    await poll(w);
    await poll(w);
    const cards = kept(w).filter((l) => !l.endedAt);
    expect(cards.map((l) => [l.members.codie, l.items.length])).toEqual([
        ['⚡ 🔧 mods | FRM-9', 4],
    ]);
    expect(links()).toBe(after);
});

test('a card clio opened by hand on the plan gets no second one from the dispatch', async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('   '));
    await start($);
    await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods-lane-9/lane-plan.md',
    });
    await poll(w);
    expect(kept(w).filter((l) => !l.endedAt)).toHaveLength(1);
});

test('a lane whose card clio ended opens no new card while its codie lives on', async ($, on) => {
    const w = world(
        on,
        dispatched([{ lane: 'mods-lane-9', pid: 5001, sessionId: CODIE }]),
    );
    titled(w, marked('xxx'));
    await start($);
    await poll(w);
    await lane($, { act: 'end', id: kept(w)[0]?.id });
    await poll(w);
    expect(kept(w).filter((l) => !l.endedAt)).toEqual([]);
});

test("a lane a wing dispatched opens in that wing's session as its card, never in main's", async ($, on) => {
    const codie = {
        coordinator: 'clio-wing-2',
        lane: 'mods-lane-9',
        pid: 5001,
        sessionId: CODIE,
    };
    const main = world(on, dispatched([codie]));
    titled(main, marked('   '));
    await start($);
    await poll(main);
    expect(kept(main)).toEqual([]);
});

test('a wing opens the card of a lane it dispatched, its runner set', async ($, on) => {
    const wing = '🦉🪽 clio: wing 2';
    const w = world(on, {
        ...dispatched(
            [
                {
                    coordinator: 'clio-wing-2',
                    lane: 'mods-lane-9',
                    pid: 5001,
                    sessionId: CODIE,
                },
            ],
            recordOf(wing),
        ),
        name: wing,
    });
    titled(w, marked('   '));
    await start($);
    await poll(w);
    expect(kept(w).map((l) => [l.title, l.runner, l.members.codie])).toEqual([
        ['mods lane 9', wing, CODIE_NAME],
    ]);
});

test('a codie a summon recorded with a lane but no dispatching clio opens no card', async ($, on) => {
    const w = world(
        on,
        dispatched([
            {
                coordinator: undefined,
                lane: 'mods-lane-9',
                pid: 5001,
                sessionId: CODIE,
            },
        ]),
    );
    titled(w, marked('   '));
    await start($);
    await poll(w);
    expect(kept(w)).toEqual([]);
});
