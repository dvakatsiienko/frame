import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';
import { config, task } from './pocket-check-world.ts';

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
