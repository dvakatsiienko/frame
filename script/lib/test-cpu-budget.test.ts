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
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const script = join(import.meta.dirname, '../test-cpu-budget.sh');

// a fake go burning a known cpu in its own process, so a row reads a real user + sys and never a sleep
const stubGo = (burnMs: number, printed: string, code: number) => `#!/bin/bash
ms() { local v=$1 m s; m=\${v%%m*}; s=\${v#*m}; s=\${s%s}; s=\${s/,/.}; echo $(( 10#$m * 60000 + 10#\${s%.*} * 1000 + 10#\${s#*.} )); }
while :; do
    times >"$TIMES_FILE"
    { read -r user sys; } <"$TIMES_FILE"
    [ $(( $(ms "$user") + $(ms "$sys") )) -ge ${burnMs} ] && break
done
echo '${printed}'
exit ${code}
`;

function fixture({
    budget = '1\t2026-11-07\tthe fixture line',
    burnMs = 1300,
    code = 0,
    printed = 'ok  \tx\t1.300s',
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
    writeFileSync(
        join(dir, 'test-cpu-budget.tsv'),
        `# suite\tcpu-s\tdate\treason\nx-go\t${budget}\n`,
    );
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'go'), stubGo(burnMs, printed, code));
    chmodSync(join(bin, 'go'), 0o755);
    const state = join(dir, 'state');
    const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => {
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            PATH: `${bin}${delimiter}${process.env.PATH}`,
            TIMES_FILE: join(dir, 'times'),
            X_STATE: state,
            ...extra,
        };
        if (!('CI' in extra)) delete env.CI;
        return spawnSync(copy, args, { encoding: 'utf8', env });
    };
    const rows = () =>
        existsSync(join(state, 'test-cpu-budget.log'))
            ? readFileSync(join(state, 'test-cpu-budget.log'), 'utf8')
                  .trimEnd()
                  .split('\n')
                  .map((row) => row.split('\t'))
            : [];
    return { rows, run };
}

const whole = ['x-go', 'go', 'test', '-count=1', './...'];

describe('a whole run past its line', () => {
    test('goes red naming the suite, the number, the budget and how to raise it', () => {
        const { rows, run } = fixture();

        const got = run(whole);

        expect(got.status, got.stderr).toBe(1);
        expect(got.stderr).toMatch(
            /x-go used [0-9]+\.[0-9] cpu-s, its budget is 1 cpu-s/,
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

describe('a run under its line', () => {
    test('stays green and logs the cpu its children spent', () => {
        const { rows, run } = fixture({ budget: '60\t2026-11-07\troomy' });

        const got = run(whole);

        expect(got.status, got.stderr).toBe(0);
        expect(got.stdout).toContain('ok  \tx');
        const cpu = Number(rows()[0]?.[3]);
        expect(cpu).toBeGreaterThanOrEqual(1.3);
        expect(cpu).toBeLessThan(30);
        expect(rows()[0]?.[4]).toBe('60');
    });
});

describe('a run that is not whole never counts', () => {
    test.each([
        ['a -run filter', ['x-go', 'go', 'test', '-run', 'TestOne', './...']],
        ['a -run= filter', ['x-go', 'go', 'test', '-run=TestOne', './...']],
        ['a -skip', ['x-go', 'go', 'test', '-skip=TestOne', './...']],
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
