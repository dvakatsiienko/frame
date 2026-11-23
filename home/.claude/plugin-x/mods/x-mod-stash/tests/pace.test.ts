import {
    HOUR,
    LEFT,
    MEMBER,
    METER,
    MIN,
    NOW,
    POLL,
    SID,
    WATCH,
    band,
    endTurn,
    paces,
    rungs,
    seat,
    settings,
    start,
    world,
} from './pace-world.ts';
import { logFile } from './quiet-helpers.ts';
import { expect, test } from './shared-boot.ts';
import { THREADS_FILE } from './threads.ts';

/* the crossing */

test(
    'a +5 crossing sends one line until the rung changes',
    { timeoutMs: 30_000 },
    async ($, on) => {
        const w = world(on, WATCH);
        w.meter(46, LEFT);
        await start($);
        await w.clock.advance(POLL);
        const first = rungs(w);
        await w.clock.advance(5 * MIN);
        expect([first, rungs(w)]).toEqual([['park'], ['park']]);
    },
);

test('between the rungs the stored one stands: +6, +3, +6 sends one line', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    w.meter(43, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    w.meter(46, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['park']);
});

test('a window on pace from the start sends no resume', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

test('a busy session takes the line at its next step', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'go',
        wait: false,
    });
    await w.clock.advance(POLL);
    const held = w.turns.length;
    const r = (await $.tool.call({ command: 'ls', tool: 'Bash' } as never)) as {
        context?: string[];
    };
    const again = (await $.tool.call({
        command: 'ls',
        tool: 'Bash',
    } as never)) as { context?: string[] };
    expect([
        held,
        r.context?.filter((c) => c.startsWith('🔋 ')).length,
        again.context?.filter((c) => c.startsWith('🔋 ')) ?? [],
        (w.store.get(`pace-rung:${SID}`) as { rung?: string }).rung,
    ]).toEqual([0, 1, [], 'park-over']);
});

test('a line the engine refused moves no rung, and the next poll sends it', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    w.state.isRefused = true;
    await start($);
    await w.clock.advance(POLL);
    const refused = w.store.get(`pace-rung:${SID}`);
    w.state.isRefused = false;
    await w.clock.advance(POLL);
    expect([refused, rungs(w)]).toEqual([undefined, ['park']]);
});

test('a second poller holding the claim sends nothing until it ages', async ($, on) => {
    const w = world(on, {
        ...WATCH,
        [`pace-claim:${SID}`]: { at: NOW, by: 'another process' },
    });
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const held = w.turns.length;
    await w.clock.advance(MIN);
    expect([held, rungs(w)]).toEqual([0, ['park']]);
});

/* the ladder */

test('90 % used with more than 1 h left sends one park', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(91, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['park']);
});

test('≤ 1 h left sends one burn', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, 40 * MIN);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['burn']);
});

test('92 % used, 50 min left, +8 over pace sends exactly one line, the burn', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(92, 50 * MIN);
    await start($);
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['burn']);
});

test(
    'a park at 70–80 % used reads resume under pace',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, WATCH);
        w.meter(72, 2 * HOUR);
        await start($);
        await w.clock.advance(POLL);
        await endTurn($);
        const reset = NOW + 2 * HOUR;
        const atOver1 = NOW + 32 * MIN;
        w.meter(72, reset - atOver1, 0, atOver1);
        await w.clock.set(atOver1);
        await w.clock.advance(POLL);
        const between = rungs(w).length;
        const atUnder = NOW + 45 * MIN;
        w.meter(72, reset - atUnder, 0, atUnder);
        await w.clock.set(atUnder);
        await w.clock.advance(POLL);
        await endTurn($);
        await w.clock.advance(POLL);
        expect([between, rungs(w)]).toEqual([1, ['park', 'resume']]);
    },
);

test('a new window clears the stored rung, so its park is told again', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(26, 4 * HOUR, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['park', 'park']);
});

test('a pre-reset meter against the fresh clock clears the rung with no line', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, 20 * MIN);
    w.store.set(`pace-rung:${SID}`, {
        resetsAt: NOW + 20 * MIN,
        rung: 'burn',
    });
    await start($);
    await w.clock.set(NOW + 21 * MIN);
    await w.clock.advance(POLL);
    expect([w.turns, w.store.get(`pace-rung:${SID}`)]).toEqual([[], undefined]);
});

