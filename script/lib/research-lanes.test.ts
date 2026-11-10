/* Core */
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

const script = path.resolve(import.meta.dirname, '../research-lanes.sh');
const builder = path.resolve(import.meta.dirname, '../recipe-brief.ts');
// a brief as recipe:brief marks it; `built` runs the real builder in the fixture instead
const MARKED = `<!-- shared-vectors: ${'0'.repeat(64)} -->\nthe question\n`;
// sv formats a local date as yyyy-mm-dd, the same day `date +%F` prints
const today = new Date().toLocaleDateString('sv');

function runLanes(
    stamp: string,
    briefDir: 'recipe' | 'outside',
    brief: string = MARKED,
) {
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
        `---\nkind: refresh\n${stamp}---\n\n# refresh-probe\n\n## the want\n\nfind it.\n\n## vectors\n\n- **one**\n`,
    );
    if (brief === 'built') {
        writeFileSync(
            path.join(root, 'recipes/AGENTS.md'),
            '# recipes\n\n## the shared vectors\n\n- **the delta**\n',
        );
        mkdirSync(path.join(root, 'script'));
        copyFileSync(builder, path.join(root, 'script/recipe-brief.ts'));
        spawnSync(
            'node',
            [path.join(root, 'script/recipe-brief.ts'), 'refresh-probe'],
            { timeout: 10_000 },
        );
    } else writeFileSync(path.join(dir, 'brief.md'), brief);
    // the copy has no spender, so these rows read the gates even under a verify run's X_VERIFY
    const run = spawnSync('sh', [copy, path.join(dir, 'brief.md')], {
        encoding: 'utf8',
        env: { ...process.env, X_VERIFY: '' },
        timeout: 10_000,
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

test('a recipe brief with no shared-vectors marker is refused, naming pnpm recipe:brief', () => {
    const { run, entries } = runLanes(
        `groomed: ${today} (dima)\n`,
        'recipe',
        'the question\n',
    );

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('pnpm recipe:brief refresh-probe');
    expect(entries).toEqual(['brief.md']);
});

test('a brief built by recipe:brief lets the lanes start', () => {
    const { run, entries } = runLanes(
        `groomed: ${today} (dima)\n`,
        'recipe',
        'built',
    );

    expect(run.stderr).not.toContain('recipe:brief');
    expect(entries.some((entry) => entry.startsWith('lanes-'))).toBe(true);
    expect(run.stdout).not.toMatch(/^(exa|parallel): /m);
});

// x verify red sets X_VERIFY=1 on both its runs, so a mutant of a paid script never spends
test.each([
    ['X_VERIFY=1 skips both paid lanes, saying so', '1', 0],
    ['no X_VERIFY reaches the stubbed spender', '', 2],
])('%s', (_, verify, calls) => {
    const root = mkdtempSync(path.join(tmpdir(), 'lanes-verify-'));
    onTestFinished(() => rmSync(root, { recursive: true }));
    const copy = path.join(root, 'research-lanes.sh');
    copyFileSync(script, copy);
    const log = path.join(root, 'op-run.calls');
    writeFileSync(
        path.join(root, 'op-run.sh'),
        `#!/bin/sh\necho "$3" >> ${log}\n`,
        { mode: 0o755 },
    );
    writeFileSync(path.join(root, 'brief.md'), 'the question\n');

    const run = spawnSync('sh', [copy, path.join(root, 'brief.md')], {
        encoding: 'utf8',
        env: { ...process.env, X_VERIFY: verify },
        timeout: 10_000,
    });

    const made = existsSync(log) ? readFileSync(log, 'utf8') : '';
    expect(made.split('\n').filter(Boolean)).toHaveLength(calls);
    if (verify) {
        expect(run.status).toBe(0);
        expect(run.stdout).toContain('X_VERIFY');
    }
});
