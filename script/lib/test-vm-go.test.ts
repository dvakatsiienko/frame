import { spawn, spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const script = join(import.meta.dirname, '../test-vm-go.sh');
const budgetScript = join(import.meta.dirname, '../test-cpu-budget.sh');
const indexRun = join(import.meta.dirname, '../index-run.sh');
const downLine = 'vm-go-test down: ran on the mac';
const realGo = spawnSync('sh', ['-c', 'command -v go'], {
    encoding: 'utf8',
    timeout: 10_000,
}).stdout.trim();

// the world: a repo with a go module m/, whose test reads m/v.txt; fake limactl, ssh and go on PATH.
// the fake ssh runs its command on this machine in a guest home, so the vm leg runs end to end with no vm.
function fixture({
    goCode = 0,
    hasLima = true,
    probeCode = 0,
    realGoInGuest = false,
    runCode = 0,
    vmStatus = 'Running',
}: {
    goCode?: number;
    hasLima?: boolean;
    probeCode?: number;
    realGoInGuest?: boolean;
    runCode?: number;
    vmStatus?: string;
} = {}) {
    const dir = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'test-vm-go-'),
    );
    const copy = join(dir, 'test-vm-go.sh');
    copyFileSync(script, copy);
    chmodSync(copy, 0o755);
    const bin = join(dir, 'bin');
    const guestBin = join(dir, 'guest-bin');
    const guest = join(dir, 'guest');
    mkdirSync(bin);
    mkdirSync(guestBin);
    mkdirSync(guest);
    const fake = (at: string, name: string, body: string) => {
        writeFileSync(join(at, name), `#!/bin/bash\n${body}\n`);
        chmodSync(join(at, name), 0o755);
    };
    const goLog = join(dir, 'go.calls');
    const goBody = `echo "\${FAKE_GUEST:-mac} $* | $(cat v.txt 2>/dev/null)" >>"${goLog}"
[ -z "\${FAKE_GUEST:-}" ] || date +%s >>"${goLog}.starts"
[ -z "\${READ:-}" ] || cat "$READ" >>"${goLog}.read"
[ -z "\${FAKE_GUEST:-}" ] || for fd in 8 9; do [ ! -e /dev/fd/$fd ] || echo $fd >>"${goLog}.fds"; done
[ -z "\${FAKE_GUEST:-}" ] || [ -z "\${GO_SLEEP:-}" ] || sleep "$GO_SLEEP"
[ "$(cat v.txt 2>/dev/null)" != bad ] || { echo '--- FAIL: TestV'; exit 1; }
echo 'ok  \tm\t0.1s'
exit ${goCode}`;
    fake(bin, 'go', goBody);
    if (realGoInGuest) fake(guestBin, 'go', `exec "${realGo}" "$@"`);
    else fake(guestBin, 'go', goBody);
    // util-linux flock on an inherited fd, for a mac with none: the lock sits on the open file the guest shell holds, as the real one's does
    writeFileSync(
        join(guestBin, 'flock'),
        `#!/usr/bin/perl
use Fcntl ':flock';
my ($op, $nb) = (LOCK_EX, 0);
while (@ARGV > 1) { my $a = shift; $op = LOCK_SH if $a eq '-s' || $a eq '--shared'; $op = LOCK_UN if $a eq '-u'; $nb = LOCK_NB if $a eq '-n'; }
open(my $fh, '>&=', $ARGV[0]) or die "flock: fd $ARGV[0]: $!";
flock($fh, $op | $nb) or exit 1;
`,
    );
    chmodSync(join(guestBin, 'flock'), 0o755);
    fake(
        bin,
        'ssh',
        `echo "$*" >>"${join(dir, 'ssh.calls')}"
while [ $# -gt 0 ]; do case $1 in -F | -o) shift 2 ;; -*) shift ;; *) break ;; esac; done
shift
cmd="$*"
case $cmd in "bash -l -s"*) [ "${runCode}" = 0 ] || exit ${runCode} ;; git-receive-pack*) ;; *) [ "${probeCode}" = 0 ] || exit ${probeCode} ;; esac
# a real ssh carries none of the host's env: a hook's GIT_INDEX_FILE never reaches the guest's git
unset $(compgen -e | grep '^GIT_')
cd "${guest}" && HOME="${guest}" FAKE_GUEST=guest PATH="${guestBin}${delimiter}$PATH" exec bash -c "\${cmd/bash -l -s/bash -s}"`,
    );
    if (hasLima) fake(bin, 'limactl', `echo '${vmStatus}'`);
    const lima = join(dir, 'lima');
    mkdirSync(join(lima, 'vm-go-test'), { recursive: true });

    const code = join(dir, 'code');
    mkdirSync(join(code, 'm'), { recursive: true });
    const git = (...args: string[]) =>
        spawnSync('git', args, {
            cwd: code,
            encoding: 'utf8',
            env: gitEnv(),
            timeout: 10_000,
        });
    git('init', '-q');
    writeFileSync(join(code, 'm/go.mod'), 'module m\n\ngo 1.21\n');
    writeFileSync(
        join(code, 'm/m_test.go'),
        'package m\n\nimport (\n\t"os"\n\t"testing"\n)\n\nfunc TestV(t *testing.T) {\n\tif b, _ := os.ReadFile("v.txt"); string(b) == "bad" {\n\t\tt.Fatal("v.txt reads bad")\n\t}\n}\n',
    );
    writeFileSync(join(code, 'm/v.txt'), 'good');
    git('add', '.');
    git('commit', '-q', '-m', 'plant');

    const report = join(dir, 'report');
    const env = (extra: NodeJS.ProcessEnv = {}) => {
        const all: NodeJS.ProcessEnv = {
            ...gitEnv(),
            GOFLAGS: '-buildvcs=false',
            LIMA_HOME: lima,
            PATH: hasLima
                ? `${bin}${delimiter}${process.env.PATH}`
                : `${bin}${delimiter}/usr/bin${delimiter}/bin`,
            TEST_VM_GO_REPORT: report,
            X_STATE: join(dir, 'state'),
            ...extra,
        };
        if (!('CI' in extra)) delete all.CI;
        return all;
    };
    const cwd = join(code, 'm');
    const run = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
        spawnSync(copy, args, {
            cwd,
            encoding: 'utf8',
            env: env(extra),
            // a real go test builds from a cold cache in the guest home: 10 s died on ci
            timeout: 50_000,
        });
    const runAsync = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
        new Promise<string>((done) => {
            const child = spawn(copy, args, {
                cwd,
                env: env(extra),
                stdio: ['ignore', 'ignore', 'pipe'],
            });
            let stderr = '';
            child.stderr.on('data', (chunk) => {
                stderr += chunk;
            });
            child.on('exit', (code) => done(`exit ${code} ${stderr}`.trim()));
        });
    // a ctrl-c as a terminal sends it: SIGINT to the whole process group, once the guest's suite has started
    const runInterrupted = (args: string[]) =>
        new Promise<number | null>((done) => {
            const child = spawn(copy, args, {
                cwd,
                detached: true,
                env: env({ GO_SLEEP: '20' }),
                stdio: 'ignore',
            });
            child.on('exit', (code) => done(code));
            const poll = setInterval(() => {
                if (!existsSync(join(dir, 'go.calls.starts'))) return;
                clearInterval(poll);
                process.kill(-(child.pid ?? 0), 'SIGINT');
            }, 50);
        });
    const calls = (name: string) =>
        existsSync(join(dir, `${name}.calls`))
            ? readFileSync(join(dir, `${name}.calls`), 'utf8')
                  .trim()
                  .split('\n')
            : [];
    const leg = () =>
        existsSync(report) ? readFileSync(report, 'utf8').split('\t')[0] : '';
    const guestRefs = () =>
        spawnSync('git', ['for-each-ref', 'refs/runs/'], {
            cwd: join(guest, 'runs.git'),
            encoding: 'utf8',
            env: gitEnv(),
            timeout: 10_000,
        }).stdout.trim();
    // what a run left in the slot trees: a file outside the commit, ignored or not; the node_modules link is the slot's own
    const guestRuns = () =>
        existsSync(join(guest, 'runs'))
            ? readdirSync(join(guest, 'runs'))
                  .filter((name) => !name.endsWith('.lock'))
                  .flatMap((slot) =>
                      spawnSync(
                          'git',
                          [
                              'status',
                              '--porcelain',
                              '--ignored',
                              '--untracked-files=all',
                          ],
                          {
                              cwd: join(guest, 'runs', slot),
                              encoding: 'utf8',
                              env: gitEnv(),
                              timeout: 10_000,
                          },
                      )
                          .stdout.split('\n')
                          .filter(
                              (line) => line && !line.endsWith(' node_modules'),
                          )
                          .map((line) => `${slot}: ${line}`),
                  )
            : [];
    const guestGit = (...args: string[]) =>
        spawnSync('git', args, {
            cwd: join(guest, 'runs.git'),
            encoding: 'utf8',
            env: { ...gitEnv(), GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' },
            timeout: 10_000,
        }).stdout.trim();
    // the runner as its doors reach it, so the budget row is the one a commit writes
    // door lane: x lane commit's go step, the budget argv cpuBudgetLog builds, in the module dir over the real index.
    // door hook: lefthook's x-go-reads job, the same argv inside index-run.sh's private index copy
    const budget = (
        args: string[],
        extra: NodeJS.ProcessEnv = {},
        door: 'hook' | 'lane' = 'lane',
    ) => {
        copyFileSync(budgetScript, join(dir, 'test-cpu-budget.sh'));
        chmodSync(join(dir, 'test-cpu-budget.sh'), 0o755);
        const argv = [
            join(dir, 'test-cpu-budget.sh'),
            '--log-only',
            'm',
            ...args,
        ];
        const got =
            door === 'lane'
                ? spawnSync(argv[0] ?? '', argv.slice(1), {
                      cwd,
                      encoding: 'utf8',
                      env: env(extra),
                      timeout: 10_000,
                  })
                : spawnSync(
                      indexRun,
                      ['sh', '-c', 'cd m && exec "$@"', 'sh', ...argv],
                      {
                          cwd: code,
                          encoding: 'utf8',
                          env: env(extra),
                          timeout: 10_000,
                      },
                  );
        const log = join(dir, 'state/test-cpu-budget.log');
        const rows = existsSync(log)
            ? readFileSync(log, 'utf8')
                  .trim()
                  .split('\n')
                  .map((row) => row.split('\t'))
            : [];
        return { got, rows };
    };
    return {
        budget,
        calls,
        code,
        git,
        guest,
        guestGit,
        guestRefs,
        guestRuns,
        leg,
        run,
        runAsync,
        runInterrupted,
        windows: join(dir, 'state/test-vm-go.log'),
    };
}

