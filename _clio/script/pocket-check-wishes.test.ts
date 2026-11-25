import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';
import { config, task } from './pocket-check-world.ts';

const wishConfig = config.replace('"idea"', '"idea", "wish"');

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

        test('«dropped» inside a done clause’s parentheses drops nothing', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done · W2 done (member word dropped)')],
                    wishToday,
                ),
            ).toEqual([]);
        });

        test('a drop written only in its parentheses still needs a verdict', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done · W2 (dropped)')],
                    wishToday,
                ),
            ).toEqual([red]);
        });

        test('a W-id dropped inside a done clause’s parentheses still needs a verdict', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [closed('close: W1 done (W2 dropped, a twin)')],
                    wishToday,
                ),
            ).toEqual([red]);
        });

        test('nested parentheses in a done clause drop nothing', () => {
            expect(
                checkPocket(
                    wishConfig,
                    [
                        closed(
                            'close: W1 done · W2 done (kept (see a) then dropped)',
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
