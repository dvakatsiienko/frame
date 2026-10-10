import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';

const config = [
    'statuses: ["open", "claimed", "waiting", "done"]',
    'labels: ["xs", "s", "m", "l"]',
    'priorities: ["now", "next", "later"]',
    'types: ["task", "idea"]',
].join('\n');

const today = '2026-10-09';

function task(
    fields: Record<string, string | string[]>,
    description = 'ticket: FRM-1',
) {
    const rows = Object.entries({
        id: 'PK-1',
        labels: ['m'],
        ordinal: '10000',
        priority: 'next',
        status: 'open',
        type: 'task',
        ...fields,
    }).map(([key, value]) =>
        Array.isArray(value)
            ? `${key}:\n${value.map((item) => `  - ${item}`).join('\n')}`
            : `${key}: '${value}'`,
    );
    return {
        name: 'pk-1.md',
        text: `---\n${rows.join('\n')}\n---\n\n## Description\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n${description}\n`,
    };
}

describe('checkPocket', () => {
    test('a task that follows the contract passes', () => {
        expect(checkPocket(config, [task({})], today)).toEqual([]);
    });

    test('an open task whose ticket linear closed goes red', () => {
        const pointing = task({}, 'body\nticket: FRM-371 (the guard rule)');
        expect(
            checkPocket(config, [pointing], today, new Set(['FRM-371'])),
        ).toEqual([
            'PK-1: its ticket FRM-371 is closed in linear: flip it to done',
        ]);
        expect(
            checkPocket(
                config,
                [task({ status: 'done' }, 'ticket: FRM-371')],
                today,
                new Set(['FRM-371']),
            ),
        ).toEqual([
            'PK-1: done but still listed: `backlog task complete` it this turn',
        ]);
    });

    test.each([
        ['an unknown status', { status: 'blocked' }, 'status «blocked»'],
        ['an unknown priority', { priority: 'urgent' }, 'priority «urgent»'],
        ['an unknown type', { type: 'chore' }, 'type «chore»'],
        ['no size label', { labels: [] as string[] }, 'exactly one size label'],
        ['two size labels', { labels: ['s', 'm'] }, 'exactly one size label'],
        ['an xs item with no due date', { labels: ['xs'] }, 'needs a due date'],
        [
            'a now item in the next band',
            { priority: 'now' },
            'outside the now band',
        ],
        ['a missing ordinal', { ordinal: '' }, 'ordinal missing'],
        [
            'an expired item',
            { due_date: '2026-10-08', labels: ['s'] },
            'expired on 2026-10-08',
        ],
    ])('names %s', (_, fields, expected) => {
        expect(checkPocket(config, [task(fields)], today).join('\n')).toContain(
            expected,
        );
    });

    test('a waiting task needs a check first line', () => {
        expect(
            checkPocket(config, [task({ status: 'waiting' })], today).join(
                '\n',
            ),
        ).toContain('`check:` first line');
        expect(
            checkPocket(
                config,
                [task({ status: 'waiting' }, 'check: gh pr view 1')],
                today,
            ),
        ).toEqual([]);
    });

    test('a joined emoji is refused', () => {
        expect(
            checkPocket(
                config,
                [task({}, `asked by 🙋${String.fromCodePoint(0x200d)}♂️`)],
                today,
            ).join('\n'),
        ).toContain('joined emoji');
    });

    test('now holds at most three items', () => {
        const four = [1, 2, 3, 4].map((n) =>
            task({ id: `PK-${n}`, ordinal: `${n}000`, priority: 'now' }),
        );
        expect(checkPocket(config, four, today)).toEqual([
            'now holds 4 items, the cap is 3',
        ]);
    });

    test('a done task still listed goes red for that alone', () => {
        expect(
            checkPocket(
                config,
                [task({ due_date: '2026-10-01', labels: [], status: 'done' })],
                today,
            ),
        ).toEqual([
            'PK-1: done but still listed: `backlog task complete` it this turn',
        ]);
    });

    test('a parked item stays out of the open cap', () => {
        const six = Array.from({ length: 6 }, (_, n) =>
            task({ id: `PK-${n}` }, n === 0 ? 'parked: waits on m1' : 'body'),
        );
        expect(checkPocket(config, six, today)).toEqual([]);
    });

    test('more than five open items goes red', () => {
        const six = Array.from({ length: 6 }, (_, n) =>
            task({ id: `PK-${n}` }),
        );
        expect(checkPocket(config, six, today)).toEqual([
            '6 open items, the cap is 5: solve, ticket or park before the main lane',
        ]);
        expect(checkPocket(config, six.slice(1), today)).toEqual([]);
    });

    test('a waiting small item needs its check, not a due date', () => {
        expect(
            checkPocket(
                config,
                [
                    task(
                        { labels: ['s'], status: 'waiting' },
                        'check: gh pr view 1',
                    ),
                ],
                today,
            ),
        ).toEqual([]);
    });
});
