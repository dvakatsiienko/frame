import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { clioAddress, peerPing } from '../hooks/register.tsx';

// quiet comms (PK-93): a member's [progress] ping is held in clio's thread, everything else passes

const SID = 'q1q1q1q1-clio';
// 2026-10-12 is an even day: the a/b arm is on unless switched
const EVEN = new Date(2026, 9, 12, 15, 0).getTime();
const ODD = new Date(2026, 9, 13, 15, 0).getTime();
const MIN = 60_000;

const PID = 4242;

// clio by default, as the registry names her; `cwd` is where a Bash `cd` left her
function world(
    on: On,
    {
        cwd = '/home/frame/_clio',
        name = '🦉 clio',
        now = EVEN,
        // files beside the registry (crow's relay), and other live sessions as cc writes their registry files
        files = {} as Record<string, string>,
        peers = [] as Record<string, unknown>[],
        // a test's own answer to a process run, before the default one
        run = (_argv: readonly string[]): string | number | undefined =>
            undefined,
        // a store write the test makes fail
        refuseSet = (_key: string): boolean => false,
        // what a SendMessage answers
        sent = { message: 'delivered', success: true } as Record<
            string,
            unknown
        >,
        // what happens while a send is on its way
        whileSending = async (): Promise<void> => {},
    } = {},
) {
    for (const p of peers)
        files[`/home/.claude/sessions/${p.pid}.json`] = JSON.stringify(p);
    const contexts: string[][] = [];
    const appended: string[] = [];
    const queued: string[] = [];
    const clock = mock.clock(on, { now });
    const store = new Map<string, unknown>();
    on('store.get', (_$, e) => ({ value: store.get(e.key) }));
    on('store.set', (_$, e) => {
        if (refuseSet(e.key)) return { deny: 'disk full' };
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
    const logged: string[] = [];
    on('process.run', (_$, e) => {
        const own = run(e.argv);
        if (own !== undefined)
            return {
                value: {
                    exitCode: typeof own === 'number' ? own : 0,
                    isStderrTruncated: false,
                    isStdoutTruncated: false,
                    stderr: '',
                    stdout: typeof own === 'string' ? own : '',
                },
            };
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    e.argv[0] === 'ps'
                        ? [PID, ...peers.map((p) => p.pid)].join('\n')
                        : `${PID}\nMon Oct 12 15:00:00 2026\n`,
            },
        };
    });
    on('fs.write', (_$, e) => {
        files[e.path] = e.text;
        return { value: undefined };
    });
    on('fs.read', (_$, e) =>
        e.path === `/home/.claude/sessions/${PID}.json`
            ? { value: JSON.stringify({ name, pid: PID, sessionId: SID }) }
            : e.path in files
              ? { value: files[e.path] ?? '' }
              : { deny: 'no such file' },
    );
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', (_$, e) => {
        logged.push(String(e.text));
        return { value: undefined };
    });
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}));
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    on('session.repo', () => ({
        value: { internal: false, name: null, remote: null, root: '/tmp' },
    }));
    on('fs.list', (_$, e) => ({
        value:
            e.path === '/home/.claude/sessions'
                ? [PID, ...peers.map((p) => p.pid)].map((pid) => ({
                      isLink: false,
                      kind: 'file' as const,
                      mtimeMs: 0,
                      name: `${pid}.json`,
                      size: 1,
                  }))
                : [],
    }));
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
    on('tool.call', async () => {
        await whileSending();
        return { result: sent, text: 'done' };
    });
    on('turn.complete', () => ({ text: '' }));
    on('classic.Stop', () => ({}));
    on('skill.prompt', (_$, e) => ({ text: e.text }));
    return { appended, clock, contexts, logged, queued, store };
}

const start = ($: Engine) =>
    $.session.start({ cwd: '/tmp', isInteractive: true, surface: 'desktop' });

// a cli member's message as the bridge delivers it
const ping = ($: Engine, body: string, from = '☕️ 🔧 codie: mods') =>
    $.session.receive({
        origin: { kind: 'peer' },
        text: `<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="${from}" from-mode="bypass">\n${body}\n</cross-session-message>`,
    });

