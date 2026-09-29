import { join } from 'node:path';
import { expect, it } from 'vitest';

import { readRoles } from './lib/roles.ts';
import { runScript } from './lib/run.ts';

it('writes a tailwind v4 @theme block with one --color-* var per colour token', () => {
    const fixture = join(import.meta.dirname, 'fixtures', 'tokens.json');
    const tokenCount = Object.values(readRoles(fixture)).flat().length;

    const { stdout } = runScript('tokens', [fixture]);

    expect(stdout.trim()).toMatch(/^@theme \{\n[\s\S]*\n\}$/);
    expect(stdout.match(/^\s+--color-[\w-]+: #[0-9a-f]{6};$/gm)).toHaveLength(
        tokenCount,
    );
});
