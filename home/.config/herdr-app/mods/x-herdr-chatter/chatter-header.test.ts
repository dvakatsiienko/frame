import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

// herdr loads no module from outside a mod's own folder, so both mods that draw the row carry the same file
describe('one x-herdr-chatter-header look in both views', () => {
    test.each(['chatter-header.js', 'header-rules.js'])(
        'the copies of %s are the same file',
        (name) => {
            const here = dirname(fileURLToPath(import.meta.url));
            expect(
                readFileSync(
                    join(here, '..', 'x-herdr-chatter-header', name),
                    'utf8',
                ),
            ).toBe(readFileSync(join(here, name), 'utf8'));
        },
    );
});
