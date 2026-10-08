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
// sv formats a local date as yyyy-mm-dd, the same day `date +%F` prints
const today = new Date().toLocaleDateString('sv');

function runLanes(stamp: string, briefDir: 'recipe' | 'outside') {
    const root = mkdtempSync(path.join(tmpdir(), 'lanes-'));
    onTestFinished(() => rmSync(root, { recursive: true }));
    // a copy with no op-run.sh beside it: no run here can pay for real lanes
    const copy = path.join(root, 'research-lanes.sh');
    copyFileSync(script, copy);
    const recipe = path.join(root, 'recipes/refresh-probe');
    const dir = briefDir === 'recipe' ? path.join(recipe, 'last') : root;
    mkdirSync(path.join(recipe, 'last'), { recursive: true });
    writeFileSync(
        path.join(recipe, 'recipe.md'),
        `---\nkind: refresh\n${stamp}---\n\n# refresh-probe\n`,
    );
    writeFileSync(path.join(dir, 'brief.md'), 'the question\n');
    const run = spawnSync('sh', [copy, path.join(dir, 'brief.md')], {
        encoding: 'utf8',
    });
    return { entries: readdirSync(dir), run };
}

test.each([
    ['no stamp', ''],
    ['a stale stamp', 'groomed: 2000-01-01 (dima)\n'],
    ['an unsigned stamp', `groomed: ${today}\n`],
])('a recipe brief with %s is refused before any lane starts', (_, stamp) => {
    const { run, entries } = runLanes(stamp, 'recipe');

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('recipe refresh-probe');
    expect(entries).toEqual(['brief.md']);
});

test.each([
    ['a plain stamp from today', `groomed: ${today} (dima)\n`, 'recipe'],
    ['a quoted stamp from today', `groomed: "${today} (dima)"\n`, 'recipe'],
    [
        'a commented stamp from today',
        `groomed: ${today} (dima) # by dima\n`,
        'recipe',
    ],
    ['a crlf stamp from today', `groomed: ${today} (dima)  \r\n`, 'recipe'],
    ['a brief outside recipes/', '', 'outside'],
] as const)('%s lets the lanes start', (_, stamp, briefDir) => {
    const { run, entries } = runLanes(stamp, briefDir);

    expect(entries.some((entry) => entry.startsWith('lanes-'))).toBe(true);
    // no lane body ran (each prints its «exa:» / «parallel:» line), so nothing reached the network
    expect(run.status).not.toBe(0);
    expect(run.stdout).not.toMatch(/^(exa|parallel): /m);
});
