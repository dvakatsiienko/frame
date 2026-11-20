import { type Engine, expect, test } from 'claude-code/testing';

import { closedMark } from '../hooks/board-kit.tsx';
import {
    HERDR_FILE,
    addLinked,
    assume,
    herdrPress,
    lines,
    mobile,
    press,
    savedSteer,
    stateOf,
    texts,
    tickLog,
} from './orbit-helpers.ts';
import {
    SID,
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

test('an ask the turn left unanswered gets its controls back when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await endTurn($);
    expect(await ui.find({ key: 'orbit:accepted:o1' })).toBeTruthy();
});

test('a resolved ask leaves orbit when the turn ends', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await say($, 'go');
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'as ticked' } });
    await endTurn($);
    await say($, 'next');
    await endTurn($);
    expect(await asksShown(ui)).toEqual(['o2']);
});

test('an ask resolved with a closing word shows dim with it for one more turn, then leaves', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await orbit($, {
        ids: ['o1', 'o2'],
        op: 'resolve',
        words: { o1: 'dropped: superseded by o58' },
    });
    expect(await texts(ui)).toContain('🗑️ o1: push FRM-1');
    await endTurn($);
    const after = [await asksShown(ui), await texts(ui)] as const;
    await say($, 'next');
    await endTurn($);
    expect([
        after[0],
        /dropped: superseded by o58/.test(after[1]),
        await asksShown(ui),
    ]).toEqual([['o1'], true, []]);
});

test('a remote mark landing while dima types a steer leaves his typed steer in its box', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    herdrPress(w, 'o1', { at: w.clock.now(), verdict: 'tick' });
    await w.clock.advance(5_000);
    expect(savedSteer(w.store)).toBe('a heron');
});

test("a card steer lands over the member's own unless it typed into that box a moment ago", async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await board($);
    await add($, ['name a bird', 'pelican']);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    herdrPress(w, 'o1', {
        at: w.clock.now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await say($, 'go');
    expect(savedSteer(w.store)).toBe('a heron');
});

test('a steer typed on another board replaces the one the ask already holds', async ($, on) => {
    const w = world(on);
    await start($);
    await add($, ['name a bird', 'pelican']);
    const ui = await board($);
    await ui.input({ key: 'orbit:steer:o1', kind: 'change', text: 'a heron' });
    await w.clock.advance(5_000);
    await ui.press({ key: 'fold:orbit' });
    await ui.press({ key: 'fold:orbit' });
    herdrPress(w, 'o1', {
        at: w.clock.now(),
        steer: 'a swan',
        verdict: 'tick',
    });
    await w.clock.advance(5_000);
    expect(savedSteer(w.store)).toBe('a swan');
});

/* the orbit note speaks only on a change (FRM-640): the rules sit in the tool's own text, so no sentence rides every prompt */

test("orbit's open asks reach the shared store the board counts from", async ($, on) => {
    const w = world(on);
    await start($);
    await say($, 'go');
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve' });
    expect((w.store.get(`asks:${SID}`) as { asks: string[] }).asks).toEqual([
        'trash the probe',
    ]);
});

test("orbit's asks survive a reload", async ($, on) => {
    const w = world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    // a reload: the engine keeps $.state, and session.start runs again in a fresh module
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    await say($, 'hi');
    expect((w.contexts.at(-1) ?? []).join('\n')).toContain('(o3)');
});

test("a turn that ends before a reloaded module's start keeps orbit", async ($, on) => {
    world(on);
    const kept = {
        asks: [{ id: 'o3', pick: 'yes', text: 'kept across a reload' }],
        next: 4,
        turns: 2,
    };
    const state: Record<string, unknown> = { orbit: kept };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    // the reload lands at the turn's end: turn.complete reaches the fresh module before its session.start
    await endTurn($);
    expect(
        (state.orbit as { asks: { id: string }[] }).asks.map((a) => a.id),
    ).toEqual(['o3']);
});

test("a follow drops the ask's tick record: his word answered the old question (S3)", async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'yes',
        text: 'push `backup`',
    });
    expect(writes.at(-1)).toEqual([]);
});