/* a quiet meter */

test(
    'a meter 40 min old still fires the resume once the clock carries pace back',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, WATCH);
        w.meter(46, LEFT);
        await start($);
        await w.clock.advance(POLL);
        await endTurn($);
        await w.clock.advance(40 * MIN);
        expect(rungs(w)).toEqual(['park', 'resume']);
    },
);

test('a meter 40 min old never fires a park', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT, 40 * MIN);
    await start($);
    await w.clock.advance(POLL);
    expect(w.turns).toEqual([]);
});

test('the first 10 % of a fresh window sends no park', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(20, 4.8 * HOUR);
    await start($);
    await w.clock.advance(POLL);
    expect(w.turns).toEqual([]);
});

test('a stale park stays quiet at 78 % used, no flap through a lower rung', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(78, 3 * HOUR);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    await w.clock.advance(11 * MIN);
    expect(rungs(w)).toEqual(['park']);
});

test('a meter written before its window opened clears the rung with no line', async ($, on) => {
    const w = world(on, {
        ...WATCH,
        [`pace-rung:${SID}`]: { resetsAt: NOW + LEFT, rung: 'park-over' },
    });
    w.meter(10, LEFT, 2.5 * HOUR);
    await start($);
    await w.clock.advance(POLL);
    expect([w.turns, w.store.get(`pace-rung:${SID}`)]).toEqual([[], undefined]);
});

test('with no pace key no line ever', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

test('a pace key deleted before the crossing sends no line', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, LEFT);
    await start($);
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    w.meter(46, LEFT, 0, w.clock.now());
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

test('with no meter file no line and no throw', async ($, on) => {
    const w = world(on, WATCH);
    await start($);
    await w.clock.advance(POLL);
    expect(w.turns).toEqual([]);
});

/* the lines, as the ticket's decided words */

const WORDS = [
    [
        46,
        LEFT,
        '🔋 park: 46 % used, 6 % over pace, 3h 0m left — park at a pit stop, 🔥 on for all',
    ],
    [
        91,
        2 * HOUR,
        '🔋 park: 91 % used, 31 % over pace, 2h 0m left — park at a pit stop, 🔥 on for all',
    ],
    [
        91,
        50 * MIN,
        '🔋 burn: 91 % used, 8 % over pace, 0h 50m left — unspent usage dies at the reset; run to 97 %',
    ],
    [
        97,
        2 * HOUR,
        '🔋 stop: 97 % used, 37 % over pace, 2h 0m left — tell everyone to pause now; they continue from the same spot at the new window; the rest is for small asks',
    ],
] as const;
for (const [used, left, line] of WORDS)
    test(`the line reads: ${line.slice(0, 16)} at ${used} %`, async ($, on) => {
        const w = world(on, WATCH);
        w.meter(used, left);
        await start($);
        await w.clock.advance(POLL);
        expect(paces(w)).toEqual([line]);
    });

test('a decimal reading prints a whole gap', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(91.4, 2 * HOUR);
    await start($);
    await w.clock.advance(POLL);
    expect(paces(w)[0]).toContain('91.4 % used, 31 % over pace');
});

test('a kept 5h figure parks nobody on the file’s newer time', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(78, 3 * HOUR);
    const file = JSON.parse(w.files[METER] ?? '{}');
    file.rate_limits.five_hour.read_at = file.written_at - 11 * 60;
    w.files[METER] = JSON.stringify(file);
    await start($);
    await w.clock.advance(POLL);
    expect(w.turns).toEqual([]);
});

test('a resume reads under pace, no signed number', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(35, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(paces(w)[1]).toBe(
        '🔋 resume: 35 % used, 5 % under pace, 3h 0m left — resume the fleet',
    );
});

test('+6, +3, −3, −3, +3, +6, +4, +6 reads park, resume, park', async ($, on) => {
    const w = world(on, WATCH);
    await start($);
    for (const over of [6, 3, -3, -3, 3, 6, 4, 6]) {
        w.meter(40 + over, LEFT);
        await w.clock.advance(POLL);
        await endTurn($);
    }
    expect(rungs(w)).toEqual(['park', 'resume', 'park']);
});

test('at over 0 after a park no resume, at −2 one', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(40, LEFT);
    await w.clock.advance(POLL);
    const at0 = rungs(w).length;
    w.meter(38, LEFT);
    await w.clock.advance(POLL);
    expect([at0, rungs(w)]).toEqual([1, ['park', 'resume']]);
});

