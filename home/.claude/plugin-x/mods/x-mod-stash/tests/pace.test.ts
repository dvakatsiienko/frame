import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// the pace watch (FRM-500): a line to the session that keeps `pace:<id>`, only when the 5h window changes its rung

const SID = 'p4c3p4c3-clio';
const PID = 4242;
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = new Date(2026, 10, 3, 14, 0).getTime();
const METER = '/home/.claude/shelf/cc-usage-window.json';
const WATCH = { [`pace:${SID}`]: { since: NOW } };
const POLL = 5_000;

function world(on: On, initial: Record<string, unknown> = {}, now = NOW) {
    const clock = mock.clock(on, { now });
    const store = new Map<string, unknown>(Object.entries(initial));
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name: '🦉 clio',
            pid: PID,
            sessionId: SID,
        }),
    };
    const turns: string[] = [];
    const state = { isRefused: false };
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/tmp' }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.receive', (_$, e) => ({ text: e.text }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: `${PID}.json`,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\n`,
        },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind !== 'plugin') return { text: e.text };
        if (state.isRefused) return { drop: 'refused' };
        turns.push(e.text);
        return { text: e.text };
    });
    const meter = (used: number, left: number, age = 0, at?: number) => {
        const t = at ?? NOW;
        files[METER] = JSON.stringify({
            rate_limits: {
                five_hour: {
                    resets_at: Math.round((t + left) / 1000),
                    used_percentage: used,
                },
            },
            written_at: Math.round((t - age) / 1000),
        });
    };
    return { clock, files, meter, state, store, turns };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

const endTurn = ($: Engine) =>
    $.turn.complete({
        answer: 'ok',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });

// three hours left is a pace of 40
const LEFT = 3 * HOUR;
const paces = (w: ReturnType<typeof world>) =>
    w.turns.filter((t) => t.startsWith('🔋 pace watch'));
const rungs = (w: ReturnType<typeof world>) =>
    paces(w).map((t) => t.match(/: (.*?);/)?.[1]);

/* the crossing */

test('a +5 crossing sends one line until the rung changes', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const first = rungs(w);
    await w.clock.advance(5 * MIN);
    expect([first, rungs(w)]).toEqual([
        ['+5 over pace — park'],
        ['+5 over pace — park'],
    ]);
});

test('between the rungs the stored one stands: +6, +3, +6 sends one line', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    w.meter(43, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    w.meter(46, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['+5 over pace — park']);
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
        r.context?.filter((c) => c.startsWith('🔋 pace watch')).length,
        again.context?.filter((c) => c.startsWith('🔋 pace watch')) ?? [],
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
    expect([refused, rungs(w)]).toEqual([undefined, ['+5 over pace — park']]);
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
    expect([held, rungs(w)]).toEqual([0, ['+5 over pace — park']]);
});

/* the ladder */

test('+6, then −1, then +6 in one window reads park, resume, park', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(39, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(46, LEFT, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual([
        '+5 over pace — park',
        'back to ≤ 0 — resume',
        '+5 over pace — park',
    ]);
});

test('90 % used with more than 1 h left sends one park', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(91, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['90 % — park']);
});

test('≤ 1 h left sends one burn', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, 40 * MIN);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['≤ 1 h left — burn']);
});

test('92 % used, 50 min left, +8 over pace sends exactly one line, the burn', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(92, 50 * MIN);
    await start($);
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['≤ 1 h left — burn']);
});

test('70 % used sends one «no new chunk»', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(72, 90 * MIN);
    await start($);
    await w.clock.advance(5 * MIN);
    expect(rungs(w)).toEqual(['70–80 % — no new chunk']);
});

test('a park at 70–80 % used reads resume at ≤ 0, never «no new chunk» on the way', async ($, on) => {
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
    expect([between, rungs(w)]).toEqual([
        1,
        ['+5 over pace — park', 'back to ≤ 0 — resume'],
    ]);
});

test('a new window clears the stored rung, so its park is told again', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    w.meter(26, 4 * HOUR, 0, w.clock.now());
    await w.clock.advance(POLL);
    expect(rungs(w)).toEqual(['+5 over pace — park', '+5 over pace — park']);
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

test('a meter 40 min old still fires the resume once the clock carries pace back', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    await w.clock.advance(40 * MIN);
    expect(rungs(w)).toEqual(['+5 over pace — park', 'back to ≤ 0 — resume']);
});

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
    expect(rungs(w)).toEqual(['+5 over pace — park']);
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

/* the waker door */

const wakerOn = (w: ReturnType<typeof world>) =>
    (w.store.get('waker') as { on?: boolean } | undefined)?.on === true;

test("a shift's end restores the waker its start found", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect([during, wakerOn(w)]).toEqual([true, false]);
});

test('a waker found on stays on at the end', async ($, on) => {
    const w = world(on, { waker: { on: true } });
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(true);
});

test('start, start, end leaves a waker found off, off', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test("dima's change during the shift is kept at the end", async ($, on) => {
    const w = world(on, { waker: { on: true } });
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test('a second start turns ⏰ back on after dima switched it off', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    const off = wakerOn(w);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    expect([off, wakerOn(w)]).toEqual([false, true]);
});

test('the end restores the state the first start found, past a second start', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test('found on, off by dima, a second start: the end leaves ⏰ on', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    w.store.set('waker', { on: true });
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(true);
});

test("dima's off after a second start stays off", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    w.store.set('waker', { on: false });
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test("a second start during afk changes afk's kept copy, so afk's end keeps ⏰ on", async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('afk', { on: true, wakerBefore: false });
    w.store.set('waker', { on: false });
    w.store.set(`pace:${SID}`, { since: NOW + 1 });
    await w.clock.advance(POLL);
    expect(w.store.get('afk')).toEqual({ on: true, wakerBefore: true });
});

test('a start with no end expires when its window resets', async ($, on) => {
    const w = world(on);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    await w.clock.advance(21 * MIN);
    expect([during, w.store.get(`pace:${SID}`), wakerOn(w)]).toEqual([
        true,
        undefined,
        false,
    ]);
});

test("at the reset ⏰ stays on past the waker's own resume", async ($, on) => {
    const w = world(on);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    await w.clock.set(NOW + 20 * MIN + 6_000);
    expect(wakerOn(w)).toBe(true);
});

test('an old meter at the start never ends the shift it just began', async ($, on) => {
    const w = world(on);
    w.meter(30, -HOUR, 2 * HOUR);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(MIN);
    expect(w.store.get(`pace:${SID}`)).toBeDefined();
});

test('a start with no meter takes its expiry from a later poll', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.meter(30, 30 * MIN, 0, w.clock.now());
    await w.clock.advance(35 * MIN);
    expect(w.store.get(`pace:${SID}`)).toBeUndefined();
});

test('a shift ending during afk changes what afk off puts back', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('afk', { at: NOW, on: true, wakerBefore: true });
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(POLL);
    expect([
        wakerOn(w),
        (w.store.get('afk') as { wakerBefore?: boolean }).wakerBefore,
    ]).toEqual([true, false]);
});

test('the part switched off mid-shift restores the waker', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    w.store.set('shown', { 'stash.pace-watch': false });
    await w.clock.advance(POLL);
    expect(wakerOn(w)).toBe(false);
});

test('a refused line leaves keep-hot armed', async ($, on) => {
    const w = world(on, { ...WATCH, [`hot:${SID}`]: { since: NOW } });
    w.meter(46, LEFT);
    w.state.isRefused = true;
    await start($);
    await w.clock.advance(POLL);
    w.state.isRefused = false;
    w.store.delete(`pace:${SID}`);
    await w.clock.advance(51 * 60_000);
    expect(w.turns.some((t) => t.includes('keep-hot'))).toBe(true);
});

const settings = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 80,
            isFocused: false,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: '🎛️ settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'desktop',
    } as never);

test('the 🎛️ row flips this session’s key', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    await ui.press({ key: 'knob:pace-watch' });
    const onAfter = w.store.get(`pace:${SID}`) !== undefined;
    await ui.press({ key: 'knob:pace-watch' });
    expect([onAfter, w.store.get(`pace:${SID}`)]).toEqual([true, undefined]);
});

test('the part off draws no row', async ($, on) => {
    const w = world(on, { shown: { 'stash.pace-watch': false } });
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    expect(
        await ui.find({ key: 'knob:pace-watch', type: 'Button' }),
    ).toBeUndefined();
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
        w.store.get(`quiet-log:${day}`) ?? [],
    ]).toEqual([['+5 over pace — park'], [], []]);
});

/* the want */

// the 11-03 shift, window 14:00–19:00, capped at 18:03; get_usage's readings (retro 2026-11-03), straight lines between
// them, since nothing read the meter before 14:59
const SHIFT = new Date(2026, 10, 3, 14, 0).getTime();
const READINGS = [
    [0, 0],
    [59, 33],
    [95, 55],
    [129, 78],
] as const;
const usedAt = (m: number) => {
    const i = READINGS.findIndex(([at]) => at >= m);
    const [a, ua] = READINGS[Math.max(0, i - 1)] ?? [0, 0];
    const [b, ub] = READINGS[i] ?? [m, 0];
    return Math.round(b === a ? ub : ua + ((ub - ua) * (m - a)) / (b - a));
};

test(
    'the 11-03 shift replayed: one park at 14:29, 214 min ahead of the 18:03 cap, no turn after it',
    { timeoutMs: 60_000 },
    async ($, on) => {
        const w = world(on, WATCH, SHIFT);
        await start($);
        const seen: number[] = [];
        for (let m = 1; m <= 129; m++) {
            const now = SHIFT + m * MIN;
            w.meter(usedAt(m), 5 * HOUR - m * MIN, 0, now);
            const was = w.turns.length;
            await w.clock.set(now);
            await w.clock.advance(POLL);
            if (w.turns.length > was) {
                seen.push(m);
                await endTurn($);
            }
        }
        expect([rungs(w), seen, 243 - (seen[0] ?? 0)]).toEqual([
            ['+5 over pace — park'],
            [29],
            214,
        ]);
    },
);
