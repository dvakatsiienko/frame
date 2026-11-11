import { describe, expect, test } from 'vitest';

import { flywayOrdinal } from './flyway-done.ts';
import { isWingNumber, ordinalFor, searchTerm } from './pocket-add.ts';

describe('flywayOrdinal', () => {
    test('the flyways sit on top in thread order', () => {
        expect(
            [
                'flyway: main',
                'flyway: wing 1',
                'flyway: wing 2',
                'flyway: wing 3',
            ].map(flywayOrdinal),
        ).toEqual([1000, 1001, 1002, 1003]);
    });

    test('a work item naming a flyway takes no slot', () => {
        expect(flywayOrdinal('herder: a flyway probe')).toBeUndefined();
    });
});

test('a --top item lands under the flyway slots', () => {
    expect(ordinalFor([1000, 1002], 'now', true)).toBe(1100);
});

test.each(['1', '12'])('wing %s is a number', (value) => {
    expect(isWingNumber(value)).toBe(true);
});

test.each(['0', '01', '', '-1', 'a', '1\n'])('wing %j is refused', (value) => {
    expect(isWingNumber(value)).toBe(false);
});

describe('searchTerm', () => {
    test('keeps the first three words over 4 characters', () => {
        expect(searchTerm('fix the broken pocket search for everyone')).toBe(
            'broken pocket search',
        );
    });

    test('is empty when no word is over 4 characters', () => {
        expect(searchTerm('fix the bug now')).toBe('');
    });
});

describe('ordinalFor', () => {
    test('places an item after the last one in its priority band', () => {
        expect(ordinalFor([2000, 15000, 120000, 130000], 'later')).toBe(131000);
    });

    test('opens an empty band at its floor', () => {
        expect(ordinalFor([120000], 'next')).toBe(11000);
    });

    test('--top places an item before the first one in its band', () => {
        expect(ordinalFor([1500, 8000, 12000], 'now', true)).toBe(1499);
    });

    test('--top opens an empty now band under the flyway slots', () => {
        expect(ordinalFor([12000], 'now', true)).toBe(1100);
    });

    test('never leaves the band when it is full', () => {
        expect(ordinalFor([9900], 'now')).toBe(9999);
    });
});
