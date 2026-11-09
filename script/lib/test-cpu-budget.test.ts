import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const script = join(import.meta.dirname, '../test-cpu-budget.sh');
const runner = join(import.meta.dirname, '../test-vm-go.sh');

// a fake go burning a known cpu in its own process, so a row reads a real user + sys and never a sleep
const stubGo = (burnMs: number, printed: string, code: number) => `#!/bin/bash
ms() { local v=$1 m s; m=\${v%%m*}; s=\${v#*m}; s=\${s%s}; s=\${s/,/.}; echo $(( 10#$m * 60000 + 10#\${s%.*} * 1000 + 10#\${s#*.} )); }
while :; do
    times >"$TIMES_FILE"
    { read -r user sys; } <"$TIMES_FILE"
    [ $(( $(ms "$user") + $(ms "$sys") )) -ge ${burnMs} ] && break
done
echo "$*" >"$TIMES_FILE.args"
echo '${printed}'
exit ${code}
`;

function fixture({
    budget = '0\t2026-11-07\tthe fixture line',
    burnMs = 150,
    code = 0,
    printed = 'ok  \tx\t0.150s',
}: {
    budget?: string;
    burnMs?: number;
    code?: number;
    printed?: string;
} = {}) {
    const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'budget-'));
    const copy = join(dir, 'test-cpu-budget.sh');
    copyFileSync(script, copy);
    chmodSync(copy, 0o755);
    copyFileSync(runner, join(dir, 'test-vm-go.sh'));
    chmodSync(join(dir, 'test-vm-go.sh'), 0o755);
    writeFileSync(
        join(dir, 'test-cpu-budget.tsv'),
        `# suite\tcpu-s\tdate\treason\nx-go\t${budget}`,
    );
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'go'), stubGo(burnMs, printed, code));
    chmodSync(join(bin, 'go'), 0o755);
    // the runner reads the vm stopped, so a run never reaches the real vm-go-test
    writeFileSync(join(bin, 'limactl'), '#!/bin/bash\necho Stopped\n');
    chmodSync(join(bin, 'limactl'), 0o755);
    const slimBin = join(dir, 'git-slim/current/bin');
    mkdirSync(slimBin, { recursive: true });
    writeFileSync(join(slimBin, 'git'), '#!/bin/bash\n');
    chmodSync(join(slimBin, 'git'), 0o755);
    const brewBin = join(dir, 'brew-bin');
    mkdirSync(brewBin);
    writeFileSync(join(brewBin, 'git'), '#!/bin/bash\n');
    chmodSync(join(brewBin, 'git'), 0o755);
    const state = join(dir, 'state');
    const run = (
        args: string[],
        extra: NodeJS.ProcessEnv = {},
        gitBin = slimBin,
        cwd = dir,
    ) => {
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            PATH: `${bin}${delimiter}${gitBin}${delimiter}${process.env.PATH}`,
            TIMES_FILE: join(dir, 'times'),
            X_STATE: state,
            ...extra,
        };
        if (!('CI' in extra)) delete env.CI;
        return spawnSync(copy, args, { cwd, encoding: 'utf8', env });
    };
    const rows = () =>
        existsSync(join(state, 'test-cpu-budget.log'))
            ? readFileSync(join(state, 'test-cpu-budget.log'), 'utf8')
                  .trimEnd()
                  .split('\n')
                  .map((row) => row.split('\t'))
            : [];
    const goArgs = () => readFileSync(join(dir, 'times.args'), 'utf8').trim();
    return { brewBin, dir, goArgs, rows, run, slimBin };
}

const whole = ['x-go', 'go', 'test', '-count=1', './...'];

