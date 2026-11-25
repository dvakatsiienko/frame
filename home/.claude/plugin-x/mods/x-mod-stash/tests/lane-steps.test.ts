import {
    CODIE_NAME,
    FILE,
    type KeptLane,
    LIVE_FIX,
    PLAN,
    type Step,
    board,
    create,
    denied,
    kept,
    keptLane,
    lane,
    laneText,
    linkedPlan,
    marked,
    plant,
    poll,
    say,
    shelf,
    start,
    steer,
    steerOf,
    take,
    world,
} from './lane-world.ts';
import { expect, test } from './shared-boot.ts';

/* todo 6 — glide steps itself from the linked codie's plan step (spec exits 3–4) */

const STEP_SIXTH_SENSE = '⚡ 🔎 sixth sense: mods';
const NOW = new Date(2026, 9, 11, 18, 30).getTime();
const stepKey = (name: string) =>
    `lane-step:${name.replaceAll(/[\s\u200d]/g, '')}`;
const fiveSteps = (done = 0) =>
    ['a', 'b', 'c', 'd', 'e'].map((text, i) => ({ isDone: i < done, text }));
const codieLane = (over: Partial<KeptLane> = {}) =>
    keptLane({ items: fiveSteps(), members: { codie: CODIE_NAME }, ...over });
const pointerOf = (w: ReturnType<typeof world>) => {
    const l = kept(w)[0];
    return [
        l?.current,
        l?.items.map((x) => x.isDone),
        l?.history.map((h) => h.by),
    ];
};

test("a session's plan step lands in the store under its registry name", async ($, on) => {
    const w = world(on, { name: CODIE_NAME });
    await start($);
    const r = await lane($, { lines: ['now: b'], op: 'plan', step: 2 });
    expect([r.deny, w.store.get(stepKey(CODIE_NAME))]).toEqual([
        undefined,
        { at: NOW, step: 2 },
    ]);
});

for (const step of [1.5, -1, '2'])
    test(`a plan step of ${JSON.stringify(step)} is refused in one line`, async ($, on) => {
        const w = world(on, { name: CODIE_NAME });
        await start($);
        const r = await lane($, { lines: ['now: b'], op: 'plan', step });
        expect([r.deny, w.store.has(stepKey(CODIE_NAME))]).toEqual([
            'orbit plan: step is your lane step now, a whole number from 0, as your brief numbers it',
            false,
        ]);
    });

test("the linked codie's step 3 moves the lane while clio idles, and her next prompt hears it once", async ($, on) => {
    const w = world(on, { files: shelf(codieLane()) });
    w.store.set(stepKey(CODIE_NAME), { at: NOW + 1, step: 3 });
    await start($);
    await w.clock.advance(5_000);
    const moved = pointerOf(w);
    await say($, 'hi');
    await say($, 'again');
    const note = 'lane l1 «kept» moved to step 3 by ☕️ 🔧 codie: mods';
    expect([
        moved,
        w.contexts.map((c) => c.filter((x) => x === note).length),
    ]).toEqual([
        [3, [true, true, true, false, false], [CODIE_NAME]],
        [1, 0],
    ]);
});

test('a card ended while a codie step is read stays ended', async ($, on) => {
    const w = world(on, { files: shelf(codieLane()) });
    w.store.set(stepKey(CODIE_NAME), {
        get at() {
            const { lanes } = JSON.parse(w.files[FILE] ?? '{"lanes":[]}');
            w.files[FILE] = JSON.stringify({
                lanes: lanes.map((l: object) => ({ ...l, endedAt: NOW })),
            });
            return NOW + 1;
        },
        step: 3,
    });
    await start($);
    await w.clock.advance(5_000);
    expect(kept(w)[0]?.endedAt).toBe(NOW);
});

test("a move reaches clio's running turn at her next tool call", async ($, on) => {
    const w = world(on, { files: shelf(codieLane()) });
    w.store.set(stepKey(CODIE_NAME), { at: NOW + 1, step: 2 });
    await start($);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([pointerOf(w)[0], r.context]).toEqual([
        2,
        expect.arrayContaining([
            'lane l1 «kept» moved to step 2 by ☕️ 🔧 codie: mods',
        ]),
    ]);
});

