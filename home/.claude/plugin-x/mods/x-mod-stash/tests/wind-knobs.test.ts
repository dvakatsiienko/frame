import type { On } from 'claude-code';

import { type Engine, expect, test } from './shared-boot.ts';
import {
    DIMAS_WORDS,
    NOW,
    SID,
    SLUG,
    band,
    compact,
    coordinator,
    endTurn,
    fake,
    notes,
    noticesOf,
    ready,
    say,
    start,
    turnAt,
    world,
} from './wind-world.ts';

// 🍃 second-wind-auto (W1909–W1918): on for every thread until pressed; 💨 afk or a shift turn a coordinator's pressed-off one on
const AUTO = `second-wind-auto:${SID}`;
const proposals = (lines: string[]) =>
    lines.filter((l) => l.includes('propose the wind to dima'));

// her 🍃 pressed off before the test's clock starts
const PRESSED_OFF = { at: NOW - 1, on: false };

test('🍃 off draws no notice and no ask', async ($, on) => {
    const w = world(on);
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [],
        false,
    ]);
});

test("the coordinator's thread with 🍃 off hears one line at 65 %, proposing the wind to dima", async ($, on) => {
    const w = coordinator(on);
    w.store.set(AUTO, PRESSED_OFF);
    await start($);
    for (const fill of [56, 70, 71]) await turnAt($, w, fill);
    expect([proposals(w.lines).length, w.store.has(`wind:${SID}`)]).toEqual([
        1,
        false,
    ]);
});

test("💨 afk on turns the coordinator's 🍃 on at read time, and afk off shows the stored value again", async ($, on) => {
    const w = coordinator(on);
    w.store.set(AUTO, PRESSED_OFF);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 1, on: false });
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect([noticesOf(w.lines).length, w.store.get(AUTO)]).toEqual([
        1,
        PRESSED_OFF,
    ]);
});

test("a shift turns the coordinator's 🍃 on, and its end turns it back", async ($, on) => {
    const w = coordinator(on);
    w.store.set(AUTO, PRESSED_OFF);
    w.store.set(`pace:${SID}`, { since: NOW });
    await start($);
    await turnAt($, w, 56);
    w.store.delete(`pace:${SID}`);
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test('a press during afk wins until the next afk on', async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    w.store.set(AUTO, { at: NOW + 1, on: false });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 2, on: true });
    await turnAt($, w, 40);
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test('a press on the band 🍃 flips only this session', async ($, on) => {
    const w = world(on);
    w.store.set('second-wind-auto:other-sid', { at: NOW, on: true });
    await start($);
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    expect([
        (w.store.get(AUTO) as { on?: boolean } | undefined)?.on,
        (w.store.get('second-wind-auto:other-sid') as { on?: boolean }).on,
    ]).toEqual([false, true]);
});

test("🍃 flipped off takes back the mod's pending ask, and keeps one dima pressed", async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    w.store.set(`wind:${SID}`, { at: NOW, by: 'mod', state: 'asked' });
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    const modGone = w.store.has(`wind:${SID}`);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await ui.press({ key: 'auto-wind' });
    await ui.press({ key: 'auto-wind' });
    expect([modGone, w.store.has(`wind:${SID}`)]).toEqual([false, true]);
});

test('🍃 flipped on past both lines still gives the notice first and the ask a turn later', async ($, on) => {
    const w = world(on);
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    await turnAt($, w, 70);
    w.store.set(AUTO, { at: NOW + 1, on: true });
    await turnAt($, w, 70);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 70);
    expect([first, w.store.has(`wind:${SID}`)]).toEqual([[1, false], true]);
});

test('💨 afk on past the line the coordinator was proposed at still gives her the notice, then the ask a turn later', async ($, on) => {
    const w = coordinator(on);
    w.store.set(AUTO, PRESSED_OFF);
    await start($);
    await turnAt($, w, 70);
    w.store.set('afk', { at: NOW + 1, on: true });
    await turnAt($, w, 70);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 70);
    expect([first, w.store.has(`wind:${SID}`)]).toEqual([[1, false], true]);
});

test("the coordinator's mod-asked wind note carries her checkpoint", async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    for (const fill of [56, 70, 70]) await turnAt($, w, fill);
    const ask = notes(w.lines).find((l) =>
        l.startsWith('🐦‍🔥 second wind: the mod asks'),
    );
    expect([
        ask?.includes('clio:checkpoint'),
        ask?.includes('tell the fleet'),
    ]).toEqual([true, true]);
});