describe('the runner it hands the suite to', () => {
    test.each([
        [
            'a commit door (--log-only) tests the index alone',
            ['--log-only', ...whole],
            '--index go test -count=1 ./...',
        ],
        [
            'a by-hand run tests the working tree',
            whole,
            'go test -count=1 ./...',
        ],
    ])('%s', (_name, args, handed) => {
        const { dir, run } = fixture({ budget: '9999\t2026-11-07\tno red' });
        writeFileSync(
            join(dir, 'test-vm-go.sh'),
            `#!/bin/bash\necho "$*" >"${join(dir, 'runner.args')}"\n`,
        );

        run(args);

        expect(readFileSync(join(dir, 'runner.args'), 'utf8').trim()).toBe(
            handed,
        );
    });

    test.each([
        ['a solo vm row past its line goes red', 'vm', 1],
        [
            'a vm-overlap row past its line never reds: its number is shared',
            'vm-overlap',
            0,
        ],
    ])('%s', (_name, leg, status) => {
        const { dir, rows, run } = fixture();
        writeFileSync(
            join(dir, 'test-vm-go.sh'),
            `#!/bin/bash\nprintf '${leg}\\t5000\\n' >"$TEST_VM_GO_REPORT"\necho 'ok  \tx\t1s'\n`,
        );

        const got = run(whole);

        expect(got.status, got.stderr).toBe(status);
        expect(rows()[0]?.[9]).toBe(leg);
        expect(Number(rows()[0]?.[3])).toBeGreaterThanOrEqual(5);
    });
});

describe('the worker cap', () => {
    test('a whole run on this mac takes 5 workers', () => {
        const { goArgs, run } = fixture({ budget: '9999\t2026-11-07\tno red' });

        run(whole);

        expect(goArgs()).toBe('test -count=1 ./... -parallel 5');
    });

    test('a run in ci keeps the runner default', () => {
        const { goArgs, run } = fixture();

        run(whole, { CI: 'true' });

        expect(goArgs()).toBe('test -count=1 ./...');
    });
});

describe('a whole run past its line', () => {
    test('goes red naming the suite, the number, the budget and how to raise it', () => {
        const { rows, run } = fixture();

        const got = run(whole);

        expect(got.status, got.stderr).toBe(1);
        expect(got.stderr).toMatch(
            /x-go used [0-9]+\.[0-9] cpu-s, its budget is 0 cpu-s/,
        );
        expect(got.stderr).toContain('script/test-cpu-budget.tsv');
        expect(got.stderr).toContain('a later lane may read a cost');
        expect(rows()).toHaveLength(1);
    });

    test.each([
        ['CI set', whole, { CI: 'true' }],
        ['--log-only', ['--log-only', ...whole], {}],
    ])('with %s it logs its row and exits 0', (_name, args, extra) => {
        const { rows, run } = fixture();

        const got = run(args, extra);

        expect(got.status, got.stderr).toBe(0);
        expect(rows()).toHaveLength(1);
        expect(rows()[0]?.[2]).toBe('x-go');
    });
});

describe('a whole run keys the code it ran on', () => {
    const realGit = dirname(
        spawnSync('sh', ['-c', 'command -v git'], {
            encoding: 'utf8',
        }).stdout.trim(),
    );
    const git = (cwd: string, ...args: string[]) =>
        spawnSync(join(realGit, 'git'), args, { cwd, encoding: 'utf8' });

    test('the same bytes keep one key, an edit reads dirty, a staged edit moves the key', () => {
        const { dir, rows, run } = fixture({
            budget: '60\t2026-11-07\troomy',
        });
        const code = join(dir, 'code');
        mkdirSync(code);
        git(code, 'init', '-q');
        writeFileSync(join(code, 'a.go'), 'package a\n');
        git(code, 'add', '.');
        const keyed = () => run(whole, {}, realGit, code);

        keyed();
        keyed();
        writeFileSync(join(code, 'a.go'), 'package a // edited\n');
        keyed();
        git(code, 'add', '.');
        keyed();

        const [first, again, edited, staged] = rows().map((row) =>
            row.slice(7, 9),
        );
        expect(first?.[0]).toMatch(/^[0-9a-f]{12}$/);
        expect(first?.[1]).toBe('clean');
        expect(again).toEqual(first);
        expect(edited).toEqual([first?.[0], 'dirty']);
        expect(staged?.[0]).not.toBe(first?.[0]);
        expect(staged?.[1]).toBe('clean');
    });
});

