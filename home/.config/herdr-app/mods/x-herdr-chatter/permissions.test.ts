import { describe, expect, test } from 'vitest';

import { permissionIn, permissionOf } from './permissions.js';

describe('the permission mode, read off Claude’s footer and cycled live', () => {
    test.each([
        [
            '  -- INSERT -- ⏵⏵ bypass permissions on (shift+tab to cycle)',
            'bypassPermissions',
        ],
        ['  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt', 'auto'],
        ['  -- INSERT -- ⏸ manual mode on', 'default'],
        ['  ⏵⏵ accept edits on (shift+tab to cycle)', 'acceptEdits'],
        ['  ⏸ plan mode on (shift+tab to cycle)', 'plan'],
    ])('«%s» reads %s', (footer, mode) => {
        expect(permissionOf(`❯ hi\n${footer}`)).toBe(mode);
    });

    test('a screen with no footer reads nothing', () => {
        expect(permissionOf('Select model')).toBeNull();
    });

    test('Shift+Tab is pressed until the footer reads the mode picked', async () => {
        const screens = [
            '⏵⏵ bypass permissions on',
            '⏵⏵ auto mode on',
            '⏸ manual mode on',
            '⏵⏵ accept edits on',
        ];
        let n = 0;
        const sent: string[][] = [];
        const mode = await permissionIn('acceptEdits', {
            keys: async (k: string[]) => {
                sent.push(k);
                n += 1;
            },
            screen: async () => screens[n] ?? '',
            sleep: async () => {},
        });
        expect([mode, sent.length]).toEqual(['acceptEdits', 3]);
    });

    test('a mode the cycle never reaches stops after one round, on the mode it ends at', async () => {
        const screens = ['⏸ manual mode on', '⏸ plan mode on'];
        let n = 0;
        const mode = await permissionIn('auto', {
            keys: async () => {
                n += 1;
            },
            screen: async () => screens[n % 2] ?? '',
            sleep: async () => {},
        });
        expect(mode).not.toBe('auto');
        expect(n).toBeLessThanOrEqual(6);
    });
});
