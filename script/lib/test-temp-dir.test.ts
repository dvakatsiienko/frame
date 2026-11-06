import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { expect, test, vi } from 'vitest';

const root = join(import.meta.dirname, '../..');
const vitest = join(root, 'node_modules/vitest/vitest.mjs');
const RUN_DIR = /^ftr-\d+-[0-9a-f]{4}$/;
const CHILD_RUN_TIMEOUT = 120_000;

// the parent run's own marks would turn the child into a worker of this run
function childEnv(temp: string) {
    const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: temp };
    for (const key of Object.keys(env))
        if (key.startsWith('VITEST')) delete env[key];
    return env;
}

function ownTempDir() {
    return mkdtempSync(join(tmpdir(), 'temp-dir-own-'));
}

function fixtureDir(testSource: string) {
    const dir = mkdtempSync(join(tmpdir(), 'temp-dir-fixture-'));
    writeFileSync(join(dir, 'fixture.test.ts'), testSource);
    return dir;
}

// the real config, so a row reads the seam every run goes through; --globals since a fixture sits outside the repo's node_modules
function childArgs(fixture: string) {
    return [vitest, 'run', '--dir', fixture, '--globals'];
}

function runChild(fixture: string, temp: string) {
    return spawnSync(process.execPath, childArgs(fixture), {
        cwd: root,
        encoding: 'utf8',
        env: childEnv(temp),
    });
}

const LEAKY_TEST = `
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('leaks', () => { mkdtempSync(join(tmpdir(), 'leak-')); });
`;

test('a child process a test spawns reads the run dir', () => {
    const child = spawnSync(process.execPath, ['-p', 'os.tmpdir()'], {
        encoding: 'utf8',
    }).stdout.trim();

    console.log(`child tmpdir: ${child}`);
    expect(basename(child)).toMatch(RUN_DIR);
    expect(child).toBe(tmpdir());
});

test(
    'a green run leaves nothing in its temp dir',
    () => {
        const temp = ownTempDir();

        const run = runChild(fixtureDir(LEAKY_TEST), temp);

        expect(run.status, run.stdout + run.stderr).toBe(0);
        expect(readdirSync(temp)).toEqual([]);
    },
    CHILD_RUN_TIMEOUT,
);

test(
    'a failed removal only logs, the run stays green',
    () => {
        const temp = ownTempDir();
        const fixture = fixtureDir(`
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('locks a dir the teardown cannot empty', () => {
    const locked = mkdtempSync(join(tmpdir(), 'locked-'));
    writeFileSync(join(locked, 'file'), '');
    chmodSync(locked, 0o500);
});
`);

        const run = runChild(fixture, temp);

        const [left] = readdirSync(temp);
        const lockedParent = join(temp, left ?? '');
        for (const name of readdirSync(lockedParent))
            chmodSync(join(lockedParent, name), 0o700);
        expect(run.status, run.stdout + run.stderr).toBe(0);
        expect(run.stdout + run.stderr).toContain('test temp dir left behind');
    },
    CHILD_RUN_TIMEOUT,
);

const HOUR = 3_600_000;

function deadPid() {
    return Number(
        spawnSync(process.execPath, ['-p', 'process.pid'], {
            encoding: 'utf8',
        }).stdout,
    );
}

function plantDir(temp: string, name: string, ageMs: number) {
    const dir = join(temp, name);
    mkdirSync(dir);
    const when = new Date(Date.now() - ageMs);
    utimesSync(dir, when, when);
}

function runModsChild(temp: string) {
    const bin = mkdtempSync(join(tmpdir(), 'temp-dir-bin-'));
    writeFileSync(
        join(bin, 'claude'),
        '#!/bin/sh\nmktemp -d "$TMPDIR/leak.XXXXXX" >/dev/null\necho tests/a.test.ts:\necho "(pass) ran"\n',
    );
    chmodSync(join(bin, 'claude'), 0o755);
    return spawnSync(
        process.execPath,
        [join(root, 'home/.claude/plugin-x/mods/test.ts'), 'x-mod-guard'],
        {
            cwd: root,
            encoding: 'utf8',
            env: {
                ...childEnv(temp),
                PATH: `${bin}:${process.env.PATH}`,
                X_TEST: '1',
            },
        },
    );
}

