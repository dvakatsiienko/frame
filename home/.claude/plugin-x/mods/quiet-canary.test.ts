import { expect, test } from 'vitest';

import { canaryState, deadlineOf } from './quiet-canary.ts';

const line = (verdict: string, canary?: string) => ({
    at: 1,
    from: 'frame-5e',
    verdict,
    ...(canary ? { canary } : {}),
});

test('a nonce with no log line reads none', () => {
    expect(canaryState({ 'quiet-log:2026-10-12': [line('held')] }, 'c1')).toBe(
        'none',
    );
});

test('a held nonce reads held', () => {
    expect(
        canaryState({ 'quiet-log:2026-10-12': [line('held', 'c1')] }, 'c1'),
    ).toBe('held');
});

test('a flushed line beats its held one, across two days', () => {
    expect(
        canaryState(
            {
                'quiet-log:2026-10-12': [line('held', 'c1')],
                'quiet-log:2026-10-13': [line('flushed', 'c1')],
            },
            'c1',
        ),
    ).toBe('flushed');
});

test("another nonce's lines and other keys are ignored", () => {
    expect(
        canaryState(
            {
                'quiet-gap': { gaps: [] },
                'quiet-log:2026-10-12': [
                    line('flushed', 'c2'),
                    line('held', 'c1'),
                ],
            },
            'c1',
        ),
    ).toBe('held');
});

test('the deadline reads 12 bare, n after --deadline, undefined for anything else', () => {
    expect(
        [
            [],
            ['--deadline', '3'],
            ['--nope'],
            ['--deadline'],
            ['--deadline', '0'],
            ['x', '--deadline', '3'],
        ].map(deadlineOf),
    ).toEqual([12, 3, undefined, undefined, undefined, undefined]);
});
