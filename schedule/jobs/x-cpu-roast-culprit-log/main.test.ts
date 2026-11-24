import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { RoastConfig, RoastDeps } from './roast.ts';
import { poll } from './roast.ts';

const JOB = import.meta.dirname;
const LOG = 'x-cpu-roast-culprit-log.log';
const LAST_POLL = 'x-cpu-roast-culprit-log.last-poll';
const MAIN = '/Users/dima/frame';
const START = Date.parse('2026-11-24T12:00:00Z');

type Proc = [pid: number, ppid: number, cpu: number, command: string];

const LONG = `node /Users/dima/frame/node_modules/.bin/vitest run --root ${MAIN}/home/.claude/plugin-x/mods/x-mod-stash --reporter verbose --pool forks`;
const VM =
    '/System/Library/Frameworks/Virtualization.framework/Versions/A/XPCServices/com.apple.Virtualization.VirtualMachine.xpc/Contents/MacOS/com.apple.Virtualization.VirtualMachine';

// two lanes' threads (10 and 20), a process of neither under a worktree folder (30), one of nothing (40), the vm (60)
const BASE: Proc[] = [
    [10, 1, 100, 'claude --session-id a -n mods'],
    [11, 10, 10, LONG],
    [20, 1, 50, 'claude --session-id b -n speak'],
    [21, 20, 5, 'go test ./...'],
    [30, 1, 3, '/bin/sh ../script/daemon-swap.test.sh'],
    [40, 1, 1, '/usr/libexec/mds'],
    [60, 10, 100, VM],
    [5, 1, 10, 'claude --session-id c -n coordinator'],
];
// the same machine later: 50 was born since the baseline
const HOT: Proc[] = [
    [10, 1, 100.5, 'claude --session-id a -n mods'],
    [11, 10, 130, LONG],
    [20, 1, 50.2, 'claude --session-id b -n speak'],
    [21, 20, 85, 'go test ./...'],
    [30, 1, 43, '/bin/sh ../script/daemon-swap.test.sh'],
    [40, 1, 6, '/usr/libexec/mds'],
    [50, 10, 15, 'git status'],
    [60, 10, 130, VM],
    [5, 1, 10, 'claude --session-id c -n coordinator'],
];
const THREADS = JSON.stringify({
    data: {
        threads: [
            { lane: 'mods-lane-9', pid: 10, role: 'codie' },
            { lane: 'speak-hunt', pid: 20, role: 'codie' },
            { lane: null, pid: 5, role: 'coordinator' },
        ],
    },
});
const CWD: Record<number, string> = {
    11: MAIN,
    21: MAIN,
    30: `${MAIN}/.claude/worktrees/worktree-x/script`,
    40: '/',
};

const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const psText = (rows: Proc[]) =>
    `PID PPID TIME COMMAND\n${rows.map(([pid, ppid, cpu, command]) => `${pid} ${ppid} ${clock(cpu)} ${command}`).join('\n')}\n`;

// a simulated clock and machine: the odd ps call answers BASE, the even one HOT, so every baseline and its row get a pair
function sim(options: { threadsFail?: boolean; spanSeconds?: number } = {}) {
    const stateDir = mkdtempSync(join(tmpdir(), 'roast-'));
    const calls = { cwd: [] as number[], ps: 0, threads: 0 };
    let now = START;
    let load: number | null = 25;
    const deps: RoastDeps = {
        cwdOf: (pid) => {
            calls.cwd.push(pid);
            return CWD[pid] ?? '';
        },
        load: () => load,
        now: () => now,
        ps: () => psText(++calls.ps % 2 === 1 ? BASE : HOT),
        sleep: (ms) => {
            now += ms;
        },
        threads: () => {
            calls.threads++;
            if (options.threadsFail) throw new Error('x timed out');
            return THREADS;
        },
    };
    const config: RoastConfig = {
        gapSeconds: 5,
        loadMin: 20,
        spanSeconds: options.spanSeconds ?? 300,
        stateDir,
    };
    return {
        at(seconds: number, loadNow: number | null = 25) {
            now = START + seconds * 1000;
            load = loadNow;
            poll(config, deps);
        },
        calls,
        rows() {
            try {
                return readFileSync(join(stateDir, LOG), 'utf8')
                    .split('\n')
                    .filter(Boolean);
            } catch {
                return [];
            }
        },
        stateDir,
    };
}

const minutes = (from: number, to: number, step = 60) =>
    Array.from(
        { length: Math.floor((to - from) / step) + 1 },
        (_, i) => from + i * step,
    );

