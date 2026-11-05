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
async function session(
    $: Engine,
    on: On,
    store: Record<string, unknown> = {},
    now = NOW,
    fiveHour = now + 30 * MIN,
    tail = '',
    percentUsed = 100,
) {
    const clock = mock.clock(on, { now });
    on('env.get', () => ({ value: '/home/test' }));
    const toasts: string[] = [];
    on('ui.toast', (_$, e) => {
        toasts.push(e.text);
        return { value: undefined };
    });
    on('process.run', () => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: tail,
        },
    }));
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
                percentUsed,
                resetsAt: new Date(fiveHour).toISOString(),
            },
        ],
    });
    const ui = await $.ui.mount({
        component: 'AbovePrompt',
        plugin: 'x-mod-stash',
        props,
        surface: 'desktop',
    });
    return { clock, resumes, store, toasts, ui };
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

// the kit refuses node:os, so no bound here can read the load: this one timed out at 5 s at load 24 (FRM-470)
test(
    'with the waker off, a 5h reset sends nothing',
    { timeoutMs: 30_000 },
    async ($, on) => {
        const s = await session($, on);
        await endTurn($, CAPPED, 'error');
        await s.clock.advance(40 * MIN);
        expect(s.resumes).toEqual([]);
    },
);

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

test('⏰ switched on before the reset still wakes the capped session', async ($, on) => {
    const s = await session($, on);
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(10 * MIN);
    await s.ui.press({ key: 'waker' });
    await s.clock.advance(30 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('⏰ switched on after the reset never wakes the session that reset left capped', async ($, on) => {
    const s = await session($, on);
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(40 * MIN);
    await s.ui.press({ key: 'waker' });
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'desktop',
    });
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toEqual([]);
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

const isWakerOn = (store: Record<string, unknown>) =>
    (store.waker as { on?: boolean } | undefined)?.on === true;

test('💨 afk switched on turns ⏰ on, and afk off puts ⏰ back off', async ($, on) => {
    const s = await session($, on);
    await s.ui.press({ key: 'afk' });
    expect(isWakerOn(s.store)).toBe(true);
    expect((await s.ui.find({ key: 'waker' }))?.props.variant).toBe(
        'secondary',
    );
    await s.ui.press({ key: 'afk' });
    expect(isWakerOn(s.store)).toBe(false);
});

test('⏰ already on stays on through an afk round trip', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    await s.ui.press({ key: 'afk' });
    await s.ui.press({ key: 'afk' });
    expect(isWakerOn(s.store)).toBe(true);
});

test('a press on ⏰ while afk is on still switches it', async ($, on) => {
    const s = await session($, on);
    await s.ui.press({ key: 'afk' });
    await s.ui.press({ key: 'waker' });
    expect(isWakerOn(s.store)).toBe(false);
});

test('afk on alone wakes a session stopped on the cap at the reset', async ($, on) => {
    const s = await session($, on);
    await s.ui.press({ key: 'afk' });
    await endTurn($, CAPPED, 'error');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('a turn that ends in an error keeps the text the hook saw', async ($, on) => {
    const s = await session($, on);
    await endTurn($, CAPPED, 'error');
    await endTurn($, 'done', 'answer');
    expect(s.store['cap-seen']).toEqual([
        { at: NOW, isCapped: true, text: CAPPED },
    ]);
});

test('a ⏰ press during afk stands after afk goes off', async ($, on) => {
    const s = await session($, on, { waker: { on: true } });
    await s.ui.press({ key: 'afk' });
    await s.ui.press({ key: 'waker' });
    await s.ui.press({ key: 'afk' });
    expect(isWakerOn(s.store)).toBe(false);
});

test('afk switched on before the waker rider leaves ⏰ as it is when it goes off', async ($, on) => {
    const s = await session($, on, {
        afk: { at: 0, on: true },
        waker: { on: true },
    });
    await s.ui.press({ key: 'afk' });
    expect(isWakerOn(s.store)).toBe(true);
});

test('an answer that only talks about limits is not kept as a cap', async ($, on) => {
    const s = await session($, on);
    await endTurn($, 'the rate limit doc says 5h', 'answer');
    expect(s.store['cap-seen']).toBeUndefined();
});

// tonight's cap entries as the transcript holds them (clio e1ac9b71 at 19:00:40Z and 14:29:41Z, codie 6aa1af14 at
// 18:59:20Z): the turn ends in error with an empty answer, the cap text lives only here
// the real entry carries the typed quota; `quota: false` drops it, the text alone then names the cap and its reset
const capLine = (at: string, reset: string, resetsAt?: string) =>
    JSON.stringify({
        error: 'rate_limit',
        isApiErrorMessage: true,
        ...(resetsAt
            ? {
                  quotaLimits: {
                      rateLimitType: 'five_hour',
                      resetsAt: Date.parse(resetsAt) / 1000,
                      status: 'rejected',
                  },
              }
            : {}),
        message: {
            content: [
                {
                    text: `- You've hit your session limit\n- resets ${reset} (Europe/Kiev)`,
                    type: 'text',
                },
            ],
            model: '<synthetic>',
            role: 'assistant',
        },
        timestamp: at,
        type: 'assistant',
    });
const userLine = JSON.stringify({
    message: { content: 'go on' },
    timestamp: '2026-11-02T18:59:19.000Z',
    type: 'user',
});

for (const [name, at, reset, wakeAt] of [
    [
        'clio 21:00',
        '2026-11-02T19:00:40.955Z',
        '9:30pm',
        '2026-11-02T19:30:00.000Z',
    ],
    [
        'codie 20:59',
        '2026-11-02T18:59:20.452Z',
        '9:30pm',
        '2026-11-02T19:30:00.000Z',
    ],
    [
        'clio 16:29',
        '2026-11-02T14:29:41.822Z',
        '4:30pm',
        '2026-11-02T14:30:00.000Z',
    ],
] as const)
    test(`the ${name} cap, read from the transcript, wakes the session once at the reset it names`, async ($, on) => {
        const now = Date.parse(at) + 500;
        const s = await session(
            $,
            on,
            { waker: { on: true } },
            now,
            now + 3 * 60 * MIN,
            `${userLine}\n${capLine(at, reset, wakeAt)}\n`,
        );
        await endTurn($, '', 'error');
        await s.clock.advance(Date.parse(wakeAt) - now - 1000);
        expect(s.resumes).toEqual([]);
        await s.clock.advance(10_000);
        expect(s.resumes).toHaveLength(1);
    });

test('the cap read from the transcript is kept in cap-seen', async ($, on) => {
    const at = '2026-11-02T19:00:40.955Z';
    const s = await session(
        $,
        on,
        {},
        Date.parse(at) + 500,
        undefined,
        `${capLine(at, '9:30pm', '2026-11-02T19:30:00.000Z')}\n`,
    );
    await endTurn($, '', 'error');
    expect(s.store['cap-seen']).toEqual([
        {
            at: Date.parse(at) + 500,
            isCapped: true,
            text: "- You've hit your session limit\n- resets 9:30pm (Europe/Kiev)",
        },
    ]);
});

test('a cap entry with no reset it can read waits for the 5h reset the measure named', async ($, on) => {
    const at = '2026-11-02T19:00:40.955Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        now,
        now + 20 * MIN,
        `${capLine(at, 'soon')}\n`,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(21 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('an error end whose last entry is no cap arms nothing', async ($, on) => {
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        NOW,
        undefined,
        `${JSON.stringify({ error: 'overloaded', message: { content: [{ text: 'API Error: 529', type: 'text' }] }, timestamp: '2026-11-02T18:00:00.000Z', type: 'assistant' })}\n`,
        50,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toEqual([]);
});

const reworded = (at: string, error?: string) =>
    JSON.stringify({
        ...(error ? { error } : {}),
        message: {
            content: [
                { text: 'Usage cap reached. Come back later.', type: 'text' },
            ],
        },
        timestamp: at,
        type: 'assistant',
    });

test('a reworded cap that keeps the rate_limit field still arms, at the 5h reset', async ($, on) => {
    const at = '2026-11-02T19:00:40.955Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        now,
        now + 20 * MIN,
        `${reworded(at, 'rate_limit')}\n`,
        50,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(21 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('a reworded cap with no field arms at the 5h reset while the window reads 100 %', async ($, on) => {
    const at = '2026-11-02T19:00:40.955Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        now,
        now + 20 * MIN,
        `${reworded(at)}\n`,
        100,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(21 * MIN);
    expect(s.resumes).toHaveLength(1);
});

test('a cap whose named reset is its own minute waits for the measured reset, never re-caps at once', async ($, on) => {
    const at = '2026-11-02T19:30:02.000Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        now,
        Date.parse('2026-11-02T19:30:40.000Z'),
        `${capLine(at, '9:30pm')}\n`,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(30_000);
    expect(s.resumes).toEqual([]);
    await s.clock.advance(20_000);
    expect(s.resumes).toHaveLength(1);
});

test('a cap with no typed quota arms at the reset its text names', async ($, on) => {
    const at = '2026-11-02T18:59:20.452Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        now,
        now + 3 * 60 * MIN,
        `${capLine(at, '9:30pm')}\n`,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(Date.parse('2026-11-02T19:29:59.000Z') - now);
    expect(s.resumes).toEqual([]);
    await s.clock.advance(10_000);
    expect(s.resumes).toHaveLength(1);
});

test('a weekly quota entry arms no 5h wake', async ($, on) => {
    const s = await session(
        $,
        on,
        { waker: { on: true } },
        NOW,
        undefined,
        `${JSON.stringify({ error: 'rate_limit', message: { content: [{ text: 'Usage limit reached.', type: 'text' }], model: '<synthetic>' }, quotaLimits: { rateLimitType: 'seven_day', resetsAt: 9_999_999 }, timestamp: '2026-11-02T18:00:00.000Z', type: 'assistant' })}\n`,
        50,
    );
    await endTurn($, '', 'error');
    await s.clock.advance(40 * MIN);
    expect(s.resumes).toEqual([]);
});

test('a cap read from the full window alone logs an unread cap-seen row and toasts', async ($, on) => {
    const at = '2026-11-02T19:00:40.955Z';
    const now = Date.parse(at) + 500;
    const s = await session(
        $,
        on,
        {},
        now,
        now + 20 * MIN,
        `${reworded(at)}\n`,
        100,
    );
    await endTurn($, '', 'error');
    expect(s.store['cap-seen']).toEqual([
        { at: now, isCapped: true, isUnread: true, text: '' },
    ]);
    expect(s.toasts).toEqual(['⏰ waker: an unrecognised cap — check FRM-488']);
});

test('an error end under 95 % with no cap signal logs no unread row and no toast', async ($, on) => {
    const s = await session(
        $,
        on,
        {},
        NOW,
        undefined,
        `${reworded('2026-11-02T19:00:40.955Z')}\n`,
        50,
    );
    await endTurn($, '', 'error');
    expect(s.store['cap-seen']).toEqual([
        { at: NOW, isCapped: false, text: '' },
    ]);
    expect(s.toasts).toEqual([]);
});