const say = ($: Engine, text: string) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text, wait: false });

const send = ($: Engine, to: string, message: string) =>
    $.tool.call({ message, to, tool: 'SendMessage' } as never) as Promise<{
        context?: string[];
        result: { message: string; success: boolean };
    }>;

const quiet = ($: Engine, args: string) =>
    $.command.run({ args, command: 'quiet' } as never);

const held = (w: ReturnType<typeof world>) =>
    (w.contexts.at(-1) ?? []).filter((c) => c.startsWith('🤫 quiet comms'));

/* the hold */

test("a [progress] ping in clio's thread is taken: not queued, no turn", async ($, on) => {
    const w = world(on);
    await start($);
    const r = await ping($, '[progress] step 2 of 5 landed');
    expect([r.consumed !== undefined, w.queued, w.contexts]).toEqual([
        true,
        [],
        [],
    ]);
});

// FRM-501: a push tag opens the message, an emoji before it counts; a tag is exact, and nothing else pushes by its look
for (const body of [
    '[ask] a or b?',
    '[done] FRM-1 landed',
    '[escalate] the gate refuses',
    '[🪜 escalate] the gate refuses',
    '🪜 [escalate] the gate refuses',
    '🚨 [ask] a or b?',
    '🐦‍🔥 [done] landed',
    'a cut for dima to pick',
    'do not merge this for dima to pick',
    'no tests\nfor dima: the cut',
    'For Dima: a cut',
    '[progress] step 2 landed. for dima: the cut',
])
    test(`pushes, starts a turn: ${body}`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await ping($, body);
        expect([r.consumed, w.queued.length]).toEqual([undefined, 1]);
    });

for (const body of [
    'step 2 landed',
    'landed [done] at last',
    'see [ask] below',
    '[Ask] a or b?',
    '[DONE] landed',
    'ask: a or b?',
    '[progress] step 2 landed',
    "blocked: can't push",
    '🪜 [progress] step 1 landed',
    '[blocked] the gate refuses',
    'final on abc1234',
    'round 2 on abc1234',
    'wrote /tmp/for dima/notes.md',
    'wrote ~/x/for-dima.md',
    'see `for dima` in the spec',
    'nothing for dima',
    'nothing here for dima',
    'step 2. decisions: none',
    'pick: a',
    'your call',
])
    test(`held, no turn: ${body}`, async ($, on) => {
        const w = world(on);
        await start($);
        const r = await ping($, body);
        expect([r.consumed !== undefined, w.queued, w.contexts]).toEqual([
            true,
            [],
            [],
        ]);
    });

for (const member of ['🐦 ⬛ crow', '🎀 helga', '🦉 clio (side)'])
    test(`an untagged line from ${member} is held`, async ($, on) => {
        const w = world(on);
        await start($);
        await ping($, 'a note', member);
        expect(w.queued).toEqual([]);
    });

test('a held message reaches clio whole, every line of it', async ($, on) => {
    const w = world(on);
    await start($);
    const long = `the third line ${'x'.repeat(400)}`;
    await ping($, `a finding\nthe second line\n${long}`);
    await say($, 'status?');
    expect(held(w).join('\n')).toContain(`the second line\n${long}`);
});

/* an answer to clio */

const CODIE = {
    hostSessionId: 'local_codie',
    name: '☕️ 🔧 codie: mods',
    pid: 71,
    sessionId: 'codie-sid',
};
const answering = (on: On) => world(on, { peers: [CODIE] });

for (const to of [
    '☕️ 🔧 codie: mods',
    '☕️ 🔧 codie: mods [a1b2c3]',
    'local_codie',
    'uds:/tmp/cc-socks/71.sock',
])
    test(`a member's first message after clio asked ${to} a question starts a turn`, async ($, on) => {
        const w = answering(on);
        await start($);
        await send($, to, 'which one?');
        await w.clock.advance(5 * MIN);
        await ping($, 'the second one');
        expect(w.queued).toHaveLength(1);
    });

