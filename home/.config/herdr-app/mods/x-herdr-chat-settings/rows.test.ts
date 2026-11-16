import { describe, expect, test } from 'vitest';

import { LOOK_DEFAULT, lookOf } from './look.js';
import { ROWS } from './rows.js';

describe('the popover’s rows', () => {
    test('every look value has a row', () => {
        expect(new Set(ROWS.map((row) => row.key))).toEqual(
            new Set(Object.keys(LOOK_DEFAULT)),
        );
    });

    test.each(
        ROWS.flatMap((row) =>
            (row.choices ?? []).map(([value]) => [row.label || row.key, value]),
        ),
    )('%s offers %s, and the reader keeps it', (label, value) => {
        const row = ROWS.find((r) => (r.label || r.key) === label);
        if (!row) throw new Error(`no row ${label}`);
        expect(lookOf({ [row.key]: value })[row.key]).toBe(value);
    });

    test('the dev container row and the «+ menu» heading are gone', () => {
        expect(ROWS.map((row) => row.label)).not.toContain(
            'Claude (dev container)',
        );
        expect(ROWS.map((row) => row.label)).not.toContain('+ menu');
    });
});
