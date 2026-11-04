import { expect, test } from 'vitest';

import { clioIdOf, withPace } from './pace-watch.ts';

test('off writes off on the key on wrote, so the default stays out', () => {
    const on = withPace({ waker: { on: false } }, 's1', true, 5);
    expect([on, withPace(on, 's1', false, 6)]).toEqual([
        { 'pace:s1': { since: 5 }, waker: { on: false } },
        { 'pace:s1': { off: true }, waker: { on: false } },
    ]);
});

test('the coordinator is the live row named 🦉 clio', () => {
    expect(
        clioIdOf(
            [
                { name: '🦉 clio', pid: 1, sessionId: 'dead' },
                { name: '🦉 clio (side)', pid: 2, sessionId: 'side' },
                { name: '🦉 clio', pid: 3, sessionId: 'main' },
            ],
            (pid) => pid !== 1,
        ),
    ).toBe('main');
});
