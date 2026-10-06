import { expect, mock, test } from 'claude-code/testing';

test("a day's refusals and escapes are counted past the kept events", async ($, on) => {
    mock.clock(on, { now: new Date(2026, 9, 6, 12).getTime() });
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
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', () => ({ result: {}, text: 'ran' }));
    for (const command of ['rm a', 'rm b', 'rm c # dima-ok: c'])
        await $.tool.call({ command, tool: 'Bash' });
    expect(store.get('day:2026-10-06:a1a1a1a1-0000')).toEqual({
        escaped: 1,
        refused: 2,
    });
});
