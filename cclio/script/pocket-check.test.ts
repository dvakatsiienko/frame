import { describe, expect, test } from 'vitest';

import { checkPocket, lostNoteLines } from './pocket-check.ts';

const config = [
    'statuses: ["open", "claimed", "waiting", "done"]',
    'labels: ["xs", "s", "m", "l"]',
    'priorities: ["now", "next", "later"]',
    'types: ["task", "idea"]',
].join('\n');

const today = '2026-10-09';
const wishConfig = config.replace('"idea"', '"idea", "wish"');

function task(fields: Record<string, string | string[]>, description = 'body') {
    const rows = Object.entries({
        id: 'PK-1',
        labels: ['m'],
        ordinal: '10000',
        priority: 'next',
        status: 'open',
        type: 'task',
        updated_date: '2026-10-09 10:00',
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

    test("a «can't» park line goes red unless it names the probe it ran", () => {
        const bare = task({}, "parked: a headless run can't queue a prompt");
        expect(checkPocket(config, [bare], today)).toEqual([
            "PK-1: a «can't» park or wait line names no probe: put the `command` it tried on that line",
        ]);
        const probed = task(
            {},
            "parked: can't queue a prompt — `claude -p --input-format stream-json` showed it",
        );
        expect(checkPocket(config, [probed], today)).toEqual([]);
        const other = task(
            {},
            "parked: after the sweep\nnote: we can't rush it",
        );
        expect(checkPocket(config, [other], today)).toEqual([]);
    });

    test('an open task carrying a ticket line goes red', () => {
        const pointing = task({}, 'body\nticket: FRM-371 (the guard rule)');
        expect(checkPocket(config, [pointing], today)).toEqual([
            'PK-1: carries ticket FRM-371 yet is open: the item dies the turn its ticket is born, set it done',
        ]);
    });

    test('an open task kept for a named ticket step passes', () => {
        const kept = task(
            {},
            'ticket: FRM-72\n\nkept: 2026-10-25 — FRM-419 step 4 maps these W-lines next',
        );
        expect(checkPocket(config, [kept], today)).toEqual([]);
    });

    test('a done task carrying a ticket line passes', () => {
        expect(
            checkPocket(
                config,
                [task({ status: 'done' }, 'ticket: FRM-371')],
                today,
            ),
        ).toEqual([]);
    });

    test.each([
        ['an unknown status', { status: 'blocked' }, 'status «blocked»'],
        ['an unknown priority', { priority: 'urgent' }, 'priority «urgent»'],
        ['an unknown type', { type: 'chore' }, 'type «chore»'],
        ['no size label', { labels: [] as string[] }, 'exactly one size label'],
        ['two size labels', { labels: ['s', 'm'] }, 'exactly one size label'],
        [
            'a now item in the next band',
            { priority: 'now' },
            'outside the now band',
        ],
        ['a missing ordinal', { ordinal: '' }, 'ordinal missing'],
        [
            'an expired wait',
            { due_date: '2026-10-08', labels: ['s'], status: 'waiting' },
            'expired on 2026-10-08',
        ],
    ])('names %s', (_, fields, expected) => {
        expect(checkPocket(config, [task(fields)], today).join('\n')).toContain(
            expected,
        );
    });

    test('a claimed item with a park line goes red, a parked open one passes', () => {
        const body = 'parked: until the weekly reset';
        expect(
            checkPocket(config, [task({ status: 'claimed' }, body)], today),
        ).toEqual([
            'PK-1: claimed and parked at once: a parked item releases its claim, set it open or waiting',
        ]);
        expect(checkPocket(config, [task({}, body)], today)).toEqual([]);
    });

    test('a waiting task needs a check first line', () => {
        expect(
            checkPocket(config, [task({ status: 'waiting' })], today).join(
                '\n',
            ),
        ).toContain('`**waiting for:**` first line');
        expect(
            checkPocket(
                config,
                [
                    task(
                        { due_date: '2026-10-10', status: 'waiting' },
                        '**waiting for:** gh pr view 1',
                    ),
                ],
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

    test('a task done before today and still listed goes red for that alone', () => {
        expect(
            checkPocket(
                config,
                [
                    task({
                        due_date: '2026-10-01',
                        labels: [],
                        status: 'done',
                        updated_date: '2026-10-08 22:00',
                    }),
                ],
                today,
            ),
        ).toEqual([
            "PK-1: done since 2026-10-08 and still listed: `backlog task archive` it (the halt archives the day's done items)",
        ]);
    });

    test('a task done today stays listed until the halt', () => {
        expect(
            checkPocket(config, [task({ labels: [], status: 'done' })], today),
        ).toEqual([]);
    });

    test('the 3-day triage names items untouched for 2+ days', () => {
        const old = task({ updated_date: '2026-10-07 09:00' });
        expect(checkPocket(config, [old], today, '2026-10-06')).toEqual([
            '3-day triage due (last 2026-10-06): PK-1 untouched 2+ days — revalidate each by hand: a stayer gets «kept: <date> — <why>», the rest move to linear; then `node script/pocket-check.ts --triaged`',
        ]);
        expect(checkPocket(config, [old], today, '2026-10-08')).toEqual([]);
    });

    test('a triage with nothing stale stays quiet', () => {
        expect(
            checkPocket(
                config,
                [task({ updated_date: '2026-10-08 09:00' })],
                today,
                '',
            ),
        ).toEqual([]);
    });

    test('a wait past tomorrow goes red: it belongs in linear', () => {
        expect(
            checkPocket(
                config,
                [
                    task(
                        { due_date: '2026-10-12', status: 'waiting' },
                        '**waiting for:** gh pr view 1',
                    ),
                ],
                today,
            ).join('\n'),
        ).toContain("a wait past tomorrow is linear's");
        expect(
            checkPocket(
                config,
                [
                    task(
                        { due_date: '2026-10-10', status: 'waiting' },
                        '**waiting for:** gh pr view 1',
                    ),
                ],
                today,
            ),
        ).toEqual([]);
    });

    test('an open item due yesterday is no red: only a wait expires', () => {
        expect(
            checkPocket(
                config,
                [task({ due_date: '2026-10-08', labels: ['s'] })],
                today,
            ),
        ).toEqual([]);
    });

    test('a fresh task with no updated date reads its created date', () => {
        expect(
            checkPocket(
                config,
                [task({ created_date: '2026-10-09 09:00', updated_date: '' })],
                today,
            ),
        ).toEqual([]);
    });

    test('a waiting task needs a due date', () => {
        expect(
            checkPocket(
                config,
                [task({ status: 'waiting' }, '**waiting for:** gh pr view 1')],
                today,
            ),
        ).toEqual([
            'PK-1: waiting without a due date: when does the wait expire?',
        ]);
    });

    test('the seeded evergreen turn stays out of the now cap', () => {
        const items = Array.from({ length: 5 }, (_, n) =>
            task(
                n < 3
                    ? { id: `PK-${n}`, ordinal: `${2000 + n}`, priority: 'now' }
                    : { id: `PK-${n}` },
            ),
        );
        const seed = task({
            id: 'PK-9',
            ordinal: '1000',
            priority: 'now',
            title: '🧬 evergreen turn — 2026-10-09',
        });
        expect(checkPocket(config, [...items, seed], today)).toEqual([]);
    });

    test('many open items are no red: the open cap is gone (dima, 2026-10-25)', () => {
        const six = Array.from({ length: 6 }, (_, n) =>
            task({ id: `PK-${n}` }),
        );
        expect(checkPocket(config, six, today)).toEqual([]);
    });

    test('a waiting small item needs its check, not a due date', () => {
        expect(
            checkPocket(
                config,
                [
                    task(
                        {
                            due_date: '2026-10-10',
                            labels: ['s'],
                            status: 'waiting',
                        },
                        '**waiting for:** gh pr view 1',
                    ),
                ],
                today,
            ),
        ).toEqual([]);
    });
});

describe('wish accounting', () => {
    const wishToday = '2026-10-22';
    const withNotes = (lines: string) =>
        `- W1 keep the words\n- W2 second\n<!-- SECTION:NOTES:BEGIN -->\n${lines}\n<!-- SECTION:NOTES:END -->`;
    const closed = (notes: string) =>
        task(
            {
                created_date: '2026-10-13 10:00',
                status: 'done',
                updated_date: '2026-10-22 10:00',
            },
            withNotes(notes),
        );

    test('a wish born today without W-lines goes red', () => {
        expect(
            checkPocket(
                wishConfig,
                [
                    task(
                        {
                            created_date: '2026-10-22 09:00',
                            type: 'wish',
                            updated_date: '2026-10-22 09:00',
                        },
                        'just prose',
                    ),
                ],
                wishToday,
            ),
        ).toEqual(['PK-1: wish born without W-lines: fold it into W1… lines']);
    });

    test('a wish born today with W-lines passes, and an older wish is spared', () => {
        const fresh = {
            created_date: '2026-10-22 09:00',
            type: 'wish',
            updated_date: '2026-10-22 09:00',
        };
        expect(
            checkPocket(wishConfig, [task(fresh, '- W1 his words')], wishToday),
        ).toEqual([]);
        expect(
            checkPocket(
                wishConfig,
                [
                    task(
                        {
                            ...fresh,
                            created_date: '2026-10-21 09:00',
                        },
                        'just prose',
                    ),
                ],
                wishToday,
            ),
        ).toEqual([]);
    });

    test('a close without a close: line citing every W-id goes red', () => {
        const red =
            'PK-1: closed without accounting for W-lines: add a `close:` line citing each as done, moved or dropped';
        expect(
            checkPocket(wishConfig, [closed('close: W1 done')], wishToday),
        ).toEqual([red]);
        expect(
            checkPocket(wishConfig, [closed('W1 W2 done')], wishToday),
        ).toEqual([red]);
    });

    test('a close: line citing every W-id passes', () => {
        expect(
            checkPocket(
                wishConfig,
                [closed('close: W1 done, W2 dropped')],
                wishToday,
            ),
        ).toEqual([]);
    });
});

describe('lostNoteLines', () => {
    const notes = (lines: string) =>
        `## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\n${lines}\n<!-- SECTION:NOTES:END -->\n`;

    test('an appended note loses nothing', () => {
        expect(
            lostNoteLines(
                notes('dima: «keep it»\n\nnew line'),
                notes('dima: «keep it»'),
            ),
        ).toEqual([]);
    });

    test('a replaced note names the line it dropped', () => {
        expect(lostNoteLines(notes('done'), notes('dima: «keep it»'))).toEqual([
            'dima: «keep it»',
        ]);
    });

    test('a task with no notes at HEAD has nothing to lose', () => {
        expect(lostNoteLines(notes('done'), 'no notes here')).toEqual([]);
    });
});

describe('the prompt groom (FRM-418)', () => {
    const day = '2026-10-26';
    const folded = task(
        { updated_date: `${day} 09:30` },
        '\nW301 (2026-10-26 09:12, dima): a fold',
    );

    test('a W-line stamped today with no groom reds, naming the prompt time', () => {
        expect(checkPocket(config, [folded], day, day, () => false)).toEqual([
            expect.stringContaining("dima's 09:12 prompt folded with no groom"),
        ]);
    });

    test('a groomed one stays green', () => {
        expect(checkPocket(config, [folded], day, day, () => true)).toEqual([]);
    });
});
