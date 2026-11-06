import { describe, expect, test } from 'vitest';

import { isWingNumber, ordinalFor, searchTerm } from './pocket-add.ts';

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

    test('--top opens an empty band at its floor', () => {
        expect(ordinalFor([12000], 'now', true)).toBe(1000);
    });

    test('never leaves the band when it is full', () => {
        expect(ordinalFor([9900], 'now')).toBe(9999);
    });
});
