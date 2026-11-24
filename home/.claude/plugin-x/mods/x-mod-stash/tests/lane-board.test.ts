import type { On } from 'claude-code';

import {
    ASK,
    CODIE,
    SID,
    SIXTH_SENSE,
    TOOL,
    board,
    create,
    endTurn,
    kept,
    keptLane,
    lane,
    laneText,
    linked,
    published,
    say,
    shelf,
    start,
    steer,
    steerOf,
    subText,
    take,
    world,
} from './lane-world.ts';
import { type Engine, expect, test } from './shared-boot.ts';

/* exit 2 — the card on every board */

test('a card lists every step in order, done ones kept, the current marked', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(await laneText(ui)).toMatch(
        /🛼 glide: mods settings.*✅ shape the settings pane.*➡️ .*FRM-391the board in cards.*⬜ guard rules/su,
    );
});

test("any session's board draws the lane clio wrote", async ($, on) => {
    world(on, { files: shelf(keptLane()), name: '☕️ 🔧 codie' });
    await start($);
    expect(await laneText(await board($))).toMatch(/🛼 glide: kept.*➡️ a/su);
});

test('the current step reads ➡️, no «we are here» (dima, 20:46)', async ($, on) => {
    world(on, { files: shelf(keptLane()) });
    await start($);
    const text = await laneText(await board($));
    expect([text?.includes('➡️ a'), text?.includes('we are here')]).toEqual([
        true,
        false,
    ]);
});

// W39: the running ticket in a card's title opens in linear
test("a card title's ticket links to linear", async ($, on) => {
    world(on, {
        files: shelf(
            keptLane({
                ticket: 'FRM-555',
                title: 'mods — FRM-555 an idle poll',
            }),
        ),
    });
    await start($);
    const ui = await board($);
    expect((await ui.find({ text: 'FRM-555', type: 'Link' }))?.props.href).toBe(
        'https://linear.app/x-com/issue/FRM-555',
    );
});

test('a ticket step links to linear', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    expect((await ui.find({ text: 'FRM-391', type: 'Link' }))?.props.href).toBe(
        'https://linear.app/x-com/issue/FRM-391',
    );
});

test("a bare tick on the current step reaches clio's next prompt once as «good to go»", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await take(ui);
    await say($, 'go');
    await say($, 'again');
    expect([
        w.contexts.at(-2)?.some((c) => c.includes('🛎️ good to go')),
        w.contexts.at(-1)?.some((c) => c.includes('🛎️ good to go')),
    ]).toEqual([true, false]);
});

test("one steer box and one take, on the current step only; a taken steer joins dima's next prompt once", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 1, id: 'l1' });
    const boxes = (await ui.findAll({ type: 'Input' })).filter((n) =>
        n.key?.startsWith('lane:'),
    ).length;
    await steer(ui, 'cards first');
    await take(ui);
    await say($, 'go');
    await say($, 'again');
    expect([
        boxes,
        w.contexts.at(-2)?.some((c) => c.includes('«cards first»')),
        w.contexts.at(-1)?.some((c) => c.includes('«cards first»')),
    ]).toEqual([1, true, false]);
});

test('a steer never sent with take stays a draft (dima, 20:51)', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await say($, 'go');
    expect([
        w.contexts.at(-1)?.some((c) => c.includes('cards first')),
        steerOf(w)?.steer,
    ]).toEqual([false, 'cards first']);
});

test("a peer's prompt never carries a taken steer (dima, 20:51: only via send prompt)", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await take(ui);
    await $.prompt.submit({
        origin: { kind: 'peer' },
        text: 'a ping',
        wait: false,
    } as never);
    expect(w.contexts.at(-1)?.some((c) => c.includes('cards first'))).toBe(
        false,
    );
});

test("a steer taken while clio's turn runs joins it at her next tool call", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await say($, 'go');
    await steer(ui, 'stop and look');
    await take(ui);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    const again = await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect([
        r.context?.some((c) => c.includes('«stop and look»')),
        again.context?.some((c) => c.includes('stop and look')) ?? false,
    ]).toEqual([true, false]);
});

