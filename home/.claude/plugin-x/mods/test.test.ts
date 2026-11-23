import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { gitEnv } from '../../../../script/lib/git-fixture.ts';
import {
    clockReads,
    cpuCap,
    cpuOf,
    failures,
    outcome,
    summary,
    timedOutFiles,
    touchedMods,
    untested,
    withRerun,
} from './test.ts';

// the one sample both parsers of claude plugin test's output are held to (x/go/mods_test.go reads it too)
const SAMPLE = readFileSync(
    join(import.meta.dirname, 'plugin-test.sample.txt'),
    'utf8',
);

// a calm mac and a queue of the test's own: a whole run takes gate-queue.sh's long turn
const CALM = "#!/bin/sh\necho 'load averages: 1.00 1.00 1.00'\n";
function queueEnv(bin: string): NodeJS.ProcessEnv {
    writeFileSync(join(bin, 'uptime'), CALM, { mode: 0o755 });
    const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        X_STATE: mkdtempSync(join(tmpdir(), 'mods-test-queue-')),
    };
    delete (env as NodeJS.ProcessEnv).GATE_QUEUE_HELD;
    delete (env as NodeJS.ProcessEnv).MODS_TEST_QUEUED;
    return env;
}

const run = (pass: number, fail: number) =>
    [
        'tests/a.test.ts:',
        ...Array.from({ length: pass }, (_, i) => `(pass) holds ${i}`),
        ...Array.from({ length: fail }, (_, i) => `(fail) breaks ${i}`),
        ` ${pass} pass`,
        ` ${fail} fail`,
    ].join('\n');

