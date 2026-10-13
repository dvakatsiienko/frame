import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { clockReads, failures, outcome, summary } from './test.ts';

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
        ['a doc comment line', ' * new Date() reads the wall clock'],
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
