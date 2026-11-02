import { expect, mock, test } from 'claude-code/testing';

// a one-shot: it leaves with its code once the live store shows the keys gone
test('a session start drops the catch shelf keys of every day and owner, and keeps the rest', async ($, on) => {
    mock.clock(on);
    const store = new Map<string, unknown>([
        ['catch-count:2026-10-12', { clears: 1 }],
        ['catch-shelf:clio', []],
        ['catchy', 1],
        ['waker', { on: false }],
    ]);
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
    on('session.start', (_$, e) => ({ cwd: e.cwd }));
    await $.session.start({
        cwd: '/tmp',
        isInteractive: true,
        surface: 'terminal',
    });
    expect([...store.keys()].sort()).toEqual(['catchy', 'waker']);
});
