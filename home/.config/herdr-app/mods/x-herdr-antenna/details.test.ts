import { describe, expect, test } from 'vitest';

import { activityShown, rowDetails, waitRuns, waitShown } from './details.js';

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

// a wait line is plain text in bold and regular runs, so a row's wait is never selectable (dima, 18:51)
describe('a wait line', () => {
    test('splits into bold and regular runs', () => {
        expect(waitRuns('waiting on **🔧 codie**, **🙋‍♂️ dima**')).toEqual([
            { isBold: false, text: 'waiting on ' },
            { isBold: true, text: '🔧 codie' },
            { isBold: false, text: ', ' },
            { isBold: true, text: '🙋‍♂️ dima' },
        ]);
    });

    test('with no bold is one regular run', () => {
        expect(waitRuns('waiting on the push')).toEqual([
            { isBold: false, text: 'waiting on the push' },
        ]);
    });
});

// FRM-618 rider E2: a 🔭 line never shows a raw shell command; a wait with a fleet name passes as it is
describe('a wait on a background command', () => {
    test('a raw command is cut at its first «=» or «/», keeping its first words', () => {
        expect(waitShown('waiting on npm run build --watch=1')).toBe(
            'waiting on npm run build --watch',
        );
        expect(waitShown('waiting on pnpm -C ~/frame test')).toBe(
            'waiting on pnpm -C ~',
        );
    });

    test('a cut that leaves almost nothing reads as a background task', () => {
        expect(
            waitShown('waiting on S=/private/tmp/claude-501/x; until [ +2'),
        ).toBe('waiting on a background task');
    });

    test("a row's wait line draws the cut, never the raw command", () => {
        expect(
            rowDetails(
                { 'antenna.details.wait': true },
                {
                    context: null,
                    model: null,
                    time: null,
                    wait: 'waiting on S=/private/tmp/x',
                },
            ).wait,
        ).toBe('waiting on a background task');
    });

    test('a wait naming a member or a plain task stays whole', () => {
        expect(waitShown('waiting on **⚡ 🔧 herdr | FRM-673**')).toBe(
            'waiting on **⚡ 🔧 herdr | FRM-673**',
        );
        expect(waitShown('Run the go done')).toBe('Run the go done');
    });

    test('a slash in plain words is no command', () => {
        expect(waitShown('waiting on 2/3 checks')).toBe(
            'waiting on 2/3 checks',
        );
        expect(waitShown('waiting on CI/CD')).toBe('waiting on CI/CD');
    });

    test('a capital «Waiting on» cuts the same', () => {
        expect(waitShown('Waiting on S=/tmp/x')).toBe(
            'waiting on a background task',
        );
    });
});