describe('a whole run of the script, a fake claude listing what it was handed', () => {
    const script = join(import.meta.dirname, 'test.ts');
    const tests = join(import.meta.dirname, 'x-mod-guard/tests');
    const runScript = (args: string[], env: Record<string, string>) => {
        const bin = mkdtempSync(join(tmpdir(), 'mods-test-bin-'));
        const claude = join(bin, 'claude');
        writeFileSync(
            claude,
            '#!/bin/sh\nfor f in "$3"/tests/*.test.ts*; do echo "tests/$(basename "$f"):"; echo "(pass) ran $(basename "$f")"; done\n',
        );
        chmodSync(claude, 0o755);
        return spawnSync('node', [script, ...args], {
            encoding: 'utf8',
            env: { ...queueEnv(bin), ...env },
            timeout: 10_000,
        });
    };
    const file = 'hint.test.ts';

    it('takes --only through a symlink to a mod', () => {
        const link = join(mkdtempSync(join(tmpdir(), 'mods-test-link-')), 'l');
        symlinkSync(tests, link);
        const r = runScript(['--only', join(link, file)], { X_TEST: '1' });
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it.each([
        ['alone', []],
        ['beside its mod', ['x-mod-guard']],
    ])('runs only the file --only names, %s', (_, mod) => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        const r = runScript([...mod, '--only', join(tests, file)], {
            X_STATE: state,
        });
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it('runs only the file --extra brings, with the mod’s helpers beside it', () => {
        const extra = join(
            mkdtempSync(join(tmpdir(), 'mods-extra-')),
            'e.test.ts',
        );
        writeFileSync(extra, '');
        const r = runScript(['x-mod-guard', '--extra', extra], { X_TEST: '1' });
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it('a whole run takes the long turn itself, a narrowed one none', () => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        runScript(['--only', join(tests, file)], {
            X_STATE: state,
            X_TEST: '1',
        });
        expect(existsSync(join(state, 'gate-queue.log'))).toBe(false);
        runScript(['x-mod-holds'], { X_STATE: state, X_TEST: '1' });
        expect(readFileSync(join(state, 'gate-queue.log'), 'utf8')).toMatch(
            /\tlong\t\d+\t\d+\t0\t.*mods\/test\.ts x-mod-holds\n$/,
        );
    });

    it.each([
        ['a file outside any mod', ['--only', script]],
        ['a file that is not there', ['--only', join(tests, 'no.test.ts')]],
        ['another mod beside it', ['--only', join(tests, file), 'x-mod-holds']],
        ['--commit with no path', ['--commit']],
        [
            '--commit beside --only',
            ['--commit', 'a', '--only', join(tests, file)],
        ],
    ])('refuses %s with its usage', (_, args) => {
        const r = runScript(args, { X_TEST: '1' });
        expect([r.status, r.stderr]).toEqual([
            2,
            expect.stringContaining('usage: pnpm mods:test'),
        ]);
    });

    it('logs one line per run under X_STATE', () => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        runScript(['x-mod-holds'], { X_STATE: state, X_TEST: '' });
        const log = readFileSync(join(state, 'mods-test.log'), 'utf8');
        expect(log.trim().split('\n')).toEqual([
            expect.stringMatching(/\tx-mod-holds\tmods:test: 1 mods green/),
        ]);
    });

    it('runs only the timed-out file a second time', () => {
        const bin = mkdtempSync(join(tmpdir(), 'mods-test-bin-'));
        const seen = join(bin, 'seen');
        const claude = join(bin, 'claude');
        writeFileSync(
            claude,
            `#!/bin/sh\necho "tests/${file}:"\nif [ -e ${seen} ]; then ls "$3"/tests/*.test.ts* | wc -l | tr -d ' ' >> ${seen}; echo "(pass) one"; exit 0; fi\ntouch ${seen}\necho "(fail) one [5001ms]"\necho "  Error: timed out after 5000 ms"\necho "Ran 1 test across 1 file."\nexit 1\n`,
        );
        chmodSync(claude, 0o755);
        const r = spawnSync('node', [script, 'x-mod-guard'], {
            encoding: 'utf8',
            env: { ...queueEnv(bin), X_TEST: '1' },
            timeout: 10_000,
        });
        expect([r.status, readFileSync(seen, 'utf8').trim()]).toEqual([0, '1']);
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it('logs nothing under X_TEST', () => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        runScript(['x-mod-holds'], { X_STATE: state, X_TEST: '1' });
        expect(readdirSync(state)).not.toContain('mods-test.log');
    });
});

describe('untested', () => {
    const row = (mod: string, sha: string) => `1\tmod ${mod}\t${sha}\t`;

    it.each([
        ['an empty record', '', 'no green yet'],
        ["only another mod's row", row('other', 'aaa'), 'no green yet'],
        ['a row of other bytes', row('m', 'bbb'), 'a green read others'],
    ])('%s refuses, naming the door', (_name, record, why) => {
        const said = untested(record, 'm', 'aaa', ['m/a.ts'], () => [
            'a.ts',
        ]).join('');
        expect(said).toContain(`m: no tested stamp on these bytes (${why})`);
        expect(said).toContain('x mods edit test');
        expect(said).toContain('pnpm mods:test --commit m/a.ts');
    });
    const greens = `${row('m', 'bbb')}\n${row('m', 'aaa')}`;
    it('these bytes pass, however old their green', () => {
        expect(untested(greens, 'm', 'aaa', [], () => ['a.ts'])).toEqual([]);
    });
    it('these bytes pass, ten greens of others past them', () => {
        const others = Array.from({ length: 12 }, (_, i) => row('m', `o${i}`));
        const record = [row('m', 'aaa'), ...others].join('\n');
        expect(untested(record, 'm', 'aaa', [], () => ['a.ts'])).toEqual([]);
        const isMdOfTheLast = (sha: string) => [
            sha === 'o11' ? 'a.md' : 'a.ts',
        ];
        expect(untested(record, 'm', 'ccc', [], isMdOfTheLast)).toEqual([]);
    });
    it.each([
        ['an .md alone', ['FTR.md', 'docs/a.md'], 0],
        ['an .md and a hook', ['FTR.md', 'hooks/a.ts'], 1],
    ])('a green of bytes differing in %s', (_, paths, refusals) => {
        expect(untested(greens, 'm', 'ccc', [], () => paths)).toHaveLength(
            refusals,
        );
    });
});

describe('a cpu cap', () => {
    it("reads the shell's count of its children", () => {
        expect(cpuOf('0m0.003s 0m0.004s\n1m2.50s 0m0.25s\n')).toBe(62.75);
        expect(cpuOf('0m0,003s 0m0,004s\n1m2,50s 0m0,25s\n')).toBe(62.75);
    });
    it.each([
        ['x-mod-stash', 246],
        ['x-mod-holds', undefined],
    ])('%s reads its own row', (mod, cap) => {
        expect(
            cpuCap('# suite\tcpu-s\nx-go\t283\t-\nx-mod-stash\t246\t-\n', mod),
        ).toBe(cap);
    });
});

// the script in a repo of its own, with one mod and a claude that burns a little cpu
describe('the script in a scratch repo', () => {
    const MODS = 'home/.claude/plugin-x/mods';
    const HOOK = `${MODS}/m/hooks/register.ts`;
    const OLD = `${MODS}/m/hooks/old.ts`;
    function world() {
        const dir = mkdtempSync(join(tmpdir(), 'mods-test-repo-'));
        const put = (path: string, body: string) => {
            mkdirSync(dirname(join(dir, path)), { recursive: true });
            writeFileSync(join(dir, path), body);
        };
        cpSync(
            join(import.meta.dirname, 'test.ts'),
            join(dir, MODS, 'test.ts'),
        );
        cpSync(
            join(
                import.meta.dirname,
                '../../../../script/lib/test-temp-dir.ts',
            ),
            join(dir, 'script/lib/test-temp-dir.ts'),
        );
        cpSync(
            join(import.meta.dirname, '../../../../script/gate-queue.sh'),
            join(dir, 'script/gate-queue.sh'),
        );
        put('package.json', '{"type": "module"}');
        put(`${MODS}/m/.claude-plugin/plugin.json`, '{"name": "m"}');
        put(HOOK, 'export const register = () => {};\n');
        put(OLD, 'export {};\n');
        put('.gitignore', 'state\nsaw\n');
        put(
            'bin/claude',
            '#!/bin/sh\nls "$3"/hooks > "$SAW"\ni=0; while [ $i -lt 60000 ]; do i=$((i+1)); done\necho tests/a.test.ts:; echo "(pass) holds"; echo " 1 pass"; echo " 0 fail"\n',
        );
        chmodSync(join(dir, 'bin/claude'), 0o755);
        const env = gitEnv();
        env.PATH = `${join(dir, 'bin')}:${env.PATH}`;
        put('bin/uptime', CALM);
        chmodSync(join(dir, 'bin/uptime'), 0o755);
        env.X_STATE = join(dir, 'state');
        env.SAW = join(dir, 'saw');
        delete env.GATE_QUEUE_HELD;
        delete env.MODS_TEST_QUEUED;
        delete env.X_TEST;
        const git = (...args: string[]) =>
            spawnSync('git', ['-C', dir, ...args], {
                encoding: 'utf8',
                env,
                timeout: 10_000,
            });
        git('init', '-q');
        git('add', '.');
        git('commit', '-q', '-m', 'world');
        const mods = (...args: string[]) =>
            spawnSync('node', [join(dir, MODS, 'test.ts'), ...args], {
                cwd: dir,
                encoding: 'utf8',
                env,
                timeout: 10_000,
            });
        return { dir, git, mods, put };
    }

    it('a commit of bytes no green read is refused, and a green --commit of its paths lets it in', () => {
        const { git, mods, put } = world();
        put(HOOK, 'export const register = () => 1;\n');
        git('add', '.');
        const refused = mods('--skip-tested');
        expect(refused.status).toBe(1);
        expect(refused.stdout).toContain('m: no tested stamp on these bytes');
        expect(refused.stdout).toContain(`pnpm mods:test --commit ${HOOK}\n`);
        expect([mods('m').status, mods('--skip-tested').status]).toEqual([
            0, 1,
        ]);
        expect([
            mods('--commit', HOOK).status,
            mods('--skip-tested').status,
        ]).toEqual([0, 0]);
        put(`${MODS}/m/FTR.md`, '# m\n');
        git('add', '.');
        expect(mods('--skip-tested').status).toBe(0);
        put(HOOK, 'export const register = () => 2;\n');
        git('add', '.');
        expect(mods('--skip-tested').stdout).toContain('a green read others');
    });

    it('--commit tests and stamps what its paths would commit, a peer’s edit left out and a deletion in', () => {
        const { dir, git, mods, put } = world();
        put(HOOK, 'export const register = () => 1;\n');
        put(`${MODS}/m/hooks/peer.ts`, 'export const peer = 1;\n');
        rmSync(join(dir, OLD));
        expect(mods('--commit', HOOK, OLD).status).toBe(0);
        expect(readFileSync(join(dir, 'saw'), 'utf8')).toBe('register.ts\n');
        git('add', HOOK, OLD);
        expect(mods('--skip-tested').status).toBe(0);
    });

    it('--commit of paths in no mod runs nothing', () => {
        const { mods, put } = world();
        put(`${MODS}/names.test.ts`, 'export {};\n');
        expect(mods('--commit', `${MODS}/names.test.ts`).status).toBe(2);
    });

    it('a git that fails refuses', () => {
        const { dir, git, mods, put } = world();
        put(HOOK, 'export const register = () => 1;\n');
        git('add', '.');
        writeFileSync(join(dir, '.git/index'), 'no index');
        expect(mods('--skip-tested').status).toBe(1);
    });

    it('a deleted hook and a hook with an odd name are the mod’s', () => {
        const { git, mods, put } = world();
        git('rm', '-q', OLD);
        expect(mods('--skip-tested').status).toBe(1);
        git('reset', '-q', '--hard');
        put(`${MODS}/m/hooks/é.ts`, 'export {};\n');
        git('add', '.');
        expect(mods('--skip-tested').status).toBe(1);
    });

    it('a root test file and an .md reach no mod', () => {
        const { git, mods, put } = world();
        put(`${MODS}/names.test.ts`, 'export {};\n');
        put(`${MODS}/m/FTR.md`, '# m\n');
        git('add', '.');
        const passed = mods('--skip-tested');
        expect([passed.status, passed.stdout]).toEqual([0, '']);
    });

    it('a whole run past its cap is red, naming the mod and both numbers; under it, green', () => {
        const { mods, put } = world();
        put('script/test-cpu-budget.tsv', 'm\t0.001\t-\n');
        const past = mods('m');
        expect(past.status).toBe(1);
        expect(past.stdout).toMatch(
            /m: \d+\.\d cpu-s, its cap in script\/test-cpu-budget\.tsv is 0\.001/,
        );
        put('script/test-cpu-budget.tsv', 'm\t60\t-\n');
        expect(mods('m').status).toBe(0);
        put('script/test-cpu-budget.tsv', 'm\tsixty\t-\n');
        expect(mods('m').status).toBe(1);
    });
});

describe('a timeout-only red', () => {
    it('reads the kit words the x verbs read too', () => {
        expect(
            timedOutFiles(
                readFileSync(
                    join(import.meta.dirname, 'plugin-test-timeout.sample.txt'),
                    'utf8',
                ),
            ),
        ).toEqual(['tests/a.test.ts']);
    });

    const tally = 'Ran 2 tests across 1 file. [11.16s]\n';
    const timedOut = (name: string) =>
        `(fail) ${name} [5002.31ms]\n  Error: timed out after 5000 ms\n`;

    it('names the files whose every failed row timed out', () => {
        expect(
            timedOutFiles(
                `tests/a.test.ts:\n${timedOut('one')}(pass) two\ntests/b.test.tsx:\n${timedOut('three')}tests/c.test.ts:\n(pass) four\n 2 pass\n 2 fail\n${tally}`,
            ),
        ).toEqual(['tests/a.test.ts', 'tests/b.test.tsx']);
    });

    it.each([
        [
            'a real red beside it',
            `tests/a.test.ts:\n${timedOut('one')}(fail) two [1ms]\n  AssertionError: no\n${tally}`,
        ],
        [
            'a file that did not load',
            `tests/a.test.ts:\n(fail) the file did not load\n${tally}`,
        ],
        ['nothing failed', `tests/a.test.ts:\n(pass) one\n${tally}`],
        [
            'a run that died after the row',
            `tests/a.test.ts:\n${timedOut('one')}`,
        ],
    ])('reads no timeout-only red with %s', (_, output) => {
        expect(timedOutFiles(output)).toBeUndefined();
    });

    it('takes the second reading of each file it ran again', () => {
        const merged = withRerun(
            `tests/a.test.ts:\n${timedOut('one')}(pass) two\ntests/c.test.ts:\n(pass) four\n 3 pass\n 1 fail\n`,
            'tests/a.test.ts:\n(pass) one\n(pass) two\n 2 pass\n 0 fail\n',
        );
        expect(outcome(merged)).toEqual({
            errored: [],
            failed: [],
            passed: 3,
        });
    });
});

describe('outcome', () => {
    it('reads a thrown hook as a fail, whatever its rows say', () => {
        const thrown =
            "tests/a.test.ts:\n(pass) one\n    m's session.start hook was skipped: m: boom\n";
        expect(outcome(thrown).failed).toEqual([
            "m's session.start hook was skipped: m: boom",
        ]);
        expect(failures(thrown)).toContain('hook was skipped');
    });

    it('tells a test that failed from a file that did not load', () => {
        expect(outcome(SAMPLE)).toEqual({
            errored: ['tests/c.test.ts'],
            failed: ['a breaks'],
            passed: 2,
        });
    });
});

describe('summary', () => {
    it('sums every mod into one line', () => {
        expect(
            summary([
                { mod: 'x-mod-guard', output: run(225, 0) },
                { mod: 'x-mod-stash', output: run(133, 0) },
            ]),
        ).toBe('mods:test: 2 mods green, 358 pass, 0 fail');
    });

    it('names the red mods', () => {
        expect(
            summary([
                { mod: 'x-mod-guard', output: run(220, 5) },
                { mod: 'x-mod-stash', output: run(133, 0) },
            ]),
        ).toBe('mods:test: red in x-mod-guard, 353 pass, 5 fail');
    });

    it('names a test file that did not load', () => {
        expect(summary([{ mod: 'x-mod-stash', output: SAMPLE }])).toBe(
            'mods:test: red in x-mod-stash (tests/c.test.ts did not load), 2 pass, 2 fail',
        );
    });

    it('counts a mod that printed no tally as red', () => {
        expect(
            summary([{ mod: 'x-mod-redact', output: 'SyntaxError: boom' }]),
        ).toBe('mods:test: red in x-mod-redact (no tally), 0 pass, 0 fail');
    });
});

describe('failures', () => {
    const output = SAMPLE;

    it('keeps each failing test under its file, with what it printed', () => {
        expect(failures(output)).toBe(
            [
                'tests/a.test.ts:',
                '(fail) a breaks [2.0ms]',
                '  AssertionError: expected 1 to be 2',
                'tests/c.test.ts:',
                '(fail) the file did not load',
                '  tests/c.test.ts: cannot import "./gone.ts"',
            ].join('\n'),
        );
    });

    it('prints nothing for a green run', () => {
        expect(
            failures('tests/b.test.ts:\n(pass) b holds\n 1 pass\n 0 fail'),
        ).toBe('');
    });
});

describe('clockReads', () => {
    it.each([
        ['a bare Date.now()', 'const at = Date.now();', [1]],
        ['a bare new Date()', 'const d = new Date();', [1]],
        ['new Date with no parens', 'const d = new Date;', [1]],
        ['Date.now passed as a value', 'g(Date.now);', [1]],
        ['spaced out', 'Date . now ()', [1]],
        [
            'a fallback behind another call',
            '$.store.get(k).catch(() => Date.now());',
            [1],
        ],
        ['a clock-ok line with no reason', '// clock-ok:\nf(Date.now());', [2]],
        ['a url before the read', 'f("https://x" + Date.now());', [1]],
        [
            'the line of each read',
            'a();\nb(Date.now());\nc(new Date());',
            [2, 3],
        ],
        [
            'a // inside a string before the read',
            "log('a // b', Date.now());",
            [1],
        ],
        [
            'a continuation line that starts with *',
            'const t = a\n    * Date.now();',
            [2],
        ],
        ['now destructured off Date', 'const { now } = Date;\nnow();', [1]],
        ['now read by index', "Date['now']();", [1]],
        ['a read inside a template placeholder', 'f(`at ${Date.now()}`);', [1]],
        [
            'a read after a template that held a placeholder',
            'f(`${a}`);\ng(Date.now());',
            [2],
        ],
        [
            'a read inside a nested template',
            'f(`${a ? `x${Date.now()}` : 1}`);',
            [1],
        ],
        // FRM-489 row 23: a backtick inside a regex literal opened a template and blanked the code after it; each read
        // sits on the regex's own line, where a misread reaches it
        [
            'a read after a regex literal holding a backtick',
            'if (/^\\s*```/.test(line)) f(Date.now());',
            [1],
        ],
        [
            'a read after a regex literal holding a quote',
            'const q = /[\'"]/; g(Date.now());',
            [1],
        ],
        [
            'a read after a regex class holding a slash',
            'const s = /[/`]/g; g(Date.now());',
            [1],
        ],
        [
            'a read after a regex a keyword opens',
            'return /^`/.test(l) && g(Date.now());',
            [1],
        ],
        ['a read after a division', 'const h = a / 2; g(Date.now());', [1]],
        [
            'a read after a JSX closer',
            'const t = <T>a</T>; g(Date.now());',
            [1],
        ],
        [
            'a read after a self-closing tag',
            'const b = <B {...p} />; g(Date.now());',
            [1],
        ],
    ])('reds %s', (_, source, lines) => {
        expect(clockReads(source)).toEqual(lines);
    });
    it.each([
        [
            'the $.clock fallback',
            'at: await $.clock.now().catch(() => Date.now()),',
        ],
        [
            'the fallback across lines',
            'await $.clock.now().catch(\n    () => Date.now(),\n);',
        ],
        ['the fallback by reference', '$.clock.now().catch(Date.now);'],
        ['new Date of a value', 'new Date(at).toISOString();'],
        ['new Date of a value across lines', 'new Date(\n    at,\n);'],
        ['a clock-ok line above', '// clock-ok: a sync render\nf(Date.now());'],
        ['a line comment', '// Date.now() is what a test cannot fake'],
        ['a doc comment line', '/**\n * new Date() reads the wall clock\n */'],
        ['a block comment mid-line', 'f(/* Date.now() */ 1);'],
        ['a read inside a string', "log('Date.now() is banned');"],
        ['a read inside a template', 'f(`Date.now()`);'],
        ["another object's now", 'myDate.now();'],
    ])('passes %s', (_, source) => {
        expect(clockReads(source)).toEqual([]);
    });
    it('reds a mod whose hooks read the clock, its tests green', () => {
        expect(
            summary([
                {
                    clockReads: ['hooks/register.ts:12'],
                    mod: 'x-mod-holds',
                    output: run(3, 0),
                },
            ]),
        ).toBe(
            'mods:test: red in x-mod-holds (clock read at hooks/register.ts:12), 3 pass, 0 fail',
        );
    });
});

describe('touchedMods', () => {
    const all = ['x-mod-guard', 'x-mod-holds', 'x-mod-stash'];

    it.each([
        ['a commit inside one mod', ['x-mod-guard/a.ts'], ['x-mod-guard']],
        [
            'a file beside the mods',
            ['stash-entry.test.ts', 'test.ts', 'tsconfig.json'],
            [],
        ],
        ['an .md', ['x-mod-guard/FTR.md'], []],
        ['nothing staged', [''], []],
    ])('%s', (_name, changed, want) => {
        expect(touchedMods(changed, all)).toEqual(want);
    });
});
