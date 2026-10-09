import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('env.get', () => ({ value: '/home' }));
    on('agent.spawn', () => ({ agentId: 'sub-1', model: 'claude-opus-5-5' }));
    return { store };
}

const spawn = (
    $: Engine,
    subagentType: string,
    description: string,
    prompt: string,
) =>
    $.agent.spawn({
        background: false,
        description,
        fork: subagentType === 'fork',
        parentModel: 'claude-opus-5-5',
        prompt,
        provider: { plugin: 'engine', tier: 'core' },
        subagentType,
        tool_use_id: 'tu-1',
    });

test('a fork with no why-fork line is refused with a fresh agent and helper', async ($, on) => {
    world(on);
    const r = await spawn(
        $,
        'fork',
        'digest the evergreen run',
        'read the log and summarise it',
    );
    expect(r.deny).toContain('a fresh agent');
    expect(r.deny).toContain('or helper for a mechanical job');
});

test('a fork with a why-fork line runs', async ($, on) => {
    world(on);
    const r = await spawn(
        $,
        'fork',
        'audit the branch',
        'why-fork: the branch state we found this session\naudit what is left',
    );
    expect(r.agentId).toBe('sub-1');
});

test('a fresh agent is left alone', async ($, on) => {
    world(on);
    const r = await spawn(
        $,
        'general-purpose',
        'find the callers',
        'find every caller of parse()',
    );
    expect(r.agentId).toBe('sub-1');
});

test('a refused fork is kept as a guard event', async ($, on) => {
    const w = world(on);
    await spawn($, 'fork', 'digest the evergreen run', 'read the log');
    expect([...w.store.values()][0]).toMatchObject({
        command: 'fork: digest the evergreen run',
        kind: 'refused',
        target: 'why-fork',
    });
});