test('an unmarked assumption leaves after three turns', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 3; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).toBe(
        undefined,
    );
});

test('an assumption still shows two turns on', async ($, on) => {
    world(on);
    await start($);
    const ui = await board($);
    await say($, 'go');
    await assume($, 'kept the old port');
    for (let i = 0; i < 2; i++) {
        await endTurn($);
        await say($, 'more');
    }
    expect(await ui.find({ key: 'orbit:assumption:a1', type: 'Box' })).not.toBe(
        undefined,
    );
});

test('the link rides the ask a glide card draws from the store', async ($, on) => {
    const w = world(on);
    await start($);
    await addLinked($, 'https://github.com/x/y/pull/7');
    expect(
        (w.store.get('asks:o1o1o1o1-orbit') as { items: { link?: string }[] })
            .items[0]?.link,
    ).toBe('https://github.com/x/y/pull/7');
});

test('a store written by the old build loads untouched, its stale keys ignored', async ($, on) => {
    const w = world(on);
    const shown = { 'stash.chips': false };
    w.store.set('undo-window', true);
    w.store.set('undo-delay', 30);
    w.store.set('shown', shown);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect([
        (await ui.find({ key: 'orbit:accepted:o1' }))?.text,
        w.store.get('undo-window'),
        w.store.get('shown'),
    ]).toEqual(['✅ tick', true, shown]);
});

const turnContext = async ($: Engine) =>
    ((await $.tool.call({ command: 'ls', tool: 'Bash' })).context ?? []).join(
        '\n',
    );

test('a herdr tick joins the running turn once, labelled from herdr, with his steer', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await say($, 'run the long job');
    const at = w.clock.now();
    files[HERDR_FILE] = press({
        at,
        id: 'o1',
        steer: 'say "hi"\nthen go',
        verdict: 'tick',
    });
    const first = await turnContext($);
    const second = await turnContext($);
    expect([
        first.match(
            /o1 🛎️ accepted from herdr: push FRM-1.*his steer: «say "hi"\nthen go»/s,
        )?.length,
        second.includes('o1 🛎️'),
        w.store.get(`herdr-read:${SID}`),
    ]).toEqual([1, false, at]);
});

// the newest press wins, as at x-mod-guard (sixth sense round 1 on FRM-544: the first-wins rule locked out his ↩️ then 🛎)
test('a herdr replay after a desktop tick takes it back, its tick record with it', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        verdict: 'replay',
    });
    await say($, 'go on');
    expect([
        /o1 🛎️ accepted/.test(joined(w.contexts).join('\n')),
        (writes.at(-1) as unknown[] | undefined)?.length,
    ]).toEqual([false, 0]);
});

// clio's o49 at 19:30: x-herdr-deck prunes a press once read and the turn that takes the ask clears its mark, so a herdr
// 🛎 writes the tick record a seat-board 🛎 writes, which x-mod-guard honours for 2 h
test('a herdr tick writes the tick record a seat-board tick writes', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['✍️ sign FRM-1: a small ticket', 'sign it']);
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        text: '✍️ sign FRM-1: a small ticket',
        verdict: 'tick',
    });
    await say($, 'go on');
    const last = (writes.at(-1) ?? []) as { id: string; text: string }[];
    expect(last.map((t) => [t.id, t.text])).toEqual([
        ['o1', '✍️ sign FRM-1: a small ticket'],
    ]);
});

test('of two herdr presses on one ask read together, the newest wins', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] =
        press({ at, id: 'o1', verdict: 'replay' }) +
        press({ at: at + 1, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a herdr 🛎 after his ↩️ on the seat board ticks the ask', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    const ui = await board($);
    await add($, ['push FRM-1', 'yes']);
    await ui.press({ key: 'orbit:rejected:o1' });
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(/o1 🛎️ accepted/);
});

