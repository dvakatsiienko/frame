import { expect, mock, test } from 'claude-code/testing';

// a one-shot: it leaves with its code once the live store shows the keys gone
test('a session start drops the store keys no code reads and keeps the rest', async ($, on) => {
    mock.clock(on);
    const store = new Map<string, unknown>([
        ['steer-two', false],
        ['breath-ab', { hz: 60 }],
        ['catch-shelf', null],
        ['catch-count', null],
        ['waker', { on: false }],
        [
            'shown',
            {
                'stash.catch': false,
                'stash.chips': false,
                'stash.enhancer': false,
            },
        ],
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
    expect([[...store.keys()].sort(), store.get('shown')]).toEqual([
        ['shown', 'waker'],
        { 'stash.chips': false },
    ]);
});
