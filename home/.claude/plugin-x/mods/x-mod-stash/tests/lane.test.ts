import {
    FILE,
    ITEMS,
    LIVE_FIX,
    create,
    denied,
    endTurn,
    kept,
    keptLane,
    lane,
    linkedPlan,
    say,
    shelf,
    start,
    world,
} from './lane-world.ts';
import { expect, test } from './shared-boot.ts';

/* exit 1 — the ops and the file */

test('a create lands in the shelf file with its history', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await create($);
    expect([
        r.deny,
        kept(w).map((l) => [l.id, l.title, l.history.length]),
    ]).toEqual([undefined, [['l1', 'mods settings', 1]]]);
});

for (const [why, input] of [
    [
        'an 8th step',
        {
            act: 'create',
            items: [...ITEMS, ...ITEMS, ...ITEMS.slice(0, 2)],
            title: 'x',
        },
    ],
    ['an empty list', { act: 'create', items: [], title: 'x' }],
    [
        'a step over 60 chars',
        { act: 'create', items: [{ text: 'x'.repeat(61) }], title: 'x' },
    ],
    ['an unknown lane id', { act: 'step', current: 1, id: 'l9' }],
    ['a step out of range', { act: 'step', current: 4, id: 'l1' }],
] as const)
    test(`${why} is refused with a one-line reason`, async ($, on) => {
        world(on, { files: shelf(keptLane()) });
        await start($);
        expect(await denied($, input)).toMatch(/^orbit glide: [^\n]+$/);
    });

test('a session the registry does not name 🦉 clio is refused', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 codie' });
    await start($);
    expect([(await create($)).deny, w.files[FILE]]).toEqual([
        'orbit glide: only 🦉 clio writes the lanes; every board shows them',
        undefined,
    ]);
});

test('clio writes the lanes from a hook that runs before session.start', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    const r = await lane($, { act: 'step', current: 1, id: 'l1' });
    expect([r.deny, kept(w)[0]?.current]).toEqual([undefined, 1]);
});

test('clio still writes the lanes after a plugin reload', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    await start($);
    await start($);
    const r = await lane($, { act: 'step', current: 1, id: 'l1' });
    expect([r.deny, kept(w)[0]?.current]).toEqual([undefined, 1]);
});

test('a new clio after a handoff steps and ends a lane it did not create', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    await start($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    await lane($, { act: 'end', id: 'l1' });
    const [l] = kept(w);
    expect([l?.current, typeof l?.endedAt]).toEqual([1, 'number']);
});

test('a second link of a role replaces the first', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'codie',
        session: 'old-codie',
    });
    await lane($, {
        act: 'link',
        id: 'l1',
        role: 'codie',
        session: 'new-codie',
    });
    await lane($, { act: 'link', id: 'l1', role: 'sixth-sense', session: 'v' });
    expect(kept(w)[0]?.members).toEqual({
        codie: 'new-codie',
        'sixth-sense': 'v',
    });
});

test('a second open lane of one topic is refused, naming the open one and its fix', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 'mods — x' });
    expect([
        await denied($, { act: 'create', items: ITEMS, title: 'MODS — y' }),
        await denied($, { act: 'create', items: ITEMS, title: 'mods: z' }),
        kept(w).map((l) => l.id),
    ]).toEqual([
        'orbit glide: lane l1 «mods — x» is live: step it (glide step l1) or edit it (glide edit l1); end it (glide end l1) only when the lane is over',
        'orbit glide: lane l1 «mods — x» is live: step it (glide step l1) or edit it (glide edit l1); end it (glide end l1) only when the lane is over',
        ['l1'],
    ]);
});

test('a second card naming the lane plan file a live card holds is refused whatever its title', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    expect(
        await denied($, {
            act: 'create',
            items: undefined,
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
            title: 'another name for the same lane',
        }),
    ).toBe(LIVE_FIX);
    expect(kept(w).map((l) => l.id)).toEqual(['l1']);
});

test("a title whose topic ends at « | » is the live lane's topic", async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    expect(
        await denied($, {
            act: 'create',
            items: ITEMS,
            title: 'mods settings | FRM-9',
        }),
    ).toBe(LIVE_FIX);
    expect(kept(w).map((l) => l.id)).toEqual(['l1']);
});

