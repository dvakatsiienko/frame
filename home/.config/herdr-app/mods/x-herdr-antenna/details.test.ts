import { describe, expect, test } from 'vitest';

import { activityShown, rowDetails } from './details.js';

// FRM-618 slice A exit 2: each row detail off in turn, that detail alone leaves the row
const facts = {
    context: 42,
    model: 'opus 5.5',
    time: 'idle 3m',
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
        expect(rowDetails(allOn, facts)).toEqual({
            context: '42%',
            idle: 'idle 3m',
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
        const shown = rowDetails({ ...allOn, [knob]: false }, facts);
        expect(shown).toEqual({
            ...rowDetails(allOn, facts),
            [detail]: null,
        });
    });

    test('a fact never read draws nothing, never a zero', () => {
        expect(
            rowDetails(allOn, {
                context: null,
                model: null,
                time: null,
                wait: null,
            }),
        ).toEqual({ context: null, idle: null, model: null, wait: null });
    });
});

// FRM-618 slice D exit 2: a row's dot and its time come from the thread's state file, never herdr's own status
describe("a row's activity from the state file", () => {
    const at = 100 * 60_000;
    test('working breathes and carries no time', () => {
        expect(
            activityShown('idle', { since: at - 60_000, state: 'working' }, at),
        ).toEqual({ dot: 'working', time: null });
    });

    test('waiting 3 min shows its own still dot and «waiting 3m»', () => {
        expect(
            activityShown(
                'working',
                { since: at - 3 * 60_000, state: 'waiting' },
                at,
            ),
        ).toEqual({ dot: 'waiting', time: 'waiting 3m' });
    });

    test('idle 54 min shows the idle dot and «idle 54m»', () => {
        expect(
            activityShown(
                'working',
                { since: at - 54 * 60_000, state: 'idle' },
                at,
            ),
        ).toEqual({ dot: 'idle', time: 'idle 54m' });
    });

    test('a thread with no live state file draws idle with no time', () => {
        expect(activityShown('working', null, at)).toEqual({
            dot: 'idle',
            time: null,
        });
    });

    test('a permission prompt still asks for him', () => {
        expect(
            activityShown('blocked', { since: at, state: 'working' }, at),
        ).toEqual({ dot: 'blocked', time: null });
    });
});
