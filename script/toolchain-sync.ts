/**
 * toolchain-sync — the installed node and pnpm are the source of truth for every
 * repo's runtime pins: `.node-version` (major only, so fnm resolves whatever patch is
 * installed), `packageManager` and `engines`. Renovate is told to leave those alone.
 * `--check` reports drift and exits 1; without it the files are rewritten.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const repos = [join(homedir(), 'frame'), join(homedir(), 'projects/bytes')];
const check = process.argv.includes('--check');

const nodeMajor = process.version.slice(1).split('.')[0];
// inside a repo pnpm switches itself to that repo's `packageManager` pin, so the
// installed version is only visible from a directory no manifest governs
const pnpmVersion = execFileSync('pnpm', ['--version'], {
    cwd: tmpdir(),
    encoding: 'utf8',
}).trim();
const want = {
    engines: { node: `>=${nodeMajor}`, pnpm: `>=${pnpmVersion}` },
    nodeVersion: `${nodeMajor}\n`,
    packageManager: `pnpm@${pnpmVersion}`,
};

let drift = 0;
for (const repo of repos) {
    const nodeFile = join(repo, '.node-version');
    const manifestFile = join(repo, 'package.json');
    const manifestText = readFileSync(manifestFile, 'utf8');
    const manifest = JSON.parse(manifestText);
    const indent = manifestText.match(/\n( +)"/)?.[1] ?? '  ';
    const diffs: string[] = [];

    const nodeNow = readFileSync(nodeFile, 'utf8');
    if (nodeNow !== want.nodeVersion)
        diffs.push(`.node-version: ${nodeNow.trim()} → ${nodeMajor}`);
    if (manifest.packageManager !== want.packageManager)
        diffs.push(
            `packageManager: ${manifest.packageManager} → ${want.packageManager}`,
        );
    if (JSON.stringify(manifest.engines) !== JSON.stringify(want.engines))
        diffs.push(
            `engines: ${JSON.stringify(manifest.engines)} → ${JSON.stringify(want.engines)}`,
        );

    const name = repo.split('/').at(-1);
    if (diffs.length === 0) {
        console.log(
            `${name}: in sync (node ${nodeMajor}, pnpm ${pnpmVersion})`,
        );
        continue;
    }
    drift += diffs.length;
    for (const d of diffs)
        console.log(`${name}: ${check ? 'drift' : 'fix'} ${d}`);
    if (check) continue;
    writeFileSync(nodeFile, want.nodeVersion);
    // the tech zone reads engines · devEngines · packageManager (bytes' package-json-shape gate)
    const { devEngines, engines: _e, packageManager: _p, ...rest } = manifest;
    const sorted = {
        ...rest,
        engines: want.engines,
        ...(devEngines ? { devEngines } : {}),
        packageManager: want.packageManager,
    };
    writeFileSync(manifestFile, `${JSON.stringify(sorted, null, indent)}\n`);
}
process.exit(check && drift > 0 ? 1 : 0);
