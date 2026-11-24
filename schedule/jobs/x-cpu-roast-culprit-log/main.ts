import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { RoastDeps } from './roast.ts';
import { poll } from './roast.ts';

// a 1-minute load of 20 or more that stays for 5 minutes writes one row; the env names are for a test and the one live step
const LOAD_MIN = 20;
const SPAN_SECONDS = 300;
// the cpu window a row measures is at least this long
const GAP_SECONDS = 5;

const run = (file: string, args: string[], timeout: number) =>
    execFileSync(file, args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout,
    });

const deps: RoastDeps = {
    cwdOf: (pid) => {
        try {
            const folder = run(
                'lsof',
                ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'],
                10_000,
            )
                .split('\n')
                .find((line) => line.startsWith('n'));
            return folder?.slice(1) ?? '';
        } catch {
            return '';
        }
    },
    load: () => {
        try {
            const match = /load averages?: *([0-9.]+)/.exec(
                run('uptime', [], 10_000),
            );
            return match === null ? null : Number(match[1]);
        } catch {
            return null;
        }
    },
    now: () => Date.now(),
    ps: () => run('ps', ['-Ao', 'pid,ppid,time,command'], 30_000),
    sleep: (ms) => {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    },
    threads: () => run('x', ['thread', 'list', '--json'], 10_000),
};

poll(
    {
        gapSeconds: Number(process.env.X_ROAST_GAP ?? GAP_SECONDS),
        loadMin: Number(process.env.X_ROAST_LOAD ?? LOAD_MIN),
        spanSeconds: Number(process.env.X_ROAST_SECONDS ?? SPAN_SECONDS),
        stateDir: process.env.X_STATE ?? join(homedir(), '.local/state/x'),
    },
    deps,
);