test('a window never parked hears no resume under pace', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(20, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

test('at or under pace past 70 % nothing is said', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(72, 80 * MIN);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

/* stop and the new window */

test('97 % sends one stop and aborts nothing', async ($, on) => {
    const w = world(on, WATCH);
    let aborts = 0;
    on('turn.abort', () => {
        aborts++;
        return { value: undefined };
    });
    w.meter(97, 2 * HOUR);
    await start($);
    await w.clock.advance(5 * MIN);
    expect([rungs(w), aborts]).toEqual([['stop'], 0]);
});

test('a frozen 97 % past its reset sends one new window, no burn, no repeat stop', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(97, 2 * MIN);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    const frozen = w.files[METER];
    await w.clock.advance(3 * MIN);
    w.files[METER] = frozen ?? '';
    await endTurn($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['stop', 'new window']);
});

test(
    'a stored park past the reset sends the new window, a hand park named',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, {
            ...WATCH,
            [`hot:${SID}`]: { off: true },
            'pace-burn': 0,
        });
        w.meter(91, 2 * HOUR);
        await start($);
        await w.clock.advance(POLL);
        await endTurn($);
        await w.clock.advance(2 * HOUR + POLL);
        expect(paces(w).at(-1)).toBe(
            '🔋 new window: reset done, resume the fleet; a hand park stays',
        );
    },
);

test(
    'a shift expiring puts back the off it found',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, {
            [`hot:${SID}`]: { off: true },
            [`pace:${SID}`]: { since: NOW, was: { off: true } },
        });
        w.meter(30, 20 * MIN);
        await start($);
        await w.clock.advance(POLL);
        await endTurn($);
        await w.clock.advance(21 * MIN);
        expect(w.store.get(`pace:${SID}`)).toEqual({ off: true });
    },
);

test('a stop a whole window old clears with no new window', async ($, on) => {
    const w = world(on, {
        [`hot:${SID}`]: { off: true },
        [`pace:${SID}`]: { off: true },
        [`pace-rung:${SID}`]: { resetsAt: NOW - 6 * HOUR, rung: 'stop' },
    });
    w.store.set(`pace:${SID}`, { on: true });
    await start($);
    await w.clock.advance(POLL);
    expect([w.turns, w.store.get(`pace-rung:${SID}`)]).toEqual([[], undefined]);
});

test(
    'a window never parked or stopped sends no new window',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, WATCH);
        w.meter(20, 30 * MIN);
        await start($);
        await w.clock.advance(POLL);
        await endTurn($);
        await w.clock.advance(40 * MIN);
        expect(paces(w).some((t) => t.startsWith('🔋 new window'))).toBe(false);
    },
);

/* the numbers */

test('a retuned number moves the rung at the next poll, no reload', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(43, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const before = w.turns.length;
    w.store.set('pace-over', 3);
    await w.clock.advance(POLL);
    expect([before, rungs(w)]).toEqual([0, ['park']]);
});

test('🎛️ shows a pace number', async ($, on) => {
    const w = world(on, { 'pace-over': 7 });
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    const row = await ui.find({ key: 'knob:pace-over', type: 'Input' });
    expect(row?.props.value ?? row?.props.defaultValue).toBe('7');
});

/* 🔥 on a seat */

for (const [name, isOn, role] of [
    ['🦉 clio', true],
    ['🦉 clio (side)', true, 'wing'],
    ['🐦‍⬛ crow', true],
    ['🎀 helga', true],
    ['⚡ 🔧 codie: mods lane 4 | FRM-500', true, 'codie'],
    ['🌗 🔎 sixth sense: x | #1', true, 'sixth-sense'],
    ['⚡ 🔧 codie: mods lane 4 (fork)', false],
    ['frame', false],
    ['clio-notes', false],
    ['⚡ 🔧 codie: pitchfork', true, 'codie'],
    ['☕️ 🔧 FRM-9 code: x', true, 'codie'],
] as [string, boolean, string?][])
    test(`${name} ${isOn ? 'starts' : 'stays off'} 🔥`, async ($, on) => {
        const w = world(on);
        seat(w, name, role);
        await start($);
        expect(w.store.get(`hot:${SID}`) !== undefined).toBe(isOn);
    });