test('a herdr tick on a resolved ask changes nothing', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, { ids: ['o1'], op: 'resolve', words: { o1: 'done' } });
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect([joined(w.contexts), keptMark(w.store, 'o1')]).toEqual([
        [],
        undefined,
    ]);
});

// the mark the stash kept for an ask, read from the store copy of its orbit
const keptMark = (store: Map<string, unknown>, id: string) =>
    (
        store.get(`kept:${SID}`) as
            | { orbit?: { asks?: { id: string; mark?: string }[] } }
            | undefined
    )?.orbit?.asks?.find((a) => a.id === id)?.mark;

test('a herdr press already taken never marks the round a follow puts under its id', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes'], ['push FRM-2', 'yes']);
    await say($, 'go');
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', verdict: 'tick' });
    await turnContext($);
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push FRM-1',
    });
    await endTurn($);
    // a newer press on another ask makes the file worth reading again; only the watermark keeps o1's old line out
    files[HERDR_FILE] += press({ at: at + 1, id: 'o2', verdict: 'tick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).toMatch(
        /^(?![\s\S]*- o1 )[\s\S]*- o2 🛎️/,
    );
});

test('a herdr press made on the old question never marks the new one a follow put under its id', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await orbit($, {
        id: 'o1',
        op: 'follow',
        pick: 'after ci',
        text: 'push FRM-1 once ci is green',
    });
    files[HERDR_FILE] = press({
        at: w.clock.now(),
        id: 'o1',
        text: 'push FRM-1',
        verdict: 'tick',
    });
    await say($, 'go on');
    expect(joined(w.contexts)).toEqual([]);
});

// FRM-552's decision 4 (no record from a herdr tick) is reversed: x-mod-guard already read the press file as his word
// since FRM-544 slice 1, behind the ticks-write fence, and the press is gone from the file after his next one
test('a herdr tick on an ask quoting a command writes the record x-mod-guard reads as his word', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    files[HERDR_FILE] = press({ at: w.clock.now(), id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    const last = (writes.at(-1) ?? []) as { targets: string[] }[];
    expect([joined(w.contexts).join('\n'), last.map((t) => t.targets)]).toEqual(
        [
            expect.stringMatching(/o1 🛎️ accepted/),
            [['git push --mirror origin']],
        ],
    );
});

test("a closed ask leads with its word's emoji: dropped 🗑️, started ▶️, anything else ✅", () => {
    expect(
        [
            'dropped: superseded by o58',
            'queued for the mods codie',
            'started',
            'landed',
            'applied, quote gate clean',
        ].map(closedMark),
    ).toEqual(['🗑️', '▶️', '▶️', '✅', '✅']);
});

// the old process quits as a reboot quits it: session.end, not a /clear
const quit = ($: Engine) =>
    $.session.end({ reason: 'other', sessionId: SID } as never);

test('open asks come back when the session is resumed in a new process', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes'], ['trash the probe', 'no']);
    await quit($);
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1', 'o2']);
});

// an app restart mid-turn: the new process's first hook is that turn's end, before its session.start (10-13 17:22,
// clio's o158 gone)
test('open asks come back when the new process ends a turn before its start', async ($, on) => {
    const w = world(on);
    stateOf(on);
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: [
                { id: 'o1', pick: 'yes', text: 'push FRM-1' },
                { id: 'o2', pick: 'no', text: 'trash the probe' },
            ],
            next: 3,
            turns: 4,
        },
    });
    await endTurn($);
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1', 'o2']);
});

test('a process that quits before its start leaves the kept asks for the next one', async ($, on) => {
    const w = world(on);
    stateOf(on);
    w.store.set(`kept:${SID}`, {
        at: w.clock.now(),
        orbit: {
            asks: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }],
            next: 2,
            turns: 4,
        },
    });
    await quit($);
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('a resumed orbit keeps counting its ids where it stopped', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await quit($);
    state.clear();
    await start($);
    const r = (await add($, ['one more', 'yes'])) as { result?: string };
    expect(r.result).toMatch(/^added o2 /);
});

