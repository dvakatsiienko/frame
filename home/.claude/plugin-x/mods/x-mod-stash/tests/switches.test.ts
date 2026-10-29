import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { PARTS } from '../hooks/register.tsx';

// a 🎛️ switch is the whole feature (mods/AGENTS.md § the rules): every registered part either runs its scenario here —
// switched on it reaches the model or spends a turn, switched off nothing does and its op is refused — or names why it
// never reaches a model; a part with neither turns this file red

const SID = 's1s1s1s1-switch';
const PID = 4545;
const TOOL = 'mcp__x-mod-stash__orbit';
const NOW = new Date(2026, 9, 12, 15, 0).getTime();
const MIN = 60_000;
const CAPPED = "You've hit your session limit · resets 11:40pm (Europe/Kiev)";

// cclio's session with the band and the board drawn: `lines` holds every model-only line a prompt or a tool result
// carried, and every turn the mod started itself
function world(on: On) {
    const lines: string[] = [];
    const clock = mock.clock(on, { now: NOW });
    const store = new Map<string, unknown>();
    const files: Record<string, string> = {
        [`/home/.claude/sessions/${PID}.json`]: JSON.stringify({
            name: '🦉 cclio',
            pid: PID,
        }),
    };
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
    on('env.get', () => ({ value: '/home' }));
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: `${PID}\nMon Oct 12 15:00:00 2026\n`,
        },
    }));
    on('fs.read', (_$, e) =>
        e.path in files
            ? { value: files[e.path] ?? '' }
            : { deny: 'no such file' },
    );
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.list', () => ({ value: [] }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('prompt.submit', (_$, e) => {
        lines.push(...(e.context ?? []));
        if (e.origin?.kind === 'plugin') lines.push(`turn: ${e.text}`);
        return { text: e.text };
    });
    on('session.append', (_$, e, next) => next(e));
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('tool.call', () => ({ result: {}, text: 'done' }));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    return { clock, lines, store };
}

type World = ReturnType<typeof world>;

const say = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });

const endTurn = (
    $: Engine,
    answer = '',
    reason: 'answer' | 'error' = 'answer',
) =>
    $.turn.complete({
        answer,
        durationMs: 1,
        isAborted: false,
        reason,
        turnId: 't',
    });

const orbit = ($: Engine, input: Record<string, unknown>) =>
    $.tool.call({ tool: TOOL, ...input } as never) as Promise<{
        deny?: string;
    }>;

// a working tool call whose model-only lines join the world's
async function edit($: Engine, w: World) {
    const r = await $.tool.call({
        file_path: '/tmp/a.ts',
        new_string: 'b',
        old_string: 'a',
        tool: 'Edit',
    } as never);
    w.lines.push(...(r.context ?? []));
}

async function mount($: Engine) {
    const band = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
    const board = await $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            isFocused: true,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: 'fleet board',
            view: {},
        },
        requestId: 'fleet-board',
        surface: 'desktop',
    });
    return { band, board };
}

type Ui = Awaited<ReturnType<typeof mount>>;

// arm: what the part needs while on; fire: what would reach the model; trace: a line it leaves; op: its tool op
type Scenario = {
    arm: ($: Engine, w: World, ui: Ui) => Promise<unknown>;
    fire: ($: Engine, w: World) => Promise<unknown>;
    trace: RegExp;
    op?: Record<string, unknown>;
};

