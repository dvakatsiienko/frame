import type { On, SessionContextBreakdown } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 10_000_000;
const HOUR = 60 * 60 * 1000;
const SID = 'm1m1m1m1-here';
const LOCAL = '/proj/.claude/settings.local.json';
const SHARED = '/proj/.claude/settings.json';
const USAGE = '/home/.claude/shelf/cc-usage-window.json';

// a session in /proj whose engine compacts at 70 % of a 1M window, the files in memory; `override` is the project's
// CLAUDE_AUTOCOMPACT_PCT_OVERRIDE as the merged settings carry it
function meters(on: On, files: Record<string, string> = {}, override?: string) {
    const store: Record<string, unknown> = {};
    const clock = mock.clock(on, { now: NOW });
    on('store.get', (_$, e) => ({ value: store[e.key] }));
    on('store.set', (_$, e) => {
        store[e.key] = e.value;
        return { value: undefined };
    });
    on('store.delete', (_$, e) => {
        delete store[e.key];
        return { value: undefined };
    });
    on('store.keys', () => ({ value: Object.keys(store) }));
    on('session.id', () => ({ value: SID }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('settings.read', () => ({
        value: override
            ? { env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: override } }
            : {},
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/proj' },
    }));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('session.compact', (_$, e) => ({ messages: e.messages }));
    on('session.usage', () => ({
        value: {
            context: {
                breakdown: {
                    autoCompactThreshold: 700_000,
                } as SessionContextBreakdown,
                window: 1_000_000,
            },
            rateLimits: [],
            startedAt: 0,
        },
    }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('fs.exists', (_$, e) => ({ value: e.path in files }));
    on('fs.read', (_$, e) => {
        const text = files[e.path];
        return text === undefined ? { deny: 'no such file' } : { value: text };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    return { clock, files, store };
}

const measure = (
    $: Engine,
    used: number,
    context: number,
    resetsInMs = 3 * HOUR,
) =>
    $.session.measure({
        changed: ['context', 'rateLimits'],
        context: {
            percent: context,
            tokens: context * 10_000,
            window: 1_000_000,
        },
        rateLimits: [
            {
                kind: 'five_hour',
                percentUsed: used,
                resetsAt: new Date(NOW + resetsInMs).toISOString(),
            },
        ],
    });

async function band($: Engine, maxRows = 12) {
    await $.session.start({
        cwd: '/proj',
        isInteractive: true,
        surface: 'desktop',
    });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking: false,
            maxRows,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface: 'desktop',
    });
}

// the 🎛️ pane, where the auto-compact point lives (FRM-391, dima's pick a)
const settingsPane = ($: Engine) =>
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
    });

// the Text whose words start a row's part, with its colour
async function part($: Engine, start: RegExp) {
    const ui = await band($);
    const t = (await ui.findAll({ type: 'Text' })).find((n) =>
        start.test(n.text ?? ''),
    );
    return t ? { color: t.props.color, text: t.text } : 'no text';
}

test('the 5h bar ends in its used %, and the head reads the gap and the time left', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const boxes = await ui.findAll({ type: 'Box' });
    const text = (key: string) => boxes.find((n) => n.key === key)?.text;
    expect([text('meter:5h'), text('meter:info')]).toEqual([
        expect.stringMatching(/39%$/),
        expect.stringMatching(/^🔋 \+1%.*⏳ 3h 0m/u),
    ]);
});

test('under a minute to the reset, ⏳ rounds up to 1m', async ($, on) => {
    meters(on);
    await measure($, 39, 35, 40_000);
    expect(await part($, /^⏳/u)).toMatchObject({ text: '⏳ 1m' });
});

test('once the reset has passed, ⏳ leaves the row until the next measure', async ($, on) => {
    meters(on);
    await measure($, 39, 35, -1000);
    expect(await part($, /^⏳/u)).toBe('no text');
});

test('a full desktop bar lights every cell through the ramp', async ($, on) => {
    meters(on);
    await measure($, 100, 0);
    const ui = await band($);
    const five = String((await ui.findAll({ type: 'Svg' }))[0]?.props.source);
    expect([five.includes('url(#ramp)'), five.includes('class="off"')]).toEqual(
        [true, false],
    );
});

