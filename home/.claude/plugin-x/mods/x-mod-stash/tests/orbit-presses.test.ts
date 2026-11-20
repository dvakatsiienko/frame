import { type Engine, expect, test } from 'claude-code/testing';

import {
    askOf,
    assume,
    herdrPress,
    lastContext,
    mobile,
    pressRace,
    tickLog,
} from './orbit-helpers.ts';
import {
    add,
    board,
    endTurn,
    joined,
    orbit,
    say,
    start,
    world,
} from './orbit-world.ts';

test('check all accepts every open ask', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['a one', 'x'], ['a two', 'y']);
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect(
        joined(w.contexts)
            .join('\n')
            .match(/o\d 🛎️/g),
    ).toEqual(['o1 🛎️', 'o2 🛎️']);
});

test('a tick the running turn never reads starts no turn of its own', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await say($, 'answer in one line');
    await ui.press({ key: 'orbit:accepted:o1' });
    await endTurn($);
    expect([w.appended, w.contexts.length]).toEqual([[], 1]);
});

test("a 🛎️ press writes the tick record: the ask's id, text, quoted targets and time", async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    const at = await w.clock.now();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([
        {
            at,
            id: 'o1',
            targets: ['git push --mirror origin'],
            text: '⚠️ push `git push --mirror origin` to the backup',
        },
    ]);
});

test('a press that lands on an ask his prompt already locked keeps the tick record (S1)', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await ui.press({ key: 'orbit:accepted:o1' }).catch(() => undefined);
    expect(writes.at(-1)).toEqual([expect.objectContaining({ id: 'o1' })]);
});

test('the tick record lands before the mark a running turn can take', async ($, on) => {
    world(on);
    const order: string[] = [];
    on('state.set', (_$, e, next) => {
        const isMarked =
            e.key === 'orbit' &&
            (e.value as { asks: { mark?: string }[] }).asks.some((a) => a.mark);
        if (e.key === 'ticks' || isMarked) order.push(e.key);
        return next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(order.slice(0, 2)).toEqual(['ticks', 'orbit']);
});

test('two presses at once leave no mark and no tick record', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    // the first press waits inside its record read, so the second lands while it is in flight
    let open = () => {};
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    open();
    await w.clock.advance(1);
    expect([
        writes.at(-1),
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
    ]).toEqual([[], '🛎️ tick']);
});

test('an untick clears the mark before it drops the record', async ($, on) => {
    world(on);
    const order: string[] = [];
    let isUnticking = false;
    on('state.set', (_$, e, next) => {
        if (isUnticking && (e.key === 'ticks' || e.key === 'orbit'))
            order.push(e.key);
        return next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    isUnticking = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(order.slice(0, 2)).toEqual(['orbit', 'ticks']);
});

// a throwing state mock is skipped by the harness (engine.md), so a kept value nothing can filter forces the failure
test('a tick record that cannot be written still marks the ask', async ($, on) => {
    const w = world(on);
    on('state.get', (_$, e, next) =>
        e.key === 'ticks'
            ? { value: { value: 5, version: 1 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a tool call landing during a press takes its mark whole, record and all', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:rejected:o1' });
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const call = $.tool.call({ command: 'ls', tool: 'Bash' });
    open();
    const r = await call;
    expect([
        (writes.at(-1) as { id: string }[]).map((t) => t.id),
        r.context?.some((c) => /o1 🛎️ accepted/.test(c)),
    ]).toEqual([['o1'], true]);
});

test('an untick whose record cannot be dropped says so', async ($, on) => {
    world(on);
    let isBroken = false;
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    on('state.get', (_$, e, next) =>
        isBroken && e.key === 'ticks'
            ? { value: { value: 5, version: 1000 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    isBroken = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(toasts).toEqual([expect.stringMatching(/^🛎️ untick not recorded/)]);
});

test('a second 🛎️ press takes the tick back', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([]);
});

test('a 🔁 replay press writes no tick', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    expect(writes.flat()).toEqual([]);
});

test('a 🛎️ press on a followed-up ask writes the tick record with the new text', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `git push origin --delete old`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, { ids: ['o1'], op: 'resolve' });
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: '⚠️ delete `git push origin --delete cloud/x-help-drift`',
    });
    const at = await w.clock.now();
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(writes.at(-1)).toEqual([
        {
            at,
            id: 'o1',
            targets: ['git push origin --delete cloud/x-help-drift'],
            text: '⚠️ delete `git push origin --delete cloud/x-help-drift`',
        },
    ]);
});

test('a 🛎️ press in orbit ends mobile mode', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'hi');
    expect(lastContext(w.contexts)).not.toContain('asks fence');
});

