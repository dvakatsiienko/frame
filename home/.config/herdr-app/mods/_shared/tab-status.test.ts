import { describe, expect, test } from 'vitest';

import { tabStatusIn } from './tab-status.js';

// FRM-664:W6: the top tabs' status tile shows unless he hid it in the settings window
const file = (rows: Record<string, unknown>) => JSON.stringify({ rows, v: 1 });

describe('tab status from the settings file', () => {
    test('no file, or no row, shows the tile, as before the setting', () => {
        expect(tabStatusIn(null)).toBe('visible');
        expect(tabStatusIn(file({ 'chatter.metalHud': true }))).toBe('visible');
    });

    test('his «hidden» hides it', () => {
        expect(tabStatusIn(file({ 'tabs.status': 'hidden' }))).toBe('hidden');
    });

    test('a file mid-write or a value no choice offers shows the tile', () => {
        expect(tabStatusIn('{"rows": {"tabs.st')).toBe('visible');
        expect(tabStatusIn(file({ 'tabs.status': 'off' }))).toBe('visible');
    });
});