test('a second message after the answer is held', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, 'the second one');
    await ping($, 'and step 3 landed');
    expect(w.queued).toHaveLength(1);
});

test('a [progress] neither pushes nor spends the slot, so the answer after it wakes her', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, '[progress] step 1 landed');
    const before = w.queued.length;
    await ping($, 'the second one');
    expect([before, w.queued.length]).toEqual([0, 1]);
});

for (const write of [
    'greenlit',
    'greenlit, see `which one?`',
    'greenlit, see https://x.test/a?b=1',
])
    test(`an untagged message after «${write}» is held`, async ($, on) => {
        const w = answering(on);
        await start($);
        await send($, CODIE.name, write);
        await ping($, 'step 1 landed');
        expect(w.queued).toEqual([]);
    });

test('a [progress] behind an emoji spends no slot either', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, '🪜 [progress] step 1 landed');
    await ping($, 'the second one');
    expect(w.queued).toHaveLength(1);
});

test('a question by the name with another mode emoji still opens the slot', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, '🌗 🔧 codie: mods', 'which one?');
    await ping($, 'the second one');
    expect(w.queued).toHaveLength(1);
});

test('a push spends the slot too', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, '[ask] a or b?');
    await ping($, 'step 1 landed');
    expect(w.queued).toHaveLength(1);
});

test('a first message past 30 min is held', async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await w.clock.advance(31 * MIN);
    await ping($, 'the second one');
    expect(w.queued).toEqual([]);
});

test("clio's question to one member opens nothing for another", async ($, on) => {
    const w = answering(on);
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, 'the second one', '🔎 sixth sense');
    expect(w.queued).toEqual([]);
});

test('a question that did not land opens no slot', async ($, on) => {
    const w = world(on, {
        peers: [CODIE],
        sent: { message: 'no such session', success: false },
    });
    await start($);
    await send($, CODIE.name, 'which one?');
    await ping($, 'the second one');
    expect(w.queued).toEqual([]);
});

/* the sender's line */

const CLIO = {
    hostSessionId: 'local_clio',
    name: '🦉 clio',
    pid: 70,
    sessionId: 'clio-sid',
};
const MEMBER = '⚡ 🔧 codie: mods';
const SLIPSTREAMED =
    "slipstreamed: joins clio's next turn. push only for a lane fully ready, a dispute, an escalation or a roadblock: lead with [ask], [done] or [escalate]";
const PUSHED =
    "pushed: starts clio's turn. push only for a lane fully ready, a dispute, an escalation or a roadblock: lead with [ask], [done] or [escalate]";
const REFUSED = {
    message:
        'Not delivered to Claude Desktop session local_clio: "that session did not accept it (messages from other sessions can require approval there, or be turned off)". (delivery: undelivered)',
    success: false,
};
const member = (on: On, sent?: Record<string, unknown>) =>
    world(on, {
        name: MEMBER,
        peers: [CLIO],
        ...(sent ? { sent } : {}),
    });

for (const to of [
    '🦉 clio',
    '🦉 clio [498790]',
    'clio',
    'local_clio',
    'uds:/tmp/cc-socks/70.sock',
    'clio-sid',
])
    test(`a send to ${to} carries the contract, no skill loaded`, async ($, on) => {
        member(on);
        await start($);
        const r = await send($, to, "blocked: can't push");
        expect(r.context).toContain(SLIPSTREAMED);
    });

for (const to of ['⚡ 🔧 codie: clio-lean', '🦉 clio (side)', 'local_other'])
    test(`a send to ${to} carries no contract`, async ($, on) => {
        member(on);
        await start($);
        const r = await send($, to, 'hi');
        expect(r.context ?? []).not.toContain(SLIPSTREAMED);
    });

test('a [blocked] opening is told how to push', async ($, on) => {
    member(on);
    await start($);
    const r = await send($, '🦉 clio', '[blocked] the gate refuses');
    expect(r.context?.join()).toContain('[escalate]');
    expect(r.context).toContain(SLIPSTREAMED);
});

