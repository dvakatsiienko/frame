import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

// a mod cannot import a sibling mod's file: the chat reads his look through its own copy of the settings part's reader
describe('one reader of his look in every mod that reads it', () => {
    test('the copies are the same file', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        expect(readFileSync(join(here, 'look.js'), 'utf8')).toBe(
            readFileSync(
                join(here, '..', 'x-herdr-chat-settings', 'look.js'),
                'utf8',
            ),
        );
    });
});
