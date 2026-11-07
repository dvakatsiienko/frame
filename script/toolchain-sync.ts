/**
 * toolchain-sync — the installed node and pnpm are the source of truth for every
 * repo's runtime pins: `.node-version` (major only, so fnm resolves whatever patch is
 * installed), `packageManager`, `engines`, `devEngines.runtime` and trophy-sys's two
 * node pins in bytes. Renovate is told to leave those alone.
 * `--check` reports drift and exits 1, and also reads each Vercel project's node version
 * (the logged-in vercel cli); without it the files are rewritten and each lockfile refreshed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// a pin outside the manifest: only the number moves, the capture groups keep the rest
const pins = [
    {
        file: 'apps/trophy-sys/package.json',
        pattern: /(--target=node)\d+()/,
    },
    {
        file: 'apps/trophy-sys/script/vercel-output.ts',
        pattern: /(runtime: 'nodejs)\d+(\.x')/,
    },
] as const;

export function toolchainSync(check: boolean, deps: Deps) {
    const { nodeMajor, pnpmVersion } = deps;
    const want = {
        devEngines: `>=${nodeMajor}.0.0`,
        engines: { node: `>=${nodeMajor}`, pnpm: `>=${pnpmVersion}` },
        nodeVersion: `${nodeMajor}\n`,
        packageManager: `pnpm@${pnpmVersion}`,
    };

    let drift = 0;
    for (const repo of deps.repos) {
        const nodeFile = join(repo, '.node-version');
        const manifestFile = join(repo, 'package.json');
        const manifestText = readFileSync(manifestFile, 'utf8');
        const manifest = JSON.parse(manifestText);
        const indent = manifestText.match(/\n( +)"/)?.[1] ?? '  ';
        const diffs: string[] = [];
        const writes: (() => void)[] = [];

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
        if (manifest.devEngines?.runtime?.version !== want.devEngines)
            diffs.push(
                `devEngines.runtime.version: ${manifest.devEngines?.runtime?.version} → ${want.devEngines}`,
            );

        for (const pin of pins) {
            const pinFile = join(repo, pin.file);
            if (!existsSync(pinFile)) continue;
            const pinText = readFileSync(pinFile, 'utf8');
            const found = pinText.match(pin.pattern)?.[0];
            const fixed = pinText.replace(pin.pattern, `$1${nodeMajor}$2`);
            if (!found) diffs.push(`${pin.file}: node pin not found`);
            else if (fixed !== pinText) {
                diffs.push(
                    `${pin.file}: ${found} → ${fixed.match(pin.pattern)?.[0]}`,
                );
                writes.push(() => writeFileSync(pinFile, fixed));
            }
        }

        const name = repo.split('/').at(-1);
        const appsDir = join(repo, 'apps');
        const projects =
            check && existsSync(appsDir)
                ? readdirSync(appsDir).filter((app) =>
                      existsSync(join(appsDir, app, 'vercel.json')),
                  )
                : [];
        if (projects.length > 0) {
            let versions: Record<string, string> = {};
            let failure = '';
            try {
                versions = deps.readVercel();
            } catch (error) {
                failure = String(error);
            }
            for (const project of projects) {
                const version = versions[project];
                if (version === `${nodeMajor}.x`) continue;
                diffs.push(
                    `vercel ${project}: ${failure ? `read failed (${failure})` : `${version ?? 'not listed'} → ${nodeMajor}.x`}`,
                );
            }
        }

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
        const {
            devEngines,
            engines: _e,
            packageManager: _p,
            ...rest
        } = manifest;
        // entries, not a literal: biome sorts a literal's keys and the gate wants this order
        const sorted = Object.fromEntries([
            ...Object.entries(rest),
            ['engines', want.engines],
            [
                'devEngines',
                {
                    ...devEngines,
                    runtime: {
                        name: 'node',
                        ...devEngines?.runtime,
                        version: want.devEngines,
                    },
                },
            ],
            ['packageManager', want.packageManager],
        ]);
        writeFileSync(
            manifestFile,
            `${JSON.stringify(sorted, null, indent)}\n`,
        );
        for (const write of writes) write();
        deps.install(repo);
    }
    return check && drift > 0 ? 1 : 0;
}

// `vercel project ls` prints one row per project, its node version the last column; the cli writes the table to stderr
function readVercelNodes() {
    const ls = spawnSync('vercel', ['project', 'ls'], {
        cwd: tmpdir(),
        encoding: 'utf8',
    });
    if (ls.error || ls.status !== 0)
        throw new Error(
            ls.error?.message ?? `vercel project ls exit ${ls.status}`,
        );
    const versions: Record<string, string> = {};
    for (const row of `${ls.stdout}${ls.stderr}`.split('\n')) {
        const match = row.match(/^\s*(\S+)\s.*?(\d+\.x)\s*$/);
        if (match?.[1] && match[2]) versions[match[1]] = match[2];
    }
    return versions;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // inside a repo pnpm switches itself to that repo's `packageManager` pin, so the
    // installed version is only visible from a directory no manifest governs
    const pnpmVersion = execFileSync('pnpm', ['--version'], {
        cwd: tmpdir(),
        encoding: 'utf8',
    }).trim();
    process.exit(
        toolchainSync(process.argv.includes('--check'), {
            // a pin bump alone reds ci's frozen install; CI=1 keeps the hook shims where they are
            install: (repo) =>
                execFileSync(
                    'pnpm',
                    ['install', '--lockfile-only', '--no-frozen-lockfile'],
                    {
                        cwd: repo,
                        env: { ...process.env, CI: '1' },
                        stdio: 'inherit',
                    },
                ),
            nodeMajor: process.version.slice(1).split('.')[0] ?? '',
            pnpmVersion,
            readVercel: readVercelNodes,
            repos: [
                join(homedir(), 'frame'),
                join(homedir(), 'projects/bytes'),
            ],
        }),
    );
}

/* Types */

/** everything the sync reads from outside: a test hands in fixtures, the script hands in the machine */
export interface Deps {
    install: (repo: string) => void;
    nodeMajor: string;
    pnpmVersion: string;
    /** project name → node version like `26.x`; throws when the read fails */
    readVercel: () => Record<string, string>;
    repos: string[];
}