const CLIO_TITLES = ['🦉 cclio', '🦉 clio']; // read-both: a tab resumed under the old title
for (const title of CLIO_TITLES)
    test(`a session named ${title} writes the lanes`, async ($, on) => {
        const w = world(on, { name: title });
        await start($);
        expect(
            await denied($, { act: 'create', items: ITEMS, title: 'mods x' }),
        ).toBeUndefined();
        expect(kept(w).map((l) => l.id)).toEqual(['l1']);
    });

test('a session named 🦉clio with no record writes nothing', async ($, on) => {
    world(on, { name: '🦉clio' });
    await start($);
    expect(
        await denied($, { act: 'create', items: ITEMS, title: 'mods x' }),
    ).toContain('writes the lanes');
});

/* a wing writes the card of a lane it runs */

const SIDE = '🦉 clio (side)';
const wingRecord = (name: string, wing: number) => ({
    display: name,
    role: 'wing',
    wing,
});

test('a wing writes a card it created', async ($, on) => {
    const w = world(on, { name: SIDE, record: wingRecord(SIDE, 1) });
    await start($);
    expect((await create($)).deny).toBeUndefined();
    expect(
        await denied($, { act: 'step', current: 1, id: 'l1' }),
    ).toBeUndefined();
    expect([kept(w)[0]?.runner, kept(w)[0]?.current]).toEqual([SIDE, 1]);
});

for (const name of [
    '🦉🪽 clio: wing 2',
    '🦉🪽 clio: wing 12',
    '🦉 🪽 clio: wing 3',
])
    test(`a numbered wing writes a card it created: ${name}`, async ($, on) => {
        const w = world(on, { name, record: wingRecord(name, 3) });
        await start($);
        expect((await create($)).deny).toBeUndefined();
        expect(kept(w)[0]?.runner).toBe(name);
    });

// FRM-579 exit 5: a rename moves a wing's display, never the lane it runs
test('a renamed wing still steps the card it runs', async ($, on) => {
    const wing = '🦉🪽 clio: wing 2';
    const w = world(on, {
        name: 'night shift',
        record: { ...wingRecord('night shift', 2), roleName: wing },
    });
    w.files[FILE] = JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id: 'l1',
                items: [{ isDone: false, text: 'a' }],
                members: {},
                movedAt: 0,
                runner: wing,
                title: 'mods x',
            },
        ],
    });
    await start($);
    expect(
        await denied($, { act: 'step', current: 1, id: 'l1' }),
    ).toBeUndefined();
    expect(kept(w)[0]?.current).toBe(1);
});

test('a wing is refused on a card it does not run, naming the card', async ($, on) => {
    const w = world(on, { name: SIDE, record: wingRecord(SIDE, 1) });
    w.files[FILE] = JSON.stringify({
        lanes: [
            {
                current: 0,
                history: [],
                id: 'l1',
                items: [{ isDone: false, text: 'a' }],
                members: {},
                movedAt: 0,
                title: 'mods x',
            },
        ],
    });
    await start($);
    const was = w.files[FILE];
    expect(await denied($, { act: 'step', current: 1, id: 'l1' })).toContain(
        'lane l1',
    );
    expect(w.files[FILE]).toBe(was);
});

for (const name of [
    '⚡ 🔧 codie: 🦉 clio (side)',
    '🦉 clio (fork)',
    '🦉🪽 clio: wing',
    '🦉🪽 clio: wing two',
    '🦉 clio: wing 2',
    '⚡ 🔧 codie: mods lane 5 | FRM-1',
])
    test(`stays refused: ${name}`, async ($, on) => {
        world(on, { name });
        await start($);
        expect(
            await denied($, { act: 'create', items: ITEMS, title: 'mods x' }),
        ).toContain('writes the lanes');
    });

test('a wing retitled with other spacing still writes its card', async ($, on) => {
    const w = world(on, {
        name: '🦉clio (side)',
        record: wingRecord('🦉clio (side)', 1),
    });
    w.files[FILE] = JSON.stringify({
        lanes: [keptLane({ current: 0, id: 'l1', runner: SIDE })],
    });
    await start($);
    expect(
        await denied($, { act: 'step', current: 1, id: 'l1' }),
    ).toBeUndefined();
});