test('a reload after the notice turn still asks at the next turn', async ($, on) => {
    const w = world(on);
    w.store.set(`fill:${SID}`, { noticed: 1, windAt: 65 });
    await start($);
    await turnAt($, w, 70);
    expect(w.store.has(`wind:${SID}`)).toBe(true);
});

test('🍃 switched off in 🎛️ gives the coordinator no propose line', async ($, on) => {
    const w = coordinator(on);
    w.store.set('shown', { 'stash.second-wind-auto': false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect(proposals(w.lines)).toEqual([]);
});

test("a shift, then afk on, then afk off keeps the coordinator's 🍃 on while the shift lasts", async ($, on) => {
    const w = coordinator(on);
    w.store.set(AUTO, PRESSED_OFF);
    w.store.set(`pace:${SID}`, { since: NOW });
    await start($);
    await turnAt($, w, 56);
    w.store.set('afk', { at: NOW + 1, on: true });
    await turnAt($, w, 40);
    w.store.set('afk', { at: NOW + 2, on: false });
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(2);
});

test('afk on, then a press off, then afk off keeps the press', async ($, on) => {
    const w = coordinator(on);
    w.store.set('afk', { at: NOW, on: true });
    await start($);
    await turnAt($, w, 56);
    w.store.set(AUTO, { at: NOW + 1, on: false });
    await turnAt($, w, 40);
    w.store.set('afk', { at: NOW + 2, on: false });
    await turnAt($, w, 56);
    expect(noticesOf(w.lines)).toHaveLength(1);
});

test("a session first read past the wind line gets the notice first and the ask a turn later, whatever another session's mark holds", async ($, on) => {
    const w = world(on);
    w.store.set('fill:other-sid', { asked: 1, noticed: 1, windAt: 65 });
    await start($);
    await turnAt($, w, 72);
    const first = [noticesOf(w.lines).length, w.store.has(`wind:${SID}`)];
    await turnAt($, w, 72);
    expect([
        first,
        w.store.has(`wind:${SID}`),
        w.store.get('fill:other-sid'),
    ]).toEqual([[1, false], true, { asked: 1, noticed: 1, windAt: 65 }]);
});

test('a session that quits keeps its 🍃 press for a resume', async ($, on) => {
    const w = world(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    w.store.set(AUTO, { at: NOW, on: false });
    await start($);
    await $.session.end({ reason: 'other', sessionId: SID } as never);
    expect(w.store.get(AUTO)).toEqual({ at: NOW, on: false });
});

// the 🎛️ knobs: a moved line reads at the next poll, and only moves crossings after it; past the wind line + 5 the
// coordinator hears one overrun line
function sendsOf(on: On) {
    const sent: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return sent;
}
const askedByMod = (w: ReturnType<typeof world>) =>
    notes(w.lines).some((l) => l.startsWith('🐦‍🔥 second wind: the mod asks'));

test('a wind line lowered in 🎛️ asks at the next poll', async ($, on) => {
    const w = world(on);
    w.store.set('wind-notice', 45);
    w.store.set('wind-at', 50);
    await start($);
    for (const fill of [46, 51]) await turnAt($, w, fill);
    expect(askedByMod(w)).toBe(true);
});

test('the wind lowered to 45 with a session at 60 % writes no ask and no overrun line', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    await turnAt($, w, 56);
    w.store.set('wind-notice', 40);
    w.store.set('wind-at', 45);
    for (const fill of [60, 60]) await turnAt($, w, fill);
    expect([w.store.has(`wind:${SID}`), sent]).toEqual([false, []]);
});

test('past the wind line + 5, the coordinator hears one overrun line, after the ask', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    const beforeAsk = sent.length;
    for (const fill of [71, 72]) await turnAt($, w, fill);
    expect([beforeAsk, sent]).toEqual([
        0,
        [
            {
                text: expect.stringMatching(/overrun.*71 %/),
                to: 'peer-1',
            },
        ],
    ]);
});

test("the overrun line never lands in the ask's own turn", async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    fake.fillNow = 76;
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    expect(sent).toEqual([]);
});

test("dima's take-back of the mod's ask sends no overrun line", async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    for (const fill of [66, 70]) await turnAt($, w, fill);
    w.store.delete(`wind:${SID}`);
    for (const fill of [71, 72]) await turnAt($, w, fill);
    expect(sent).toEqual([]);
});

test('a wind dima pressed and the session left standing past the line + 5 sends one overrun line', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    await start($);
    await turnAt($, w, 60);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    for (const fill of [66, 71, 72]) await turnAt($, w, fill);
    expect(sent.map((s) => s.text)).toEqual([
        expect.stringMatching(/overrun.*71 %/),
    ]);
});