// FRM-570: a store that does not parse reads as the last list that did, so a member keeps its chair through one bad read
test('a member keeps its 🔥 chair through a thread store that does not parse', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER, 'codie');
    await start($);
    w.store.delete(`hot:${SID}`);
    w.files[THREADS_FILE] = '{"threads":[{"sessionId"';
    await start($);
    expect(w.store.get(`hot:${SID}`)).toBeDefined();
});

test('a 🔥 click off is written and stays off across a restart', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await band($);
    await ui.press({ key: 'hot' });
    await start($);
    expect(w.store.get(`hot:${SID}`)).toEqual({ off: true });
});

test(
    'a cache dying before the reset gets one ping at 45 min left',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, { [`pace:${SID}`]: { off: true } });
        w.meter(50, 70 * MIN);
        await start($);
        await endTurn($);
        const pings = () =>
            w.turns.filter((t) => t.includes('keep-hot ping')).length;
        await w.clock.advance(24 * MIN);
        const before = pings();
        await w.clock.advance(2 * MIN);
        const at45 = pings();
        await endTurn($);
        await w.clock.advance(5 * MIN);
        expect([before, at45, pings()]).toEqual([0, 1, 1]);
    },
);

test(
    'a refused late ping goes out once and leaves keep-hot armed',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, { [`pace:${SID}`]: { off: true } });
        w.meter(50, 70 * MIN);
        await start($);
        await endTurn($);
        w.state.isRefused = true;
        const pings = () =>
            w.turns.filter((t) => t.includes('keep-hot ping')).length;
        await w.clock.advance(26 * MIN);
        w.state.isRefused = false;
        await w.clock.advance(POLL * 3);
        const noRetry = pings();
        await w.clock.advance(30 * MIN);
        expect([noRetry, pings()]).toEqual([0, 1]);
    },
);

test('a quit keeps a written 🔥 off for a resume of that id', async ($, on) => {
    const w = world(on);
    on('session.end', (_$, e) => ({ sessionId: e.sessionId }));
    await start($);
    const ui = await band($);
    await ui.press({ key: 'hot' });
    await $.session.end({
        reason: 'prompt_input_exit',
        resume: { id: SID },
        sessionId: SID,
    } as never);
    await start($);
    expect(w.store.get(`hot:${SID}`)).toEqual({ off: true });
});

test('a cache that outlives the reset gets no late ping', async ($, on) => {
    const w = world(on, { [`pace:${SID}`]: { off: true } });
    w.meter(50, 30 * MIN);
    await start($);
    await endTurn($);
    await w.clock.advance(5 * POLL);
    expect(w.turns).toEqual([]);
});

test('at 100 % no ping is sent', { timeoutMs: 60_000 }, async ($, on) => {
    const w = world(on, { [`pace:${SID}`]: { off: true } });
    w.meter(100, 65 * MIN);
    await start($);
    await endTurn($);
    await w.clock.advance(55 * MIN);
    expect(w.turns).toEqual([]);
});

/* the critic's three */

test('a queued send counts as sent: no second line while it waits', async ($, on) => {
    const w = world(on, WATCH);
    let release = () => {};
    w.state.gate = new Promise((r) => {
        release = r;
    });
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    const waiting = rungs(w);
    release();
    await w.clock.advance(5 * MIN);
    expect([waiting, rungs(w)]).toEqual([['park'], ['park']]);
});

test('an ended session’s key sends nothing: only its own session polls it', async ($, on) => {
    const w = world(on, { 'pace:ended': { since: NOW } });
    seat(w, MEMBER);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(w.turns).toEqual([]);
});

test('a store refusing every rung write costs one line, not a turn per poll', async ($, on) => {
    const w = world(on, WATCH);
    w.state.refusesRung = true;
    w.meter(46, LEFT);
    await start($);
    for (let i = 0; i < 12; i++) {
        await w.clock.advance(POLL);
        await endTurn($);
    }
    expect(rungs(w)).toEqual(['park']);
});

test('a refused rung write leaves the watch alive: the line once, then the resume', async ($, on) => {
    const w = world(on, WATCH);
    w.state.refusedKey = `pace-rung:${SID}`;
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(35, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['park', 'resume']);
});

