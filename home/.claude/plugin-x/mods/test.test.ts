import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { failures, outcome, summary } from './test.ts';

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