test('🛎️ clears an assumption', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await assume($, 'kept the old port');
    await ui.press({ key: 'orbit:right:a1' });
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
    );
});

// o88 wisp (dima, 20:39): a tick on an ask the running turn had just followed up was ignored until the turn ended
test('a tick on an ask just followed up mid-turn lands at once', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: 'push FRM-1 to main?',
    });
    await ui.press({ key: 'orbit:accepted:o1' });
    await w.clock.advance(5_000);
    expect((await ui.find({ key: 'orbit:accepted:o1' }))?.text).toBe('✅ tick');
});

/* a part switched off in 🎛️ settings is off for the model too (l13 r4) */

for (const [site, act] of [
    ["his prompt's lock", ($: Engine) => say($, 'next')],
    [
        "a tool call's lock",
        ($: Engine) => $.tool.call({ command: 'ls', tool: 'Bash' }),
    ],
] as const) {
    test(`${site}, reading from before his press, keeps the mark and the tick`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        await say($, 'run the long job');
        await ui.press({ key: 'orbit:accepted:o1' });
        await ui.find({ key: 'orbit:accepted:o1' });
        const stale = race.last;
        await ui.press({ key: 'orbit:accepted:o2' });
        race.frozen = stale;
        await act($);
        race.frozen = undefined;
        expect([
            askOf(race, 'o1')?.isLocked,
            askOf(race, 'o2')?.mark,
            race.ticks.map((t) => t.id),
        ]).toEqual([true, 'accepted', ['o1', 'o2']]);
    });

    test(`a press landing inside ${site}'s write stays marked`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        await say($, 'run the long job');
        await ui.press({ key: 'orbit:accepted:o1' });
        race.onLock = () => void ui.press({ key: 'orbit:accepted:o2' });
        await act($);
        await ui.find({ key: 'orbit:accepted:o2' });
        expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
            true,
            'accepted',
        ]);
    });
}

test("the idle wake's lock, reading from before his press, keeps the mark", async ($, on) => {
    const w = world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await endTurn($);
    herdrPress(w, 'o1', { at: w.clock.now(), verdict: 'tick' });
    await w.clock.advance(5_000);
    await ui.find({ key: 'orbit:accepted:o1' });
    const stale = race.last;
    await ui.press({ key: 'orbit:accepted:o2' });
    w.store.set('dima-at', w.clock.now() + 1);
    race.frozen = stale;
    await w.clock.advance(5_000);
    race.frozen = undefined;
    expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
        true,
        'accepted',
    ]);
});

test("a press reading from before a turn's lock leaves the lock", async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await say($, 'run the long job');
    await ui.press({ key: 'orbit:accepted:o1' });
    await ui.find({ key: 'orbit:accepted:o1' });
    const stale = race.last;
    await $.tool.call({ command: 'ls', tool: 'Bash' });
    race.frozen = stale;
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozen = undefined;
    expect([askOf(race, 'o1')?.isLocked, askOf(race, 'o2')?.mark]).toEqual([
        true,
        'accepted',
    ]);
});

test('a second press reading ticks from before the first keeps both records', async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['push `origin`', 'yes'],
        ['push `backup`', 'yes'],
        ['push `third`', 'yes'],
    );
    await ui.press({ key: 'orbit:accepted:o3' });
    await ui.press({ key: 'orbit:accepted:o1' });
    race.frozenTicks = race.lastTicks;
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozenTicks = undefined;
    expect(race.ticks.map((t) => t.id)).toEqual(['o3', 'o1', 'o2']);
});

/* FRM-510: ✅ is his word on what it marks, one record per ask; a ⚠️ ask takes its own 🛎️ */
test('✅ writes one tick record per ask it marks', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await ui.press({ key: 'orbit:all' });
    expect(
        (writes.at(-1) as { id: string; targets: string[] }[]).map((t) => [
            t.id,
            t.targets,
        ]),
    ).toEqual([
        ['o1', ['origin']],
        ['o2', ['backup']],
    ]);
});

test('✅ on an ask quoting nothing marks it, with a record that unlocks nothing', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect([
        (writes.at(-1) as { targets: string[] }[]).map((t) => t.targets),
        joined(w.contexts).join('\n'),
    ]).toEqual([[[]], expect.stringMatching(/o1 🛎️ accepted/)]);
});

test('✅ leaves a ⚠️ ask unmarked, with no record', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['⚠️ mirror: `git push --mirror origin`', 'yes'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    await say($, 'go');
    expect([
        (writes.at(-1) as { id: string }[]).map((t) => t.id),
        joined(w.contexts)
            .join('\n')
            .match(/o\d 🛎️/g),
    ]).toEqual([['o2'], ['o2 🛎️']]);
});