test("the ctx bar's ramp reaches red at the compaction point", async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const ctx = String((await ui.findAll({ type: 'Svg' }))[1]?.props.source);
    const width = Number(ctx.match(/viewBox="0 0 ([\d.]+) /)?.[1]);
    const red = Number(ctx.match(/x2="([\d.]+)"/)?.[1]);
    expect(Math.round((red / width) * 100)).toBe(70);
});

// dima's wisp (10-28): the mark drawn as a 2px bar across both rows read as a stray bar; it is a hollow cell in the grid
for (const [bar, at] of [
    ['5h pace', 0],
    ['ctx compaction', 1],
] as const)
    test(`the ${bar} mark is a hollow cell in each row, never a thin bar`, async ($, on) => {
        meters(on);
        await measure($, 10, 35);
        const ui = await band($);
        const svg = String(
            (await ui.findAll({ type: 'Svg' }))[at]?.props.source,
        );
        const marks = [...svg.matchAll(/<rect class="mark"[^>]*>/g)].map(
            (m) => m[0],
        );
        expect([
            marks.length,
            marks.every(
                (r) => r.includes('width="4"') && r.includes('height="4"'),
            ),
        ]).toEqual([2, true]);
    });

test('an idle band takes the 5h reading another session wrote', async ($, on) => {
    const { clock, files } = meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    files['/home/.claude/shelf/cc-usage-window.json'] = JSON.stringify({
        rate_limits: {
            five_hour: {
                resets_at: (NOW + 3 * HOUR) / 1000,
                used_percentage: 52,
            },
        },
    });
    await clock.advance(4000);
    const five = (await ui.findAll({ type: 'Box' })).find(
        (n) => n.key === 'meter:5h',
    );
    expect(five?.text).toMatch(/52%$/);
});

test("the ctx row shows the fill and the engine's compaction point", async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    const input = await ui.find({ key: 'compact-at', type: 'Input' });
    expect([
        (await part($, /^35%$/)) !== 'no text',
        input?.props.value,
    ]).toEqual([true, '70']);
});

test("a repo top's compaction point lands in its shared settings.json, other keys kept", async ($, on) => {
    const { files } = meters(on, {
        [SHARED]: '{"permissions":{"allow":["Bash"]}}',
    });
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', text: '80' });
    expect([JSON.parse(files[SHARED] ?? '{}'), LOCAL in files]).toEqual([
        {
            env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '80' },
            permissions: { allow: ['Bash'] },
        },
        false,
    ]);
});

test("a subdir session's compaction point lands in its own settings.local.json, not the repo top's", async ($, on) => {
    const { files } = meters(on, {
        '/home/.claude/sessions/4649.json': '{"cwd":"/launch"}',
    });
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '4649\nFri Oct  9 09:39:32 2026\n',
        },
    }));
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', text: '90' });
    expect([
        JSON.parse(files['/launch/.claude/settings.local.json'] ?? '{}').env,
        LOCAL in files,
    ]).toEqual([{ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '90' }, false]);
});

test('a compaction point outside 10–99 is refused and the file stays untouched', async ($, on) => {
    const { files } = meters(on, { [LOCAL]: '{}' });
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', text: '5' });
    expect([
        files[LOCAL],
        (await part($, /^compaction point must/)) !== 'no text',
    ]).toEqual(['{}', true]);
});

test('a small overrun of the pace already reads 🪫 in red', async ($, on) => {
    meters(on);
    await measure($, 45, 35);
    expect(await part($, /^🪫/u)).toEqual({
        color: '#e5484d',
        text: '🪫 -5%',
    });
});

test('the pace chip prints bold', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const pace = (await ui.findAll({ type: 'Text' })).find((n) =>
        /^🔋/u.test(n.text ?? ''),
    );
    expect(pace?.props.bold).toBe(true);
});

test('room under the pace reads 🔋 in green', async ($, on) => {
    meters(on);
    await measure($, 30, 35);
    expect(await part($, /^🔋/u)).toEqual({
        color: '#47915a',
        text: '🔋 +10%',
    });
});

test("a project override of the compaction point beats the engine's default", async ($, on) => {
    meters(on, {}, '55');
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    expect(
        (await ui.find({ key: 'compact-at', type: 'Input' }))?.props.value,
    ).toBe('55');
});

test('the ctx fill turns amber 10 points before the compaction point', async ($, on) => {
    meters(on);
    await measure($, 39, 60);
    expect(await part($, /^60%$/)).toEqual({ color: '#d9661a', text: '60%' });
});

test('a measure writes the 5h window to the usage file in seconds', async ($, on) => {
    const { files } = meters(on);
    await measure($, 39, 35);
    expect(JSON.parse(files[USAGE] ?? '{}').rate_limits.five_hour).toEqual({
        resets_at: Math.round((NOW + 3 * HOUR) / 1000),
        used_percentage: 39,
    });
});

const bothLimits = (
    changed: 'rateLimits' | 'context',
): Parameters<Engine['session']['measure']>[0] => ({
    changed: [changed],
    context: { percent: 35, tokens: 350_000, window: 1_000_000 },
    rateLimits: [
        {
            kind: 'five_hour',
            percentUsed: 39,
            resetsAt: new Date(NOW + 3 * HOUR).toISOString(),
        },
        {
            kind: 'seven_day',
            percentUsed: 12,
            resetsAt: new Date(NOW + 48 * HOUR).toISOString(),
        },
    ],
});

