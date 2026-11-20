import { describe, expect, test } from 'vitest';

import { focusedLine } from './focused-line.js';

// FRM-618 slice A exit 5: with tabs hidden, the top bar names the focused thread and its wait line
const names = { t1: '🦉 clio', t2: '⚡ 🔧 herdr | FRM-618' };
const pids = { t1: 101, t2: 202 };
const deck = {
    at: 1,
    threads: {
        '101': { context: 50, wait: 'waiting on dima', week: null },
        '202': { context: 20, wait: null, week: null },
    },
};

describe('the top bar with tabs hidden', () => {
    test('the focused thread shows its name and its wait line', () => {
        expect(focusedLine('t1', names, pids, deck)).toEqual({
            name: '🦉 clio',
            wait: 'waiting on dima',
        });
    });

    test('a thread with no wait line shows its name alone', () => {
        expect(focusedLine('t2', names, pids, deck)).toEqual({
            name: '⚡ 🔧 herdr | FRM-618',
            wait: null,
        });
    });

    test('no focused thread, or one not named yet, draws nothing', () => {
        expect(focusedLine(null, names, pids, deck)).toBe(null);
        expect(focusedLine('t9', names, pids, deck)).toBe(null);
    });

    test('a deck not published yet leaves the name alone', () => {
        expect(focusedLine('t1', names, pids, null)).toEqual({
            name: '🦉 clio',
            wait: null,
        });
    });
});
