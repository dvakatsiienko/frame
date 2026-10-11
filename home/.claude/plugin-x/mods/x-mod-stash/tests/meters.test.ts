import type { On, SessionContextBreakdown } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { meterBar } from '../hooks/register.tsx';

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
    const width = Number(ctx.match(/width="([\d.]+)"/)?.[1]);
    const red = Number(ctx.match(/x2="([\d.]+)"/)?.[1]);
    expect(Math.round((red / width) * 100)).toBe(70);
});

test('a terminal bar is sline ▮ ▯ cells', () => {
    const text = meterBar(50, 10)
        .map((r) => r.text)
        .join('');
    expect(text).toBe('▮▮▮▮▮▯▯▯▯▯');
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
    const ui = await band($);
    const input = await ui.find({ type: 'Input' });
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
    const ui = await band($);
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
    const ui = await band($);
    await ui.input({ key: 'compact-at', text: '90' });
    expect([
        JSON.parse(files['/launch/.claude/settings.local.json'] ?? '{}').env,
        LOCAL in files,
    ]).toEqual([{ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '90' }, false]);
});

test('a compaction point outside 10–99 is refused and the file stays untouched', async ($, on) => {
    const { files } = meters(on, { [LOCAL]: '{}' });
    await measure($, 39, 35);
    const ui = await band($);
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
    const ui = await band($);
    expect((await ui.find({ type: 'Input' }))?.props.value).toBe('55');
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

test('a terminal meter runs the band to its right edge', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    await $.session.start({
        cwd: '/proj',
        isInteractive: true,
        surface: 'terminal',
    });
    const ui = await $.ui.mount({
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
        surface: 'terminal',
    });
    const bar = (await ui.find({ key: 'meter:5h', type: 'Box' }))?.text ?? '';
    expect([...bar.replace(/[^▮▯┃]/g, '')].length).toBe(87);
});

test('typing a compaction point saves it with no Enter', async ($, on) => {
    const { files } = meters(on, { [SHARED]: '{}' });
    await measure($, 39, 35);
    const ui = await band($);
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
    const ui = await band($);
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
    const ui = await band($);
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

test('mid-turn the terminal bars breathe: two frames apart differ', async ($, on) => {
    const { clock } = meters(on);
    await measure($, 39, 35);
    const ui = await bandOn($, 'terminal', true);
    const first = await frameOf(ui);
    await clock.advance(3000);
    expect(await frameOf(ui)).not.toBe(first);
});

test('idle the terminal bars stand still: two frames apart are equal', async ($, on) => {
    const { clock } = meters(on);
    await measure($, 39, 35);
    const ui = await bandOn($, 'terminal', false);
    const first = await frameOf(ui);
    await clock.advance(1000);
    expect(await frameOf(ui)).toBe(first);
});

test('mid-turn the terminal bars keep the idle glyphs, labels and values', async ($, on) => {
    const { clock } = meters(on);
    await measure($, 39, 35);
    // the runs split where a spark's styling starts, so the band's text is compared joined
    const textOf = async (ui: Awaited<ReturnType<typeof bandOn>>) =>
        (await ui.findAll({ type: 'Text' })).map((t) => t.text).join('');
    const idle = await textOf(await bandOn($, 'terminal', false));
    const working = await bandOn($, 'terminal', true);
    await clock.advance(3000);
    expect(await textOf(working)).toBe(idle);
});

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

// the slice-02 A/B (FRM-391): /board ab, the ⏱ rate chip, the gpu % in the owner session
const setAb = (
    store: Record<string, unknown>,
    hz: 10 | 30 | 60,
    owner = SID,
) => {
    store['breath-ab'] = { hz, owner };
};
const svgsAnimate = async (
    ui: Pick<Awaited<ReturnType<typeof bandOn>>, 'findAll'>,
) =>
    (await ui.findAll({ type: 'Svg' })).map((n) =>
        String(n.props.source).includes('<animate'),
    );

test('/board ab turns the A/B on: bars, 10 Hz, owned by this session', async ($, on) => {
    const { store } = meters(on);
    on('command.run', () => ({ text: '' }));
    await $.session.start({
        cwd: '/proj',
        isInteractive: true,
        surface: 'desktop',
    });
    await $.command.run({
        args: 'ab',
        command: 'board',
        origin: { kind: 'composer' },
        presentation: { columns: 80, isFullscreen: false },
    });
    expect(store['breath-ab']).toEqual({ hz: 10, owner: SID });
});

test('while the A/B runs the idle desktop bars breathe', async ($, on) => {
    const { store } = meters(on);
    await measure($, 39, 35);
    setAb(store, 10);
    expect(await svgsAnimate(await bandOn($, 'desktop', false))).toEqual([
        true,
        true,
    ]);
});

test('the ⏱ chip steps the rate to the next one', async ($, on) => {
    const { store } = meters(on);
    await measure($, 39, 35);
    setAb(store, 10);
    const ui = await bandOn($, 'terminal', false);
    await ui.press({ key: 'ab:rate' });
    expect(store['breath-ab']).toEqual({ hz: 30, owner: SID });
});

// how many of 90 samples, 34 ms apart (3.06 s), show a frame the last one did not: 10 Hz can change at most 31 times
const changesAt = async ($: Engine, on: On, hz: 10 | 30) => {
    const { clock, store } = meters(on);
    await measure($, 39, 35);
    setAb(store, hz, 'bars');
    const ui = await bandOn($, 'terminal', false);
    let last = await frameOf(ui);
    let changes = 0;
    for (let i = 0; i < 90; i++) {
        await clock.advance(34);
        const now = await frameOf(ui);
        if (now !== last) changes++;
        last = now;
    }
    return changes;
};

test('at 30 Hz the terminal bars change more often than 10 Hz ever can', async ($, on) => {
    expect(await changesAt($, on, 30)).toBeGreaterThan(31);
});

test('at 10 Hz the terminal bars change at most ten times a second', async ($, on) => {
    const n = await changesAt($, on, 10);
    expect([n > 0, n <= 31]).toEqual([true, true]);
});

test('the owner session shows the gpu % its setting costs', async ($, on) => {
    const { clock, store } = meters(on);
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '"Device Utilization %"=42',
        },
    }));
    await measure($, 39, 35);
    setAb(store, 10);
    const ui = await bandOn($, 'desktop', false);
    await clock.advance(2000);
    expect((await ui.find({ text: /^gpu /, type: 'Text' }))?.text).toBe(
        'gpu 10 Hz 42%',
    );
});

test('a session that does not own the A/B never reads the gpu', async ($, on) => {
    const { clock, store } = meters(on);
    const ran: string[] = [];
    on('process.run', (_$, e) => {
        ran.push(e.argv[0] ?? '');
        return { deny: 'not here' };
    });
    await measure($, 39, 35);
    setAb(store, 10, 'someone-else');
    await bandOn($, 'desktop', false);
    await clock.advance(4000);
    expect(ran.filter((c) => c === 'ioreg')).toEqual([]);
});

test('the desktop A/B names its rate as the display rate, with no rate button', async ($, on) => {
    const { store } = meters(on);
    await measure($, 39, 35);
    setAb(store, 10);
    const ui = await bandOn($, 'desktop', false);
    expect([
        (await ui.find({ text: '⏱ display rate', type: 'Text' }))?.text,
        await ui.find({ key: 'ab:rate', type: 'Button' }),
    ]).toEqual(['⏱ display rate', undefined]);
});