test("dima's take-back of his own press holds until the fill drops: the mod writes no ask at the same fill", async ($, on) => {
    const w = world(on);
    await start($);
    await turnAt($, w, 60);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await turnAt($, w, 70);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'cancelled' });
    for (const fill of [70, 70, 70]) await turnAt($, w, fill);
    expect(
        notes(w.lines).filter((l) =>
            l.startsWith('🐦‍🔥 second wind: the mod asks'),
        ),
    ).toHaveLength(0);
});

test('🍃 flipped off takes back the ask the mod wrote, after its note went out', async ($, on) => {
    const w = world(on);
    await start($);
    for (const fill of [70, 70, 70]) await turnAt($, w, fill);
    const was = (w.store.get(`wind:${SID}`) as { state?: string } | undefined)
        ?.state;
    const ui = await band($);
    await ui.press({ key: 'auto-wind' });
    expect([was, w.store.has(`wind:${SID}`)]).toEqual(['writing', false]);
});

test('the overrun line follows the wind knob', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    w.store.set('wind-at', 60);
    await start($);
    for (const fill of [56, 61, 66]) await turnAt($, w, fill);
    expect(sent).toHaveLength(1);
});

test('with second wind switched off, no notice and no ask', async ($, on) => {
    const w = world(on);
    w.store.set('shown', { 'stash.second-wind': false });
    await start($);
    for (const fill of [70, 70]) await turnAt($, w, fill);
    expect([noticesOf(w.lines), w.store.has(`wind:${SID}`)]).toEqual([
        [],
        false,
    ]);
});

test('a session with no ingest command ingests its handoff through a plain prompt', async ($, on) => {
    const w = world(on);
    fake.hasIngestCommand = false;
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.commands.map((c) => c.split(' ')[0]),
        w.prompts.filter((p) => p.includes(`x handoff ingest ${SLUG} --for`))
            .length,
        w.store.has(`wind:${SID}`),
    ]).toEqual([['/compact'], 1, false]);
});

// the ingest refused: the toast reaches no one in a pane nobody watches
function refusedWind(on: On) {
    fake.ingestRefusal = 'no ingest here';
    const sent: { text: string; to: unknown }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    return sent;
}

test('a stopped wind tells the coordinator in one line, naming the handoff kept in the store', async ($, on) => {
    const w = world(on);
    const sent = refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(sent).toEqual([
        {
            text: expect.stringMatching(
                new RegExp(
                    `second wind stopped.*${SLUG} is still in the store`,
                ),
            ),
            to: 'peer-1',
        },
    ]);
});

test('a compact that fails while its ingest runs tells the coordinator the handoff was ingested, and stops nothing', async ($, on) => {
    const w = world(on);
    const sent = sendsOf(on);
    fake.compactRefusal = 'no compact here';
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([sent, w.store.has(`wind:${SID}`)]).toEqual([
        [
            {
                text: expect.stringMatching(
                    new RegExp(`compact failed.*${SLUG} was ingested`),
                ),
                to: 'peer-1',
            },
        ],
        false,
    ]);
});

test('a handoff gone from the store before the compact stops the wind: no compact, the coordinator hears it', async ($, on) => {
    const kept = [SLUG];
    const w = world(on, undefined, kept);
    const sent = sendsOf(on);
    await start($);
    await ready($, SLUG);
    kept.length = 0;
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        w.commands,
        sent.map((s) => s.text),
        (w.store.get(`wind:${SID}`) as { state?: string }).state,
    ]).toEqual([
        [],
        [expect.stringMatching(new RegExp(`stopped.*${SLUG} left the store`))],
        'stopped',
    ]);
    await say($);
    expect(
        notes(w.lines).filter((l) => l.includes('write the handoff again')),
    ).toHaveLength(1);
});

test('a stopped wind keeps the session from reading idle on the board', async ($, on) => {
    const w = world(on);
    refusedWind(on);
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect((w.store.get(`wind:${SID}`) as { state?: string }).state).toBe(
        'stopped',
    );
});

test('a stopped wind tells the session once, at its next turn, how to ingest by hand', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'stopped' });
    await start($);
    await say($);
    await say($, 'again');
    expect([
        notes(w.lines).map((l) => l.includes(`x handoff ingest ${SLUG} --for`)),
        w.store.has(`wind:${SID}`),
    ]).toEqual([[true], false]);
});

