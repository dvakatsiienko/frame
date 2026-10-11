import { describe, expect, it } from 'vitest';

import { failures, summary } from './test.ts';

const run = (pass: number, fail: number) =>
    `(pass) a\n\n ${pass} pass\n ${fail} fail\nRan ${pass + fail} tests across 1 file.`;

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

    it('counts a mod that printed no tally as red', () => {
        expect(
            summary([{ mod: 'x-mod-redact', output: 'SyntaxError: boom' }]),
        ).toBe('mods:test: red in x-mod-redact (no tally), 0 pass, 0 fail');
    });
});

describe('failures', () => {
    const output = [
        'tests/a.test.ts:',
        '(pass) a holds [1.0ms]',
        '(fail) a breaks [2.0ms]',
        '  AssertionError: expected 1 to be 2',
        '',
        'tests/b.test.ts:',
        '(pass) b holds [1.0ms]',
        'tests/c.test.ts:',
        '(fail) the file did not load',
        '  tests/c.test.ts: cannot import "./gone.ts"',
        '',
        ' 2 pass',
        ' 2 fail',
    ].join('\n');

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
