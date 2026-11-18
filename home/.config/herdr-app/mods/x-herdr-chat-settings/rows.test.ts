import { describe, expect, test } from 'vitest';

import { lookOf } from './look.js';
import { ROWS } from './rows.js';

describe('the popover’s rows', () => {
    test('the rows are the look values the new chat acts on', () => {
        expect(new Set(ROWS.map((row) => row.key))).toEqual(
            new Set(['size', 'font', 'width', 'tools', 'fg', 'space']),
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