test('a push reads as pushed, never as slipstreamed', async ($, on) => {
    member(on);
    await start($);
    const r = await send($, '🦉 clio', '[escalate] the gate refuses');
    expect(r.context).toContain(PUSHED);
    expect(r.context).not.toContain(SLIPSTREAMED);
});

test('an answer inside the window reads as pushed', async ($, on) => {
    const w = member(on);
    await start($);
    w.store.set('quiet-asked', { '🔧codie:mods': EVEN - MIN });
    const r = await send($, '🦉 clio', 'the second one');
    expect(r.context).toContain(PUSHED);
});

test('with the switch off a send carries no contract', async ($, on) => {
    const w = member(on);
    await start($);
    w.store.set('quiet-comms', false);
    const r = await send($, '🦉 clio', 'step 2');
    expect(r.context ?? []).not.toContain(SLIPSTREAMED);
});

const heldLine = (from: string, at: number) => ({
    arm: 'on',
    at,
    from,
    startedTurn: false,
    tag: 'none',
    verdict: 'held',
});
const DAY = new Date(EVEN).toISOString().slice(0, 10);

test('a held message reads as held to its sender, never as refused', async ($, on) => {
    const w = member(on, REFUSED);
    await start($);
    w.store.set(`quiet-log:${DAY}`, [heldLine(MEMBER, EVEN)]);
    const r = await send($, '🦉 clio', 'step 2 landed');
    expect(r.result).toEqual({
        message: "held, delivered at clio's next turn",
        success: true,
    });
});

for (const [who, name, to] of [
    ['a member', MEMBER, '🦉 clio'],
    ['clio', '🦉 clio', CODIE.name],
] as const)
    test(`${who}'s send keeps the turn's other notes`, async ($, on) => {
        const w = world(on, { name, peers: [CLIO, CODIE] });
        await start($);
        await say($, 'go');
        w.store.set(`wind:${SID}`, { at: EVEN, state: 'asked' });
        const r = await send($, to, 'hi');
        expect(r.context?.some((c) => c.includes('second wind'))).toBe(true);
    });

test('a send held across midnight still reads as held', async ($, on) => {
    const late = new Date(EVEN);
    late.setUTCHours(23, 59, 59, 900);
    const after = late.getTime() + 200;
    const nextDay = new Date(after).toISOString().slice(0, 10);
    const w = world(on, {
        name: MEMBER,
        now: late.getTime(),
        peers: [CLIO],
        sent: REFUSED,
        whileSending: async () => {
            w.store.set(`quiet-log:${nextDay}`, [heldLine(MEMBER, after)]);
            await w.clock.set(after);
        },
    });
    await start($);
    const r = await send($, '🦉 clio', 'step 2 landed');
    expect(r.result.success).toBe(true);
});

test('a refusal with no held line stays a refusal', async ($, on) => {
    const w = member(on, REFUSED);
    await start($);
    w.store.set(`quiet-log:${DAY}`, [heldLine('🔎 sixth sense', EVEN)]);
    const r = await send($, '🦉 clio', 'step 2 landed');
    expect(r.result).toEqual(REFUSED);
});

test('an older held line of the same member leaves a refusal a refusal', async ($, on) => {
    const w = member(on, REFUSED);
    await start($);
    w.store.set(`quiet-log:${DAY}`, [heldLine(MEMBER, EVEN - MIN)]);
    const r = await send($, '🦉 clio', 'step 2 landed');
    expect(r.result).toEqual(REFUSED);
});

