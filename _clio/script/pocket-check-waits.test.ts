import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';
import { config, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
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
