/* Core */
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

const script = path.resolve(import.meta.dirname, '../research-lanes.sh');

test.each([
    ['no stamp', ''],
    ['a stale stamp', 'groomed: 2000-01-01 (dima)\n'],
    // sv formats a local date as yyyy-mm-dd, the same day `date +%F` prints
    ['an unsigned stamp', `groomed: ${new Date().toLocaleDateString('sv')}\n`],
])('a recipe brief with %s is refused before any lane starts', (_, stamp) => {
    const root = mkdtempSync(path.join(tmpdir(), 'lanes-'));
    onTestFinished(() => rmSync(root, { recursive: true }));
    // a copy with no op-run.sh beside it: a broken gate fails here instead of paying for real lanes
    const copy = path.join(root, 'research-lanes.sh');
    copyFileSync(script, copy);
    const recipe = path.join(root, 'recipes/refresh-probe');
    const last = path.join(recipe, 'last');
    mkdirSync(last, { recursive: true });
    writeFileSync(
        path.join(recipe, 'recipe.md'),
        `---\nkind: refresh\n${stamp}---\n\n# refresh-probe\n`,
    );
    writeFileSync(path.join(last, 'brief.md'), 'the question\n');

    const run = spawnSync('sh', [copy, path.join(last, 'brief.md')], {
        encoding: 'utf8',
    });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('recipe refresh-probe');
    expect(readdirSync(last)).toEqual(['brief.md']);
});
