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
const SID = 'w4k3w4k3-aaaa';
const CAPPED = "You've hit your session limit · resets 11:40pm (Europe/Kiev)";

// a session whose stash store already holds `store`, its 5h reset 30 min out
async function session($: Engine, on: On, store: Record<string, unknown> = {}) {
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
    const resumes: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('session.measure', (_$, e) => ({ changed: e.changed }));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('turn.complete', () => ({ text: '' }));
    on('prompt.submit', (_$, e) => {
        if (e.origin?.kind === 'plugin' && e.text.includes('waker'))
            resumes.push(e.text);
        return { text: e.text };
    });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
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
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'desktop',
    });
    return { clock, resumes, store, ui };
}

function endTurn($: Engine, answer: string, reason: 'answer' | 'error') {
    return $.turn.complete({
        answer,
        durationMs: 1,
        isAborted: false,
        reason,
        turnId: 't',
    });
}

test('with the waker off, a 5h reset sends nothing', async ($, on) => {
    const s = await session($, on);
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toEqual([]);
});

test('with the waker on, a session stopped on the cap gets one resume at the reset', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('with the waker on, a session that stopped for another reason gets nothing', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    await endTurn($, 'done', 'answer');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toEqual([]);
});

test('one reset sends at most one resume, a reload included', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(40 * MIN);
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('the ⏰ button in the band switches the waker on for every session', async ($, on) => {
    const s = await session($, on);
    await s.ui.press({ key: 'waker' });
    expect(s.store.waker).toEqual({ on: true });
});

test('a session started with the waker on shows ⏰ lit', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    expect((await s.ui.find({ key: 'waker' }))?.props.variant).toBe(
        'secondary',
    );
});