const AT_3 = codieLane({
    current: 3,
    history: [{ act: 'step', at: NOW, current: 3, done: 3 }],
    items: fiveSteps(3),
});
for (const [why, lanes, key, step, shown] of [
    ['the codie names a step behind the pointer', [AT_3], CODIE_NAME, 2],
    ['the codie names the step count', [AT_3], CODIE_NAME, 5],
    [
        'the sixth sense names a step',
        [
            {
                ...AT_3,
                members: { codie: CODIE_NAME, 'sixth-sense': STEP_SIXTH_SENSE },
            },
        ],
        STEP_SIXTH_SENSE,
        4,
    ],
    ['an unlinked session names a step', [AT_3], '☕️ 🔧 codie: cli', 4],
    ['the lane is ended', [{ ...AT_3, endedAt: NOW }], CODIE_NAME, 4],
    ['🛼 glide is switched off', [AT_3], CODIE_NAME, 4, false],
] as const)
    test(`the pointer stays and the file gains nothing when ${why}`, async ($, on) => {
        const w = world(on, { files: shelf(...lanes) });
        const before = w.files[FILE];
        w.store.set(stepKey(key), { at: NOW + 1, step });
        if (shown === false) w.store.set('shown', { 'stash.glide': false });
        await start($);
        await w.clock.advance(5_000);
        await say($, 'hi');
        expect([
            w.files[FILE] === before,
            w.contexts.flat().some((c) => c.includes('moved to step')),
        ]).toEqual([true, false]);
    });

test("clio's step back holds until the codie names a step again", async ($, on) => {
    const w = world(on, { files: shelf(codieLane()) });
    w.store.set(stepKey(CODIE_NAME), { at: NOW + 1, step: 3 });
    await start($);
    await w.clock.advance(5_000);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    await w.clock.advance(5_000);
    const held = pointerOf(w)[0];
    w.store.set(stepKey(CODIE_NAME), { at: NOW + 10_001, step: 2 });
    await w.clock.advance(5_000);
    expect([held, pointerOf(w)[0]]).toEqual([1, 2]);
});

test('a create naming a lane plan takes its steps from the file', async ($, on) => {
    const w = world(on);
    await start($);
    expect(await linkedPlan($, w, 'x  ')).toBeUndefined();
    expect(kept(w)[0]?.items.map((i) => [i.text, i.isDone])).toEqual([
        ['step 1', true],
        ['step 2', false],
        ['step 3', false],
    ]);
});

test('a tick in the plan file moves the card to the first unticked line on the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    plant(w, marked('xx '));
    await poll(w);
    expect(kept(w)[0]?.current).toBe(2);
});

// FRM-649 step 132 (clio's ruling, 20:00): «we are here» is the first open step of the ticket the card runs; an older
// chunk's open close line stays open and is passed over
for (const [name, title, at] of [
    ['the ticket the card runs', 'mods — FRM-9 the idle poll', 2],
    ['its plan when the title runs no ticket', 'mods lane', 0],
] as const)
    test(`a plan card points at the first open step of ${name}`, async ($, on) => {
        const w = world(on);
        await start($);
        plant(w, [
            [' ', 'FRM-1', 'FRM-1 reviewed and closed'],
            ['x', 'FRM-9', 'measure first'],
            [' ', 'FRM-9', 'the idle poll'],
        ]);
        await create($, {
            items: undefined,
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
            title,
        });
        await poll(w);
        expect(kept(w)[0]?.current).toBe(at);
    });

test("a plan card whose running ticket is all done points at the plan's first open step", async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [
        ['x', 'FRM-9', 'measure first'],
        [' ', 'FRM-1', 'FRM-1 reviewed and closed'],
        ['x', 'FRM-9', 'the idle poll'],
    ]);
    await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
        title: 'mods — FRM-9 the idle poll',
    });
    await poll(w);
    expect(kept(w)[0]?.current).toBe(1);
});

// FRM-656 exit 1: card l96 read 49/116, the pointer's index, on a plan with 115 of 116 steps ticked
test('the card the deck draws carries its ticked steps, never the pointer', async ($, on) => {
    const w = world(on);
    await start($);
    plant(
        w,
        Array.from(
            { length: 116 },
            (_, i): Step => [i === 49 ? ' ' : 'x', 'FRM-649', `step ${i + 1}`],
        ),
    );
    await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
        title: 'mods lane',
    });
    await poll(w);
    const card = kept(w)[0] as KeptLane & { done?: number };
    expect([card.done, card.items.length, card.current]).toEqual([
        115, 116, 49,
    ]);
});

