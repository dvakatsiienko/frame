import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// warn mode is the code's to give (WARN_ONLY), never the store's: a test cannot reach the hook's module, so the warn
// path is proven by red-proof listing a rule there, which turns the first test below red
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    on('agent.spawn', () => ({ agentId: 'sub-1', model: 'claude-opus-5-5' }));
    return { ran, store };
}

const kinds = (store: Map<string, unknown>) =>
    [...store.entries()]
        .filter(([k]) => k.startsWith('event:'))
        .map(([, v]) => (v as { kind: string }).kind);

const fork = ($: Engine) =>
    $.agent.spawn({
        background: false,
        description: 'audit',
        fork: true,
        parentModel: 'claude-opus-5-5',
        prompt: 'audit what is left',
        provider: { plugin: 'engine', tier: 'core' },
        subagentType: 'fork',
        tool_use_id: 'tu-1',
    });

test('a floor rule stays refused when the store says warn', async ($, on) => {
    const { ran, store } = world(on);
    store.set('rule-mode:rm', 'warn');
    const r = await $.tool.call({ command: 'rm -rf build', tool: 'Bash' });
    expect([ran, r.deny !== undefined]).toEqual([[], true]);
});

test('a rule with no mode set still refuses', async ($, on) => {
    const { ran } = world(on);
    const r = await $.tool.call({ command: 'rm -rf build', tool: 'Bash' });
    expect([ran, r.deny !== undefined]).toEqual([[], true]);
});
