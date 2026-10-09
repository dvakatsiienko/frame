import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';

// the plugin ships to ~/.claude/plugins/cache/x/x/<version>/ without the rest of frame, so a bin that imports a path
// outside plugin-x dies there with ERR_MODULE_NOT_FOUND (scratch-edit, edit-anchored and edit-batch did, 2026-10-09)
const root = resolve(import.meta.dirname, '../../home/.claude/plugin-x');

test('every plugin bin imports only files inside the plugin', () => {
    const outside: string[] = [];
    for (const name of readdirSync(join(root, 'bin'))) {
        const file = join(root, 'bin', name);
        const source = readFileSync(file, 'utf8');
        for (const [, spec] of source.matchAll(/from '(\.{1,2}\/[^']+)'/g)) {
            const target = relative(root, resolve(dirname(file), spec ?? ''));
            if (target.startsWith('..')) outside.push(`${name} → ${spec}`);
        }
    }
    expect(outside).toEqual([]);
});