test("clio cd'd out of ~/frame/_clio still holds a [progress] ping", async ($, on) => {
    const w = world(on, { cwd: '/home/frame/home/.claude/plugin-x/mods' });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test('a session the registry names other than clio passes a [progress] ping, even in her dir', async ($, on) => {
    const w = world(on, { name: '☕️ 🔧 codie: mods' });
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

/* the switch: on by default, every day, /quiet off reverts */

test('quiet holds on an odd day too, with no switch set', async ($, on) => {
    const w = world(on, { now: ODD });
    await start($);
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test('/quiet off passes a [progress] ping', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toHaveLength(1);
});

test('/quiet on after off holds again', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await quiet($, 'on');
    await ping($, '[progress] step 2 landed');
    expect(w.queued).toEqual([]);
});

test('/quiet off is the same store switch the settings pane reads', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    expect(w.store.get('quiet-comms')).toBe(false);
});

test('the log names the arm from the switch', async ($, on) => {
    const w = world(on);
    await start($);
    await quiet($, 'off');
    await ping($, '[progress] a');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(
        (w.store.get(`quiet-log:${day}`) as Record<string, unknown>[]).map(
            (l) => l.arm,
        ),
    ).toEqual(['off']);
});

// the 🎛️ pane, mounted as the board mounts the pane: one press on the quiet switch
const settings = ($: Engine) =>
    $.ui.mount({
        component: 'Pane',
        plugin: 'x-mod-stash',
        props: {
            bodyColumns: 100,
            isFocused: true,
            placement: 'dock',
            scroll: { bodyRows: 40, offset: 0 },
            title: 'settings',
            view: {},
        },
        requestId: 'stash-settings',
        surface: 'desktop',
    });

test('the 🎛️ quiet switch turns quiet off, and a [progress] ping passes', async ($, on) => {
    const w = world(on);
    await start($);
    const pane = await settings($);
    await pane.press({ key: 'knob:quiet-comms' });
    await ping($, '[progress] step 2 landed');
    expect([w.store.get('quiet-comms'), w.queued.length]).toEqual([false, 1]);
});

/* the flush */

const gapNote = (w: ReturnType<typeof world>) =>
    (w.contexts.at(-1) ?? []).filter((c) =>
        c.startsWith('🤫 quiet-comms ledger'),
    );

test('a ledger gap rides the lane owner’s next prompt once, naming the member', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 }],
    });
    await start($);
    await say($, 'status?');
    const first = gapNote(w);
    await say($, 'and now?');
    expect([first, gapNote(w)]).toEqual([
        [
            '🤫 quiet-comms ledger: ☕️ 🔧 codie: mods sent you 2 pings and your quiet log holds 1: 1 skipped the hold, check its log line.',
        ],
        [],
    ]);
});

test('a standing gap of the same size after one more send and one more line is not told again', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 23, sent: 24 }],
    });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', {
        at: 2,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 24, sent: 25 }],
    });
    await say($, 'and now?');
    expect(gapNote(w)).toEqual([]);
});

test('a gap that closes and opens again is told again', async ($, on) => {
    const w = world(on);
    const gap = { from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 };
    w.store.set('quiet-gap', { at: 1, gaps: [gap] });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', { at: 2, gaps: [] });
    await say($, 'closed?');
    w.store.set('quiet-gap', { at: 3, gaps: [gap] });
    await say($, 'again?');
    expect(gapNote(w)).toHaveLength(1);
});

test('a gap that grows is told again', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-gap', {
        at: 1,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 2 }],
    });
    await start($);
    await say($, 'status?');
    w.store.set('quiet-gap', {
        at: 2,
        gaps: [{ from: '☕️ 🔧 codie: mods', logged: 1, sent: 3 }],
    });
    await say($, 'and now?');
    expect(gapNote(w)).toHaveLength(1);
});

test('held pings ride the next prompt as one hidden block, once', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed\nthe detail line');
    await ping($, '[progress] step 3 landed', '🔎 sixth sense');
    await say($, 'status?');
    const first = held(w).join('\n');
    await say($, 'and now?');
    expect([first, held(w)]).toEqual([
        expect.stringMatching(
            /2 held member pings.*☕️ 🔧 codie: mods: step 2 landed\n.*🔎 sixth sense: step 3 landed$/s,
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

test('a flush appends once, no turn', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, 'step 2 landed');
    await w.clock.advance(40 * MIN);
    expect([w.appended.length, w.queued, w.contexts]).toEqual([1, [], []]);
});

test('a line held after a flush gets its own, no sooner than the wait', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, 'step 2 landed');
    await w.clock.advance(11 * MIN);
    await ping($, 'step 3 landed');
    await w.clock.advance(9 * MIN);
    const before = w.appended.length;
    await w.clock.advance(2 * MIN);
    expect([before, w.appended.length]).toEqual([1, 2]);
});