test('a plan with a step line holding no ticket id is refused, naming that line', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [
        [' ', 'FRM-7', 'the build'],
        [' ', undefined, 'the loose one'],
    ]);
    const r = await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
    });
    expect(r.deny).toContain('«the loose one»');
    expect(kept(w)).toEqual([]);
});

test('an edit naming a plan with a step line holding no ticket id is refused', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    plant(w, [[' ', undefined, 'the loose one']]);
    expect(
        await denied($, {
            act: 'edit',
            id: 'l1',
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
        }),
    ).toContain('«the loose one»');
});

test('an edit naming the plan its card follows passes, however its path is spelled', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [[' ', 'FRM-7', 'the build']]);
    await create($, { items: undefined, plan: PLAN });
    expect(
        await denied($, {
            act: 'edit',
            id: 'l1',
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
            title: 'mods y',
        }),
    ).toBeUndefined();
});

test('a second card naming one plan by another spelling is refused', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [[' ', 'FRM-7', 'the build']]);
    await create($, { items: undefined, plan: PLAN });
    expect(
        await denied($, {
            act: 'create',
            items: undefined,
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
            title: 'another name',
        }),
    ).toBe(LIVE_FIX);
});

test('a card a wing creates while a plan poll reads survives the poll', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [
        [' ', 'FRM-7', 'a'],
        [' ', 'FRM-7', 'b'],
    ]);
    await create($, { items: undefined, plan: PLAN });
    plant(w, [
        ['x', 'FRM-7', 'a'],
        [' ', 'FRM-7', 'b'],
    ]);
    const text = w.steps[PLAN];
    Object.defineProperty(w.steps, PLAN, {
        configurable: true,
        enumerable: true,
        get() {
            const lanes = JSON.parse(w.files[FILE] ?? '{"lanes":[]}').lanes;
            if (lanes.length === 1)
                w.files[FILE] = JSON.stringify({
                    lanes: [
                        ...lanes,
                        keptLane({ id: 'l2', runner: '🦉 clio (side)' }),
                    ],
                });
            return text;
        },
    });
    await poll(w);
    expect(kept(w).map((l) => [l.id, l.current])).toEqual([
        ['l1', 1],
        ['l2', 0],
    ]);
});

test('a card ended while a plan poll reads stays ended', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [
        [' ', 'FRM-7', 'a'],
        [' ', 'FRM-7', 'b'],
    ]);
    await create($, { items: undefined, plan: PLAN });
    plant(w, [
        ['x', 'FRM-7', 'a'],
        [' ', 'FRM-7', 'b'],
    ]);
    const text = w.steps[PLAN];
    Object.defineProperty(w.steps, PLAN, {
        configurable: true,
        enumerable: true,
        get() {
            const lanes = JSON.parse(w.files[FILE] ?? '{"lanes":[]}').lanes;
            w.files[FILE] = JSON.stringify({
                lanes: lanes.map((l: object) => ({ ...l, endedAt: NOW })),
            });
            return text;
        },
    });
    await poll(w);
    expect(kept(w)[0]?.endedAt).toBe(NOW);
});

test('an edit naming a plan its card does not follow is refused', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    plant(w, [[' ', 'FRM-7', 'the build']]);
    expect(
        await denied($, {
            act: 'edit',
            id: 'l1',
            plan: '~/.local/state/x/lanes/mods/lane-plan.md',
        }),
    ).toContain('edit cannot link a plan');
});

test('a plan whose every line carries its ticket draws the ids', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [
        [' ', 'FRM-7', 'the build'],
        [' ', 'FRM-8', 'next'],
    ]);
    const r = await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
    });
    expect(r.deny).toBeUndefined();
    expect(kept(w)[0]?.items.map((i) => i.ticket)).toEqual(['FRM-7', 'FRM-8']);
});

test('a chunk with its build ticked stays on the card until its closing slice ticks', async ($, on) => {
    const w = world(on);
    await start($);
    const plan = (closing: ' ' | 'x'): Step[] => [
        ['x', 'FRM-7', 'the build'],
        [closing, 'FRM-7', 'reviewed and closed'],
        [' ', 'FRM-8', 'the next chunk'],
    ];
    plant(w, plan(' '));
    await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
    });
    const onCard = () => {
        const lane = kept(w)[0];
        return lane?.items[lane.current]?.ticket;
    };
    expect(onCard()).toBe('FRM-7');
    plant(w, plan('x'));
    await poll(w);
    expect(onCard()).toBe('FRM-8');
});

