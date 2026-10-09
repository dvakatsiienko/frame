import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const props = {
    bodyColumns: 100,
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    scroll: { bodyRows: 40, offset: 0 },
    view: {},
};
const MIN = 60 * 1000;
const NOW = 10_000_000;
const SID = 's7a7e000-aaaa';

// a session as a hot reload finds it: the store as it was, and `$.state` holding what the old module kept there.
// `calls` counts every file and process read, so a test can ask what a render did
async function reloaded(
    $: Engine,
    on: On,
    state: Record<string, unknown>,
    store: Record<string, unknown> = {},
    isBoardOpen = false,
) {
    const clock = mock.clock(on, { now: NOW });
    const calls = { io: 0 };
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
    on('state.get', (_$, e) => ({
        value: { value: state[e.key], version: e.key in state ? 1 : 0 },
    }));
    on('state.set', (_$, e) => {
        state[e.key] = e.value;
        return { value: { isSet: true, version: 2 } };
    });
    on('env.get', () => ({ value: '/home' }));
    on('fs.list', () => {
        calls.io++;
        return { value: [] };
    });
    on('fs.read', () => {
        calls.io++;
        return { deny: 'no such file' };
    });
    on('process.run', () => {
        calls.io++;
        return {
            value: {
                exitCode: 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: '',
            },
        };
    });
    on('ui.panes', () => ({
        value: isBoardOpen
            ? [
                  {
                      id: 'fleet-board',
                      isFocused: false,
                      isPlaced: true,
                      isShown: true,
                      plugin: 'x-mod-stash',
                      title: 'fleet board',
                  },
              ]
            : [],
    }));
    const pings: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('ui.log', () => ({ value: undefined }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin') pings.push(e.text);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    return { calls, clock, pings };
}

const band = ($: Engine) =>
    $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'desktop',
    });

test('the away digest still shows after a reload', async ($, on) => {
    await reloaded($, on, {
        view: {
            afk: false,
            areGuardsOpen: false,
            digest: {
                done: [{ name: 'd0d0d0d0', sid: 'd0d0d0d0-done' }],
                needs: [],
            },
            entries: {},
            guards: [],
            holds: { others: 0, warned: false },
            isBoardOpen: false,
            isHot: false,
        },
    });
    const ui = await band($);
    expect(
        await ui.find({ text: 'done · d0d0d0d0', type: 'Text' }),
    ).toBeTruthy();
});

test('a reload in a running turn never pings it with keep-hot', async ($, on) => {
    const s = await reloaded(
        $,
        on,
        { turn: { isBusy: true, isPinged: false, isUserTurn: true } },
        { [`hot:${SID}`]: { since: NOW - 60 * MIN } },
    );
    await s.clock.advance(60 * MIN);
    expect(s.pings).toEqual([]);
});

test('the board draws with no file or process read', async ($, on) => {
    const s = await reloaded($, on, {}, {}, true);

    await s.clock.advance(4000);
    const before = s.calls.io;
    await $.ui.mount({
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
    expect(s.calls.io - before).toBe(0);
});

test("an open board's tick leaves the band's view unwritten", async ($, on) => {
    const state: Record<string, unknown> = {};
    const s = await reloaded($, on, state, {}, true);
    await s.clock.advance(4000);
    const settled = JSON.stringify(state.view);
    await s.clock.advance(3 * 4000);
    expect(JSON.stringify(state.view)).toBe(settled);
});

test("an open board's tick moves the board's clock", async ($, on) => {
    const state: Record<string, unknown> = {};
    const s = await reloaded($, on, state, {}, true);
    await s.clock.advance(4000);
    const first = (state.board as { at: number } | undefined)?.at;
    await s.clock.advance(4000);
    expect((state.board as { at: number } | undefined)?.at).toBe(
        (first ?? 0) + 4000,
    );
});