test("a member's board takes a steer that reaches clio, never the member's own prompt", async ($, on) => {
    const w = world(on, { files: shelf(keptLane()), name: '☕️ 🔧 codie' });
    await start($);
    const ui = await board($);
    await steer(ui, 'slow down');
    await take(ui);
    await say($, 'go');
    expect([
        steerOf(w)?.steer,
        steerOf(w)?.isTaken,
        w.contexts.at(-1)?.some((c) => c.includes('slow down')),
        // only clio's lane op writes the shelf file
        kept(w)[0]?.steer,
    ]).toEqual(['slow down', true, false, undefined]);
});

test('a steer on a step leaves when clio moves the lane past it', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await create($);
    await steer(ui, 'cards first');
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(steerOf(w)).toBe(undefined);
});

test('a taken steer clears from the box once clio took it', async ($, on) => {
    world(on);
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
    await say($, 'go');
    // the field held what it showed while typed into; the clear remounts it, so the surface drops the typed text
    const box = (await ui.findAll({ type: 'Input' })).find((n) =>
        n.key?.startsWith('lane:l1:steer'),
    );
    expect([
        box?.key,
        box?.props.value,
        (await ui.find({ key: 'lane:l1:take', type: 'Button' }))?.text,
    ]).toEqual(['lane:l1:steer#1', '', '🛎️ tick']);
});

test('a step past an item marks it done, never leaving the pointer on a done one', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($, {
        items: [{ done: true, text: 'a' }, { text: 'b' }, { text: 'c' }],
        title: 't',
    });
    const first = await laneText(ui);
    await lane($, { act: 'step', current: 2, id: 'l1' });
    expect([first, await laneText(ui)]).toEqual([
        expect.stringMatching(/✅ a.*➡️ b/su),
        expect.stringMatching(/✅ a.*✅ b.*➡️ c/su),
    ]);
});

test('a step back moves the pointer back and reopens the steps after it', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($, {
        items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        title: 't',
    });
    await lane($, { act: 'step', current: 2, id: 'l1' });
    await lane($, { act: 'step', current: 1, id: 'l1' });
    expect(await laneText(ui)).toMatch(/✅ a.*➡️ b.*⬜ c/su);
});

test('a lane reads back whole from the shelf file at a fresh start', async ($, on) => {
    world(on, {
        files: shelf(
            keptLane({
                current: 1,
                items: [
                    { isDone: true, text: 'a' },
                    { isDone: false, text: 'b' },
                ],
            }),
        ),
    });
    await start($);
    expect(await laneText(await board($))).toMatch(
        /🛼 glide: kept.*✅ a.*➡️ b/su,
    );
});

test("a finished lane stays, all done, across turn ends until the end call (dima's o57)", async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await create($);
    await lane($, { act: 'step', current: 3, id: 'l1' });
    for (let i = 0; i < 4; i++) await endTurn($);
    const finished = await laneText(ui);
    await lane($, { act: 'end', id: 'l1' });
    expect([finished, await laneText(ui)]).toEqual([
        expect.stringMatching(
            /✅ shape.*✅ .*FRM-391the board.*✅ guard rules/su,
        ),
        undefined,
    ]);
});

test('an ended lane never comes back at a fresh start', async ($, on) => {
    world(on, { files: shelf(keptLane({ endedAt: 1, title: 'gone' })) });
    await start($);
    expect(await laneText(await board($))).toBe(undefined);
});

test("nothing of a lane enters a member's model context", async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ steer: 'n' })),
        name: '☕️ 🔧 codie',
    });
    await start($);
    for (let i = 0; i < 9; i++) await endTurn($);
    await say($, 'go');
    expect(w.contexts.at(-1)?.some((c) => /lane|kept/.test(c))).toBe(false);
});

test('the 🛼 glide switch hides every glide card', async ($, on) => {
    const w = world(on, { files: shelf(keptLane()) });
    w.store.set('shown', { 'stash.glide': false });
    await start($);
    expect(await laneText(await board($))).toBe(undefined);
});

