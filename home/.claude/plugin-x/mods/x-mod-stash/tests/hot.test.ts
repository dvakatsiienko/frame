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
const NOW = 1_000_000;
const SID = 'h0t0h0t0-aaaa';

async function hotSession($: Engine, on: On) {
    const clock = mock.clock(on);
    mock.store(on);
    const pings: string[] = [];
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin') pings.push(e.text);
        return { text: e.text };
    });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'desktop',
    });
    await ui.press({ key: 'hot' });
    return { clock, pings };
}

function endTurn($: Engine) {
    return $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
}

test('a hot session is pinged 50 minutes after its last turn ended', async ($, on) => {
    const s = await hotSession($, on);
    await endTurn($);
    await s.clock.advance(49 * MIN);
    const before = s.pings.length;
    await s.clock.advance(MIN);
    expect([before, s.pings]).toEqual([
        0,
        [expect.stringContaining('keep-hot ping')],
    ]);
});

test('a busy session is never pinged', async ($, on) => {
    const s = await hotSession($, on);
    await endTurn($);
    await s.clock.advance(30 * MIN);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'a long turn',
        wait: false,
    });
    await s.clock.advance(40 * MIN);
    expect(s.pings).toEqual([]);
});

// mock.store copies its entries; this one is the record itself, so a test writes a key as another process would
function liveStore(on: On, entries: Record<string, unknown>) {
    on('store.get', (_$, e) => ({ value: entries[e.key] }));
    on('store.set', (_$, e) => {
        entries[e.key] = e.value;
        return { value: undefined };
    });
    on('store.delete', (_$, e) => {
        delete entries[e.key];
        return { value: undefined };
    });
    on('store.keys', () => ({ value: Object.keys(entries) }));
}

// a session whose stash store, and `$.state` when given, already hold what a reload or a respawn finds
async function started(
    $: Engine,
    on: On,
    store: Record<string, unknown> = {},
    state?: Record<string, unknown>,
) {
    const clock = mock.clock(on, { now: NOW });
    liveStore(on, store);
    if (state)
        on('state.get', (_$, e) => ({
            value: { value: state[e.key], version: e.key in state ? 1 : 0 },
        }));
    const pings: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
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
        props,
        surface: 'desktop',
    });
    const button = async () =>
        (await ui.findAll({ type: 'Button' })).find((n) => n.key === 'hot');
    return { button, clock, pings, ui };
}

function measure($: Engine, percentUsed: number, resetsInMs: number) {
    return $.session.measure({
        changed: ['rateLimits'],
        context: { window: 200_000 },
        rateLimits: [
            {
                kind: 'five_hour',
                percentUsed,
                resetsAt: new Date(NOW + resetsInMs).toISOString(),
            },
        ],
    });
}

test('🔥 stays ticked after two pings', async ($, on) => {
    const s = await started($, on);
    await s.ui.press({ key: 'hot' });
    await endTurn($);
    await s.clock.advance(50 * MIN);
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect([s.pings.length, (await s.button())?.props.variant]).toEqual([
        2,
        'secondary',
    ]);
});

test('🔥 survives a reload', async ($, on) => {
    const s = await started($, on, { [`hot:${SID}`]: { since: NOW } });
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings.length]).toEqual([
        'secondary',
        1,
    ]);
});

test('a 🔥 key written after the session started arms the ping when its turn ends', async ($, on) => {
    const store: Record<string, unknown> = {};
    const s = await started($, on, store);
    store[`hot:${SID}`] = { since: NOW };
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings]).toEqual([
        'secondary',
        [expect.stringContaining('keep-hot ping')],
    ]);
});

test('a 🔥 key deleted while the session idles arms no ping when the next turn ends', async ($, on) => {
    const store: Record<string, unknown> = { [`hot:${SID}`]: { since: NOW } };
    const s = await started($, on, store);
    delete store[`hot:${SID}`];
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect(s.pings).toEqual([]);
});

test('🔥 switched off on the band stays off when the next turn ends', async ($, on) => {
    const s = await started($, on, { [`hot:${SID}`]: { since: NOW } });
    await s.ui.press({ key: 'hot' });
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings]).toEqual([
        undefined,
        [],
    ]);
});

test('🔥 turns itself off after the 5h window resets', async ($, on) => {
    const s = await started($, on);
    await measure($, 50, 30 * MIN);
    await s.ui.press({ key: 'hot' });
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings]).toEqual([
        undefined,
        [],
    ]);
});

test('🔥 switched on right after a reload still turns itself off at the reset', async ($, on) => {
    const s = await started(
        $,
        on,
        {},
        {
            fiveHour: { resetsAt: NOW + 30 * MIN },
        },
    );
    await s.ui.press({ key: 'hot' });
    await endTurn($);
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings]).toEqual([
        undefined,
        [],
    ]);
});

test('a folded asks list stays folded across a reload', async ($, on) => {
    const s = await started(
        $,
        on,
        { [`asks:${SID}`]: { asks: ['ship it'], at: NOW, label: 'frame' } },
        { open: false },
    );
    expect(await s.ui.find({ text: /ship it/, type: 'Text' })).toBe(undefined);
});

// what a reload will read back, recorded as it is written
function stateWrites(on: On) {
    const writes: [string, unknown][] = [];
    on('state.set', (_$, e) => {
        writes.push([e.key, e.value]);
        return { value: { isSet: true, version: 1 } };
    });
    return writes;
}

test('folding the asks writes the fold to $.state', async ($, on) => {
    const writes = stateWrites(on);
    const s = await started($, on, {
        [`asks:${SID}`]: { asks: ['ship it'], at: NOW, label: 'frame' },
    });
    await s.ui.press({ key: 'asks-toggle' });
    expect(writes.filter(([key]) => key === 'open').at(-1)).toEqual([
        'open',
        false,
    ]);
});

test('a measure writes the 5h reset to $.state', async ($, on) => {
    const writes = stateWrites(on);
    await started($, on);
    await measure($, 50, 30 * MIN);
    expect(writes.filter(([key]) => key === 'fiveHour')).toEqual([
        ['fiveHour', { resetsAt: NOW + 30 * MIN }],
    ]);
});