test("a wing's card never nags clio, its turn count being another thread's", async ($, on) => {
    const w = world(on);
    w.files[FILE] = JSON.stringify({
        lanes: [keptLane({ id: 'l1', movedAt: 0, runner: SIDE })],
    });
    await start($);
    for (let i = 0; i < 9; i++) {
        await say($, 'go');
        await endTurn($);
    }
    await say($, 'go');
    expect(
        w.contexts.flat().filter((c) => c.includes('moved nothing')),
    ).toEqual([]);
});

test('a session whose name only ends in clio is not the lane owner', async ($, on) => {
    world(on, { name: '⚡ 🔧 codie: board for clio' });
    await start($);
    expect(
        await denied($, { act: 'create', items: ITEMS, title: 'mods x' }),
    ).toContain('only 🦉 clio writes the lanes');
});

test('a finished lane holds its topic until it is ended', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { items: [{ text: 'a' }], title: 'mods — x' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const whileFinished = await denied($, {
        act: 'create',
        items: ITEMS,
        title: 'mods — y',
    });
    await lane($, { act: 'end', id: 'l1' });
    const afterEnd = await denied($, {
        act: 'create',
        items: ITEMS,
        title: 'mods — y',
    });
    expect([
        whileFinished,
        afterEnd,
        kept(w).map((l) => [l.id, l.endedAt === undefined]),
    ]).toEqual([
        'orbit glide: lane l1 «mods — x» is live: step it (glide step l1) or edit it (glide edit l1); end it (glide end l1) only when the lane is over',
        undefined,
        [
            ['l1', false],
            ['l2', true],
        ],
    ]);
});

test('two lanes live at once both persist', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 'mods' });
    await create($, { title: 'cli' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(kept(w).map((l) => [l.id, l.title, l.current])).toEqual([
        ['l1', 'mods', 1],
        ['l2', 'cli', 0],
    ]);
});

test('every pointer move lands in the history with its time', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    await lane($, { act: 'step', current: 0, id: 'l1' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(
        kept(w)[0]?.history.map((h) => [h.act, h.current, typeof h.at]),
    ).toEqual([
        ['create', 0, 'number'],
        ['step', 1, 'number'],
    ]);
});

/* exit 5 — the stale nag, clio's turns only */

test("a lane that moved nothing for 8 of clio's turns reads stale; a step that moves nothing keeps the count", async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { title: 't' });
    for (let i = 0; i < 8; i++) {
        await endTurn($);
        await lane($, { act: 'step', current: 0, id: 'l1' });
    }
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane l1 «t».*stale/.test(c))).toBe(
        true,
    );
});

const staleLines = (w: { contexts: string[][] }) =>
    (w.contexts.at(-1) ?? []).filter((c) => c.includes('moved nothing'));

test('a stale lane is told once, and again only after it moved and went stale anew', async ($, on) => {
    const w = world(on);
    await start($);
    await create($, { items: [{ text: 'a' }, { text: 'b' }], title: 't' });
    const told: number[] = [];
    const turns = async (n: number) => {
        for (let i = 0; i < n; i++) await endTurn($);
        await say($, 'go');
        told.push(staleLines(w).length);
    };
    await turns(8);
    await turns(1);
    // no prompt lands between the move and the next staleness: the mod's own turns grow the count too
    await lane($, { act: 'step', current: 1, id: 'l1' });
    await turns(8);
    expect(told).toEqual([1, 0, 1]);
});

test('his text for a stale lane replaces the built-in line, its placeholders filled', async ($, on) => {
    const w = world(on, {
        files: {
            '/home/.claude/shelf/herdr-settings/settings.json': JSON.stringify({
                rows: {
                    'stash.orbit.text.lane-stale':
                        'heron: {id} «{title}» sat {n} turns, use {tool}',
                },
                v: 1,
            }),
        },
    });
    await start($);
    await create($, { title: 't' });
    for (let i = 0; i < 8; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)).toContain(
        'heron: l1 «t» sat 8 turns, use mcp__x-mod-stash__orbit',
    );
});

test('with no lane the reminder carries no lane text', async ($, on) => {
    const w = world(on);
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => c.includes('lane'))).toBe(false);
});