const SCENARIOS: Record<string, Scenario> = {
    'stash.afk': {
        arm: (_$, _w, ui) => ui.band.press({ key: 'afk' }),
        // the away note at the prompt, then dima back mid-turn: the back note at the next tool call
        fire: async ($, w) => {
            await say($, 'go');
            w.store.set('afk', { at: NOW, on: false });
            await w.clock.advance(4_000);
            await edit($, w);
        },
        trace: /afk/,
    },
    'stash.assumed': {
        arm: async ($, _w, ui) => {
            await orbit($, { op: 'assume', texts: ['kept the old port'] });
            await ui.board.press({ key: 'orbit:wrong:a1' });
        },
        fire: ($) => say($, 'go'),
        op: { op: 'assume', texts: ['one more'] },
        trace: /wrong assumption/,
    },
    'stash.boot': {
        arm: ($) => $.skill.prompt({ skill: 'cclio:boot', text: '# boot' }),
        // start_session returns inside the open boot: its result carries the line
        fire: async ($, w) => {
            const r = await $.tool.call({
                tool: 'mcp__ccd_session__start_session',
            } as never);
            w.lines.push(...(r.context ?? []));
        },
        trace: /the boot continues/,
    },
    'stash.cost': {
        // the world is cclio's session, and dima asks her about cost
        arm: async () => undefined,
        fire: ($) => say($, 'what does a cache read cost on opus?'),
        trace: /a cost question/,
    },
    'stash.glide': {
        arm: async ($) => {
            await orbit($, {
                act: 'create',
                items: [{ text: 'a' }, { text: 'b' }],
                op: 'glide',
                title: 't',
            });
            for (let i = 0; i < 8; i++) await endTurn($);
        },
        fire: ($) => say($, 'go'),
        op: { act: 'create', items: [{ text: 'a' }], op: 'glide', title: 'u' },
        trace: /lane l1/,
    },
    'stash.hot': {
        arm: async ($, _w, ui) => {
            await ui.band.press({ key: 'hot' });
            await endTurn($);
        },
        fire: (_$, w) => w.clock.advance(50 * MIN),
        trace: /^turn: .*keep-hot/,
    },
    'stash.orbit': {
        arm: async ($, _w, ui) => {
            await orbit($, {
                asks: [
                    { hiddenNote: 'n', pick: 'yes', text: 'push it' },
                    { hiddenNote: 'n', pick: 'no', text: 'cut it' },
                ],
                op: 'add',
            });
            await ui.board.press({ key: 'orbit:accepted:o1' });
        },
        // a tick at the prompt, and one marked on another board mid-turn at the next tool call
        fire: async ($, w) => {
            await say($, 'go');
            w.store.set(`marks:${SID}:o2`, {
                at: NOW - 5_000,
                mark: 'accepted',
            });
            await edit($, w);
        },
        op: {
            asks: [{ hiddenNote: 'n', pick: 'yes', text: 'one more' }],
            op: 'add',
        },
        trace: /orbit holds|dima marked/,
    },
    'stash.phases': {
        arm: ($) => orbit($, { lines: ['now: a'], op: 'plan' }),
        fire: async ($, w) => {
            await say($, 'go');
            for (let i = 0; i < 3; i++) await edit($, w);
        },
        op: { lines: ['now: b'], op: 'plan' },
        trace: /phases|plan/,
    },
    'stash.second-wind': {
        // a board asked this session: the note rides its next prompt, and the op takes the handoff it wrote
        arm: async (_$, w) => {
            w.store.set(`wind:${SID}`, { at: NOW, state: 'asked' });
        },
        fire: ($) => say($, 'go'),
        op: { op: 'second-wind', slug: 'mods-l14-2' },
        trace: /second wind/,
    },
    'stash.waker': {
        arm: async ($, _w, ui) => {
            await ui.band.press({ key: 'waker' });
            await $.session.measure({
                changed: ['rateLimits'],
                context: { window: 200_000 },
                rateLimits: [
                    {
                        kind: 'five_hour',
                        percentUsed: 100,
                        resetsAt: new Date(NOW + 30 * MIN).toISOString(),
                    },
                ],
            });
            await endTurn($, CAPPED, 'error');
        },
        fire: (_$, w) => w.clock.advance(40 * MIN),
        trace: /^turn: .*waker/,
    },
};