const suite = ['go', 'test', '-count=1', './...'];

describe('the vm is down', () => {
    test.each([
        ['limactl reads it stopped', { vmStatus: 'Stopped' }],
        ['the 5 s ssh probe fails', { probeCode: 255 }],
    ])(
        'when %s, the suite runs on the mac with one line said',
        (_name, world) => {
            const { calls, leg, run } = fixture({ goCode: 3, ...world });

            const got = run(suite);

            expect(got.status, got.stderr).toBe(3);
            expect(calls('go')).toEqual([
                'mac test -count=1 ./... -parallel 5 | good',
            ]);
            expect(got.stderr.split(downLine)).toHaveLength(2);
            expect(leg()).toBe('vm-down');
        },
    );
});

test('with CI set it calls go test directly and says nothing', () => {
    const { calls, run } = fixture({ goCode: 3, vmStatus: 'Stopped' });

    const got = run(suite, { CI: 'true' });

    expect(got.status).toBe(3);
    expect(calls('go')).toEqual(['mac test -count=1 ./... | good']);
    expect(calls('ssh')).toEqual([]);
    expect(got.stderr).not.toContain(downLine);
});

test('a machine with no limactl runs on the mac and says nothing', () => {
    const { calls, leg, run } = fixture({ hasLima: false });

    const got = run(suite);

    expect(got.status, got.stderr).toBe(0);
    expect(calls('go')).toEqual(['mac test -count=1 ./... -parallel 5 | good']);
    expect(got.stderr).not.toContain(downLine);
    expect(leg()).toBe('mac');
});