test('a codie subcard sits above a sixth sense subcard, each folded to its count', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, [ASK, { ...ASK, id: 'o4' }]);
    published(w, SIXTH_SENSE, [ASK]);
    await start($);
    const text = await laneText(await board($));
    expect([
        text?.indexOf('🙋 🔧 codie · 2 asks'),
        text?.includes('cut the second probe'),
    ]).toEqual([expect.any(Number), false]);
    expect(
        (text?.indexOf('🙋 🔧 codie · 2 asks') ?? -1) <
            (text?.indexOf('🙋 🔎 sixth sense · 1 ask') ?? -1),
    ).toBe(true);
});

test('a member with asks heads its subcard in bold amber with a 🙋; at 0 it reads plain, and no strip draws', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, [ASK]);
    published(w, SIXTH_SENSE, []);
    await start($);
    const ui = await board($);
    const head = async (text: string) => {
        const t = await ui.find({ text, type: 'Text' });
        return [t?.props.bold, t?.props.color];
    };
    expect([
        await head('🙋 🔧 codie · 1 ask'),
        await head('🔎 sixth sense · 0 asks'),
    ]).toEqual([
        [true, '#d9661a'],
        [true, undefined],
    ]);
});

test("at 0 asks the board's top has no strip", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, []);
    await start($);
    expect(
        await (await board($)).find({ key: 'asks-strip', type: 'Box' }),
    ).toBe(undefined);
});

// FRM-643 (dima's 12:54 ok): the strip counts only the clios' own orbit asks; a member's asks show on its lane card alone
test("the board's top strip counts the clio's own open asks, a marked one not counted, never a member's", async ($, on) => {
    const w = world(on, { files: linked() });
    // the poll reads the clios' asks only while a board is open
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
    published(w, CODIE, [ASK, { ...ASK, id: 'o4' }]);
    published(w, SID, [
        ASK,
        { ...ASK, id: 'o4' },
        { ...ASK, id: 'o5', mark: 'accepted' },
    ]);
    await start($);
    await w.clock.advance(5_000);
    const ui = await board($);
    expect((await ui.find({ key: 'asks-strip', type: 'Box' }))?.text).toBe(
        '🙋 2 asks wait for you· 🦉 clio 2',
    );
});

test("a member's asks alone draw no strip", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, [ASK]);
    await start($);
    await w.clock.advance(5_000);
    expect(
        await (await board($)).find({ key: 'asks-strip', type: 'Box' }),
    ).toBe(undefined);
});

test('🪐 orbit switched off draws no strip', async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, SID, [ASK]);
    w.store.set('shown', { 'stash.orbit': false });
    await start($);
    await w.clock.advance(5_000);
    expect(
        await (await board($)).find({ key: 'asks-strip', type: 'Box' }),
    ).toBe(undefined);
});

// todo 21: a /clear left the l14 card linked to the codie's old id, so its asks never drew there
const OLD = 'o0o0o0o0-old';

test('a member linked by an id it cleared away from keeps its asks on the card', async ($, on) => {
    const w = world(on, {
        files: shelf(keptLane({ members: { codie: OLD } })),
    });
    w.store.set(`succ:${OLD}`, { at: 1, sid: CODIE });
    published(w, CODIE, [ASK, { ...ASK, id: 'o4' }]);
    await start($);
    expect(await laneText(await board($))).toContain('🙋 🔧 codie · 2 asks');
});

test('a /clear records the id the session goes on under', async ($, on) => {
    const w = world(on);
    await start($);
    await $.session.end({ reason: 'clear', sessionId: OLD } as never);
    await endTurn($);
    expect(w.store.get(`succ:${OLD}`)).toEqual({
        at: expect.any(Number),
        sid: SID,
    });
});

