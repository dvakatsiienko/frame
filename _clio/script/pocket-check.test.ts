import { execFileSync, spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';
import {
    auditAgainstHead,
    checkPocket,
    headFromGit,
    lostNoteLines,
    unkeptStale,
} from './pocket-check.ts';

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
        const bare = task(
            {},
            "**waiting for:** a headless run can't queue a prompt",
        );
        expect(checkPocket(config, [bare], today)).toEqual([
            "PK-1: a «can't» park or wait line names no probe: put the `command` it tried on that line",
        ]);
        const probed = task(
            {},
            "**waiting for:** can't queue a prompt — `claude -p --input-format stream-json` showed it",
        );
        expect(checkPocket(config, [probed], today)).toEqual([]);
        const other = task(
            {},
            "**waiting for:** after the sweep\nnote: we can't rush it",
        );
        expect(checkPocket(config, [other], today)).toEqual([]);
    });

    test('an open task carrying a ticket line goes red', () => {
        const pointing = task({}, 'body\nticket: FRM-371 (the guard rule)');
        expect(checkPocket(config, [pointing], today)).toEqual([
            'PK-1: carries ticket FRM-371 yet is open: the item dies the turn its ticket is born, set it done',
        ]);
    });

    test('a ticket mentioned mid-line is no ticket line', () => {
        const prose = task({}, 'related: an old ticket: FRM-371');
        expect(checkPocket(config, [prose], today)).toEqual([]);
    });

    test('a bulleted ticket line goes red', () => {
        const bullet = task({}, 'body\n  - ticket: FRM-371');
        expect(checkPocket(config, [bullet], today)).toEqual([
            'PK-1: carries ticket FRM-371 yet is open: the item dies the turn its ticket is born, set it done',
        ]);
    });

    test('a UTC updated_date is read on the local calendar day', () => {
        const zone = process.env.TZ;
        process.env.TZ = 'Pacific/Auckland';
        try {
            // 2026-10-24 20:00 UTC is already 10-25 in Auckland, so it is done today
            const doneToday = task({
                labels: [],
                status: 'done',
                updated_date: '2026-10-24T20:00:00Z',
            });
            expect(checkPocket(config, [doneToday], '2026-10-25')).toEqual([]);
        } finally {
            if (zone === undefined) delete process.env.TZ;
            else process.env.TZ = zone;
        }
    });

    describe('a held line', () => {
        const carries = (held: string) => task({}, `ticket: FRM-72\n\n${held}`);
        const red =
            'PK-1: carries ticket FRM-72 yet is open: the item dies the turn its ticket is born, set it done';

        test('a fresh one naming the item’s own ticket passes', () => {
            const held = carries('held: 2026-10-08 — FRM-72 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([]);
        });

        test('an old-dated one goes red', () => {
            const held = carries('held: 2026-10-05 — FRM-72 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([red]);
        });

        test('one naming another ticket goes red', () => {
            const held = carries('held: 2026-10-08 — FRM-419 step 4 is next');
            expect(checkPocket(config, [held], today)).toEqual([red]);
        });

        test('a kept line no longer holds a ticket', () => {
            const kept = carries('kept: 2026-10-08 — FRM-72 step 4 is next');
            expect(checkPocket(config, [kept], today)).toEqual([red]);
        });

        test('a closed ticket goes red even with a fresh held line', () => {
            const held = carries('held: 2026-10-08 — FRM-72 step 4 is next');
            expect(
                checkPocket(
                    config,
                    [held],
                    today,
                    '',
                    () => true,
                    new Set(['FRM-72']),
                ),
            ).toEqual([
                'PK-1: its ticket FRM-72 is closed in linear: flip it to done',
            ]);
        });
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

    test("a parked line on a not-done item goes red: it is linear's", () => {
        const red = ["PK-1: a parked item is linear's: move it there"];
        const body = 'parked: until the weekly reset';
        for (const status of ['open', 'claimed'])
            expect(
                checkPocket(config, [task({ status }, body)], today),
            ).toEqual(red);
        expect(
            checkPocket(
                config,
                [task({ labels: [], status: 'done' }, body)],
                today,
            ),
        ).toEqual([]);
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

    const flyway = (fields: Record<string, string | string[]>, body = 'body') =>
        checkPocket(
            config,
            [
                task(
                    {
                        labels: ['m', 'clio-wing-1'],
                        ordinal: '1001',
                        priority: 'now',
                        title: 'flyway: wing 1',
                        ...fields,
                    },
                    body,
                ),
            ],
            today,
        ).join('\n');

    test('a flyway off its thread slot is red, naming the edit', () => {
        expect(flyway({ ordinal: '10000', priority: 'next' })).toContain(
            '--priority now --ordinal 1001',
        );
        expect(flyway({ ordinal: '1005' })).toContain('--ordinal 1001');
    });

    test('a work item in a flyway slot is red', () => {
        expect(
            checkPocket(
                config,
                [task({ ordinal: '1003', priority: 'now' })],
                today,
            ).join('\n'),
        ).toContain("a flyway's slot");
    });

    test('a clean flyway from any earlier day stays, past the stale check', () => {
        expect(
            flyway({ updated_date: '2026-01-01 10:00' }, '- [ ] #1 cpu'),
        ).toBe('');
    });

    test('an open line pointing at a closed item is red, a finished line or an open item is not', () => {
        const withItem = (status: string, line: string) =>
            checkPocket(
                config,
                [
                    task(
                        {
                            labels: ['m', 'clio-wing-1'],
                            title: 'flyway: wing 1',
                        },
                        line,
                    ),
                    task({ id: 'PK-77', status }),
                ],
                today,
            ).join('\n');
        expect(withItem('done', '- [ ] #1 PK-77 a chore')).toContain(
            'points at PK-77',
        );
        expect(withItem('open', '- [ ] #1 PK-77 a chore')).not.toContain(
            'points at',
        );
        expect(withItem('done', '- [x] #1 PK-77 a chore')).not.toContain(
            'points at',
        );
        expect(flyway({}, '- [ ] #1 PK-404 gone')).toContain(
            'points at PK-404',
        );
    });

    test('a wish about flyways is no flyway', () => {
        expect(
            flyway({
                ordinal: '10000',
                priority: 'next',
                title: 'flyways board view',
            }),
        ).toBe('');
    });

    test('a flyway never closes', () => {
        expect(flyway({ status: 'done' })).toContain('never closes');
    });

    test('a flyway carries its thread label, main and wing alike', () => {
        expect(flyway({ labels: ['m'] })).toContain('clio-wing-1');
        expect(flyway({ labels: ['m'], title: 'flyway: main' })).toContain(
            'clio-main',
        );
        expect(
            flyway({
                labels: ['m', 'clio-main'],
                ordinal: '1000',
                title: 'flyway: main',
            }),
        ).toBe('');
    });

    test('a flyway title names a thread', () => {
        expect(flyway({ title: 'flyway: 11-07' })).toContain('titled');
    });

    test('one flyway per thread', () => {
        const one = task({ labels: ['m', 'clio-main'], title: 'flyway: main' });
        expect(checkPocket(config, [one, one], today).join('\n')).toContain(
            'one flyway per thread',
        );
    });

    test('a flyway stays out of the now cap', () => {
        const ones = ['main', 'wing 1', 'wing 2', 'wing 3'].map((thread) =>
            task({
                labels: [
                    'm',
                    thread === 'main'
                        ? 'clio-main'
                        : `clio-wing-${thread.slice(5)}`,
                ],
                priority: 'now',
                title: `flyway: ${thread}`,
            }),
        );
        expect(checkPocket(config, ones, today).join('\n')).not.toContain(
            'the cap is',
        );
    });

    test('a ticked line reds the same day, naming the move', () => {
        expect(flyway({}, '- [x] #1 shipped')).toContain(
            'flyway-done.ts PK-1 1',
        );
    });

    test.each([
        [
            'a wait with its tail',
            '- [ ] #1 ⏳ cpu read — waits for: 2026-11-14',
            false,
        ],
        ['a wait with no tail', '- [ ] #1 ⏳ cpu read, until 11-14', true],
        [
            'a later with its tail',
            '- [ ] #1 💤 helga grill — later: dima 19:58',
            false,
        ],
        ['a later with no tail', '- [ ] #1 💤 helga grill', true],
        [
            'a dated with its date',
            '- [ ] #1 📅 crow read — on: 2026-11-14',
            false,
        ],
        ['a dated with no date', '- [ ] #1 📅 crow read, next week', true],
    ])('%s', (_, line, isRed) => {
        expect(flyway({}, line).includes(' ends «')).toBe(isRed);
    });

    test.each([
        [
            'open, waits, later',
            ['redraw', '⏳ a — waits for: x', '💤 b — later: dima 1'],
            false,
        ],
        ['an open line under a wait', ['⏳ a — waits for: x', 'redraw'], true],
        [
            'a wait under a later',
            ['💤 b — later: dima 1', '⏳ a — waits for: x'],
            true,
        ],
        [
            'dated by date',
            [
                '⏳ a — waits for: x',
                '📅 b — on: 2026-11-11',
                '📅 c — on: 2026-11-14',
                '💤 d — later: dima 1',
            ],
            false,
        ],
        [
            'dated out of date order',
            ['📅 c — on: 2026-11-14', '📅 b — on: 2026-11-11'],
            true,
        ],
        [
            'a dated above a wait',
            ['📅 b — on: 2026-11-11', '⏳ a — waits for: x'],
            true,
        ],
    ])('lines in the order %s', (_, lines, isRed) => {
        const body = lines
            .map((line, i) => `- [ ] #${i + 1} ${line}`)
            .join('\n');
        expect(flyway({}, body).includes('out of order')).toBe(isRed);
    });

    test('now holds at most three items', () => {
        const four = [1, 2, 3, 4].map((n) =>
            task({ id: `PK-${n}`, ordinal: `${n}100`, priority: 'now' }),
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

    test.each([
        ['yesterday', '2026-10-08', true],
        ['the day after tomorrow', '2026-10-11', true],
        ['today', '2026-10-09', false],
        ['tomorrow', '2026-10-10', false],
    ])('a not-done item due %s: red is %s', (_, due, isRed) => {
        expect(checkPocket(config, [task({ due_date: due })], today)).toEqual(
            isRed
                ? [
                      `PK-1: due ${due} is outside today–tomorrow: work it, re-date it to tomorrow, or move it to linear`,
                  ]
                : [],
        );
    });

    test('a done item with a stale due date is no due red', () => {
        expect(
            checkPocket(
                config,
                [task({ due_date: '2026-10-01', labels: [], status: 'done' })],
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
            ordinal: '1100',
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

describe('the triage stamp (--triaged)', () => {
    const stale = task({ id: 'PK-3', updated_date: '2026-10-05 09:00' });

    test('a stale item without a kept line dated today is named', () => {
        expect(unkeptStale([stale], today)).toEqual(['PK-3']);
        expect(
            unkeptStale(
                [
                    task(
                        { id: 'PK-3', updated_date: '2026-10-05 09:00' },
                        'kept: 2026-10-08 — still needed',
                    ),
                ],
                today,
            ),
        ).toEqual(['PK-3']);
    });

    test('a kept line dated today, or a fresh item, is quiet', () => {
        const kept = task(
            { id: 'PK-3', updated_date: '2026-10-05 09:00' },
            `kept: ${today} — still needed`,
        );
        expect(unkeptStale([kept, task({})], today)).toEqual([]);
    });

    describe('the cli, on a copy', () => {
        const here = import.meta.dirname;
        const run = (description: string) => {
            const root = mkdtempSync(join(tmpdir(), 'pocket-triaged-'));
            try {
                mkdirSync(join(root, 'script'));
                for (const file of [
                    'chat-lines.ts',
                    'flyway-done.ts',
                    'pocket-check.ts',
                    'prompt-groom.ts',
                    'session-registry.ts',
                    'wish-cover.ts',
                ])
                    copyFileSync(join(here, file), join(root, 'script', file));
                mkdirSync(join(root, 'pocket', 'tasks'), { recursive: true });
                writeFileSync(join(root, 'backlog.config.yml'), config);
                const day = new Date().toLocaleDateString('sv');
                const old = task(
                    { updated_date: '2000-01-01 09:00' },
                    description.replace('TODAY', day),
                );
                writeFileSync(
                    join(root, 'pocket', 'tasks', 'pk-1.md'),
                    old.text,
                );
                const result = spawnSync(
                    process.execPath,
                    [join(root, 'script', 'pocket-check.ts'), '--triaged'],
                    { encoding: 'utf8', env: gitEnv(), timeout: 10_000 },
                );
                return {
                    result,
                    stamped: existsSync(
                        join(root, 'pocket', 'last-triage.txt'),
                    ),
                };
            } finally {
                rmSync(root, { force: true, recursive: true });
            }
        };

        test('refuses with exit 1 and no stamp while a stale item lacks a kept line', () => {
            const { result, stamped } = run('body');
            expect(result.status).toBe(1);
            expect(result.stdout).toContain('--triaged refused: PK-1');
            expect(stamped).toBe(false);
        });

        test('stamps once the stale item carries a kept line dated today', () => {
            const { stamped } = run('kept: TODAY — still needed');
            expect(stamped).toBe(true);
        });
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
        ).toEqual([
            'PK-1: wish born without W-lines: fold it into PK-N:W1… lines',
        ]);
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

    test('a close line may cite its W-ids as a range', () => {
        expect(
            checkPocket(wishConfig, [closed('close: W1–W2 done')], wishToday),
        ).toEqual([]);
    });

    test.each([
        ['full ids', 'close: PK-1:W1 PK-1:W2 done'],
        ['a full range', 'close: PK-1:W1–PK-1:W2 done'],
        ['a bare id and a full one', 'close: W1 PK-1:W2 done'],
    ])('a close line cites its W-ids as %s', (_name, notes) => {
        expect(checkPocket(wishConfig, [closed(notes)], wishToday)).toEqual([]);
    });

    test("another item's prefixed ids account for nothing here", () => {
        expect(
            checkPocket(
                wishConfig,
                [closed('close: PK-2:W1 PK-2:W2 done')],
                wishToday,
            ),
        ).toEqual([
            'PK-1: closed without accounting for W-lines: add a `close:` line citing each as done, moved or dropped',
        ]);
    });

    describe('the copy into its ticket', () => {
        const moved = task(
            {
                created_date: '2026-10-22 09:00',
                status: 'done',
                type: 'wish',
                updated_date: '2026-10-22 09:00',
            },
            '- W1 keep the dark board\n- W2 and the halt view\nticket: FRM-9\n<!-- SECTION:NOTES:BEGIN -->\nclose: W1 W2 moved to FRM-9\n<!-- SECTION:NOTES:END -->',
        );
        const run = (block: string) =>
            checkPocket(
                wishConfig,
                [moved],
                wishToday,
                '',
                () => true,
                new Set(),
                new Map([['FRM-9', block]]),
            );

        test('a W-line missing from the ticket wish block goes red', () => {
            expect(run('* W7 (2026-10-22, dima): keep the dark board')).toEqual(
                [
                    'PK-1: W2 moved to FRM-9 but in none of their wish blocks: copy it verbatim into the one it belongs to',
                ],
            );
        });

        test('every W-line copied, renumbered, passes', () => {
            expect(
                run(
                    '* W7 (x): keep the dark board\n* W8 (x): and the halt view',
                ),
            ).toEqual([]);
        });

        test('a W-line split across two tickets needs one home, not both', () => {
            const split = {
                ...moved,
                text: moved.text
                    .replace('ticket: FRM-9', 'ticket: FRM-9\nticket: FRM-10')
                    .replace('moved to FRM-9', 'moved to FRM-9 and FRM-10'),
            };
            const runSplit = (other: string) =>
                checkPocket(
                    wishConfig,
                    [split],
                    wishToday,
                    '',
                    () => true,
                    new Set(),
                    new Map([
                        ['FRM-9', '* W7 (x): keep the dark board'],
                        ['FRM-10', other],
                    ]),
                );
            expect(runSplit('* W1 (x): and the halt view')).toEqual([]);
            expect(runSplit('* W1 (x): something else')).toEqual([
                'PK-1: W2 moved to FRM-9, FRM-10 but in none of their wish blocks: copy it verbatim into the one it belongs to',
            ]);
        });

        test('«raw drop kept in the notes» drops no W-line', () => {
            const kept = {
                ...moved,
                text: moved.text.replace(
                    'close: W1 W2 moved to FRM-9',
                    'close: W1 W2 moved to FRM-9, raw drop kept in the notes',
                ),
            };
            expect(
                checkPocket(
                    wishConfig,
                    [kept],
                    wishToday,
                    '',
                    () => true,
                    new Set(),
                    new Map([['FRM-9', '* W7 (x): keep the dark board']]),
                ),
            ).toEqual([
                'PK-1: W2 moved to FRM-9 but in none of their wish blocks: copy it verbatim into the one it belongs to',
            ]);
        });
    });

    describe("a dropped clause needs dima's verdict", () => {
        const red =
            "PK-1: dropped W2 with no verdict of dima's: cite the orbit id (oN) or «dima <date|HH:MM>» in the same clause";

        test('a dropped clause with no verdict goes red', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done, W2 dropped')],
                    wishToday,
                ),
            ).toEqual([red]);
        });

        test('a dropped clause citing an orbit id passes', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done, W2 dropped (o14)')],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('a dropped clause citing «dima <date>» passes', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done, W2 dropped (dima 2026-10-30)')],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('a comma inside the parentheses keeps the verdict in its clause', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [
                        closed(
                            'close: W1 done · W2 dropped (no area emoji, dima o58)',
                        ),
                    ],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('a · splits clauses, so a done clause never borrows a drop', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done (kept) · W2 dropped')],
                    wishToday,
                ),
            ).toEqual([red]);
        });

        test('a dropped clause citing «dima <HH:MM>» passes', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done, W2 dropped (dima 09:15)')],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('a verdict in another clause does not cover a dropped one', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done (o14), W2 dropped')],
                    wishToday,
                ),
            ).toEqual([red]);
        });

        test('a done clause needs no verdict', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done, W2 done')],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('an item older than the rules date is not judged', () => {
            const old = task(
                {
                    created_date: '2026-10-13 10:00',
                    status: 'done',
                    updated_date: '2026-10-21 10:00',
                },
                '- W1 keep the words\n- W2 second\n<!-- SECTION:NOTES:BEGIN -->\nclose: W1 done, W2 dropped\n<!-- SECTION:NOTES:END -->',
            );
            expect(checkPocket(wishConfig, [old], '2026-10-21')).toEqual([]);
        });
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

    test('a note line that only lost its emoji joiner is not lost', () => {
        expect(
            lostNoteLines(
                notes('done: \u{1F426}⬛ crow grade'),
                notes('done: \u{1F426}‍⬛ crow grade'),
            ),
        ).toEqual([]);
    });

    test('a task with no notes at HEAD has nothing to lose', () => {
        expect(lostNoteLines(notes('done'), 'no notes here')).toEqual([]);
    });

    test('a note line that only gained its home prefix is not lost', () => {
        expect(
            lostNoteLines(
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                notes('W3 (2026-11-06 10:00, dima): keep'),
                'PK-1',
            ),
        ).toEqual([]);
    });

    test('a note line that swapped to another home is lost', () => {
        expect(
            lostNoteLines(
                notes('PK-4:W3 (2026-11-06 10:00, dima): keep'),
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                'PK-1',
            ),
        ).toEqual(['PK-1:W3 (2026-11-06 10:00, dima): keep']);
    });

    test('a note line removed beside a prefixed one is lost', () => {
        expect(
            lostNoteLines(
                notes('PK-1:W3 (2026-11-06 10:00, dima): keep'),
                notes(
                    'W3 (2026-11-06 10:00, dima): keep\nW4 (2026-11-06 10:01, dima): gone',
                ),
                'PK-1',
            ),
        ).toEqual(['W4 (2026-11-06 10:01, dima): gone']);
    });
});

describe('auditAgainstHead', () => {
    const file = (name: string, status: string, notes = '', wishes = '') => ({
        name,
        text: `---\nstatus: ${status}\n---\n\n<!-- SECTION:DESCRIPTION:BEGIN -->\n${wishes}\n<!-- SECTION:DESCRIPTION:END -->\n<!-- SECTION:NOTES:BEGIN -->\n${notes}\n<!-- SECTION:NOTES:END -->\n`,
    });
    const head = (
        names: string[],
        texts: Record<string, string> = {},
        archiveNames: string[] = [],
    ) => ({
        archiveNames,
        names,
        text: (dir: string, name: string) => texts[`${dir}/${name}`] ?? '',
    });
    const left =
        'PK-5: left the tasks dir without being done and closed — restore it or close it with a close: line';

    test('an item gone from tasks and absent from the archive goes red', () => {
        expect(auditAgainstHead([], [], head(['pk-5 - gone.md']))).toEqual([
            left,
        ]);
    });

    test('an item archived while still open goes red', () => {
        expect(
            auditAgainstHead(
                [],
                [file('pk-5 - gone.md', 'open')],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([left]);
    });

    test('a done item with W-lines archived without a close: line goes red', () => {
        const wished = file('pk-5 - gone.md', 'done', '', '- W1 a wish');
        expect(
            auditAgainstHead([], [wished], head(['pk-5 - gone.md'])),
        ).toEqual([left]);
    });

    test('a done item with a close: line archived under a new slug passes', () => {
        const closed = file(
            'pk-5 - renamed.md',
            'done',
            'close: W1 done',
            '- W1 a wish',
        );
        expect(
            auditAgainstHead([], [closed], head(['pk-5 - gone.md'])),
        ).toEqual([]);
    });

    test('an archived file gone from the archive goes red', () => {
        expect(
            auditAgainstHead([], [], head([], {}, ['pk-265 - raw drops.md'])),
        ).toEqual([
            'PK-265: left the archive — restore it from `git show HEAD:`',
        ]);
    });

    test('an archived file renamed in the archive or back into tasks is not gone', () => {
        const archiveNames = ['pk-265 - raw drops.md'];
        expect(
            auditAgainstHead(
                [],
                [file('pk-265 - new slug.md', 'done')],
                head([], {}, archiveNames),
            ),
        ).toEqual([]);
        expect(
            auditAgainstHead(
                [file('pk-265 - new slug.md', 'open')],
                [],
                head([], {}, archiveNames),
            ),
        ).toEqual([]);
    });

    test('a task renamed in place keeps its prefix and is not gone', () => {
        expect(
            auditAgainstHead(
                [file('pk-5 - new slug.md', 'open')],
                [],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([]);
    });

    test('the real git path: a committed task deleted afterwards goes red', () => {
        const repo = mkdtempSync(join(tmpdir(), 'pocket-git-'));
        try {
            const root = join(repo, 'clio');
            const tasks = join(root, 'pocket', 'tasks');
            const archive = join(root, 'pocket', 'archive', 'tasks');
            mkdirSync(tasks, { recursive: true });
            mkdirSync(archive, { recursive: true });
            writeFileSync(join(tasks, 'pk-5 - gone.md'), 'x');
            writeFileSync(join(archive, 'pk-6 - old.md'), 'y');
            const noted = file('pk-7 - kept.md', 'done', 'dima: «keep it»');
            writeFileSync(join(archive, noted.name), noted.text);
            const git = (...args: string[]) =>
                execFileSync(
                    'git',
                    [
                        '-c',
                        'user.name=t',
                        '-c',
                        'user.email=t@t',
                        '-c',
                        'commit.gpgsign=false',
                        ...args,
                    ],
                    {
                        cwd: repo,
                        env: gitEnv(),
                        stdio: 'ignore',
                        timeout: 10_000,
                    },
                );
            git('init', '-q');
            git('add', '.');
            git('commit', '-q', '-m', 'seed');
            rmSync(join(tasks, 'pk-5 - gone.md'));
            rmSync(join(archive, 'pk-6 - old.md'));
            const wiped = file(noted.name, 'done', 'done');
            expect(
                auditAgainstHead([], [wiped], headFromGit(root, gitEnv())),
            ).toEqual([
                'pk-7: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
                'PK-6: left the archive — restore it from `git show HEAD:`',
                left,
            ]);
        } finally {
            rmSync(repo, { force: true, recursive: true });
        }
    });

    test('an item still in tasks is not gone', () => {
        expect(
            auditAgainstHead(
                [file('pk-5 - gone.md', 'open')],
                [],
                head(['pk-5 - gone.md']),
            ),
        ).toEqual([]);
    });

    test('an item archived with its notes wiped in one step goes red', () => {
        const archived = file('pk-5 - renamed.md', 'done', 'done');
        const was = file('pk-5 - gone.md', 'done', 'dima: «keep it»').text;
        expect(
            auditAgainstHead(
                [],
                [archived],
                head(['pk-5 - gone.md'], { 'tasks/pk-5 - gone.md': was }),
            ),
        ).toEqual([
            'pk-5: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
        ]);
    });

    test('an archived item that lost a note line since HEAD goes red', () => {
        const archived = file('pk-5 - gone.md', 'done', 'done');
        const was = file('pk-5 - gone.md', 'done', 'dima: «keep it»').text;
        expect(
            auditAgainstHead(
                [],
                [archived],
                head([], { 'archive/pk-5 - gone.md': was }),
            ),
        ).toEqual([
            'pk-5: 1 note line(s) gone since HEAD — a close appends (`--append-notes`); restore from `git show HEAD:`',
        ]);
    });
});

describe('the closed-ticket net, with linear unreachable', () => {
    test('a failing x skips the net with a yellow line and never crashes', () => {
        const root = mkdtempSync(join(tmpdir(), 'pocket-linear-'));
        try {
            mkdirSync(join(root, 'script'));
            for (const file of [
                'chat-lines.ts',
                'flyway-done.ts',
                'pocket-check.ts',
                'prompt-groom.ts',
                'session-registry.ts',
                'wish-cover.ts',
            ])
                copyFileSync(
                    join(import.meta.dirname, file),
                    join(root, 'script', file),
                );
            mkdirSync(join(root, 'pocket', 'tasks'), { recursive: true });
            mkdirSync(join(root, 'bin'));
            writeFileSync(join(root, 'bin', 'x'), '#!/bin/sh\nexit 1\n', {
                mode: 0o755,
            });
            writeFileSync(join(root, 'backlog.config.yml'), config);
            writeFileSync(
                join(root, 'pocket', 'tasks', 'pk-1.md'),
                task({}, 'ticket: FRM-72').text,
            );
            const result = spawnSync(
                process.execPath,
                [join(root, 'script', 'pocket-check.ts')],
                {
                    encoding: 'utf8',
                    env: {
                        ...gitEnv(),
                        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                    },
                    timeout: 10_000,
                },
            );
            expect(result.stderr).toContain('linear not read');
            expect(result.stderr).not.toContain('Error');
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
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

    describe('an orbit steer (FRM-451)', () => {
        const steered = task(
            { updated_date: `${day} 09:30` },
            '\nW302 (2026-10-26 09:15, dima, o69 steer): a steered wish',
        );

        test('a steer-stamped W-line with no groom reds, naming the id', () => {
            expect(
                checkPocket(config, [steered], day, day, () => false),
            ).toEqual([expect.stringContaining("dima's o69 prompt")]);
        });

        test('with its groom file it stays green', () => {
            expect(
                checkPocket(
                    config,
                    [steered],
                    day,
                    day,
                    (_, key) => key === 'o69',
                ),
            ).toEqual([]);
        });

        test('a minute groom does not stand in for the steer', () => {
            expect(
                checkPocket(
                    config,
                    [steered],
                    day,
                    day,
                    (_, key) => key === '09:15',
                ),
            ).toEqual([expect.stringContaining('o69')]);
        });
    });

    test("a numbered wing's item is groomed in its wing, not here", () => {
        const owned = task(
            {
                labels: ['s', 'clio-wing-2'],
                updated_date: `${day} 09:30`,
            },
            '\nW302 (2026-10-26 09:12, dima): a fold',
        );
        expect(checkPocket(config, [owned], day, day, () => false)).toEqual([]);
    });

    test('a retired wing label no longer skips the groom', () => {
        const retired = task(
            {
                labels: ['s', 'wing-owned'],
                updated_date: `${day} 09:30`,
            },
            '\nW303 (2026-10-26 09:12, dima): a fold',
        );
        expect(checkPocket(config, [retired], day, day, () => false)).toEqual([
            expect.stringContaining('no groom'),
        ]);
    });
});
