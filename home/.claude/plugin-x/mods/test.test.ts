import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    clockReads,
    failures,
    outcome,
    summary,
    timedOutFiles,
    withRerun,
} from './test.ts';

// the one sample both parsers of claude plugin test's output are held to (x/go/mods_test.go reads it too)
const SAMPLE = readFileSync(
    join(import.meta.dirname, 'plugin-test.sample.txt'),
    'utf8',
);

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
    const holds = join(import.meta.dirname, 'x-mod-holds/tests');
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
            env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}` },
        });
    };
    const file = readdirSync(holds).find((f) => f.endsWith('.test.ts')) ?? '';

    it('runs only the file --only names', () => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        const r = runScript(['--only', join(holds, file)], { X_STATE: state });
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it.each([
        ['a file outside any mod', ['--only', script]],
        ['a file that is not there', ['--only', join(holds, 'no.test.ts')]],
        ['a mod beside it', ['--only', join(holds, file), 'x-mod-holds']],
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

    it('runs a timed-out file again, and a green second run is green', () => {
        const bin = mkdtempSync(join(tmpdir(), 'mods-test-bin-'));
        const once = join(bin, 'once');
        const claude = join(bin, 'claude');
        writeFileSync(
            claude,
            `#!/bin/sh\nls "$3"/tests/*.test.ts* | wc -l | tr -d ' ' >> ${once}.files\necho "tests/a.test.ts:"\nif [ -e ${once} ]; then echo "(pass) one"; exit 0; fi\ntouch ${once}\necho "(fail) one [5001ms]"\necho "  Error: timed out after 5000 ms"\nexit 1\n`,
        );
        chmodSync(claude, 0o755);
        const r = spawnSync('node', [script, 'x-mod-holds'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                X_TEST: '1',
            },
        });
        expect([r.status, r.stdout]).toEqual([
            0,
            expect.stringContaining(
                'only timeouts, ran again: tests/a.test.ts',
            ),
        ]);
        expect(r.stdout).toContain('1 mods green, 1 pass, 0 fail');
    });

    it('logs nothing under X_TEST', () => {
        const state = mkdtempSync(join(tmpdir(), 'mods-test-state-'));
        runScript(['x-mod-holds'], { X_STATE: state, X_TEST: '1' });
        expect(readdirSync(state)).toEqual([]);
    });
});

describe('a timeout-only red', () => {
    const timedOut = (name: string) =>
        `(fail) ${name} [5002.31ms]\n  Error: timed out after 5000 ms\n`;

    it('names the files whose every failed row timed out', () => {
        expect(
            timedOutFiles(
                `tests/a.test.ts:\n${timedOut('one')}(pass) two\ntests/b.test.tsx:\n${timedOut('three')}tests/c.test.ts:\n(pass) four\n 2 pass\n 2 fail\n`,
            ),
        ).toEqual(['tests/a.test.ts', 'tests/b.test.tsx']);
    });

    it.each([
        [
            'a real red beside it',
            `tests/a.test.ts:\n${timedOut('one')}(fail) two [1ms]\n  AssertionError: no\n`,
        ],
        [
            'a file that did not load',
            'tests/a.test.ts:\n(fail) the file did not load\n',
        ],
        ['nothing failed', 'tests/a.test.ts:\n(pass) one\n'],
    ])('reads no timeout-only red with %s', (_, output) => {
        expect(timedOutFiles(output)).toBeUndefined();
    });

    it('replaces each file the second run read, and keeps the rest', () => {
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