test(
    '8 idle hours with one held line every 30 min: 16 appends, 0 turns',
    { timeoutMs: 120_000 },
    async ($, on) => {
        const w = world(on);
        await start($);
        for (let i = 0; i < 16; i++) {
            await ping($, `step ${i} landed`);
            await w.clock.advance(30 * MIN);
        }
        expect([w.appended.length, w.queued, w.contexts]).toEqual([16, [], []]);
    },
);

test('a wait set to 15 min holds the idle append past 10 and lands it after 15', async ($, on) => {
    const w = world(on);
    w.store.set('quiet-wait', 15);
    await start($);
    await ping($, '[progress] step 2 landed');
    await w.clock.advance(11 * MIN);
    const at11 = w.appended.length;
    await w.clock.advance(5 * MIN);
    expect([
        at11,
        w.appended.some((a) => a.includes('1 held member ping')),
    ]).toEqual([0, true]);
});

/* the log */

test('each delivery logs its sender, tag, verdict and whether it started a turn', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await ping($, '[done] landed', '🔎 sixth sense');
    const day = new Date(EVEN).toISOString().slice(0, 10);
    expect(
        (w.store.get(`quiet-log:${day}`) as Record<string, unknown>[]).map(
            (l) => [l.from, l.tag, l.verdict, l.startedTurn, l.arm],
        ),
    ).toEqual([
        ['☕️ 🔧 codie: mods', 'progress', 'held', false, 'on'],
        ['🔎 sixth sense', 'done', 'passed', true, 'on'],
    ]);
});

test("the held pings reach the store for clio's sessions row", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] a');
    await ping($, '[progress] b');
    expect(
        (
            w.store.get(`quiet-held:${SID}`) as { from: string; text: string }[]
        ).map((p) => [p.from, p.text]),
    ).toEqual([
        ['☕️ 🔧 codie: mods', 'a'],
        ['☕️ 🔧 codie: mods', 'b'],
    ]);
});

/* the envelope */

test('a desktop envelope names its sender with name=', () => {
    expect(
        peerPing(
            '<cross-session-message from="local_a1" name="🦉 clio">\n[ask] a or b?\n</cross-session-message>',
        ),
    ).toEqual({ body: '[ask] a or b?', from: '🦉 clio', tag: 'ask' });
});

/* the safety net (brief 6) */

const logOf = (w: ReturnType<typeof world>) =>
    (w.store.get(`quiet-log:${new Date(EVEN).toISOString().slice(0, 10)}`) ??
        []) as Record<string, unknown>[];

test('a throw inside the hold passes the ping and logs failed-open', async ($, on) => {
    const w = world(on);
    let isBroken = false;
    on('state.get', (_$, e, next) =>
        isBroken && e.key === 'mobile' ? { deny: 'boom' } : next(e),
    );
    await start($);
    isBroken = true;
    await ping($, '[progress] step 2 landed');
    expect([w.queued.length, logOf(w).map((l) => l.verdict)]).toEqual([
        1,
        ['failed-open'],
    ]);
});

test('a held list that does not save passes the ping, failed-open, nothing held', async ($, on) => {
    const w = world(on);
    let isBroken = false;
    on('state.set', (_$, e, next) =>
        isBroken && e.key === 'quiet' ? { deny: 'disk full' } : next(e),
    );
    await start($);
    isBroken = true;
    await ping($, '[progress] step 2 landed');
    expect([w.queued.length, logOf(w).map((l) => l.verdict)]).toEqual([
        1,
        ['failed-open'],
    ]);
});

test('a held line that does not log passes the ping and takes it back out of the held list', async ($, on) => {
    let isBroken = false;
    const w = world(on, {
        refuseSet: (key) => isBroken && key.startsWith('quiet-log:'),
    });
    await start($);
    isBroken = true;
    await ping($, '[progress] step 2 landed');
    expect([w.queued.length, w.store.get(`quiet-held:${SID}`)]).toEqual([
        1,
        [],
    ]);
});

