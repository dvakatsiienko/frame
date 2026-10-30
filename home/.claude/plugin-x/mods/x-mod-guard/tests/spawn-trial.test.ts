import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-467: a start_session spawn is read by the gate that refuses a `claude --bg` spawn whose brief leaves a live trial
// unnamed (frame's script/test-drive-list.ts --spawn-hook); the gate's own answer is stood in for here
const REASON =
    'the brief misses live trials that fit a codie lane: fixture-trial';
const TOOL = 'mcp__ccd_session__start_session';

function world(on: On, gate: 'answers' | 'breaks' = 'answers') {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const asked: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('process.run', (_$, e) => {
        const command = String(
            JSON.parse(e.init?.stdin ?? '{}').tool_input?.command ?? '',
        );
        asked.push(command);
        const stdout =
            gate === 'breaks'
                ? 'panic: boom'
                : command.includes('/x:crew-codie') &&
                    !command.includes('fixture-trial')
                  ? JSON.stringify({
                        hookSpecificOutput: {
                            hookEventName: 'PreToolUse',
                            permissionDecision: 'deny',
                            permissionDecisionReason: REASON,
                        },
                    })
                  : '';
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
            },
        };
    });
    on('tool.call', () => ({ result: {}, text: 'started' }));
    return { asked, store };
}

const start = ($: Engine, prompt: string) =>
    $.tool.call({ initiation: 'user_asked', prompt, tool: TOOL } as never);

const UNNAMED = '/x:crew-codie FRM-1 do the job';

test('a spawn leaving a live trial unnamed runs warn-only, naming what it would refuse', async ($, on) => {
    world(on);
    const r = await start($, UNNAMED);
    expect([r.deny, r.context?.join('\n')]).toEqual([
        undefined,
        expect.stringContaining(`would refuse this (rule spawn-trial`),
    ]);
});

test('the warned spawn leaves a warned event under the spawn-trial rule', async ($, on) => {
    const { store } = world(on);
    await start($, UNNAMED);
    expect(
        [...store.entries()]
            .filter(([k]) => k.startsWith('event:'))
            .map(([, v]) => v),
    ).toMatchObject([{ kind: 'warned', rule: 'spawn-trial' }]);
});

test("with the rule enforced, the spawn is refused with the gate's own reason", async ($, on) => {
    const { store } = world(on);
    store.set('rule-mode:spawn-trial', 'enforce');
    const r = await start($, UNNAMED);
    expect(r.deny).toContain(REASON);
});

test('a spawn naming the trial runs with no note', async ($, on) => {
    world(on);
    const r = await start($, `${UNNAMED} fixture-trial`);
    expect([r.deny, r.context]).toEqual([undefined, undefined]);
});

test('the gate reads the prompt as the same command a --bg spawn would be', async ($, on) => {
    const { asked } = world(on);
    await start($, UNNAMED);
    expect(asked).toEqual([`claude --bg '${UNNAMED}'`]);
});

test('a single quote in the prompt reaches the gate quoted whole', async ($, on) => {
    const { asked } = world(on);
    await start($, "it's /x:crew-codie FRM-1");
    expect(asked).toEqual([`claude --bg 'it'\\''s /x:crew-codie FRM-1'`]);
});

test('a gate that breaks lets the spawn go', async ($, on) => {
    const { store } = world(on, 'breaks');
    store.set('rule-mode:spawn-trial', 'enforce');
    const r = await start($, UNNAMED);
    expect(r.deny).toBeUndefined();
});