test('a seven-day window and the write time ride the usage file', async ($, on) => {
    const { files } = meters(on);
    await $.session.measure(bothLimits('rateLimits'));
    const written = JSON.parse(files[USAGE] ?? '{}');
    expect([written.rate_limits.seven_day, written.written_at]).toEqual([
        {
            resets_at: Math.round((NOW + 48 * HOUR) / 1000),
            used_percentage: 12,
        },
        Math.round(NOW / 1000),
    ]);
});

test('a measure whose rate limits did not move rewrites nothing', async ($, on) => {
    const { clock, files } = meters(on);
    await $.session.measure(bothLimits('rateLimits'));
    await clock.advance(10_000);
    await $.session.measure(bothLimits('context'));
    expect(JSON.parse(files[USAGE] ?? '{}').written_at).toBe(
        Math.round(NOW / 1000),
    );
});

test('a settings file that is not a json object is refused and left untouched', async ($, on) => {
    const { files } = meters(on, { [SHARED]: '[1, 2]' });
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', kind: 'change', text: '85' });
    expect([
        files[SHARED],
        (await part(
            $,
            /\/proj\/\.claude\/settings\.json is not a json object/,
        )) !== 'no text',
    ]).toEqual(['[1, 2]', true]);
});

test('every chip and reading in the row names itself on hover', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const cards = (await ui.findAll({ type: 'Box' }))
        .filter((n) => n.props.display === 'none')
        .map((n) => n.text);
    expect(cards).toEqual(
        expect.arrayContaining([
            expect.stringMatching(/the 5h pace$/),
            'until the 5h window resets',
            '5h window used',
            'context window used',
        ]),
    );
});

test('typing a compaction point saves it with no Enter', async ($, on) => {
    const { files } = meters(on, { [SHARED]: '{}' });
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', kind: 'change', text: '85' });
    expect(JSON.parse(files[SHARED] ?? '{}').env).toEqual({
        CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '85',
    });
});

test('a refused compaction point takes back what typing saved on the way to it', async ($, on) => {
    const { files } = meters(
        on,
        { [SHARED]: '{"env":{"CLAUDE_AUTOCOMPACT_PCT_OVERRIDE":"70"}}' },
        '70',
    );
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    for (const text of ['1', '10', '100'])
        await ui.input({ key: 'compact-at', kind: 'change', text });
    await ui.input({ key: 'compact-at', text: '100' });
    expect(JSON.parse(files[SHARED] ?? '{}').env).toEqual({
        CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '70',
    });
});

test('a half-typed compaction point saves nothing and names no refusal', async ($, on) => {
    const { files } = meters(on, { [LOCAL]: '{}' });
    await measure($, 39, 35);
    await band($);
    const ui = await settingsPane($);
    await ui.input({ key: 'compact-at', kind: 'change', text: '8' });
    expect([files[LOCAL], await part($, /^compaction point must/)]).toEqual([
        '{}',
        'no text',
    ]);
});

// the band on one surface, mid-turn or idle; a frame is every Text's words and weight in draw order
async function bandOn(
    $: Engine,
    surface: 'terminal' | 'desktop',
    isWorking: boolean,
) {
    await $.session.start({ cwd: '/proj', isInteractive: true, surface });
    return $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            hasSurvey: false,
            isWorking,
            maxRows: 12,
            scroll: { bodyRows: 40, offset: 0 },
            view: {},
        },
        surface,
    });
}
const frameOf = async (ui: Awaited<ReturnType<typeof bandOn>>) =>
    JSON.stringify(
        (await ui.findAll({ type: 'Text' })).map((t) => [
            t.text,
            Boolean(t.props.bold),
            t.props.color,
        ]),
    );

test('mid-turn the desktop bars carry their breathing, idle ones none', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const sources = async (ui: Awaited<ReturnType<typeof bandOn>>) =>
        (await ui.findAll({ type: 'Svg' })).map((n) =>
            String(n.props.source).includes('<animate'),
        );
    const working = await sources(await bandOn($, 'desktop', true));
    const idle = await sources(await bandOn($, 'desktop', false));
    expect([working, idle]).toEqual([
        [true, true],
        [false, false],
    ]);
});

