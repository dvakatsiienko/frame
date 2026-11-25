/**
 * ? a file past 1,200 lines no longer fits one default Read (25k tokens at ~18 a line), and a compaction brings a file
 * ? back only under 5,000 tokens: the numbers in docs/research/agent-giant-files.md; the rule is x:guide-code § file size
 */

/* Core */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { trackedFiles } from './git-fixture.ts';

const limit = 1_200;
const ceiling = 2_000;
const sizeLineWindow = 10;
const root = path.resolve(import.meta.dirname, '../..');

// not ours to cut: types the engines write, vendored code, generated files, public bundles
const skipped = [/\.d\.ts$/, /^logos\/data\.gen\.ts$/, /(^|\/)public\//];

// giants not cut yet, each capped at its size: a cap goes down by hand as the file shrinks;
// a raise names dima's word and its date in the why
const caps: Readonly<Record<string, { cap: number; why: string }>> = {};

const codeFiles = trackedFiles(
    root,
    '--',
    '*.ts',
    '*.tsx',
    '*.js',
    '*.go',
    '*.sh',
).filter((file) => !skipped.some((pattern) => pattern.test(file)));

const readText = (file: string) => {
    try {
        return readFileSync(path.join(root, file), 'utf8');
    } catch {
        // a path the index lists but the tree lacks (a staged delete's neighbour, a sparse copy) has no size to check
        return null;
    }
};

const countLines = (text: string) => text.split('\n').length - 1;

// a comment line opening with size: — `//`, a `#` that is not a private field or a shebang, `/*`, or a block's ` * `
const sizeLinePattern = /^\s*(\/\/|#(?![\w!])|\/\*+|\*)\s*size:\s*\S/;

const hasSizeLine = (text: string) =>
    text.split('\n', sizeLineWindow).some((line) => sizeLinePattern.test(line));

test.each([
    ['// size: one closure kept whole', true],
    ['#!/usr/bin/env bash\n# size: one script of steps', true],
    ['/* size: a generated table */', true],
    ['/**\n * size: one parser, its states shared', true],
    ['    #size: number;', false],
    ["const label = 'size: big';", false],
    ['// sizes: many', false],
    ['// size:', false],
    [`${'\n'.repeat(sizeLineWindow)}// size: past the window`, false],
] as const)('size: line in %j reads %s', (text, isExplained) => {
    expect(hasSizeLine(text)).toBe(isExplained);
});

const sizes = codeFiles.flatMap((file) => {
    const text = readText(file);
    // a git-crypt file stays ciphertext in a gate's copy of the index: its bytes are no line count
    if (text === null || text.startsWith('\0GITCRYPT')) return [];
    return [{ file, isExplained: hasSizeLine(text), lines: countLines(text) }];
});

test('a file past 1,200 lines carries a size: line and stays under 2,000', () => {
    const offenders = sizes
        .filter(({ file, lines }) => lines > limit && !(file in caps))
        .filter(({ isExplained, lines }) => !isExplained || lines > ceiling)
        .map(({ file, lines }) =>
            lines > ceiling
                ? `${file}: ${lines} lines, past the ${ceiling} ceiling — split it`
                : `${file}: ${lines} lines, past ${limit} with no size: line in its first ${sizeLineWindow} lines — split it, or say why it is one file`,
        );
    expect(offenders, 'x:guide-code § file size').toEqual([]);
});

test.each(Object.entries(caps))('%s stays within its cap', (file, { cap }) => {
    const size = sizes.find((entry) => entry.file === file);
    expect(size, `${file}: no longer tracked — drop its row`).toBeDefined();
    expect(
        size?.lines,
        `${file}: grew past its cap of ${cap} — the new concern gets its own module; a raise is dima's word`,
    ).toBeLessThanOrEqual(cap);
    expect(
        size?.lines,
        `${file}: now under ${limit} lines — drop its row`,
    ).toBeGreaterThan(limit);
});

// go functions: the same shape as the files above, one cap a function (dima, 2026-11-25)
const goFuncLimit = 120;

// functions over the limit, each capped at its size: a cap goes down by hand as the function shrinks;
// a raise names dima's word and its date in the why
const goFuncCaps: Readonly<Record<string, { cap: number; why: string }>> = {
    'x/go/brief_summon.go briefSummonPlan': {
        cap: 228,
        why: 'its size on 2026-11-25, not cut yet',
    },
    'x/go/fleet_growth.go fleetGrowth': {
        cap: 138,
        why: 'its size on 2026-11-25, not cut yet',
    },
    'x/go/linear_set.go linearSet': {
        cap: 260,
        why: 'its size on 2026-11-25, not cut yet',
    },
    'x/go/verify_red.go verifyRed': {
        cap: 125,
        why: 'its size on 2026-11-25, not cut yet',
    },
    'x/go/verify_tree.go verifyTree': {
        cap: 132,
        why: 'its size on 2026-11-25, not cut yet',
    },
};

// text that is no code: a `"` string, a rune, a comment on its line, a raw string whole, so a `}` at column 0 in one ends nothing
const goNotCode =
    /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)+'|\/\/.*|\/\*[\s\S]*?\*\/|`[^`]*`/g;

// gofmt puts a top-level func at column 0 and its closing brace alone on a line; the commit gate holds gofmt
const goFuncs = (file: string, text: string) => {
    const blanked = text.replace(goNotCode, (found) =>
        found.replace(/[^\n]/g, ' '),
    );
    const heads = blanked.matchAll(
        /^func (?:\((?:\w+ )?\*?(\w+)(?:\[[^\]]*\])?\) )?(\w+)/gm,
    );
    return [...heads].flatMap(({ index, 1: receiver, 2: name }) => {
        const body = blanked.slice(index);
        const isOneLine = /\}\s*$/.test(body.split('\n', 1)[0] ?? '');
        const end = isOneLine ? 0 : body.search(/^\}[ \t]*$/m);
        if (end < 0) return [];
        return [
            {
                lines: body.slice(0, end).split('\n').length,
                name: `${file} ${receiver ? `${receiver}.` : ''}${name}`,
            },
        ];
    });
};

