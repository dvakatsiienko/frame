import type { On, SessionContextBreakdown } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { meterBar } from '../hooks/register.tsx';

const NOW = 10_000_000;
const HOUR = 60 * 60 * 1000;
const SID = 'm1m1m1m1-here';
const LOCAL = '/proj/.claude/settings.local.json';
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
        expect.stringMatching(/^🔥 5h39%/),
        expect.stringMatching(/^1% spare🌔 3h 0m/),
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
    expect(five?.text).toMatch(/^🔥 5h52%/);
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

test('a submitted compaction point lands in the project settings.local.json, other keys kept', async ($, on) => {
    const { files } = meters(on, {
        [LOCAL]: '{"permissions":{"allow":["Bash"]}}',
    });
    await measure($, 39, 35);
    const ui = await band($);
    await ui.input({ key: 'compact-at', text: '80' });
    expect(JSON.parse(files[LOCAL] ?? '{}')).toEqual({
        env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '80' },
        permissions: { allow: ['Bash'] },
    });
});

test('a submitted compaction point lands in the launch dir the registry names, not the start cwd', async ($, on) => {
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

test('a debt up to 10 reads amber', async ($, on) => {
    meters(on);
    await measure($, 45, 35);
    expect(await part($, /debt$/)).toEqual({
        color: '#d9661a',
        text: '+5% debt',
    });
});

test('a debt past 10 reads red', async ($, on) => {
    meters(on);
    await measure($, 55, 35);
    expect(await part($, /debt$/)).toEqual({
        color: '#e5484d',
        text: '+15% debt',
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

test('a compaction is kept with its fill before and after', async ($, on) => {
    const { store } = meters(on);
    await band($);
    await measure($, 39, 72);
    await $.session.compact({
        messages: [{ role: 'user', text: 'hi', toolUses: [] }],
        trigger: 'auto',
    });
    await measure($, 39, 18);
    expect(store[`compactions:${SID}`]).toEqual([
        { at: NOW, from: 72, to: 18 },
    ]);
});

test('the meters keep their rows when the asks outgrow the band', async ($, on) => {
    meters(on);
    on('classic.Stop', () => ({}));
    await measure($, 39, 35);
    await $.session.start({
        cwd: '/proj',
        isInteractive: true,
        surface: 'desktop',
    });
    const asks = Array.from(
        { length: 10 },
        (_, i) => `${i + 1}. ask ${i + 1} ➡️ yes`,
    );
    await $.classic.Stop({
        last_assistant_message: `⏳ waiting on your word:\n\n\`\`\`\nlane\n${asks.join('\n')}\n\`\`\``,
        stop_hook_active: false,
    });
    const ui = await band($, 8);
    const texts = (await ui.findAll({ type: 'Text' })).map((t) => t.text ?? '');
    const boxes = (await ui.findAll({ type: 'Box' })).map((b) => b.key);
    expect([
        texts.filter((t) => /^\d+\. ask/.test(t)).length,
        texts.includes('+6 more'),
        boxes.includes('meter:5h') && boxes.includes('meter:ctx'),
    ]).toEqual([4, true, true]);
});

test('the desktop gives the bars air above, between and below them', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const boxes = await ui.findAll({ type: 'Box' });
    const box = boxes.find((b) => b.key === 'meters');
    const ctx = boxes.find((b) => b.key === 'meter:ctx');
    const air = [
        box?.props.marginTop,
        ctx?.props.marginTop,
        box?.props.marginBottom,
    ];
    expect(air.every((n) => typeof n === 'number' && n > 0)).toBe(true);
});

// the harness cannot hover; it reads the hidden card's words, and `pnpm mods:live … hover` checks the reveal
const cardTexts = async ($: Engine) =>
    (await (await band($)).findAll({ type: 'Text' }))
        .map((t) => t.text ?? '')
        .filter((t) => t.includes('┃'));

test("the 5h bar's card names its tick as the on-pace mark", async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    expect(await cardTexts($)).toContain(
        'used 39% · ┃ on pace at 40% · 1% spare',
    );
});

test("the ctx bar's card names its tick as the compaction point", async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    expect(await cardTexts($)).toContain('context 35% · ┃ compacts at 70%');
});

test('a band with no reading draws no card', async ($, on) => {
    meters(on);
    expect(await cardTexts($)).toEqual([]);
});