test("the breathing keeps every bar's cells and colours", async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const svgs = async (ui: Awaited<ReturnType<typeof bandOn>>) =>
        (await ui.findAll({ type: 'Svg' })).map((n) => String(n.props.source));
    const withoutEmbers = (svg: string) =>
        svg.replace(/<rect class="ember"[^>]*>.*?<\/rect>/g, '');
    const breathing = await svgs(await bandOn($, 'desktop', true));
    const still = await svgs(await bandOn($, 'desktop', false));
    expect(still.length).toBe(2);
    expect(breathing.map(withoutEmbers)).toEqual(still);
});

test('/board breathe keeps the bars breathing while idle, for refining the look', async ($, on) => {
    meters(on);
    on('command.run', () => ({ text: '' }));
    await measure($, 39, 35);
    await $.session.start({
        cwd: '/proj',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.command.run({
        args: 'breathe',
        command: 'board',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    const ui = await bandOn($, 'desktop', false);
    expect(
        (await ui.findAll({ type: 'Svg' })).map((n) =>
            String(n.props.source).includes('<animate'),
        ),
    ).toEqual([true, true]);
});

test('a terminal band draws no 5h or ctx bars and keeps its pace reading', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await bandOn($, 'terminal', true);
    const texts = (await ui.findAll({ type: 'Text' })).map((t) => t.text);
    expect([
        texts.some((t) => t === '🔥 5h' || t === '🧠 ctx'),
        texts.some((t) => /^(🔋 \+|🪫 -)\d+%$/.test(t)),
    ]).toEqual([false, true]);
});

test('a desktop band keeps both bars', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await bandOn($, 'desktop', false);
    expect((await ui.findAll({ type: 'Svg' })).length).toBe(2);
});

// each desktop meter part, drawn by default and gone under its switch
const METER_PARTS: [
    string,
    (ui: Awaited<ReturnType<typeof band>>) => Promise<boolean>,
][] = [
    [
        'stash.5h',
        async (ui) =>
            (await ui.findAll({ type: 'Box' })).some(
                (n) => n.key === 'meter:5h',
            ),
    ],
    [
        'stash.ctx',
        async (ui) =>
            (await ui.findAll({ type: 'Box' })).some(
                (n) => n.key === 'meter:ctx',
            ),
    ],
    [
        'stash.pace',
        async (ui) =>
            (await ui.findAll({ type: 'Text' })).some((n) =>
                /^🔋/u.test(n.text ?? ''),
            ),
    ],
    [
        'stash.reset',
        async (ui) =>
            (await ui.findAll({ type: 'Text' })).some((n) =>
                /^⏳/u.test(n.text ?? ''),
            ),
    ],
];
for (const [key, drawn] of METER_PARTS)
    test(`the ${key} switch hides its part`, async ($, on) => {
        const { clock, store } = meters(on);
        await measure($, 39, 35);
        const ui = await band($);
        const before = await drawn(ui);
        store.shown = { [key]: false };
        await clock.advance(4000);
        expect([before, await drawn(ui)]).toEqual([true, false]);
    });

// the 🎛️ bar knobs (FRM-391 slice 06)
test('with breathe switched off, mid-turn bars stand still', async ($, on) => {
    const { store } = meters(on);
    store.breathe = false;
    await measure($, 39, 35);
    const svgs = (
        await (await bandOn($, 'desktop', true)).findAll({ type: 'Svg' })
    ).map((n) => String(n.props.source).includes('<animate'));
    expect(svgs).toEqual([false, false]);
});

test('the breath speed knob stretches every spark: 0.25× runs twice as slow as 0.5×', async ($, on) => {
    const { store } = meters(on);
    store['breath-speed'] = 0.25;
    await measure($, 39, 35);
    const durs = (
        await (await bandOn($, 'desktop', true)).findAll({ type: 'Svg' })
    )
        .flatMap((n) => [
            ...String(n.props.source).matchAll(/dur="([\d.]+)s"/g),
        ])
        .map((m) => Number(m[1]));
    // at 0.5× a period runs 3.2–8.8 s; at 0.25× 6.4–17.6 s
    expect([Math.min(...durs) >= 6.4, Math.max(...durs) <= 17.6]).toEqual([
        true,
        true,
    ]);
});

// dima's wisp, 10-28 15:19/15:24: the bars ended short of the % — the desktop clamps an Svg to its slot but never stretches
// one, and a `width="100%"` drawing fell to the 300 px default; so each bar is drawn wider than its slot and squeezed in
test('each desktop bar is drawn wider than its slot and squeezed into it', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const svgs = (await ui.findAll({ type: 'Svg' })).map(
        (n) => String(n.props.source).match(/^<svg[^>]*>/)?.[0] ?? '',
    );
    expect(
        svgs.map(
            (t) =>
                Number(t.match(/ width="([\d.]+)"/)?.[1]) > 100 * 9 - 90 &&
                t.includes('preserveAspectRatio="none"'),
        ),
    ).toEqual([true, true]);
});
