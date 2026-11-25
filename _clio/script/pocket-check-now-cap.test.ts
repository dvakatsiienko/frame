import { describe, expect, test } from 'vitest';

import { checkPocket } from './pocket-check.ts';
import { config, task, today } from './pocket-check-world.ts';

describe('checkPocket', () => {
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

    test('now holds at most three items', () => {
        const four = [1, 2, 3, 4].map((n) =>
            task({ id: `PK-${n}`, ordinal: `${n}100`, priority: 'now' }),
        );
        expect(checkPocket(config, four, today)).toEqual([
            'now holds 4 items, the cap is 3',
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
});