test('an all-ticked plan file shows the lane done', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    plant(w, marked('xxx'));
    await poll(w);
    expect(kept(w)[0]?.current).toBe(3);
});

const lineStep = async (
    w: ReturnType<typeof world>,
    ticket: string | undefined,
    text: string,
) => {
    plant(w, [[' ', ticket, text]]);
    await poll(w);
    return kept(w)[0]?.items[0];
};

test('a plan line leading with its ticket keeps it once, as the link', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    expect(
        await lineStep(w, 'FRM-501', 'quiet reads the prompt'),
    ).toMatchObject({
        text: 'quiet reads the prompt',
        ticket: 'FRM-501',
    });
});

test('the card draws a leading ticket once', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await linkedPlan($, w);
    await lineStep(w, 'FRM-501', 'quiet reads the prompt');
    expect([
        (await ui.find({ text: 'FRM-501', type: 'Link' }))?.props.href,
        await ui.find({ text: 'FRM-501 quiet reads the prompt', type: 'Text' }),
    ]).toEqual(['https://linear.app/x-com/issue/FRM-501', undefined]);
});

test('a step past 60 chars is cut to 60 on the card', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    const step = await lineStep(w, 'FRM-501', 'a'.repeat(61));
    expect(step?.text).toBe('a'.repeat(60));
});

test('a card created from a plan carries the ticket from its first draw', async ($, on) => {
    const w = world(on);
    await start($);
    plant(w, [[' ', 'FRM-501', 'quiet reads the prompt']]);
    await create($, {
        act: 'create',
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
        title: 'plan lane',
    });
    expect(kept(w)[0]?.items[0]).toMatchObject({
        text: 'quiet reads the prompt',
        ticket: 'FRM-501',
    });
});

test('a plan file grown past seven steps keeps every step and its pointer', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    plant(w, marked('xxxxxxx  '));
    await poll(w);
    expect([kept(w)[0]?.items.length, kept(w)[0]?.current]).toEqual([9, 7]);
});

test('a create naming a plan of eleven steps is taken, never refused', async ($, on) => {
    const w = world(on);
    await start($);
    expect(await linkedPlan($, w, ' '.repeat(11))).toBeUndefined();
    expect(kept(w)[0]?.items.length).toBe(11);
});

test('a card of eleven steps draws the current one with its neighbours and says where it is', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await linkedPlan($, w, `${'x'.repeat(4)}${' '.repeat(7)}`);
    await poll(w);
    const text = (await laneText(ui)) ?? '';
    expect([
        text.includes('4–8 of 11'),
        text.includes('step 5'),
        text.includes('step 8'),
        text.includes('step 3'),
        text.includes('step 9'),
    ]).toEqual([true, true, true, false, false]);
});

test('a lane whose data breaks its draw blanks alone, the next lane draws', async ($, on) => {
    const w = world(on, {
        files: shelf(
            keptLane({ items: [null] as never }),
            keptLane({ id: 'l2', title: 'fine' }),
        ),
    });
    await start($);
    const ui = await board($);
    await w.clock.advance(5_000);
    expect([
        (await ui.find({ key: 'broken:lane l1', type: 'Box' }))?.text,
        await laneText(ui, 'l2'),
    ]).toEqual([
        '⚠ lane l1 could not draw',
        expect.stringContaining('🛼 glide: fine'),
    ]);
});

test('a card of seven steps draws all of them with no window label', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await linkedPlan($, w, 'x'.repeat(3) + ' '.repeat(4));
    await poll(w);
    expect(await laneText(ui)).not.toContain(' of 7');
});

test('a missing plan file keeps the last state marked «plan file gone»', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    delete w.files[PLAN];
    await poll(w);
    const l = kept(w)[0];
    expect([l?.current, l?.isPlanGone]).toEqual([1, true]);
    expect(await laneText(await board($))).toContain('· plan file gone');
});

// FRM-570 rule 7: x parses the plan, spawned only when the file moved
test('an untouched plan file spawns no x lane plan-steps on the next poll', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    const runs = w.planRuns.length;
    await poll(w);
    await poll(w);
    plant(w, marked('xx '));
    await poll(w);
    expect(w.planRuns.length - runs).toBe(1);
});