test('the op tells the session to end its turn with no waiting line', async ($, on) => {
    world(on);
    await start($);
    expect((await ready($, SLUG)).result).toMatch(
        /end your turn now, with no «waiting on» line/,
    );
});

test('a turn end that lands during the compact starts no second one', async ($, on) => {
    const w = world(on, undefined, undefined, async () => {
        await endTurn($);
        await w.clock.advance(2_000);
    });
    await start($);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

for (const state of ['asked', 'writing'] as const)
    test(`a threshold compact clears a wind left ${state}, so the board stops waiting`, async ($, on) => {
        const w = world(on);
        w.store.set(`wind:${SID}`, { at: NOW, state });
        await start($);
        await compact($, 'auto');
        expect(w.store.has(`wind:${SID}`)).toBe(false);
    });

test('a compact another hook skipped keeps the wind', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
    await start($);
    await $.session.compact({
        messages: [{ role: 'user', text: 'veto', toolUses: [] }],
        trigger: 'auto',
    } as never);
    expect(w.store.has(`wind:${SID}`)).toBe(true);
});

test('the compact a wind started clears its row, its ingest still queued', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a refreshing row past 30 min clears at the next turn end', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW - 31 * 60_000, state: 'refreshing' });
    await start($);
    await endTurn($);
    expect(w.store.has(`wind:${SID}`)).toBe(false);
});

test('a compact keeps a wind that is refreshing, and a precompute keeps a writing one', async ($, on) => {
    const w = world(on);
    w.store.set(`wind:${SID}`, { at: NOW, slug: SLUG, state: 'refreshing' });
    await start($);
    await compact($, 'plugin');
    const kept = w.store.has(`wind:${SID}`);
    w.store.set(`wind:${SID}`, { at: NOW, state: 'writing' });
    await compact($, 'precompute');
    expect([kept, w.store.has(`wind:${SID}`)]).toEqual([true, true]);
});

test('the op refuses with no pending field, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, null);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny?.includes('\n'), r.deny, w.commands]).toEqual([
        false,
        expect.stringContaining('pending is required'),
        [],
    ]);
});

test('the op refuses a pending that names work, saying what is pending, and nothing compacts', async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ready($, SLUG, 'two subagents still running');
    await endTurn($);
    await w.clock.advance(2_000);
    expect([r.deny, w.commands]).toEqual([
        expect.stringContaining('two subagents still running'),
        [],
    ]);
});

test('a wind held for named pending says the compact waits and the work does not', async ($, on) => {
    world(on);
    await start($);
    const r = await ready($, SLUG, 'a ci run');
    expect(r.deny).toMatch(
        /the compact waits, the work does not: do every step that run doesn't need/,
    );
});

for (const [who, isOwner] of [
    ['a codie', false],
    ['clio', true],
] as const)
    test(`${who}'s second wind note carries dima's words whole`, async ($, on) => {
        const w = world(
            on,
            isOwner ? '🦉 clio' : '☕️ 🔧 codie: mods',
            undefined,
            undefined,
            isOwner ? null : 'codie',
        );
        w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        await start($);
        await say($);
        expect(notes(w.lines).join('\n')).toContain(DIMAS_WORDS);
    });

for (const [what, call] of [
    ['an agent', { tool: 'Agent' }],
    ['a watch', { command: 'tail -f ci.log', tool: 'Monitor' }],
    [
        'a background session with its flag last',
        { command: "claude -p 'work' --bg", tool: 'Bash' },
    ],
] as const)
    test(`${what} started after pending: none makes the wind refuse, and the next prompt says why`, async ($, on) => {
        const w = world(on);
        await start($);
        await ready($, SLUG);
        await $.tool.call(call as never);
        await endTurn($);
        await w.clock.advance(2_000);
        await say($);
        expect([
            w.commands.filter((c) => c.startsWith('/compact')),
            notes(w.lines).join('\n').includes('second wind refused'),
            w.store.has(`wind:${SID}`),
        ]).toEqual([[], true, false]);
    });

test('a background command started after pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await $.tool.call({
        command: 'sleep 90',
        run_in_background: true,
        tool: 'Bash',
    } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

// the turn's own Stop lists what still runs; a watch is cc's `monitor` task, a background command its `shell` one
const stopWith = ($: Engine, type: string, description: string) =>
    $.classic.Stop({
        background_tasks: [{ description, id: 't1', status: 'running', type }],
        last_assistant_message: 'done.',
        session_id: SID,
        stop_hook_active: false,
    } as never);

