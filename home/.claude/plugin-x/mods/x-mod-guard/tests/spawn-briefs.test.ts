import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

const MISSING = '`home/.claude/nope.md`';
const GUESSED = '`nope.md`';
const ABSENT = '`/Users/x/bytes/nope.md`';
const QUIZ = "matt's `to-tickets`";

// a stand-in for x brief check's answer: a finding per line, `line N: <kind> <what> — <why>`, as brief.go prints them
function checkAnswer(text: string) {
    const found = [
        text.includes(MISSING) &&
            'line 1: path home/.claude/nope.md — no such path in the repo',
        text.includes(ABSENT) &&
            'line 1: path /Users/x/bytes/nope.md — no such path',
        text.includes(GUESSED) &&
            'line 1: path nope.md — no such path in the repo',
        text.includes(QUIZ) &&
            !/\bskip\b[^\n]*\bquiz/i.test(text) &&
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

function world(on: On, check: 'answers' | 'breaks' = 'answers') {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const checked: string[] = [];
    const logs: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', (_$, e) => {
        logs.push(String(e.text));
        return { value: undefined };
    });
    on('process.run', (_$, e) => {
        const stdin = e.init?.stdin ?? '';
        if (e.argv[0] === 'x') checked.push(stdin);
        const answer = checkAnswer(stdin);
        return {
            value: {
                exitCode:
                    check === 'breaks' ? 2 : JSON.parse(answer).ok ? 0 : 1,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: check === 'breaks' ? 'panic: boom' : answer,
            },
        };
    });
    on('agent.spawn', () => ({ agentId: 'sub-1', model: 'claude-opus-5-5' }));
    on('session.send', () => ({ isDelivered: true }));
    return { checked, logs, store };
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

const send = ($: Engine, text: string) =>
    $.session.send({
        origin: { kind: 'model' },
        text,
        to: '☕️ 🔧 FRM-1 code: x',
    });

test('an agent brief naming a missing path is refused with the path', async ($, on) => {
    world(on);
    const r = await spawn($, `FRM-1: read ${MISSING} first`);
    expect(r.deny).toContain('home/.claude/nope.md — no such path');
});

test('a refused agent brief leaves a refused event under the brief rule', async ($, on) => {
    const { store } = world(on);
    await spawn($, `FRM-1: read ${MISSING} first`);
    const events = [...store.entries()]
        .filter(([k]) => k.startsWith('event:'))
        .map(([, v]) => v);
    expect(events).toMatchObject([{ kind: 'refused', rule: 'brief' }]);
});

test('an agent brief guessing a bare file name is checked and refused', async ($, on) => {
    world(on);
    const r = await spawn($, `read ${GUESSED} and say its first line`);
    expect(r.deny).toContain('nope.md — no such path');
});

test('the same agent brief with the path fixed runs once checked', async ($, on) => {
    const { checked, logs } = world(on);
    const r = await spawn($, 'FRM-1: read `home/.claude/CLAUDE.md` first');
    expect([r.deny, checked.length, logs]).toEqual([undefined, 1, []]);
});

test('an agent brief naming to-tickets with no skip line is refused naming the quiz', async ($, on) => {
    world(on);
    const r = await spawn($, `cut the spec with ${QUIZ}`);
    expect(r.deny).toContain('quiz to-tickets');
});

test('an agent brief naming to-tickets with a skip line runs once checked', async ($, on) => {
    const { checked, logs } = world(on);
    const r = await spawn($, `cut the spec with ${QUIZ}\nskip its quiz step`);
    expect([r.deny, checked.length, logs]).toEqual([undefined, 1, []]);
});

test('a plain agent brief with no id and no path runs unchecked', async ($, on) => {
    const { checked } = world(on);
    const r = await spawn($, 'summarise the last three commits');
    expect([r.deny, checked]).toEqual([undefined, []]);
});

test('a backticked code term the repo lacks never refuses', async ($, on) => {
    const { checked, logs } = world(on);
    const r = await spawn($, 'FRM-1: mutate `const z = 1;` and rerun');
    expect([r.deny, checked.length, logs]).toEqual([undefined, 1, []]);
});

test('a brief check that breaks lets the agent run', async ($, on) => {
    world(on, 'breaks');
    const r = await spawn($, `FRM-1: read ${MISSING} first`);
    expect(r.deny).toBeUndefined();
});

test('a message naming a skill and a missing path is sent unchecked', async ($, on) => {
    const { checked } = world(on);
    const r = await send($, `FRM-1 round 1: ${QUIZ} and ${MISSING} came up`);
    expect([r.isDelivered, checked]).toEqual([true, []]);
});

test('a relative path the repo lacks is refused with the other-repo hint', async ($, on) => {
    world(on);
    const r = await spawn($, `FRM-1: read ${MISSING} first`);
    expect(r.deny).toContain(
        'a path from another repo: write it absolute or ~/',
    );
});

test('a missing absolute path is refused without the other-repo hint', async ($, on) => {
    world(on);
    const r = await spawn($, `FRM-1: read ${ABSENT} first`);
    expect([
        r.deny?.includes('no such path'),
        r.deny?.includes('another repo'),
    ]).toEqual([true, false]);
});

test('a relative miss after an absolute one still gets the other-repo hint', async ($, on) => {
    world(on);
    const r = await spawn($, `FRM-1: read ${ABSENT} and ${GUESSED}`);
    expect(r.deny).toContain(
        'a path from another repo: write it absolute or ~/',
    );
});
