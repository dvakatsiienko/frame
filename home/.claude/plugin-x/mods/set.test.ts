import { expect, test } from 'vitest';

import { clioIdOf, numberSetting, withPace } from './set.ts';

test('a shift over a key never written ends with no key, so a seat default fills it', () => {
    const on = withPace({ waker: { on: false } }, 's1', true, 5);
    expect([on, withPace(on, 's1', false, 6)]).toEqual([
        { 'pace:s1': { since: 5 }, waker: { on: false } },
        { waker: { on: false } },
    ]);
});

test('a shift over a default-on clio ends on', () => {
    const on = withPace({ 'pace:s1': { on: true } }, 's1', true, 5);
    expect(withPace(on, 's1', false, 6)).toEqual({ 'pace:s1': { on: true } });
});

test('a second start keeps what the first found', () => {
    const one = withPace({ 'pace:s1': { off: true } }, 's1', true, 5);
    const two = withPace(one, 's1', true, 6);
    expect([two, withPace(two, 's1', false, 7)]).toEqual([
        { 'pace:s1': { since: 6, was: { off: true } } },
        { 'pace:s1': { off: true } },
    ]);
});

test('off with no shift running is a written off', () => {
    expect(withPace({ 'pace:s1': { on: true } }, 's1', false, 5)).toEqual({
        'pace:s1': { off: true },
    });
});

test('a number takes only a known key inside its range', () => {
    expect([
        numberSetting('pace-over', '7'),
        numberSetting('pace-over', '0'),
        numberSetting('pace-over', 'x'),
        numberSetting('nope', '7'),
    ]).toEqual([7, undefined, undefined, undefined]);
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