test('a line on its way never rides its own turn as a second line', async ($, on) => {
    const w = world(on, WATCH);
    let release = () => {};
    w.state.gate = new Promise((r) => {
        release = r;
    });
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const r = (await $.tool.call({ command: 'ls', tool: 'Bash' } as never)) as {
        context?: string[];
    };
    release();
    expect((r.context ?? []).filter((c) => c.startsWith('🔋 '))).toEqual([]);
});

test('a door write redraws 🔋: the next press is the opposite of what it shows', async ($, on) => {
    const w = world(on);
    w.store.set('waker', { on: true });
    await start($);
    const ui = await band($);
    w.store.set(`pace:${SID}`, { off: true });
    await w.clock.advance(POLL);
    const chip = await ui.find({ key: 'pace-watch', type: 'Button' });
    await ui.press({ key: 'pace-watch' });
    expect([chip?.props.plain, w.store.get(`pace:${SID}`)]).toEqual([
        true,
        { on: true },
    ]);
});

test('a registry row named after the start arms at the first turn end', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    await start($);
    const before = w.store.get(`pace:${SID}`);
    seat(w, '🦉 clio');
    await endTurn($);
    expect([before, w.store.get(`pace:${SID}`)]).toEqual([
        undefined,
        { on: true },
    ]);
});

test('a dead target revived after 5 polls gets one line', async ($, on) => {
    const w = world(on, WATCH);
    w.state.isRefused = true;
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(5 * POLL);
    const dead = w.turns.length;
    w.state.isRefused = false;
    await w.clock.advance(2 * POLL);
    expect([dead, rungs(w)]).toEqual([0, ['park']]);
});

/* the poll a test asks for */

test('a poll asked slower than 4 s is kept: no line before it, one at it', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL - 1);
    const early = rungs(w);
    await w.clock.advance(1);
    expect([early, rungs(w)]).toEqual([[], ['park']]);
});

test('a poll asked faster than 4 s is refused: the live 4 s stands', async ($, on) => {
    const w = world(on, WATCH, NOW, 1_000);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(3_999);
    const early = rungs(w);
    await w.clock.advance(1);
    expect([early, rungs(w)]).toEqual([[], ['park']]);
});

test('a poll that is no number keeps the live 4 s', async ($, on) => {
    const w = world(on, WATCH, NOW, Number.NaN);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(3_999);
    const early = rungs(w);
    await w.clock.advance(1);
    expect([early, rungs(w)]).toEqual([[], ['park']]);
});

/* beside the quiet gate */

test('a pace line starts a turn with the quiet gate on: the mod sends it, never a held message', async ($, on) => {
    const w = world(on, { ...WATCH, 'quiet-comms': true });
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const day = new Date(NOW).toISOString().slice(0, 10);
    expect([
        rungs(w),
        w.store.get(`quiet-held:${SID}`) ?? [],
        w.files[logFile(day)],
    ]).toEqual([['park'], [], undefined]);
});

/* the want */

// the 11-03 shift, window 14:00–19:00, capped at 18:03; get_usage's readings (retro 2026-11-03), straight lines between
// them, since nothing read the meter before 14:59
const SHIFT = new Date(2026, 10, 3, 14, 0).getTime();
const READINGS = [
    [59, 33],
    [95, 55],
    [129, 78],
] as const;
const usedAt = (m: number) => {
    const i = READINGS.findIndex(([at]) => at >= m);
    const [a, ua] = READINGS[Math.max(0, i - 1)] ?? [59, 33];
    const [b, ub] = READINGS[i] ?? [m, 0];
    return Math.round(b === a ? ub : ua + ((ub - ua) * (m - a)) / (b - a));
};

test(
    'the 11-03 shift replayed: its readings open at +13, no crossing to name, one park at the first reading, 184 min ahead of the 18:03 cap, no turn after it',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, WATCH, SHIFT);
        await start($);
        const seen: number[] = [];
        const overAt = (m: number) => usedAt(m) - Math.round((m / 300) * 100);
        for (let m = 59; m <= 129; m++) {
            const now = SHIFT + m * MIN;
            w.meter(usedAt(m), 5 * HOUR - m * MIN, 0, now);
            const was = paces(w).length;
            await w.clock.set(now);
            await w.clock.advance(POLL);
            if (paces(w).length > was) seen.push(m);
            await endTurn($);
        }
        expect([overAt(59), rungs(w), seen, 243 - (seen[0] ?? 0)]).toEqual([
            13,
            ['park'],
            [59],
            184,
        ]);
    },
);