test('✅ leaves a bare merge ask for its own 🛎️', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add(
        $,
        ['merge https://github.com/o/r/pull/7 at abc1234', 'yes'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o2',
    ]);
});

test('✅ names every ask it left unticked', async ($, on) => {
    world(on);
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    await start($);
    const ui = await board($);
    await add(
        $,
        ['⚠️ merge bytes#104 at abc1234: the guard fix', 'merge it'],
        ['push `backup`', 'yes'],
    );
    await ui.press({ key: 'orbit:all' });
    expect([
        toasts,
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
    ]).toEqual([
        ['✅ left unticked: o1 ⚠️ merge bytes#104 at abc1234: the guard fix'],
        '🛎️ tick',
    ]);
});

test('✅ is not drawn while only ⚠️ asks are left to mark', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['⚠️ mirror: `git push --mirror origin`', 'yes']);
    expect(await ui.find({ key: 'orbit:all' })).toBeUndefined();
});

test("a session's first presses, the second reading no ticks yet, keep both records", async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    race.frozenTicks = { value: undefined, version: 0 };
    await ui.press({ key: 'orbit:accepted:o2' });
    race.frozenTicks = undefined;
    expect(race.ticks.map((t) => t.id)).toEqual(['o1', 'o2']);
});

test('a mark whose orbit write is denied leaves no record', async ($, on) => {
    world(on);
    let ticks: unknown;
    let isDenied = false;
    on('state.set', (_$, e, next) => {
        if (e.key === 'ticks') ticks = e.value;
        return isDenied && e.key === 'orbit' ? { deny: 'disk full' } : next(e);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    isDenied = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    expect(ticks).toEqual([]);
});

test('a press landing right after a follow on that ask keeps its mark and its record', async ($, on) => {
    world(on);
    const race = pressRace(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    race.onWrite = () => void ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, { id: 'o1', op: 'follow', pick: 'yes', text: 'push `new`' });
    await ui.find({ key: 'orbit:accepted:o1' });
    expect([
        askOf(race, 'o1')?.mark,
        race.ticks.map((t) => (t as { text?: string }).text),
    ]).toEqual(['accepted', ['push `new`']]);
});

test('✅ marks only the asks on the frame he pressed', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    // his 🛎️ waits inside its record read, so ✅ queues behind it and an ask lands before ✅ runs
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const late = add($, ['push `late`', 'yes']);
    await ui.press({ key: 'orbit:all' });
    open();
    await late;
    await w.clock.advance(1);
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o1',
        'o2',
    ]);
});

test('✅ leaves an ask followed up since the frame he pressed', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    let open = () => {};
    let isHeld = false;
    const gate = new Promise<void>((resolve) => {
        open = resolve;
    });
    on('state.get', async (_$, e, next) => {
        if (isHeld && e.key === 'ticks') await gate;
        return next(e as never);
    });
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
    isHeld = true;
    await ui.press({ key: 'orbit:accepted:o1' });
    const follow = orbit($, {
        id: 'o2',
        op: 'follow',
        pick: 'yes',
        text: 'push `late`',
    });
    await ui.press({ key: 'orbit:all' });
    open();
    await follow;
    await w.clock.advance(1);
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o1',
    ]);
});

for (const [site, act] of [
    ['a turn end', ($: Engine) => endTurn($)],
    ['an orbit op', ($: Engine) => add($, ['push `late`', 'yes'])],
    [
        'a follow dropping its tick',
        ($: Engine) =>
            orbit($, {
                id: 'o1',
                op: 'follow',
                pick: 'yes',
                text: 'push `new`',
            }),
    ],
] as const)
    test(`a press landing inside ${site}'s write stays marked, its record kept`, async ($, on) => {
        world(on);
        const race = pressRace(on);
        await start($);
        const ui = await board($);
        await add($, ['push `origin`', 'yes'], ['push `backup`', 'yes']);
        race.onWrite = () => void ui.press({ key: 'orbit:accepted:o2' });
        await act($);
        await ui.find({ key: 'orbit:accepted:o2' });
        expect([askOf(race, 'o2')?.mark, race.ticks.map((t) => t.id)]).toEqual([
            'accepted',
            ['o2'],
        ]);
    });

/* FRM-531: a thread switch on the desktop detaches the client and drops the board's view; the return attaches it, and
   the board draws fresh 2–20 ms later and again 76–131 ms after that (the desktop log, 2026-11-07: detach → attach → draw, a timer firing in between) */