describe('the vm leg', () => {
    test('runs the suite in the guest on its own tree and leaves no ref or tree behind', () => {
        const { calls, guestRefs, guestRuns, leg, run } = fixture();

        const got = run(suite);

        expect(got.status, got.stderr).toBe(0);
        expect(calls('go')).toEqual([
            'guest test -count=1 ./... -parallel 7 | good',
        ]);
        expect(got.stdout).toContain('ok  \tm');
        expect(leg()).toBe('vm');
        expect(guestRefs()).toBe('');
        expect(guestRuns()).toEqual([]);
    });

    test.each([
        [
            'another run still in its window marks the row vm-overlap',
            2,
            'vm-overlap',
        ],
        [
            'a killed run, its start past the leg bound with no end, marks nothing',
            600,
            'vm',
        ],
    ])('%s', (_name, ageSeconds, want) => {
        const { leg, run, windows } = fixture();
        mkdirSync(dirname(windows), { recursive: true });
        writeFileSync(
            windows,
            `start ${Math.floor(Date.now() / 1000) - ageSeconds} 1-other\n`,
        );

        run(suite);

        expect(leg()).toBe(want);
    });

    test('two runs at once each test their own commit and leave nothing behind', async () => {
        const { calls, code, guestRefs, guestRuns, runAsync } = fixture();
        // two seats' commits: each its own index, as each hook's GIT_INDEX_FILE names it
        const staged = (body: string) => {
            const index = join(code, `.git/index-${body}`);
            writeFileSync(join(code, 'm/v.txt'), body);
            spawnSync('git', ['add', 'm/v.txt'], {
                cwd: code,
                env: { ...gitEnv(), GIT_INDEX_FILE: index },
                timeout: 10_000,
            });
            return index;
        };
        const one = staged('one');
        const two = staged('two');
        const reports = [
            join(code, '../report-one'),
            join(code, '../report-two'),
        ];
        const [first, second] = [one, two].map((index, n) =>
            runAsync(['--index', ...suite], {
                GIT_INDEX_FILE: index,
                GO_SLEEP: '3',
                TEST_VM_GO_REPORT: reports[n],
            }),
        );

        expect(await Promise.all([first, second])).toEqual([
            'exit 0',
            'exit 0',
        ]);
        expect(calls('go').sort()).toEqual([
            'guest test -count=1 ./... -parallel 7 | one',
            'guest test -count=1 ./... -parallel 7 | two',
        ]);
        // side by side, never one after the other: each suite sleeps 3 s
        const [a, b] = readFileSync(join(code, '../go.calls.starts'), 'utf8')
            .trim()
            .split('\n')
            .map(Number);
        expect(Math.abs((a ?? 0) - (b ?? 99))).toBeLessThanOrEqual(1);
        expect(
            reports.map((path) => readFileSync(path, 'utf8').split('\t')[0]),
        ).toEqual(['vm-overlap', 'vm-overlap']);
        expect(guestRefs()).toBe('');
        expect(guestRuns()).toEqual([]);
    });

    test("the suite's children hold neither the slot lock nor the deps lock", () => {
        const { code, run } = fixture();

        run(suite);

        expect(existsSync(join(code, '../go.calls.fds'))).toBe(false);
    });

    test('a run leaves its parent as refs/base/head, for the next push to negotiate against', () => {
        const { git, guestGit, run } = fixture();

        run(suite);

        expect(guestGit('rev-parse', 'refs/base/head')).toBe(
            git('rev-parse', 'HEAD').stdout.trim(),
        );
    });

    test('a run that starts the second the last one ended marks no overlap', async () => {
        const { leg, run, windows } = fixture();
        mkdirSync(dirname(windows), { recursive: true });
        await new Promise((done) =>
            setTimeout(done, 1000 - (Date.now() % 1000)),
        );
        const now = Math.floor(Date.now() / 1000);
        writeFileSync(
            windows,
            `start ${now - 5} 1-other\nend ${now} 1-other\n`,
        );

        run(suite);

        expect(leg()).toBe('vm');
    });

    test('two runs of the same tree get two refs', () => {
        const { calls, run } = fixture();

        run(suite);
        run(suite);

        // the run id names its ref, refs/runs/<id>
        const runIds = calls('ssh')
            .filter((line) => line.includes('bash -l -s'))
            .map((line) => line.split('bash -l -s -- ')[1]?.split(' ')[0]);
        expect(new Set(runIds).size).toBe(2);
    });

    test.each([
        ['lane', "x lane commit's go step"],
        ['hook', 'the x-go-reads hook job'],
    ] as const)(
        'through %s (%s), a commit tests its staged file, never the unstaged edit beside it',
        (door, _name) => {
            const { budget, calls, code, git } = fixture();
            writeFileSync(join(code, 'm/v.txt'), 'fine');
            git('add', 'm/v.txt');
            writeFileSync(join(code, 'm/v.txt'), 'bad');

            const { got, rows } = budget(suite, {}, door);

            expect(got.status, got.stderr).toBe(0);
            expect(calls('go')).toEqual([
                'guest test -count=1 ./... -parallel 7 | fine',
            ]);
            expect(rows.map((row) => row[9])).toEqual(['vm']);
        },
    );

    test('a by-hand run tests the working tree, as the mac would', () => {
        const { calls, code, run } = fixture();
        writeFileSync(join(code, 'm/v.txt'), 'bad');

        const got = run(suite);

        expect(got.status).toBe(1);
        expect(calls('go')).toEqual([
            'guest test -count=1 ./... -parallel 7 | bad',
        ]);
    });

    test('a ctrl-c on a by-hand run stops it, with no re-run on the mac', async () => {
        const { calls, runInterrupted } = fixture();

        const exit = await runInterrupted(suite);

        expect(exit).toBe(130);
        expect(calls('go').filter((line) => line.startsWith('mac'))).toEqual(
            [],
        );
    }, 30_000);

    test('a by-hand run carries an unstaged edit outside the module, a file its tests read', () => {
        const { code, git, run } = fixture();
        writeFileSync(join(code, 'reads.txt'), 'committed');
        git('add', 'reads.txt');
        git('commit', '-q', '-m', 'a file x/go tests read');
        writeFileSync(join(code, 'reads.txt'), 'unstaged');

        run(suite, { READ: '../reads.txt' });

        expect(readFileSync(join(code, '../go.calls.read'), 'utf8')).toBe(
            'unstaged',
        );
    });
});