test('a failed x lane plan-steps keeps the last steps marked stale', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w, 'x  ');
    w.files[PLAN] = `${w.files[PLAN]}\n`;
    w.steps[PLAN] = undefined;
    await poll(w);
    const l = kept(w)[0];
    expect([l?.current, l?.isPlanStale]).toEqual([1, true]);
    expect(await laneText(await board($))).toContain(
        '· steps stale, x lane plan-steps failed',
    );
});

test('a create whose plan x cannot read is refused, naming x', async ($, on) => {
    const w = world(on);
    await start($);
    w.files[PLAN] = '- [ ] 01 · FRM-1 step 1';
    const r = await create($, {
        items: undefined,
        plan: '~/.local/state/x/lanes/mods/lane-plan.md',
    });
    expect([r.deny, kept(w)]).toEqual([
        expect.stringContaining('x lane plan-steps could not read'),
        [],
    ]);
});

test('a hand step on a linked card is refused, naming the file', async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    expect(await denied($, { act: 'step', current: 1, id: 'l1' })).toContain(
        'lane-plan.md',
    );
});

test('a card with no linked file stays hand-stepped', async ($, on) => {
    world(on);
    await start($);
    await create($);
    expect(
        await denied($, { act: 'step', current: 1, id: 'l1' }),
    ).toBeUndefined();
});

test("a plan tick that moves the pointer drops dima's steer on the old step", async ($, on) => {
    const w = world(on);
    await start($);
    await linkedPlan($, w);
    w.store.set('lane-steer:l1', { steer: 'hold on step 1' });
    plant(w, marked('x  '));
    await poll(w);
    expect(steerOf(w)).toBeUndefined();
});

test("a move whose write did not land keeps dima's steer and tells no move: a plan tick, a codie's step, a glide step", async ($, on) => {
    const w = world(on, { files: shelf(codieLane()) });
    await start($);
    await linkedPlan($, w);
    w.store.set('lane-steer:l1', { steer: 'hold' });
    w.store.set('lane-steer:l2', { steer: 'hold' });
    w.shelfReads.isMoveRefused = true;
    plant(w, marked('x  '));
    w.store.set(stepKey(CODIE_NAME), { at: NOW + 1, step: 3 });
    await poll(w);
    const deny = await denied($, { act: 'step', current: 2, id: 'l1' });
    await say($, 'hi');
    expect([
        w.store.get('lane-steer:l1'),
        w.store.get('lane-steer:l2'),
        deny,
        w.contexts.flat().some((c) => c.includes('moved to step')),
    ]).toEqual([
        { steer: 'hold' },
        { steer: 'hold' },
        'orbit glide: the lanes file was not kept: disk full',
        false,
    ]);
});

test('two glide steps at once both land', async ($, on) => {
    const w = world(on);
    await start($);
    await create($);
    await create($, { title: 'herdr panes' });
    const denies = await Promise.all(
        ['l1', 'l2'].map((id) => denied($, { act: 'step', current: 1, id })),
    );
    expect([denies, kept(w).map((l) => [l.id, l.current])]).toEqual([
        [undefined, undefined],
        [
            ['l1', 1],
            ['l2', 1],
        ],
    ]);
});

test('a create naming a relative plan path is refused for its shape, not read', async ($, on) => {
    const w = world(on);
    await start($);
    w.files['plan.md'] = '- [ ] 01 · FRM-1 step 1';
    expect(
        await denied($, { act: 'create', plan: 'plan.md', title: 'x' }),
    ).toContain('absolute or ~/');
});

test('a glide steer clio took while he was away is not offered back over a newer steer', async ($, on) => {
    const { store } = world(on);
    on('session.attach', (_$, e) => ({ clientId: e.clientId }));
    on('session.detach', (_$, e) => ({ clientId: e.clientId }));
    on('ui.panes', () => ({
        value: [
            {
                id: 'x-cc-deck',
                isFocused: false,
                isPlaced: true,
                isShown: true,
                plugin: 'x-mod-stash',
                title: 'fleet board',
            },
        ],
    }));
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await take(ui);
    const client = { clientId: 'desktop-2', surface: 'desktop' } as const;
    await $.session.detach({ ...client, reason: 'detach' });
    await ui.unmount();
    await say($, 'go');
    store.set('lane-steer:l1', { steer: 'bars first' });
    await $.session.attach(client);
    const back = await board($);
    await back.redraw();
    expect(await back.find({ key: 'kept:lane:l1:steer', type: 'Button' })).toBe(
        undefined,
    );
});