const runners = [
    {
        name: 'vitest',
        run: (temp: string) => runChild(fixtureDir(LEAKY_TEST), temp),
    },
    { name: 'mods:test', run: runModsChild },
];

test.each(runners)(
    'a $name run sweeps only a dead pid over an hour old',
    ({ run }) => {
        const temp = ownTempDir();
        const dead = deadPid();
        const kept = [
            { ageMs: 2 * HOUR, name: `ftr-${process.pid}-aaaa` },
            // pid 1 answers «not yours», which still means alive
            { ageMs: 2 * HOUR, name: 'ftr-1-dddd' },
            { ageMs: HOUR / 2, name: `ftr-${dead}-bbbb` },
            { ageMs: 2 * HOUR, name: `ftr-${dead}-toolong` },
            { ageMs: 2 * HOUR, name: 'ftr-notes' },
            { ageMs: 2 * HOUR, name: 'memory-load-abc' },
        ];
        for (const { ageMs, name } of kept) plantDir(temp, name, ageMs);
        plantDir(temp, `ftr-${dead}-cccc`, 2 * HOUR);

        const result = run(temp);

        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(readdirSync(temp).sort()).toEqual(
            kept.map(({ name }) => name).sort(),
        );
    },
    CHILD_RUN_TIMEOUT,
);

test(
    'a mods:test run leaves nothing in its temp dir',
    () => {
        const temp = ownTempDir();

        const run = runModsChild(temp);

        expect(run.status, run.stdout + run.stderr).toBe(0);
        expect(readdirSync(temp)).toEqual([]);
    },
    CHILD_RUN_TIMEOUT,
);

test(
    'a killed run leaves one named dir for a later run to sweep',
    async () => {
        const temp = ownTempDir();
        const started = join(
            mkdtempSync(join(tmpdir(), 'temp-dir-marker-')),
            'worker-pid',
        );
        const fixture = fixtureDir(`
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('waits to be killed', async () => {
    mkdtempSync(join(tmpdir(), 'leak-'));
    writeFileSync(process.env.STARTED, String(process.pid));
    await new Promise((resolve) => setTimeout(resolve, 20_000));
}, 30_000);
`);
        const child = spawn(process.execPath, childArgs(fixture), {
            cwd: root,
            env: { ...childEnv(temp), STARTED: started },
            stdio: 'ignore',
        });
        const exited = once(child, 'exit');
        // never an empty read: pid 0 would signal this run's whole process group
        const workerPid = await vi.waitFor(
            () => {
                const pid = Number(readFileSync(started, 'utf8'));
                if (!pid) throw new Error('no worker pid yet');
                return pid;
            },
            { interval: 50, timeout: CHILD_RUN_TIMEOUT / 2 },
        );

        child.kill('SIGKILL');
        await exited;
        // the orphaned worker may already have left on the lost ipc channel
        try {
            process.kill(workerPid, 'SIGKILL');
        } catch {}

        const leftovers = readdirSync(temp);
        expect(leftovers).toEqual([expect.stringMatching(RUN_DIR)]);
        const killedDir = join(temp, leftovers[0] ?? '');
        expect(readdirSync(killedDir)).toEqual([
            expect.stringMatching(/^leak-/),
        ]);

        const past = new Date(Date.now() - 2 * HOUR);
        utimesSync(killedDir, past, past);
        const next = runChild(fixtureDir(LEAKY_TEST), temp);

        expect(next.status, next.stdout + next.stderr).toBe(0);
        expect(readdirSync(temp)).toEqual([]);
    },
    CHILD_RUN_TIMEOUT,
);
