import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// the «held the foreground» hint is gone (FRM-428): 197 of 643 calls got it, 82 % under 30 s, none moved
function world(on: On, takes: number) {
    const clock = mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/home/frame/x/go' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', async () => {
        await clock.advance(takes);
        return { result: {}, text: 'ran' };
    });
    return store;
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: false, tool: 'Bash' });

test('a foreground call that held over a minute leaves no hint and no memory', async ($, on) => {
    const store = world(on, 90_000);
    await bash($, 'go test -count=1 ./...');
    const second = await bash($, 'go test -count=1 ./...');
    expect([
        (second.context ?? []).filter((l) => l.includes('held the foreground')),
        [...store.keys()].filter((k) => k.startsWith('slow:')),
    ]).toEqual([[], []]);
});
