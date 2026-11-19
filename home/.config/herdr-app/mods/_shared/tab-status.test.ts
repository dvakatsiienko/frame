import { describe, expect, test } from 'vitest';

import { nextChange, tabStatusIn } from './tab-status.js';

// FRM-664:W6: the top tabs' status tile shows unless he hid it in x-herdr-settings
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

describe('the read loop never stops on a missing folder', () => {
    test('a watch that fails waits, then the loop reads again', async () => {
        let waits = 0;
        await expect(
            nextChange(
                () => Promise.reject(new Error('no such folder')),
                async () => {
                    waits++;
                },
            ),
        ).resolves.toBeUndefined();
        expect(waits).toBe(1);
    });

    test('a watch that fires reads again at once, with no wait', async () => {
        let waits = 0;
        await nextChange(
            () => Promise.resolve(['settings.json']),
            async () => {
                waits++;
            },
        );
        expect(waits).toBe(0);
    });
});