test('a held ping that rides the next prompt logs flushed', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await say($, 'status?');
    expect(logOf(w).map((l) => l.verdict)).toEqual(['held', 'flushed']);
});

test('a held ping that lands as the idle row logs flushed', async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] step 2 landed');
    await w.clock.advance(11 * MIN);
    expect(logOf(w).map((l) => l.verdict)).toEqual(['held', 'flushed']);
});

test("a canary ping's held and flushed lines carry its nonce", async ($, on) => {
    const w = world(on);
    await start($);
    await ping($, '[progress] quiet canary c42: a test ping');
    await say($, 'status?');
    expect(logOf(w).map((l) => [l.verdict, l.canary])).toEqual([
        ['held', 'c42'],
        ['flushed', 'c42'],
    ]);
});

test('/quiet-canary sends clio a [progress] ping with its nonce', async ($, on) => {
    world(on, { name: '☕️ 🔧 codie: mods' });
    const sent: { to: string; text: string }[] = [];
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return { isDelivered: true };
    });
    await start($);
    const r = await $.command.run({
        args: 'c7',
        command: 'quiet-canary',
    } as never);
    expect([r.text, sent]).toEqual([
        'quiet canary c7: sent',
        [
            {
                text: '[progress] quiet canary c7: a test ping from /quiet-canary, nothing to do',
                to: '🦉 clio',
            },
        ],
    ]);
});

test('/quiet-canary says FAIL with the reason when the send bounces', async ($, on) => {
    world(on, { name: '☕️ 🔧 codie: mods' });
    on('session.send', () => ({ isDelivered: false, reason: 'not reachable' }));
    await start($);
    const r = await $.command.run({
        args: 'c7',
        command: 'quiet-canary',
    } as never);
    expect(r.text).toBe('quiet canary c7: FAIL, not reachable');
});

test('the ledger counts a send to clio by her name, her socket or her session id, wherever `to` sits', () => {
    const to = new RegExp(
        clioAddress({ pid: 35832, sids: ['local_a955'] }),
        'u',
    );
    const sent = (input: string) =>
        `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"SendMessage","input":${input}}]}}`;
    expect(
        [
            sent('{"to":"🦉 clio [271ab4]","message":"x"}'),
            sent(
                '{"summary":"s","to":"uds:/tmp/cc-socks/35832.sock","message":"x"}',
            ),
            sent('{"message":"x","to":"local_a955"}'),
            sent('{"to":"🔎 sixth sense","message":"clio said so"}'),
            sent('{"to":"uds:/tmp/cc-socks/999.sock","message":"x"}'),
        ].map((l) => to.test(l)),
    ).toEqual([true, true, true, false, false]);
});

/* brief 8 item 2: clio's thread sends crow's wake itself */

const RELAY = '/home/.local/state/crow/relay.json';
const CROW_SID = 'f9f9f9f9-crow';
const WAKE = JSON.stringify({
    id: 'w1',
    line: 'wake w1 · day · read the last 30 steps',
});
const crowPeer = { name: '🐦 ⬛ crow', pid: 777, sessionId: CROW_SID };

function relayWorld(on: On, delivered = true) {
    const files: Record<string, string> = { [RELAY]: WAKE };
    const sent: { to: unknown; text: string }[] = [];
    const w = world(on, { files, peers: [crowPeer] });
    on('session.send', (_$, e) => {
        sent.push({ text: e.text, to: e.to });
        return delivered
            ? { isDelivered: true }
            : { isDelivered: false, reason: 'not reachable' };
    });
    return { ...w, files, sent };
}

test("a parked crow wake goes to her session from clio's poll, and is marked sent", async ($, on) => {
    const w = relayWorld(on);
    await start($);
    await w.clock.advance(5000);
    expect([w.sent, JSON.parse(w.files[RELAY] ?? '{}').isSent]).toEqual([
        [{ text: 'wake w1 · day · read the last 30 steps', to: CROW_SID }],
        true,
    ]);
});

test('a wake that does not go out stays parked for the next poll', async ($, on) => {
    const w = relayWorld(on, false);
    await start($);
    await w.clock.advance(5000);
    expect(w.files[RELAY]).toBe(WAKE);
});