type GoFunc = ReturnType<typeof goFuncs>[number];

const goFuncOffenders = (
    funcs: readonly GoFunc[],
    capped: typeof goFuncCaps,
) => [
    ...funcs
        .filter(({ lines, name }) => lines > goFuncLimit && !(name in capped))
        .map(
            ({ lines, name }) =>
                `${name}: ${lines} lines, past ${goFuncLimit} — break it into named parts`,
        ),
    ...Object.entries(capped).flatMap(([name, { cap }]) => {
        // go takes many `init` in one file: the longest of a name is its size
        const lines = Math.max(
            0,
            ...funcs.filter((func) => func.name === name).map((f) => f.lines),
        );
        if (lines > cap)
            return [
                `${name}: ${lines} lines, past its cap of ${cap} — a raise is dima's word`,
            ];
        return lines <= goFuncLimit
            ? [
                  `${name}: now ${lines} lines, within ${goFuncLimit} — drop its row`,
              ]
            : [];
    }),
];

const goFuncOf = (lines: number, head = 'func big() {') =>
    `package main\n\n${head}\n${'\twork()\n'.repeat(lines - 2)}}\n`;
const goFuncRow = (cap: number) => ({ 'a.go big': { cap, why: 'planted' } });

test.each([
    ['a func at the limit', goFuncOf(120), {}, []],
    [
        'a new 121-line func',
        goFuncOf(121),
        {},
        ['a.go big: 121 lines, past 120 — break it into named parts'],
    ],
    ['a capped func at its cap', goFuncOf(130), goFuncRow(130), []],
    [
        'a capped func that grew',
        goFuncOf(131),
        goFuncRow(130),
        ["a.go big: 131 lines, past its cap of 130 — a raise is dima's word"],
    ],
    [
        'a capped func that shrank under the limit, its row left',
        goFuncOf(120),
        goFuncRow(130),
        ['a.go big: now 120 lines, within 120 — drop its row'],
    ],
    [
        'a method',
        goFuncOf(121, 'func (d *plan) big() error {'),
        {},
        ['a.go plan.big: 121 lines, past 120 — break it into named parts'],
    ],
    [
        'a brace at column 0 in a raw string',
        goFuncOf(121).replace('\twork()\n', '\tx := `\n}\n`\n'),
        {},
        ['a.go big: 123 lines, past 120 — break it into named parts'],
    ],
    [
        'a signature closed at column 0',
        goFuncOf(121, 'func big() []struct {\n\tname string\n} {'),
        {},
        ['a.go big: 123 lines, past 120 — break it into named parts'],
    ],
    [
        'a brace in a string',
        goFuncOf(121).replace('\twork()\n', '\tx := "}\\n"\n'),
        {},
        ['a.go big: 121 lines, past 120 — break it into named parts'],
    ],
    [
        'a quote in a rune',
        goFuncOf(121).replace('\twork()\n', "\tx := '\"'\n"),
        {},
        ['a.go big: 121 lines, past 120 — break it into named parts'],
    ],
    [
        'a brace at column 0 in a block comment',
        goFuncOf(121).replace('\twork()\n', '\t/*\n}\n*/\n'),
        {},
        ['a.go big: 123 lines, past 120 — break it into named parts'],
    ],
    [
        'a backtick in a line comment',
        goFuncOf(121).replace('\twork()\n', '\t// a ` alone\n'),
        {},
        ['a.go big: 121 lines, past 120 — break it into named parts'],
    ],
    [
        'a generic receiver',
        goFuncOf(121, 'func (s *set[T]) big() {'),
        {},
        ['a.go set.big: 121 lines, past 120 — break it into named parts'],
    ],
    [
        'the longest of two of one name',
        `${goFuncOf(125, 'func init() {')}${goFuncOf(131, 'func init() {').slice(13)}`,
        { 'a.go init': { cap: 130, why: 'planted' } },
        ["a.go init: 131 lines, past its cap of 130 — a raise is dima's word"],
    ],
    [
        'a one-line func before a long one',
        `package main\n\nfunc small() {}\n\n${goFuncOf(121).slice(14)}`,
        {},
        ['a.go big: 121 lines, past 120 — break it into named parts'],
    ],
] as const)('%s reads as its size', (_, text, capped, offenders) => {
    expect(goFuncOffenders(goFuncs('a.go', text), capped)).toEqual(offenders);
});

test('no go function grows past 120 lines, tests out', () => {
    const funcs = codeFiles
        .filter((file) => file.endsWith('.go') && !file.endsWith('_test.go'))
        .flatMap((file) => goFuncs(file, readText(file) ?? ''));
    expect(
        goFuncOffenders(funcs, goFuncCaps),
        'x:guide-code § file size',
    ).toEqual([]);
});
