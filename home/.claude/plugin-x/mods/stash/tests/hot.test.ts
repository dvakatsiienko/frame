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
        plugin: 'stash',
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

// a session whose stash store already holds 🔥, as a reload or a respawn finds it
async function started($: Engine, on: On, store: Record<string, unknown> = {}) {
    const clock = mock.clock(on, { now: NOW });
    mock.store(on, store);
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
        plugin: 'stash',
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
        'primary',
    ]);
});

test('🔥 survives a reload', async ($, on) => {
    const s = await started($, on, { [`hot:${SID}`]: { since: NOW } });
    await s.clock.advance(50 * MIN);
    expect([(await s.button())?.props.variant, s.pings.length]).toEqual([
        'primary',
        1,
    ]);
});

test('🔥 suggests itself when the 5h window is nearly spent', async ($, on) => {
    const s = await started($, on);
    await measure($, 92, 120 * MIN);
    const b = await s.button();
    expect([b?.text, b?.props.dimColor]).toEqual(['🔥? hot', true]);
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

test("a turn's ➡️ line is proposed in the prompt box", async ($, on) => {
    mock.clock(on);
    mock.store(on);
    const proposed: string[] = [];
    on('turn.complete', () => ({ text: '' }));
    on('prompt.suggest', (_$, e) => {
        proposed.push(e.text);
        return { isShown: true };
    });
    await $.turn.complete({
        answer: 'done\n\n➡️ next: push it',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    expect(proposed).toEqual(['push it']);
});
