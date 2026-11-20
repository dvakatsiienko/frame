import { describe, expect, test } from 'vitest';

import { rowDetails } from './details.js';

// FRM-618 slice A exit 2: each row detail off in turn, that detail alone leaves the row
const now = 10 * 60_000;
const facts = {
    context: 42,
    model: 'opus 5.5',
    since: now - 3 * 60_000,
    wait: 'waiting on 🦉 clio',
};
const allOn = {
    'antenna.details.context': true,
    'antenna.details.idle': true,
    'antenna.details.model': true,
    'antenna.details.wait': true,
};

describe('a row details', () => {
    test('every detail on: idle time, context fill and the wait line', () => {
        expect(rowDetails(allOn, facts, now)).toEqual({
            context: '42%',
            idle: '3m',
            model: 'opus 5.5',
            wait: 'waiting on 🦉 clio',
        });
    });

    test.each([
        ['antenna.details.idle', 'idle'],
        ['antenna.details.context', 'context'],
        ['antenna.details.model', 'model'],
        ['antenna.details.wait', 'wait'],
    ])('%s off: only %s leaves', (knob, detail) => {
        const shown = rowDetails({ ...allOn, [knob]: false }, facts, now);
        expect(shown).toEqual({
            ...rowDetails(allOn, facts, now),
            [detail]: null,
        });
    });

    test('a fact never read draws nothing, never a zero', () => {
        expect(
            rowDetails(
                allOn,
                { context: null, model: null, since: 0, wait: null },
                now,
            ),
        ).toEqual({ context: null, idle: null, model: null, wait: null });
    });
});
