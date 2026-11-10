import { describe, expect, test } from 'vitest';

import { tabLabel } from './label.js';

describe('a tab keeps the part of a session name that tells it apart', () => {
    test('the three codies read by their lanes', () => {
        expect(
            [
                '⚡ 🔧 codie: herdr lane | PK-363',
                '⚡ 🔧 codie: mods lane | PK-363',
                '🌗 🔧 codie: cli lane 7 | FRM-554',
            ].map(tabLabel),
        ).toEqual([
            '⚡ 🔧 herdr lane | PK-363',
            '⚡ 🔧 mods lane | PK-363',
            '🌗 🔧 cli lane 7 | FRM-554',
        ]);
    });

    test('a wing keeps its badges and its number', () => {
        expect(tabLabel('🦉🪽 clio: wing 1')).toBe('🦉🪽 wing 1');
    });

    test('a name with no member word stays whole', () => {
        expect(tabLabel('🦉 clio')).toBe('🦉 clio');
        expect(tabLabel("dima's haiku probe")).toBe("dima's haiku probe");
    });

    test('a name with no badge keeps its member word, the only thing that names it', () => {
        expect(tabLabel('codie: herdr lane')).toBe('codie: herdr lane');
    });
});