describe('a whole run reads its git', () => {
    test('prints and logs the git path it found', () => {
        const { rows, run, slimBin } = fixture({
            budget: '60\t2026-11-07\troomy',
        });

        const got = run(whole);

        expect(got.status, got.stderr).toBe(0);
        expect(rows()[0]?.[6]).toBe(join(slimBin, 'git'));
        expect(got.stderr).toContain(join(slimBin, 'git'));
        expect(got.stderr).not.toContain('script/git-slim.sh');
    });

    test('past its line on another git it logs, names the rebuild and never reds', () => {
        const { brewBin, rows, run } = fixture();

        const got = run(whole, {}, brewBin);

        expect(got.status, got.stderr).toBe(0);
        expect(rows()[0]?.[6]).toBe(join(brewBin, 'git'));
        expect(got.stderr).toContain('script/git-slim.sh');
        expect(got.stderr).not.toContain('its budget is');
    });

    test('with CI set it never asks for the rebuild', () => {
        const { brewBin, run } = fixture();

        const got = run(whole, { CI: 'true' }, brewBin);

        expect(got.status, got.stderr).toBe(0);
        expect(got.stderr).not.toContain('script/git-slim.sh');
    });
});

describe('a run under its line', () => {
    test('stays green and logs the cpu its children spent', () => {
        const { rows, run } = fixture({ budget: '60\t2026-11-07\troomy' });

        const got = run(whole);

        expect(got.status, got.stderr).toBe(0);
        expect(got.stdout).toContain('ok  \tx');
        const cpu = Number(rows()[0]?.[3]);
        expect(cpu).toBeGreaterThanOrEqual(0.1);
        expect(cpu).toBeLessThan(30);
        expect(rows()[0]?.[4]).toBe('60');
    });

    test.each([
        ['on this mac', {}, 'vm-down'],
        ['in ci', { CI: 'true' }, '-'],
    ])('names the leg it ran on %s in its 10th column', (_name, extra, leg) => {
        const { rows, run } = fixture({ budget: '60\t2026-11-07\troomy' });

        run(whole, extra);

        expect(rows()[0]).toHaveLength(10);
        expect(rows()[0]?.[9]).toBe(leg);
    });
});

describe('a run that is not whole never counts', () => {
    test.each([
        ['a -run filter', ['x-go', 'go', 'test', '-run', 'TestOne', './...']],
        ['a -run= filter', ['x-go', 'go', 'test', '-run=TestOne', './...']],
        ['a -skip', ['x-go', 'go', 'test', '-skip=TestOne', './...']],
        ['many runs', ['x-go', 'go', 'test', '-count=5', './...']],
        ['a tag', ['x-go', 'go', 'test', '-tags', 'nostacks', './...']],
        ['one test file', ['x-go', 'go', 'test', 'a_test.go']],
    ])('%s logs no row and never reds', (_name, args) => {
        const { rows, run } = fixture();

        const got = run(args);

        expect(got.status, got.stderr).toBe(0);
        expect(rows()).toEqual([]);
    });

    test('a cached run logs no row and never reds', () => {
        const { rows, run } = fixture({ printed: 'ok  \tx\t(cached)' });

        const got = run(['x-go', 'go', 'test', './...']);

        expect(got.status, got.stderr).toBe(0);
        expect(rows()).toEqual([]);
    });
});

test('a red suite keeps its own exit and its budget stays quiet', () => {
    const { run } = fixture({ code: 3 });

    const got = run(whole);

    expect(got.status).toBe(3);
    expect(got.stderr).not.toContain('its budget is');
});

test('a row that is no whole number says so and never reds', () => {
    const { rows, run } = fixture({ budget: '370.5\t2026-11-07\ta typo' });

    const got = run(whole);

    expect(got.status, got.stderr).toBe(0);
    expect(got.stderr).toContain("reads '370.5'");
    expect(rows()).toHaveLength(1);
});

test('a suite with no row logs and never reds', () => {
    const { rows, run } = fixture();

    const got = run(['sline', 'go', 'test', './...']);

    expect(got.status, got.stderr).toBe(0);
    expect(rows()[0]?.[4]).toBe('-');
});

test('a command that is not go test passes through, its exit kept', () => {
    const { rows, run } = fixture();

    const got = run(['x-go', 'sh', '-c', 'exit 4']);

    expect(got.status).toBe(4);
    expect(rows()).toEqual([]);
});
