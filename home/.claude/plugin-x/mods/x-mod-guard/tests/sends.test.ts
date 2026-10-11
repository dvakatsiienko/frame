import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const MISSING = '`home/.claude/nope.md`';
const QUIZ = "matt's `to-tickets`";

// x brief check as it answers: a finding per line, `line N: <kind> <what> — <why>`
function brief(text: string) {
    const found = [
        text.includes(MISSING) &&
            'line 1: path home/.claude/nope.md — no such path in the repo',
        text.includes(QUIZ) &&
            !/skip/.test(text) &&
            "line 1: quiz to-tickets — its step waits on the user's approval; add a line that skips it («skip the quiz step of to-tickets»)",
        text.includes('`const z = 1;`') &&
            'line 1: term const z = 1; — appears nowhere in the repo',
    ].filter(Boolean);
    return found.length
        ? JSON.stringify({
              error: [
                  `${found.length} problems in the brief`,
                  ...found,
                  'a thing the brief asks to build passes with (new) right after it',
              ].join('\n'),
              ok: false,
          })
        : JSON.stringify({ data: { checked: 1 }, ok: true });
}

function world(on: On, x: 'answers' | 'breaks' = 'answers') {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const checked: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', (_$, e) => {
        const stdin = e.init?.stdin ?? '';
        if (e.argv[0] === 'x') checked.push(stdin);
        const isOk = x === 'answers' && !JSON.parse(brief(stdin)).error;
        return {
            value: {
                exitCode: x === 'breaks' ? 2 : isOk ? 0 : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: x === 'breaks' ? 'panic: boom' : brief(stdin),
            },
        };
    });
    on('agent.spawn', () => ({ agentId: 'sub-1', model: 'claude-opus-5-5' }));
    on('session.send', () => ({ isDelivered: true }));
    return { checked };
}

const spawn = ($: Engine, prompt: string) =>
    $.agent.spawn({
        background: false,
        description: 'a job',
        fork: false,
        parentModel: 'claude-opus-5-5',
        prompt,
        provider: { plugin: 'engine', tier: 'core' },
        subagentType: 'general-purpose',
        tool_use_id: 'tu-1',
    });

const send = ($: Engine, text: string, isPlugin = false) =>
    $.session.send({
        origin: isPlugin
            ? { kind: 'plugin', name: 'x-mod-stash' }
            : { kind: 'model' },
        text,
        to: '☕️ 🔧 FRM-1 code: x',
    });

test('an agent brief naming a missing path is refused with the path', async ($, on) => {
    world(on);
    const r = await spawn($, `FRM-1: read ${MISSING} first`);
    expect(r.deny).toContain('home/.claude/nope.md — no such path');
});

test('the same agent brief with the path fixed runs', async ($, on) => {
    world(on);
    const r = await spawn($, 'FRM-1: read `home/.claude/CLAUDE.md` first');
    expect(r.deny).toBeUndefined();
});

test('a message naming to-tickets with no skip line is refused naming the quiz', async ($, on) => {
    world(on);
    const r = await send($, `FRM-1: cut the spec with ${QUIZ}`);
    expect(r).toEqual({
        isDelivered: false,
        reason: expect.stringContaining('quiz to-tickets'),
    });
});

test('a message naming to-tickets with a skip line is sent', async ($, on) => {
    world(on);
    const r = await send(
        $,
        `FRM-1: cut the spec with ${QUIZ}\nskip its quiz step`,
    );
    expect(r.isDelivered).toBe(true);
});

test('a plain steer with no id and no path is sent unchecked', async ($, on) => {
    const { checked } = world(on);
    const r = await send($, 'nice, carry on with the next slice');
    expect([r.isDelivered, checked]).toEqual([true, []]);
});

test('a backticked code term the repo lacks never refuses', async ($, on) => {
    world(on);
    const r = await send($, 'round 2 on FRM-1: red under `const z = 1;`');
    expect(r.isDelivered).toBe(true);
});

test('a brief check that breaks lets the send through', async ($, on) => {
    world(on, 'breaks');
    const r = await send($, `FRM-1: read ${MISSING} first`);
    expect(r.isDelivered).toBe(true);
});

test('a brief check that breaks lets the agent run', async ($, on) => {
    world(on, 'breaks');
    const r = await spawn($, `FRM-1: read ${MISSING} first`);
    expect(r.deny).toBeUndefined();
});

test("a plugin's own send is never checked", async ($, on) => {
    const { checked } = world(on);
    const r = await send($, `FRM-1: read ${MISSING} first`, true);
    expect([r.isDelivered, checked]).toEqual([true, []]);
});
