import { describe, expect, test } from 'vitest';

import { clockOf, relayIn, relayLine } from './relay.js';

const origin = {
    body: '  [ask] land now?\nsecond line  ',
    from: 'uds:/tmp/cc-socks/1.sock',
    kind: 'peer',
    msg_id: 'm1',
    name: '🦉 clio',
};

describe('a message from another thread is read from its transcript entry', () => {
    test('a meta user entry at a turn start', () => {
        expect(
            relayIn({
                isMeta: true,
                origin,
                timestamp: '2026-11-11T19:37:19.962Z',
                type: 'user',
            }),
        ).toEqual({
            at: '2026-11-11T19:37:19.962Z',
            dir: 'in',
            from: '🦉 clio',
            kind: 'relay',
            msgId: 'm1',
            text: '[ask] land now?\nsecond line',
        });
    });

    test('a queued command mid-turn', () => {
        expect(
            relayIn({
                attachment: { origin, prompt: '<x/>', type: 'queued_command' },
                type: 'attachment',
            })?.msgId,
        ).toBe('m1');
    });

    test('his own prompt, a plugin line or a task notice is not a relay', () => {
        expect(relayIn({ origin: { kind: 'human' }, type: 'user' })).toBeNull();
        expect(
            relayIn({ origin: { kind: 'plugin' }, type: 'user' }),
        ).toBeNull();
        expect(
            relayIn({
                attachment: {
                    origin: { kind: 'task-notification' },
                    type: 'queued_command',
                },
                type: 'attachment',
            }),
        ).toBeNull();
        expect(relayIn({ type: 'assistant' })).toBeNull();
        expect(relayIn(null)).toBeNull();
    });

    test('a peer origin without a body, or with no name, is guarded', () => {
        expect(relayIn({ origin: { kind: 'peer' }, type: 'user' })).toBeNull();
        expect(
            relayIn({ origin: { body: 'hi', kind: 'peer' }, type: 'user' })
                ?.from,
        ).toBe('another thread');
    });
});

describe('the folded line reads sender → receiver · first words · time', () => {
    const at = new Date(2026, 10, 11, 21, 7).toISOString();

    test('the first non-empty line, and the local time', () => {
        expect(
            relayLine({
                at,
                from: '🦉 clio',
                text: '\n[done] landed\nmore',
                to: 'herdr codie',
            }),
        ).toBe('🦉 clio → herdr codie · [done] landed · 21:07');
    });

    test('a long first line is cut at a word with an ellipsis', () => {
        const line = relayLine({
            at: null,
            from: 'a',
            text: 'word '.repeat(30),
            to: 'b',
        });
        expect(line.startsWith('a → b · word word')).toBe(true);
        expect(line.endsWith('word…')).toBe(true);
        expect(line.length).toBeLessThan(90);
    });

    test('no time and no words leave no empty parts', () => {
        expect(relayLine({ at: null, from: 'a', text: '', to: 'b' })).toBe(
            'a → b',
        );
        expect(clockOf('not a date')).toBe('');
    });
});
