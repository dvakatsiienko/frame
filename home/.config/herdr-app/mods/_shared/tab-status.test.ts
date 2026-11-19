import { describe, expect, test } from 'vitest';

import { tabStatusOf } from './tab-status.js';

// FRM-664:W6: the top tabs' status tile shows unless he hid it
describe('tab status', () => {
    test('nothing stored shows the tile, as before the setting', () => {
        expect(tabStatusOf(undefined)).toBe('visible');
        expect(tabStatusOf(null)).toBe('visible');
    });

    test('his «hidden» hides it', () => {
        expect(tabStatusOf('hidden')).toBe('hidden');
    });

    test('a value no choice offers shows the tile', () => {
        expect(tabStatusOf('off')).toBe('visible');
        expect(tabStatusOf(true)).toBe('visible');
    });
});
