import type { On, SessionContextBreakdown } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const NOW = 10_000_000;
const HOUR = 60 * 60 * 1000;
const SID = 'm1m1m1m1-here';
const LOCAL = '/proj/.claude/settings.local.json';
const USAGE = '/home/.claude/shelf/cc-usage-window.json';

// a session in /proj whose engine compacts at 70 % of a 1M window, the files in memory; `override` is the project's
// CLAUDE_AUTOCOMPACT_PCT_OVERRIDE as the merged settings carry it
function meters(on: On, files: Record<string, string> = {}, override?: string) {
    const store: Record<string, unknown> = {};
    mock.clock(on, { now: NOW });
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
    return { files, store };
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

async function band($: Engine) {
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
            maxRows: 12,
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

test('the 5h row shows used, pace, the gap and the reset', async ($, on) => {
    meters(on);
    await measure($, 39, 35);
    const ui = await band($);
    const row = (await ui.findAll({ type: 'Box' })).find(
        (n) => n.key === 'meter:5h',
    );
    expect(row?.text).toMatch(/39%.*pace 40%.*1 spare.*↻ \d\d:\d\d/);
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
        color: 'warning',
        text: '+5 debt',
    });
});

test('a debt past 10 reads red', async ($, on) => {
    meters(on);
    await measure($, 55, 35);
    expect(await part($, /debt$/)).toEqual({
        color: 'error',
        text: '+15 debt',
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
    expect(await part($, /^60%$/)).toEqual({ color: 'warning', text: '60%' });
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
