import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

// herdr loads no module from outside a mod's own folder, so both mods that draw the row carry the same file
describe('one x-herdr-chatter-header look in both views', () => {
    test('the copies are the same file', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        expect(
            readFileSync(
                join(here, '..', 'x-herdr-chatter-header', 'chatter-header.js'),
                'utf8',
            ),
        ).toBe(readFileSync(join(here, 'chatter-header.js'), 'utf8'));
    });
});