test('a failing test in the vm exits non-zero and prints its name as go test does on the mac', () => {
    const { code, run } = fixture({ realGoInGuest: true });
    writeFileSync(join(code, 'm/v.txt'), 'bad');
    const onMac = spawnSync(realGo, ['test', '-count=1', './...'], {
        cwd: join(code, 'm'),
        encoding: 'utf8',
        env: { ...process.env, GOFLAGS: '-buildvcs=false' },
        timeout: 50_000,
    });

    const got = run(suite);

    expect(onMac.status).toBe(1);
    expect(got.status).not.toBe(0);
    const failLines = (out: string) =>
        out
            .split('\n')
            .filter((line) => line.startsWith('--- FAIL'))
            .map((line) => line.replace(/ \([0-9.]+s\)$/, ''));
    expect(failLines(got.stdout)).toEqual(['--- FAIL: TestV']);
    expect(failLines(onMac.stdout)).toEqual(failLines(got.stdout));
}, 60_000);

describe('a cut vm leg', () => {
    test.each([
        ['ssh dies', 255],
        ['the vm stops under the run', 143],
        ['the guest has no go', 127],
    ])(
        'a leg where %s re-runs the suite on the mac once, logged vm-cut',
        (_name, runCode) => {
            const { budget, calls } = fixture({ goCode: 4, runCode });

            const { got, rows } = budget(suite);

            expect(got.status, got.stderr).toBe(4);
            expect(calls('go')).toEqual([
                'mac test -count=1 ./... -parallel 5 | good',
            ]);
            expect(got.stderr).toContain(
                `vm-go-test cut (exit ${runCode}): re-ran on the mac`,
            );
            expect(rows.map((row) => row[9])).toEqual(['vm-cut']);
        },
    );

    test('a leg past its deadline re-runs on the mac once, logged vm-cut', () => {
        const { budget, calls, guestRefs, guestRuns } = fixture({ goCode: 4 });

        const from = Date.now();
        const { got, rows } = budget(suite, {
            GO_SLEEP: '30',
            TEST_VM_GO_DEADLINE: '1',
        });

        // the guest's own timeout ends the leg, well before the host's at deadline + 15
        expect(Date.now() - from).toBeLessThan(10_000);
        expect(got.status, got.stderr).toBe(4);
        expect(calls('go')).toEqual([
            'guest test -count=1 ./... -parallel 7 | good',
            'mac test -count=1 ./... -parallel 5 | good',
        ]);
        expect(rows.map((row) => row[9])).toEqual(['vm-cut']);
        expect(guestRefs()).toBe('');
        expect(guestRuns()).toEqual([]);
    }, 30_000);

    test('a run sweeps the ref of a dead run older than one deadline', () => {
        const { guestGit, guestRefs, run } = fixture();
        run(suite);
        const dead = guestGit(
            'commit-tree',
            '-m',
            'a run the vm lost',
            guestGit('mktree'),
        );
        guestGit('update-ref', 'refs/runs/dead', dead);

        const got = run(suite);

        expect(got.status, got.stderr).toBe(0);
        expect(guestRefs()).toBe('');
    });

    test.each([
        [
            'a checkout lock a dead run left',
            (guest: string) =>
                writeFileSync(
                    join(guest, 'runs.git/worktrees/slot-0/index.lock'),
                    '',
                ),
        ],
        [
            'a slot dir gone while still registered',
            (guest: string) =>
                renameSync(join(guest, 'runs/slot-0'), join(guest, 'gone')),
        ],
    ])('a slot holding %s heals on the next run', (_name, breakSlot) => {
        const { calls, guest, leg, run } = fixture();
        run(suite);
        breakSlot(guest);

        const got = run(suite);

        expect(got.status, got.stderr).toBe(0);
        expect(leg()).toBe('vm');
        expect(calls('go').at(-1)).toBe(
            'guest test -count=1 ./... -parallel 7 | good',
        );
    });

    test('a file a cut run left in its slot dies before the next run reads it', () => {
        const { calls, guest, guestRuns, run } = fixture();
        run(suite);
        writeFileSync(join(guest, 'runs/slot-0/m/v.txt'), 'bad');
        writeFileSync(
            join(guest, 'runs/slot-0/m/left.txt'),
            'a cut run wrote me',
        );

        const got = run(suite);

        expect(got.status, got.stdout).toBe(0);
        expect(calls('go').at(-1)).toBe(
            'guest test -count=1 ./... -parallel 7 | good',
        );
        expect(guestRuns()).toEqual([]);
    });
});
