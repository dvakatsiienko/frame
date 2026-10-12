import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { peerPing } from '../hooks/register.tsx';

// quiet comms (PK-93): a member's [progress] ping is held in cclio's thread, everything else passes

const SID = 'q1q1q1q1-cclio';
// 2026-10-12 is an even day: the a/b arm is on unless switched
const EVEN = new Date(2026, 9, 12, 15, 0).getTime();
const ODD = new Date(2026, 9, 13, 15, 0).getTime();
const MIN = 60_000;

function world(on: On, { cwd = '/home/frame/cclio', now = EVEN } = {}) {
    const contexts: string[][] = [];
    const appended: string[] = [];
    const queued: string[] = [];
    const clock = mock.clock(on, { now });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', () => ({ value: [] }));
    on('tool.register', (_$, e) => ({
        value: { tool: `mcp__x-mod-stash__${e.name}` },
    }));
    on('session.receive', (_$, e) => {
        queued.push(e.text);
        return { text: e.text };
    });
    on('prompt.submit', (_$, e) => {
        contexts.push([...(e.context ?? [])]);
        return { text: e.text };
    });
    on('session.append', (_$, e, next) => {
        for (const b of e.message.content)
            if (b.type === 'text') appended.push(String(b.text));
        return next(e);
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    return { appended, clock, contexts, queued, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

// a cli member's message as the bridge delivers it
const ping = ($: Engine, body: string, from = '☕️ 🔧 coder: mods') =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${from}" from-mode="bypass">\n${body}\n</cross-session-message>`,
    });

const say = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });

const quiet = ($: Engine, args: string) =>
    $.command.run({ args, command: 'quiet' } as never);

const held = (w: ReturnType<typeof world>) =>
    (w.contexts.at(-1) ?? []).filter((c) => c.startsWith('🤫 quiet comms'));

/* the hold */

test("a [progress] ping in cclio's thread is taken: not queued, no turn", async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ping($, '[progress] step 2 of 5 landed');
    expect([r.consumed !== undefined, w.queued, w.contexts]).toEqual([
        true,
        [],
        [],
    ]);
});

test('a [done], [blocked] or [ask] ping passes', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[done] FRM-1 landed');
    await ping($, '[blocked] the gate refuses');
    await ping($, '[ask] a or b?');
    expect(w.queued).toHaveLength(3);
});

test('an untagged ping passes, never held blind', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, 'step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test("outside cclio's thread a [progress] ping passes", async ($, on) => {
    const w = world(on, { cwd: '/home/frame' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test('with mobile mode on nothing is held', async ($, on) => {
    const w = world(on);
    await start($);
    await $.skill.prompt({
        skill: 'x:mobile-mode',
        text: '# mobile-mode',
    } as never);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

/* the arm and the switch */

test('on an odd day the arm is off and a [progress] ping passes', async ($, on) => {
    const w = world(on, { now: ODD });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test("/quiet on beats an odd day's arm", async ($, on) => {
    const w = world(on, { now: ODD });
    await start($);
    await quiet($, 'on');
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test("/quiet off beats an even day's arm", async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

/* the flush */

test('held pings ride the next prompt as one hidden block, once', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed\nthe detail line');
    await ping($, '[progress] step 3 landed', '🔎 verifier');
    await say($, 'status?');
    const first = held(w).join('\n');
    await say($, 'and now?');
    expect([first, held(w)]).toEqual([
        expect.stringMatching(
            /2 held member pings.*☕️ 🔧 coder: mods: step 2 landed\n.*🔎 verifier: step 3 landed$/s,
        ),
        [],
    ]);
});

test('held pings older than 10 min while idle become one hidden row, no turn', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await w.clock.advance(11 * MIN);
    await say($, 'next');
    expect([
        w.appended.some((a) => a.includes('1 held member ping')),
        held(w),
    ]).toEqual([true, []]);
});

/* the log */

test('each delivery logs its sender, tag, verdict and whether it started a turn', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await ping($, '[done] landed', '🔎 verifier');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(
        (w.store.get(`quiet-log:${day}`) as Record<string, unknown>[]).map(
            (l) => [l.from, l.tag, l.verdict, l.startedTurn, l.arm],
        ),
    ).toEqual([
        ['☕️ 🔧 coder: mods', 'progress', 'held', false, 'on'],
        ['🔎 verifier', 'done', 'passed', true, 'on'],
    ]);
});

test("the held count reaches the store for cclio's sessions row", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] a');
    await ping($, '[progress] b');
    expect(w.store.get(`quiet-held:${SID}`)).toBe(2);
});

/* the envelope */

test('a desktop envelope names its sender with name=', () => {
    expect(
        peerPing(
            '<cross-session-message from="local_a1" name="🦉 cclio">\n[ask] a or b?\n</cross-session-message>',
        ),
    ).toEqual({ body: '[ask] a or b?', from: '🦉 cclio', tag: 'ask' });
});
