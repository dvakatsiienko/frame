import { describe, expect, test } from 'vitest';

import { pressLine, withBandPress } from './band-press.js';

describe('a press is one line of the band press file', () => {
    const now = Date.parse('2026-11-10T22:00:00Z');
    const day = 24 * 60 * 60 * 1000;

    test('wind and hot name their thread, waker and AFK do not', () => {
        expect(pressLine('hot', true, 'abc', now)).toEqual({
            at: now,
            button: 'hot',
            on: true,
            sid: 'abc',
        });
        expect(pressLine('afk', false, 'abc', now)).toEqual({
            at: now,
            button: 'afk',
            on: false,
        });
    });

    test('the override is fleet-wide: its line names no thread', () => {
        expect(pressLine('override', true, 'abc', now)).toEqual({
            at: now,
            button: 'override',
            on: true,
        });
    });

    test('a press is appended after the lines already there', () => {
        const old = `${JSON.stringify({ at: now - 5, button: 'waker', on: true })}\n`;
        const line = pressLine('afk', true, null, now);
        expect(withBandPress(old, line, now)).toBe(
            `${old}${JSON.stringify(line)}\n`,
        );
    });

    test('lines older than a day are trimmed, a broken line too', () => {
        const stale = JSON.stringify({
            at: now - day - 1,
            button: 'afk',
            on: true,
        });
        const line = pressLine('waker', true, null, now);
        expect(withBandPress(`${stale}\n{"half\n`, line, now)).toBe(
            `${JSON.stringify(line)}\n`,
        );
    });

    test('a missing file starts with the press', () => {
        const line = pressLine('hot', false, 'abc', now);
        expect(withBandPress(null, line, now)).toBe(
            `${JSON.stringify(line)}\n`,
        );
    });
});