test('a watch still running at the turn end holds the wind, naming it and its two doors', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await stopWith($, 'monitor', 'watch ci on #170');
    await endTurn($);
    await w.clock.advance(2_000);
    await say($);
    const said = notes(w.lines).join('\n');
    expect([
        w.commands.filter((c) => c.startsWith('/compact')),
        ['watch ci on #170', 'TaskStop', 'pending'].map((t) =>
            said.includes(t),
        ),
    ]).toEqual([[], [true, true, true]]);
});

test('a watch the last turn left running refuses the op at the call, naming it, and no wind is kept', async ($, on) => {
    const w = world(on);
    await start($);
    await stopWith($, 'monitor', 'watch ci on #170');
    const r = await ready($, SLUG);
    expect([r.deny, w.store.has(`wind:${SID}`)]).toEqual([
        'orbit second-wind: held by your watch «watch ci on #170»: stop it with TaskStop and call again',
        false,
    ]);
});

test('a watch stopped in the same turn lets the second call through, and the wind fires at its end', async ($, on) => {
    const w = world(on);
    await start($);
    await stopWith($, 'monitor', 'watch ci on #170');
    const first = await ready($, SLUG);
    await $.tool.call({ task_id: 't1', tool: 'TaskStop' } as never);
    const second = await ready($, SLUG);
    await $.classic.Stop({
        last_assistant_message: 'i take the wind.',
        session_id: SID,
        stop_hook_active: false,
    } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect([
        first.deny !== undefined,
        second.deny,
        w.commands.filter((c) => c.startsWith('/compact')).length,
    ]).toEqual([true, undefined, 1]);
});

test('a watch beside a 🔭 line refuses the op too', async ($, on) => {
    world(on);
    await start($);
    await $.classic.Stop({
        background_tasks: [
            {
                description: 'watch ci on #170',
                id: 't1',
                status: 'running',
                type: 'monitor',
            },
        ],
        last_assistant_message: 'done.\n\n🔭 waiting on the commit',
        session_id: SID,
        stop_hook_active: false,
    } as never);
    expect((await ready($, SLUG)).deny).toContain('watch ci on #170');
});

test('a TaskStop that failed leaves the turn end to refuse the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await stopWith($, 'monitor', 'watch ci on #170');
    await $.tool.call({ task_id: 't1', tool: 'TaskStop' } as never);
    await ready($, SLUG);
    await stopWith($, 'monitor', 'watch ci on #170');
    await endTurn($);
    expect(w.store.get(`wind:${SID}`)).toMatchObject({ state: 'refused' });
});

test('a watch of a session that ended holds no op of the resumed one', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set(`reply:${SID}`, {
        at: 1,
        ended: 2,
        watches: [{ id: 't1', name: 'watch ci' }],
    });
    expect((await ready($, SLUG)).deny).toBeUndefined();
});

test("a turn's end stamps its own time on the reply, with no Stop of its own too", async ($, on) => {
    const w = world(on);
    await start($);
    await stopWith($, 'shell', 'x');
    await w.clock.advance(5000);
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: true,
        reason: 'error',
        turnId: 't',
    } as never);
    const { at, turnAt } = w.store.get(`reply:${SID}`) as {
        at: number;
        turnAt: number;
    };
    expect(turnAt - at).toBe(5000);
});

test('another task stopped leaves the watch holding the op', async ($, on) => {
    world(on);
    await start($);
    await stopWith($, 'monitor', 'watch ci on #170');
    await $.tool.call({ task_id: 't2', tool: 'TaskStop' } as never);
    expect((await ready($, SLUG)).deny).toContain('watch ci on #170');
});

test('a refused wind keeps the handoff it named', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await stopWith($, 'monitor', 'watch ci on #170');
    await endTurn($);
    expect(w.store.get(`wind:${SID}`)).toMatchObject({
        blocked: 'a watch («watch ci on #170»)',
        slug: SLUG,
        state: 'refused',
    });
});

test('a background command still running at the turn end does not hold the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await stopWith($, 'shell', 'pnpm mods:test');
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

test('an agent started before pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await $.tool.call({ tool: 'Agent' } as never);
    await ready($, SLUG);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});

test('a foreground command started after pending: none does not block the wind', async ($, on) => {
    const w = world(on);
    await start($);
    await ready($, SLUG);
    await $.tool.call({ command: 'ls', tool: 'Bash' } as never);
    await endTurn($);
    await w.clock.advance(2_000);
    expect(w.commands.filter((c) => c.startsWith('/compact'))).toHaveLength(1);
});