// the parts that never reach a model: each says why, so a new part has to choose
const NO_MODEL: Record<string, string> = {
    'stash.5h': 'a band bar, drawn only',
    'stash.board': 'the band button that opens the board',
    'stash.boldwords':
        'its rewrite of the stored reply already reads its switch',
    'stash.bullets': 'its rewrite of the stored reply already reads its switch',
    'stash.chips': 'band chips, drawn only',
    'stash.circled': 'a redraw of the reply on screen, drawn only',
    'stash.ctx': 'a band bar, drawn only',
    'stash.digest': 'a band card for dima, drawn only',
    'stash.enhancer':
        'spends Haiku only on a press of its buttons, which leave the band',
    'stash.pace': 'a band number, drawn only',
    'stash.reset': 'a band timer, drawn only',
    'stash.rowmeta': 'board row text, drawn only',
    'stash.speak': 'board buttons, drawn only',
    'stash.tickets': 'a redraw of the reply on screen, drawn only',
    'stash.wait': 'the band line the last reply wrote, drawn only',
    'stash.waitaside': 'a redraw of the reply on screen, drawn only',
};

test('every 🎛️ part has a switch scenario or says why it never reaches a model', () => {
    expect(
        PARTS.map((p) => p.key).filter(
            (key) => !(key in SCENARIOS) && !(key in NO_MODEL),
        ),
    ).toEqual([]);
});

async function run($: Engine, on: On, key: string, isOn: boolean) {
    const s = SCENARIOS[key];
    if (!s) throw new Error(`no scenario for ${key}`);
    const w = world(on);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    const ui = await mount($);
    await s.arm($, w, ui);
    w.lines.length = 0;
    w.store.set('shown', { [key]: isOn });
    await s.fire($, w);
    const refused = s.op ? (await orbit($, s.op)).deny : undefined;
    return { refused, traces: w.lines.filter((l) => s.trace.test(l)) };
}

for (const key of Object.keys(SCENARIOS)) {
    test(`${key} on: it reaches the model and its op works`, async ($, on) => {
        const r = await run($, on, key, true);
        expect([r.traces.length > 0, r.refused]).toEqual([true, undefined]);
    });
    test(`${key} off: nothing reaches the model, no turn, its op refused in one line`, async ($, on) => {
        const r = await run($, on, key, false);
        expect([
            r.traces,
            SCENARIOS[key]?.op ? r.refused?.includes('🎛️ settings') : true,
            r.refused?.includes('\n') ?? false,
        ]).toEqual([[], true, false]);
    });
}

test('🪐 orbit off tells the model its asks go into the reply as a ➡️ line', async ($, on) => {
    const w = world(on);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await orbit($, { lines: ['now: a'], op: 'plan' });
    w.store.set('shown', { 'stash.orbit': false });
    await say($, 'go');
    const r = await orbit($, SCENARIOS['stash.orbit']?.op ?? {});
    expect([w.lines.some((l) => l.includes('➡️ line')), r.deny]).toEqual([
        true,
        expect.stringContaining('into the reply as one ➡️ line'),
    ]);
});

// an idle session with marks from another board wakes once dima prompts anywhere: a turn the switch must stop too
async function idleWake($: Engine, on: On, isOn: boolean) {
    const w = world(on);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await orbit($, {
        asks: [{ hiddenNote: 'n', pick: 'yes', text: 'push it' }],
        op: 'add',
    });
    w.store.set('shown', { 'stash.orbit': isOn });
    w.store.set(`marks:${SID}:o1`, { at: NOW, mark: 'accepted' });
    await w.clock.advance(5_000);
    w.store.set('dima-at', NOW + 6_000);
    await w.clock.advance(5_000);
    await w.clock.advance(5_000);
    return w.lines.filter((l) => l.startsWith('turn: ')).length;
}

test('🪐 orbit on: an idle session with marks wakes once dima prompts anywhere', async ($, on) => {
    expect(await idleWake($, on, true)).toBe(1);
});

test('🪐 orbit off: an idle session with marks never wakes', async ($, on) => {
    expect(await idleWake($, on, false)).toBe(0);
});