describe('one row names the lane that burned the cpu', () => {
    it('maps by the parent chain, then the worktree folder, then «no lane»', () => {
        const machine = sim();
        for (const second of minutes(0, 360)) machine.at(second);

        const rows = machine.rows();
        expect(rows).toHaveLength(1);
        const fields = (rows[0] ?? '').split('\t');
        expect(Date.parse(fields[0] ?? '')).toBe(START + 300_000);
        expect(fields[1]).toBe('25.00');
        expect(fields[2]).toBe(
            'mods-lane-9 135.5s, speak-hunt 80.2s, worktree-x 40.0s, no lane 35.0s',
        );
        expect(fields).toHaveLength(8);
        expect(fields[3]).toMatch(/^11 120\.0s .* @ mods-lane-9$/);
        expect(fields[4]).toMatch(
            /^21 80\.0s go test \.\/\.\.\. @ speak-hunt$/,
        );
        expect(fields[5]).toMatch(/^30 40\.0s .* @ worktree-x$/);
        expect(fields[6]).toBe('60 30.0s vm-go-test @ no lane');
        expect(fields[7]).toBe('50 15.0s git status @ mods-lane-9');
        expect(machine.calls).toMatchObject({ ps: 2, threads: 1 });
        expect(machine.calls.cwd).toEqual([30, 40]);
    });

    it('cuts a command from the front: the last 60 characters stay', () => {
        const machine = sim();
        for (const second of minutes(0, 300)) machine.at(second);

        const row = machine.rows()[0];
        expect(row).toContain(LONG.slice(-60));
        expect(row).not.toContain(LONG.slice(-61));
    });

    it('writes the row with «threads unread» when x thread list fails, lanes by folder only', () => {
        const machine = sim({ threadsFail: true });
        for (const second of minutes(0, 300)) machine.at(second);

        const row = machine.rows()[0];
        expect(row?.split('\t')[2]).toBe('no lane 250.7s, worktree-x 40.0s');
        expect(row?.endsWith('\tthreads unread')).toBe(true);
    });
});

describe('a quiet mac costs one uptime and no file but its stamp', () => {
    it('writes no row over 1,440 polls under the threshold, and a fresh last-poll stamp', () => {
        const machine = sim();
        for (let poll = 0; poll < 1440; poll++) machine.at(poll * 60, 3);

        expect(machine.rows()).toEqual([]);
        expect(readdirSync(machine.stateDir)).toEqual([LAST_POLL]);
        expect(
            Number(readFileSync(join(machine.stateDir, LAST_POLL), 'utf8')),
        ).toBe(START + 1439 * 60_000);
        expect(machine.calls).toEqual({ cwd: [], ps: 0, threads: 0 });
    });

    it('keeps a stretch in progress when uptime cannot be read', () => {
        const machine = sim();
        machine.at(0);
        machine.at(60, null);

        expect(readdirSync(machine.stateDir).sort()).toEqual([
            LAST_POLL,
            'x-cpu-roast-culprit-log.stamp',
        ]);
    });
});

describe('the span is wall time', () => {
    it('writes no row for a load over for 4 minutes that then drops', () => {
        const machine = sim();
        for (const second of minutes(0, 240)) machine.at(second);
        machine.at(300, 3);
        machine.at(360, 3);

        expect(machine.rows()).toEqual([]);
    });

    it('writes one row for 25 minutes over, and a second for a second stretch after a drop', () => {
        const machine = sim();
        for (const second of minutes(0, 1500)) machine.at(second);
        expect(machine.rows()).toHaveLength(1);

        machine.at(1560, 3);
        for (const second of minutes(1620, 1980)) machine.at(second);

        expect(machine.rows()).toHaveLength(2);
    });

    it('starts a new stretch after a 3-hour gap, with a new baseline', () => {
        const machine = sim();
        for (const second of minutes(0, 180)) machine.at(second);
        machine.at(180 + 3 * 3600);

        expect(machine.rows()).toEqual([]);
        expect(machine.calls.ps).toBe(2);
    });

    it('writes the row once 5 minutes of wall time have passed, not on the 5th poll', () => {
        const machine = sim();
        for (const second of [0, 120, 240]) machine.at(second);
        expect(machine.rows()).toEqual([]);

        machine.at(360);

        expect(machine.rows()).toHaveLength(1);
    });

    it.each([
        { gap: 150, rows: 1 },
        { gap: 151, rows: 0 },
    ])(
        'polls $gap s apart: $rows row once 2 × $gap s have passed',
        ({ gap, rows }) => {
            const machine = sim();
            for (const second of [0, gap, 2 * gap]) machine.at(second);

            expect(machine.rows()).toHaveLength(rows);
        },
    );

    it('waits out the rest of a 5 s window when the stretch is younger than it', () => {
        const machine = sim({ spanSeconds: 0 });
        machine.at(0);

        const fields = (machine.rows()[0] ?? '').split('\t');
        expect(Date.parse(fields[0] ?? '')).toBe(START + 5000);
        expect(machine.calls.ps).toBe(2);
    });

    it('counts a load of exactly 20 as over, and 19.99 as under', () => {
        const over = sim();
        for (const second of minutes(0, 300)) over.at(second, 20);
        const under = sim();
        for (const second of minutes(0, 300)) under.at(second, 19.99);

        expect([over.rows().length, under.rows().length]).toEqual([1, 0]);
    });
});