// FRM-643: a member's asks reach dima through its coordinator; the subcard only shows them
test("unfolded, a subcard draws the member's asks as a view: line and pick, no tick, replay, sound or steer", async ($, on) => {
    const w = world(on, { files: linked() });
    published(w, CODIE, [
        {
            ...ASK,
            area: 'mods',
            areaEmoji: '🧩',
            from: { line: '🐦‍⬛ crow', who: 'crow' },
            why: 'it rang twice',
        },
    ]);
    await start($);
    const ui = await board($);
    await ui.press({ key: 'fold:lane:l1:codie' });
    const text = (await subText(ui, 'codie')) ?? '';
    expect(text).toMatch(
        /o3 🧩 mods: cut the second probe\?.*➡️ cut it.*🐦‍⬛ crow · it rang twice/su,
    );
    expect([
        /tick|replay|🔊|steer/u.test(text),
        await ui.find({ key: 'lane:l1:codie:accepted:o3' }),
    ]).toEqual([false, undefined]);
});

async function memberWithAsk($: Engine, on: On, kind?: 'bg') {
    const w = world(on, { kind, name: '☕️ 🔧 codie' });
    await start($);
    await $.tool.call({
        asks: [
            {
                area: 'mods',
                pick: 'cut it',
                text: 'cut the second probe?',
                why: 'a test ask',
            },
        ],
        op: 'add',
        tool: TOOL,
    } as never);
    await endTurn($);
    return w;
}

for (const kind of [undefined, 'bg'] as const)
    test(`a ${kind ?? 'foreground'} member publishes its open asks whole, with ids, for the glide card`, async ($, on) => {
        const w = await memberWithAsk($, on, kind);
        expect(
            (w.store.get(`asks:${SID}`) as { items?: unknown[] })?.items,
        ).toEqual([
            {
                area: 'mods',
                id: 'o1',
                pick: 'cut it',
                text: 'cut the second probe?',
                why: 'a test ask',
            },
        ]);
    });

test('an idle member with a herdr press wakes once, after dima prompts anywhere', async ($, on) => {
    const w = await memberWithAsk($, on);
    const before = w.texts.length;
    w.files[`/home/.claude/shelf/orbit-ticks/${SID}.jsonl`] = `${JSON.stringify(
        {
            at: w.clock.now(),
            id: 'o1',
            steer: 'later',
            verdict: 'replay',
        },
    )}\n`;
    await w.clock.advance(5_000);
    const quiet = w.texts.length;
    w.store.set('dima-at', w.clock.now() + 1);
    await w.clock.advance(5_000);
    await w.clock.advance(5_000);
    const woke = w.texts.slice(before);
    expect([quiet - before, woke.length, woke[0]]).toEqual([
        0,
        1,
        expect.stringMatching(/o1 ↩️ rejected.*cut the second probe.*«later»/su),
    ]);
});

test("dima's own prompt records when he last prompted, for the members to read", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    expect(w.store.get('dima-at')).toBe(w.clock.now());
});

test("the lanes stick to the board's bottom, on top of the phases (dima, 20:12)", async ($, on) => {
    world(on, { files: shelf(keptLane()) });
    await start($);
    await $.tool.call({ lines: ['now: x'], op: 'plan', tool: TOOL } as never);
    const keys = (await (await board($)).findAll({ type: 'Box' })).map(
        (b) => b.key ?? '',
    );
    const at = (key: string) => keys.indexOf(key);
    expect([
        at('phases:gap') < at('lane:l1'),
        at('lane:l1') < at('phases'),
    ]).toEqual([true, true]);
});

/* an ask: its line, the pick on its own line, the buttons under it (dima, 20:23) */

test("an ask's buttons sit on the line under its pick, never beside it", async ($, on) => {
    world(on);
    await start($);
    await $.tool.call({
        asks: [
            {
                area: 'mods',
                pick: 'cut it',
                text: 'cut the second probe?',
                why: 'a test ask',
            },
        ],
        op: 'add',
        tool: TOOL,
    } as never);
    const row = (
        await (await board($)).find({ key: 'orbit:row:o1', type: 'Box' })
    )?.text;
    expect([row?.includes('tick'), row?.includes('cut it')]).toEqual([
        true,
        false,
    ]);
});
