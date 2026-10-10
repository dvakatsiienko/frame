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
