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
    const state = {
        gate: undefined as Promise<void> | undefined,
        isRefused: false,
        refusedKey: undefined as string | undefined,
        refusesRung: false,
    };
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        if (state.refusesRung && e.key.startsWith('pace-rung:'))
            return { deny: 'refused' };
        if (e.key === state.refusedKey) {
            state.refusedKey = undefined;
            return { deny: 'refused' };
        }
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
    on('command.run', () => ({ text: '' }));
    on('ui.log', () => ({ value: undefined }));
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
            stdout: `${PID}\nMon Oct 12 15:00:00 2026\n`,
        },
    }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('prompt.submit', async (_$, e) => {
        if (e.origin?.kind !== 'plugin') return { text: e.text };
        if (state.isRefused) return { drop: 'refused' };
        turns.push(e.text);
        await state.gate;
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

const seat = (w: ReturnType<typeof world>, name: string) => {
    w.files[`/home/.claude/sessions/${PID}.json`] = JSON.stringify({
        name,
        pid: PID,
        sessionId: SID,
    });
};
const MEMBER = '⚡ 🔧 codie: mods lane 4';

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
    w.turns.filter((t) => t.startsWith('🔋 '));
const rungs = (w: ReturnType<typeof world>) =>
    paces(w).map((t) => t.match(/^🔋 (.*?):/)?.[1]);

/* the crossing */

test('a +5 crossing sends one line until the rung changes', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const first = rungs(w);
    await w.clock.advance(5 * MIN);
    expect([first, rungs(w)]).toEqual([['park'], ['park']]);
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

test('a park at 70–80 % used reads resume under pace', async ($, on) => {
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
});

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

test('a meter 40 min old still fires the resume once the clock carries pace back', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    await endTurn($);
    await w.clock.advance(40 * MIN);
    expect(rungs(w)).toEqual(['park', 'resume']);
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
        { on: true },
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
    expect(w.store.get(`pace:${SID}`)).toEqual({ on: true });
});

test('a member’s start with no end leaves no key when its window resets', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    w.meter(30, 20 * MIN);
    await start($);
    w.store.set(`pace:${SID}`, { since: NOW });
    await w.clock.advance(POLL);
    await w.clock.advance(21 * MIN);
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
    const onAfter = (w.store.get(`pace:${SID}`) as { off?: boolean }).off;
    await ui.press({ key: 'knob:pace-watch' });
    expect([onAfter, w.store.get(`pace:${SID}`)]).toEqual([true, { on: true }]);
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

/* 🔋 on the coordinator's seat */

const band = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 140,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    } as never);

test('a new 🦉 clio session starts on, with no ⏰, and hears the crossing', async ($, on) => {
    const w = world(on);
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(POLL);
    expect([
        w.store.get(`pace:${SID}`),
        rungs(w),
        w.store.get('waker'),
    ]).toEqual([{ on: true }, ['park'], undefined]);
});

test('with the part off a new 🦉 clio session writes no pace key', async ($, on) => {
    const w = world(on, { shown: { 'stash.pace-watch': false } });
    await start($);
    expect(w.store.get(`pace:${SID}`)).toBeUndefined();
});

test('the two 🔋 rows in the pane say which scope each flips', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await settings($);
    expect([
        (await ui.find({ key: 'part:stash.pace-watch', type: 'Button' }))?.text,
        (await ui.find({ key: 'knob:pace-watch', type: 'Button' }))?.text,
    ]).toEqual(['🔋 pace watch: all sessions', '🔋 pace watch: this session']);
});

test('click off, restart with the same id, cross +5: no line', async ($, on) => {
    const w = world(on);
    w.meter(30, LEFT);
    await start($);
    const ui = await band($);
    await ui.press({ key: 'pace-watch' });
    await start($);
    w.meter(46, LEFT);
    await w.clock.advance(5 * MIN);
    expect([w.store.get(`pace:${SID}`), w.turns]).toEqual([{ off: true }, []]);
});

test('🔋 sits between 🔥 and ⏰ and one click flips the key', async ($, on) => {
    const w = world(on);
    await start($);
    const ui = await band($);
    const words = async () =>
        (await ui.find({ key: 'tip:pace-watch', type: 'Box' }))?.text;
    const keys = (await ui.findAll({ type: 'Button' })).map((b) => b.key);
    const from = keys.indexOf('hot');
    const before = await words();
    await ui.press({ key: 'pace-watch' });
    expect([
        keys.slice(from, from + 3),
        before,
        w.store.get(`pace:${SID}`),
        await words(),
    ]).toEqual([
        ['hot', 'pace-watch', 'waker'],
        '🔋pace watch: this session',
        { off: true },
        '🔋pace watch: this session',
    ]);
});

test('any other seat draws no 🔋 and writes no key', async ($, on) => {
    const w = world(on);
    seat(w, MEMBER);
    await start($);
    const ui = await band($);
    expect([
        await ui.find({ key: 'pace-watch', type: 'Button' }),
        w.store.get(`pace:${SID}`),
    ]).toEqual([undefined, undefined]);
});

test('🔋 off during a shift ends the shift: ⏰ goes back', async ($, on) => {
    const w = world(on, WATCH);
    w.meter(30, LEFT);
    await start($);
    await w.clock.advance(POLL);
    const during = wakerOn(w);
    const ui = await band($);
    await ui.press({ key: 'pace-watch' });
    await w.clock.advance(POLL);
    expect([during, wakerOn(w)]).toEqual([true, false]);
});

test('the door’s off holds across a restart like a click', async ($, on) => {
    const w = world(on, { [`pace:${SID}`]: { off: true } });
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(5 * MIN);
    expect([w.store.get(`pace:${SID}`), w.turns]).toEqual([{ off: true }, []]);
});

test('/clear on the coordinator seat arms a key never written', async ($, on) => {
    const w = world(on);
    await start($);
    w.store.delete(`pace:${SID}`);
    await $.command.run({
        args: '',
        command: 'clear',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    expect(w.store.get(`pace:${SID}`)).toEqual({ on: true });
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

for (const [name, isOn] of [
    ['🦉 clio', true],
    ['🦉 clio (side)', true],
    ['🐦‍⬛ crow', true],
    ['🎀 helga', true],
    ['⚡ 🔧 codie: mods lane 4 | FRM-500', true],
    ['🌗 🔎 sixth sense: x | #1', true],
    ['⚡ 🔧 codie: mods lane 4 (fork)', false],
    ['frame', false],
    ['clio-notes', false],
    ['⚡ 🔧 codie: pitchfork', true],
    ['☕️ 🔧 FRM-9 code: x', true],
] as const)
    test(`${name} ${isOn ? 'starts' : 'stays off'} 🔥`, async ($, on) => {
        const w = world(on);
        seat(w, name);
        await start($);
        expect(w.store.get(`hot:${SID}`) !== undefined).toBe(isOn);
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

test('a dead target revived after 20 polls gets one line', async ($, on) => {
    const w = world(on, WATCH);
    w.state.isRefused = true;
    w.meter(46, LEFT);
    await start($);
    await w.clock.advance(20 * POLL);
    const dead = w.turns.length;
    w.state.isRefused = false;
    await w.clock.advance(5 * POLL);
    expect([dead, rungs(w)]).toEqual([0, ['park']]);
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
    ]).toEqual([['park'], [], []]);
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