test('a /clear starts the next conversation with an empty orbit', async ($, on) => {
    world(on);
    const state = stateOf(on);
    on('command.run', () => ({ text: '' }));
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual([]);
});

test('a kept state unsaved for a week is dropped at the next start', async ($, on) => {
    const w = world(on);
    const week = 7 * 24 * 60 * 60 * 1000;
    w.store.set('kept:gone-sid', { at: w.clock.now() - week, orbit: {} });
    w.store.set('kept:recent-sid', {
        at: w.clock.now() - week + 60_000,
        orbit: {},
    });
    await start($);
    expect([...w.store.keys()].filter((k) => k.startsWith('kept:'))).toEqual([
        'kept:recent-sid',
    ]);
});

test("a resumed orbit's open asks reach the store again, so every board counts them", async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await quit($);
    state.clear();
    await start($);
    expect(
        (w.store.get(`asks:${SID}`) as { asks?: string[] } | undefined)?.asks,
    ).toEqual(['push FRM-1']);
});

test('🌔 phases come back when the session is resumed in a new process', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await orbit($, { lines: ['now: a', 'next: b'], op: 'plan' });
    await quit($);
    state.clear();
    await start($);
    await say($, 'hi');
    expect(lines(w)).toMatch(/plan set/);
});

test('a folded card comes back folded when the session is resumed in a new process', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    state.set('folds', { 'orbit:assumed': true });
    await quit($);
    state.clear();
    await start($);
    expect(state.get('folds')).toEqual({ 'orbit:assumed': true });
});

test('📱 mobile mode comes back on when the session is resumed in a new process', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    await mobile($);
    await quit($);
    state.clear();
    await start($);
    await say($, 'hi');
    expect(lines(w)).toMatch(/no board reaches dima/);
});

// a crash or a power cut ends the process with no session.end: what was saved before it comes back
test('asks saved before a crash come back, with no clean quit', async ($, on) => {
    world(on);
    const state = stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    state.clear();
    await start($);
    const ui = await board($);
    expect(await asksShown(ui)).toEqual(['o1']);
});

test('a fold made a poll before a crash comes back, with no clean quit', async ($, on) => {
    const w = world(on);
    const state = stateOf(on);
    await start($);
    state.set('folds', { 'orbit:assumed': true });
    await w.clock.advance(4_000);
    state.clear();
    await start($);
    expect(state.get('folds')).toEqual({ 'orbit:assumed': true });
});

