import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const STORE = '/home/.claude/plugins/store';
const OLD = 'stash_inline-0ld0ld0ld0ld.json';
const MIN = 60 * 1000;
const NOW = 1_000_000;
const SID = 'r3n4m3d0-aaaa';

// a session whose old `stash` store file holds 🔥 for it: is 🔥 still on, and does its ping fire?
async function hotAfterStart(
    $: Engine,
    on: On,
    store: Record<string, unknown> = {},
    oldMtime = 0,
) {
    const clock = mock.clock(on, { now: NOW });
    mock.store(on, store);
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === STORE
                ? [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: oldMtime,
                          name: OLD,
                          size: 1,
                      },
                  ]
                : [],
    }));
    on('fs.read', (_$, e) => ({
        value: JSON.stringify(
            e.path === `${STORE}/${OLD}`
                ? { [`hot:${SID}`]: { since: NOW } }
                : {},
        ),
    }));
    const pings: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin') pings.push(e.text);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
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
        surface: 'desktop',
    });
    await clock.advance(50 * MIN);
    const hot = (await ui.findAll({ type: 'Button' })).find(
        (n) => n.key === 'hot',
    );
    return [hot?.props.variant, pings.length];
}

test('🔥 kept under the old stash name survives the rename', async ($, on) => {
    expect(await hotAfterStart($, on)).toEqual(['secondary', 1]);
});

// a probe that ran the new name early adopted a snapshot; the old mod kept writing until the cutover
test('an old store written after an earlier adoption is adopted again', async ($, on) => {
    expect(await hotAfterStart($, on, { 'adopted:stash': 5 }, 9)).toEqual([
        'secondary',
        1,
    ]);
});

// `$.state` as the engine keeps it, per plugin: what the session wrote under the old `stash` name before the rename
function state(on: On, values: Record<string, unknown>) {
    const versions: Record<string, number> = {};
    on('state.get', (_$, e) => {
        const at = `${e.plugin}.${e.key}`;
        return {
            value: {
                value: values[at],
                version: versions[at] ?? (at in values ? 1 : 0),
            },
        };
    });
    on('state.set', (_$, e) => {
        const at = `${e.plugin}.${e.key}`;
        values[at] = e.value;
        versions[at] = (versions[at] ?? 0) + 1;
        return { value: { isSet: true, version: versions[at] } };
    });
}

test('the band stays folded as dima left it under the old stash name', async ($, on) => {
    mock.clock(on, { now: NOW });
    mock.store(on, {
        [`asks:${SID}`]: { asks: ['ship it'], at: NOW, label: 'frame' },
    });
    state(on, { 'stash.open': false });
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({ value: null }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    await $.session.start({
        cwd: '/tmp',
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
    expect(await ui.findAll({ text: /ship it/, type: 'Text' })).toEqual([]);
});
