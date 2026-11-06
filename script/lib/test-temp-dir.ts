// a test run's own TMPDIR: every fixture dir its tests and their children leave goes with the run.
// vitest loads this as its globalSetup, `pnpm mods:test` calls setup itself
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUN_DIR = /^ftr-(\d+)-[0-9a-f]{4}$/;
const KILLED_RUN_MIN_AGE_MS = 3_600_000;

// a detached child may still write, so a leftover dir is named and a green run stays green
function removeOrLog(dir: string) {
    try {
        rmSync(dir, { force: true, maxRetries: 3, recursive: true });
    } catch (error) {
        console.error(`test temp dir left behind: ${dir}: ${String(error)}`);
    }
}

function isProcessAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

// the age guards a reused pid and a child that outlived its killed run
function sweepKilledRuns(base: string) {
    for (const name of readdirSync(base)) {
        const pid = name.match(RUN_DIR)?.[1];
        if (!pid || isProcessAlive(Number(pid))) continue;
        const dir = join(base, name);
        // a peer run may sweep the same dir first
        const modified = statSync(dir, { throwIfNoEntry: false })?.mtimeMs;
        if (modified && Date.now() - modified > KILLED_RUN_MIN_AGE_MS)
            removeOrLog(dir);
    }
}

export function setup() {
    sweepKilledRuns(tmpdir());
    // short: a unix socket path under it caps at 104 bytes
    const runDir = join(
        tmpdir(),
        `ftr-${process.pid}-${randomBytes(2).toString('hex')}`,
    );
    mkdirSync(runDir, { mode: 0o700 });
    process.env.TMPDIR = runDir;
    return () => removeOrLog(runDir);
}