test('a poll that finds nothing changed leaves the kept copy as it was', async ($, on) => {
    const w = world(on);
    stateOf(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const before = (w.store.get(`kept:${SID}`) as { at?: number } | undefined)
        ?.at;
    await w.clock.advance(8_000);
    expect(
        (w.store.get(`kept:${SID}`) as { at?: number } | undefined)?.at,
    ).toBe(before);
});

test('an orbit kept with caught pieces loads without them, and the board draws no 🐠', async ($, on) => {
    world(on);
    let kept: unknown = {
        asks: [{ id: 'o1', pick: 'yes', text: 'push FRM-1' }],
        caught: [{ at: 0, id: 'c2', kind: '💡', text: 'an old piece' }],
        next: 3,
        turns: 1,
    };
    on('state.get', (_$, e, next) =>
        e.key === 'orbit' ? { value: { value: kept, version: 1 } } : next(e),
    );
    on('state.set', (_$, e, next) => {
        if (e.key !== 'orbit') return next(e);
        kept = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    const ui = await board($);
    expect([
        'caught' in (kept as object),
        (await texts(ui)).includes('🐠'),
        await asksShown(ui),
    ]).toEqual([false, false, ['o1']]);
});

test('an ask that breaks the orbit card blanks the card alone, the board still draws', async ($, on) => {
    world(on);
    const state: Record<string, unknown> = {
        orbit: { asks: [], next: 2, turns: 1 },
    };
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    await start($);
    state.orbit = {
        asks: [{ id: 'o1', link: 5, pick: 'y', text: 'x' }],
        next: 2,
        turns: 1,
    };
    const ui = await board($);
    expect([
        (await ui.find({ key: 'broken:orbit', type: 'Box' }))?.text,
        (await ui.find({ text: /failed to draw/, type: 'Text' }))?.text,
    ]).toEqual(['⚠ orbit could not draw', undefined]);
});

/* FRM-492 round 3: a hot reload keeps $.state and starts a fresh module. the harness keeps one module per file, so a
   row forgets the module's boxes with a fold, lays back the $.state the old module left, and runs the reload's start */

test('✅ on twenty-five asks keeps every record', async ($, on) => {
    world(on);
    const writes = tickLog(on);
    await start($);
    const ui = await board($);
    for (let i = 0; i < 25; i++) await add($, [`push \`t${i}\``, 'yes']);
    await ui.press({ key: 'orbit:all' });
    expect((writes.at(-1) as unknown[]).length).toBe(25);
});

test('a press drops a record past its 2 h, and keeps a live one', async ($, on) => {
    const w = world(on);
    const writes = tickLog(on);
    const now = w.clock.now();
    const old = {
        at: now - 2 * 60 * 60 * 1000 - 1,
        id: 'o8',
        targets: [],
        text: 'old',
    };
    const live = { at: now - 1000, id: 'o9', targets: [], text: 'live' };
    on('state.get', (_$, e, next) =>
        e.key === 'ticks'
            ? { value: { value: [old, live], version: 1000 } }
            : next(e as never),
    );
    await start($);
    const ui = await board($);
    await add($, ['push `origin`', 'yes']);
    await ui.press({ key: 'orbit:accepted:o1' });
    expect((writes.at(-1) as { id: string }[]).map((t) => t.id)).toEqual([
        'o9',
        'o1',
    ]);
});

// the deck's tick is a toggle: his ↩️ there after a 🛎 a turn already took drops the record, as a seat-board ↩️ does,
// so the guard honours no tick he took back
test('a herdr ↩️ after a herdr tick a turn took drops its tick record', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['⚠️ push `git push --mirror origin` to the backup', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    await endTurn($);
    files[HERDR_FILE] += press({ at: at + 1, id: 'o1', verdict: 'replay' });
    await say($, 'next');
    const last = (writes.at(-1) ?? []) as { id: string }[];
    expect(last.map((t) => t.id)).toEqual([]);
});

// FRM-574 rider, PK-363:W934: his untick on x-herdr-deck takes back a tick the stash already read, and a tick after it
// marks the ask again
test('exit 12: a herdr untick after a read tick leaves the next turn no mark, and a tick after it marks again', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    const writes = tickLog(on);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] = press({ at, id: 'o1', steer: 'go', verdict: 'tick' });
    await say($, 'go on');
    await endTurn($);
    const ticked = joined(w.contexts).join('\n');
    w.contexts.length = 0;
    files[HERDR_FILE] += press({ at: at + 1, id: 'o1', verdict: 'untick' });
    await say($, 'go on');
    await endTurn($);
    const unticked = joined(w.contexts).join('\n');
    const record = (writes.at(-1) as unknown[] | undefined)?.length;
    w.contexts.length = 0;
    files[HERDR_FILE] += press({ at: at + 2, id: 'o1', verdict: 'tick' });
    await say($, 'go on');
    expect([
        /o1 🛎️ accepted/.test(ticked),
        /o1 🛎️/.test(unticked),
        record,
        /o1 🛎️ accepted/.test(joined(w.contexts).join('\n')),
    ]).toEqual([true, false, 0, true]);
});

test('of a herdr tick and his untick read together, the untick wins', async ($, on) => {
    const files: Record<string, string> = {};
    const w = world(on, files);
    await start($);
    await add($, ['push FRM-1', 'yes']);
    const at = w.clock.now();
    files[HERDR_FILE] =
        press({ at, id: 'o1', verdict: 'tick' }) +
        press({ at: at + 1, id: 'o1', verdict: 'untick' });
    await say($, 'go on');
    expect(joined(w.contexts).join('\n')).not.toMatch(/o1 🛎️/);
});