describe('the plist', () => {
    const file = join(JOB, 'com.dima.x-cpu-roast-culprit-log.plist');

    it('names the job, runs node on main.ts every 60 s, reaches x and opens with its comment', () => {
        const plist = readFileSync(file, 'utf8');

        expect(plist).toMatch(
            /<key>Label<\/key>\s*<string>com\.dima\.x-cpu-roast-culprit-log<\/string>/,
        );
        expect(plist).toMatch(/<string>\/[^<]*\/bin\/node<\/string>/);
        expect(plist).toContain(
            '<string>/Users/dima/frame/schedule/jobs/x-cpu-roast-culprit-log/main.ts</string>',
        );
        expect(plist).toMatch(
            /<key>StartInterval<\/key>\s*<integer>60<\/integer>/,
        );
        expect(plist).toMatch(
            /<key>PATH<\/key>\s*<string>[^<]*\/Users\/dima\/\.local\/bin[^<]*<\/string>/,
        );
        expect(plist).toContain(
            '/Users/dima/.local/share/x-cpu-roast-culprit-log/run.log',
        );
        expect(plist).toContain(
            '/Users/dima/.local/share/x-cpu-roast-culprit-log/run.err.log',
        );
        expect(plist.indexOf('<!--')).toBeGreaterThan(-1);
        expect(plist.indexOf('<!--')).toBeLessThan(plist.indexOf('<plist'));
        expect(plist.slice(0, plist.indexOf('<plist'))).toContain('vm-go-test');
    });

    it('passes plutil -lint', () => {
        const lint = spawnSync('plutil', ['-lint', file], { encoding: 'utf8' });

        expect(lint.stdout + lint.stderr).toContain('OK');
    });
});

describe('main.ts as a real process', () => {
    it('reads uptime, ps, lsof and x from PATH and writes one row at threshold 0', () => {
        const dir = mkdtempSync(join(tmpdir(), 'roast-real-'));
        const bin = join(dir, 'bin');
        const state = join(dir, 'state');
        mkdirSync(bin);
        mkdirSync(state);
        const put = (name: string, body: string) => {
            writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
            chmodSync(join(bin, name), 0o755);
        };
        writeFileSync(join(bin, 'base.txt'), psText(BASE));
        writeFileSync(join(bin, 'hot.txt'), psText(HOT));
        put(
            'uptime',
            'echo "12:00  up 1 day, 7 users, load averages: 25.00 9.00 9.00"',
        );
        put(
            'ps',
            `n=$(cat ${bin}/n 2>/dev/null || echo 0); echo $((n+1)) > ${bin}/n; if [ "$n" = 0 ]; then cat ${bin}/base.txt; else cat ${bin}/hot.txt; fi`,
        );
        put(
            'lsof',
            `printf 'p%s\\nfcwd\\nn${MAIN}/.claude/worktrees/worktree-x\\n' "$3"`,
        );
        put('x', `echo '${THREADS}'`);

        const run = spawnSync(process.execPath, [join(JOB, 'main.ts')], {
            encoding: 'utf8',
            env: {
                HOME: dir,
                PATH: `${bin}:${process.env.PATH}`,
                X_ROAST_GAP: '0',
                X_ROAST_SECONDS: '0',
                X_STATE: state,
            },
        });

        expect(run.status, run.stderr).toBe(0);
        const rows = readFileSync(join(state, LOG), 'utf8')
            .split('\n')
            .filter(Boolean);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.split('\t')[2]).toContain('mods-lane-9 135.5s');
        expect(readdirSync(state).sort()).toEqual(
            [LAST_POLL, LOG, 'x-cpu-roast-culprit-log.stamp'].sort(),
        );
    });
});
