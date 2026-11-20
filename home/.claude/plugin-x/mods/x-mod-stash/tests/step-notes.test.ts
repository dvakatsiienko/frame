import { type Engine, expect, test } from 'claude-code/testing';

import { partOff } from './orbit-helpers.ts';
import {
    add,
    asksShown,
    board,
    endTurn,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test("a peer's prompt carries no mark, but its turn takes the tick at its next tool call", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    await $.prompt.submit({
        origin: { kind: 'peer-send-message' } as never,
        text: 'status?',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect([joined(w.contexts), (r.context ?? []).join('\n')]).toEqual([
        [],
        expect.stringMatching(/o1 🛎️ accepted/),
    ]);
});

test('a keep-hot ping turn never takes a tick', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await $.prompt.submit({
        origin: { kind: 'plugin' } as never,
        text: 'x-mod-stash keep-hot ping: answer with one character, nothing else.',
        wait: false,
    });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a ping turn a reload kept in state still takes no tick', async ($, on) => {
    world(on);
    // a fresh module after a mid-turn reload: its own flag is the default, the ping turn lives on in $.state
    let keptTurn: unknown;
    on('state.get', (_$, e, next) =>
        e.key === 'turn' && keptTurn
            ? { value: { value: keptTurn, version: 1 } }
            : next(e),
    );
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    keptTurn = { afk: false, isBusy: true, isPinged: true, isUserTurn: false };
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/accepted/);
});

test('a tick while the turn runs reaches that turn, and its resolve takes it out at turn end', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    const r = await $.tool.call({ command: 'sleep 20', tool: 'Bash' });
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'as ticked' } });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect([(r.context ?? []).join('\n'), await asksShown(ui)]).toEqual([
        expect.stringMatching(
            /o1 🛎️ accepted: name a bird \(your pick: pelican\)/,
        ),
        [],
    ]);
});

const tools = async ($: Engine, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++)
        out.push(
            (
                (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ??
                []
            ).join('\n'),
        );
    return out;
};

const edits = async ($: Engine, n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++)
        out.push(
            (
                (
                    await $.tool.call({
                        file_path: '/tmp/a.ts',
                        new_string: 'b',
                        old_string: 'a',
                        tool: 'Edit',
                    } as never)
                ).context ?? []
            ).join('\n'),
        );
    return out;
};

test('the third tool call of a working turn with no phases set carries the nudge, once', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    const seen = await edits($, 4);
    expect(seen.map((c) => /no phases yet/.test(c))).toEqual([
        false,
        false,
        true,
        false,
    ]);
});

test('a q&a turn of reads gets no phases nudge', async ($, on) => {
    world(on);
    await start($);
    await say($, 'why does it wrap?');
    const seen = await tools($, 5);
    expect(seen.some((c) => /phases/.test(c))).toBe(false);
});

test('a commit through bash makes the turn a working one', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await $.tool.call({ command: 'x lane commit m.txt -- a.ts', tool: 'Bash' });
    const seen = await tools($, 2);
    expect(seen.at(-1)).toMatch(/no phases yet/);
});

test('a turn that set its phases gets no nudge', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    const seen = await tools($, 3);
    expect(seen.some((c) => /phases/.test(c))).toBe(false);
});

test('phases set in the last 2 turns hold: working turns stay quiet till the third', async ($, on) => {
    world(on);
    await start($);
    await say($, 'go');
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await endTurn($);
    const nudged: boolean[] = [];
    for (let i = 0; i < 3; i++) {
        await say($, 'go on');
        nudged.push(
            (await edits($, 3)).some((c) =>
                /phases not set for 3 turns/.test(c),
            ),
        );
        await endTurn($);
    }
    expect(nudged).toEqual([false, false, true]);
});

test('a tick taken back by a second press never reaches the turn', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toMatch(/o1 🛎️ accepted/);
});

test('a running turn takes a tick at its next tool call', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a reorder joins the running turn at once, the new order listed', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:0:down' });
    const first =
        (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? [];
    const again =
        (await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? [];
    expect([
        first.join('\n'),
        again.some((c) => /reordered your phases/.test(c)),
    ]).toEqual([
        expect.stringMatching(
            /reordered your phases[\s\S]*1\. next: b\n2\. now: a/,
        ),
        false,
    ]);
});

test('a press on a dead end arrow sends the turn no reorder', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:0:up' });
    await w.clock.advance(5_000);
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).some((c) => /reordered your phases/.test(c))).toBe(
        false,
    );
});

test('with 🌔 phases switched off, a working turn gets no nudge', async ($, on) => {
    const w = world(on);
    await start($);
    partOff(w, 'stash.phases');
    await say($, 'go');
    expect((await edits($, 4)).some((c) => /phases/.test(c))).toBe(false);
});

test("with 🌔 phases switched off, dima's phases tick joins no running turn", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await orbit($, { lines: ['now: a'], op: 'plan' });
    await say($, 'go');
    await ui.press({ key: 'plan:tick' });
    await w.clock.advance(5_000);
    partOff(w, 'stash.phases');
    const r = await $.tool.call({ command: 'ls', tool: 'Bash' });
    expect((r.context ?? []).join('\n')).not.toContain('🌔 phases: dima');
});

/* one no-board reply reminder: 📱 mobile mode and 🪐 orbit switched off both inject it (dima's o162) */
