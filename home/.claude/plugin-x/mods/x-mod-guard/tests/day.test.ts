import { expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

test("a day's refusals and escapes are counted past the kept events", async ($, on) => {
    mock.clock(on, { now: new Date(2026, 9, 6, 12).getTime() });
    const store = liveStore(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    for (const command of ['rm a', 'rm b', 'rm c # dima-ok: c'])
        await $.tool.call({ command, tool: 'Bash' });
    expect(store.get('day:2026-10-06:a1a1a1a1-0000')).toMatchObject({
        escaped: 1,
        refused: 2,
    });
});

test("a day's count names the rule behind each refusal and escape", async ($, on) => {
    mock.clock(on, { now: new Date(2026, 9, 6, 12).getTime() });
    const store = liveStore(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    for (const command of [
        'rm a',
        'git push -f origin x',
        'rm c # dima-ok: c',
        'pkill x',
    ])
        await $.tool.call({ command, tool: 'Bash' });
    expect(store.get('day:2026-10-06:a1a1a1a1-0000')).toMatchObject({
        rules: {
            'git-rewrite': { escaped: 0, refused: 1 },
            kill: { escaped: 0, refused: 1 },
            rm: { escaped: 1, refused: 1 },
        },
    });
});
