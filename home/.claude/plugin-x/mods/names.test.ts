import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// a mod's identity is its manifest name: a renamed loaded mod keeps its old identity, every `$.state` call is refused
// and its band silently disappears (claude-code#91870, 10-18), and `$.store` sits in a file named after it — so the
// name stays its folder's, and a rename moves the store file in the same change
const root = import.meta.dirname;
const mods = readdirSync(root).filter((m) =>
    existsSync(join(root, m, '.claude-plugin/plugin.json')),
);

describe('a mod keeps one name', () => {
    it('finds the mods', () => {
        expect(mods.length).toBeGreaterThan(0);
    });

    for (const mod of mods)
        it(`${mod}: its manifest name is its folder's`, () => {
            const { name } = JSON.parse(
                readFileSync(
                    join(root, mod, '.claude-plugin/plugin.json'),
                    'utf8',
                ),
            ) as { name: string };
            expect(
                name,
                'a rename moves ~/.claude/plugins/store/<old>_* to the new name and restarts every session (mods/AGENTS.md)',
            ).toBe(mod);
        });
});
