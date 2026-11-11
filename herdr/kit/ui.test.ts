import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// a herdr mod imports only from its own folder, so each carries the kit as a whole-file copy
const SOURCE = join(import.meta.dirname, 'ui.js');
const MODS = join(import.meta.dirname, '../../home/.config/herdr-app/mods');
const copies = readdirSync(MODS).filter((m) =>
    existsSync(join(MODS, m, 'ui.js')),
);

describe('the ui kit copies', () => {
    it('finds the mods that carry one', () => {
        expect(copies).toEqual(['x-herdr-chatter']);
    });
    for (const mod of copies)
        it(`${mod}/ui.js reads as herdr/kit/ui.js`, () => {
            expect(readFileSync(join(MODS, mod, 'ui.js'), 'utf8')).toBe(
                readFileSync(SOURCE, 'utf8'),
            );
        });
});