test('a wake already sent goes out once', async ($, on) => {
    const w = relayWorld(on);
    await start($);
    await w.clock.advance(5000);
    await w.clock.advance(5000);
    expect(w.sent.length).toBe(1);
});

/* o75: the quiet ledger's gaps and a stuck hold raise a native alarm */

const CODIE_SID = 'c0c0c0c0-codie';
const codiePeer = { name: '☕️ 🔧 codie: mods', pid: 778, sessionId: CODIE_SID };
// the send timestamps the ledger's transcript grep returns, local time like EVEN
const sendAt = (min: number) =>
    `2026-10-12T15:${String(min).padStart(2, '0')}:00.000`;

function alarmWorld(
    on: On,
    { notify = 'no-surface', osascript = 0, sends = [] as string[] } = {},
) {
    const scripted: string[] = [];
    const w = world(on, {
        peers: [codiePeer],
        run: (argv) => {
            if (argv[0] === 'osascript') {
                scripted.push(String(argv[3]));
                return osascript;
            }
            if (argv[0] === 'sh' && String(argv[2]).includes('SendMessage'))
                return sends.join('\n');
            return undefined;
        },
    });
    const notified: string[] = [];
    on('ui.notify', (_$, e) => {
        notified.push(e.text);
        if (notify === 'deny') return { deny: 'a hook refused it' };
        return {
            value:
                notify === 'sent'
                    ? { channel: 'ghostty' as const, isSent: true as const }
                    : {
                          isSent: false as const,
                          reason: notify as 'no-surface',
                      },
        };
    });
    return { ...w, notified, scripted };
}

test('a ledger gap raises one native alarm, through osascript when notify finds no surface', async ($, on) => {
    const w = alarmWorld(on, { sends: [sendAt(2), sendAt(3)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect([w.notified, w.scripted]).toEqual([
        ['☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0'],
        ['☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0'],
    ]);
});

test('a gap that closes and opens again alarms again', async ($, on) => {
    const sends = [sendAt(2)];
    const w = alarmWorld(on, { sends });
    await start($);
    await w.clock.advance(10 * MIN);
    sends.length = 0;
    await w.clock.advance(2 * MIN);
    sends.push(sendAt(2));
    await w.clock.advance(2 * MIN);
    expect(w.scripted.length).toBe(2);
});

test('a gap notify sends itself goes no further', async ($, on) => {
    const w = alarmWorld(on, { notify: 'sent', sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect([w.notified.length, w.scripted]).toEqual([1, []]);
});

test('a held ping stuck past the idle wait + 2 min raises one alarm', async ($, on) => {
    const w = alarmWorld(on);
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 13 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.clock.advance(3 * MIN);
    expect(w.scripted).toEqual([
        '1 held ping stuck 13 min, oldest from ☕️ 🔧 codie: mods',
    ]);
});

test('a held ping inside the idle wait + 2 min raises none', async ($, on) => {
    const w = alarmWorld(on);
    w.store.set(`quiet-held:${SID}`, [
        {
            at: EVEN - 11 * MIN,
            from: '☕️ 🔧 codie: mods',
            text: '[progress] a',
        },
    ]);
    await start($);
    await w.clock.advance(30_000);
    expect(w.notified).toEqual([]);
});

test('an alarm neither notify nor osascript can raise is logged, never thrown', async ($, on) => {
    const w = alarmWorld(on, { osascript: 1, sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect(
        w.logged.filter((l) => l.includes('quiet alarm not raised')),
    ).toEqual([
        'x-mod-stash: quiet alarm not raised (notify: no-surface; osascript: exit 1): ☕️ 🔧 codie: mods sent clio 1, her quiet log holds 0',
    ]);
});

test('a notify that rejects falls through to osascript, never thrown', async ($, on) => {
    const w = alarmWorld(on, { notify: 'deny', sends: [sendAt(2)] });
    await start($);
    await w.clock.advance(10 * MIN);
    expect(w.scripted.length).toBe(1);
});
