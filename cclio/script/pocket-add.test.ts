import { describe, expect, test } from 'vitest';

import { dueFor, ordinalFor } from './pocket-add.ts';

describe('ordinalFor', () => {
    test('places an item after the last one in its priority band', () => {
        expect(ordinalFor([2000, 15000, 120000, 130000], 'later')).toBe(131000);
    });

    test('opens an empty band at its floor', () => {
        expect(ordinalFor([120000], 'next')).toBe(11000);
    });

    test('never leaves the band when it is full', () => {
        expect(ordinalFor([9900], 'now')).toBe(9999);
    });
});

describe('dueFor', () => {
    test('gives an xs item one day and an s item three', () => {
        expect([dueFor('xs', '2026-10-14'), dueFor('s', '2026-10-30')]).toEqual(
            ['2026-10-15', '2026-11-02'],
        );
    });

    test('leaves an m item undated', () => {
        expect(dueFor('m', '2026-10-14')).toBeUndefined();
    });
});
