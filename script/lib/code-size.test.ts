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

// today's giants, each capped at its size on 2026-11-19: a cap goes down by hand as the file shrinks;
// a raise names dima's word and its date in the why
const caps = {
    '_clio/script/pocket-check.test.ts': {
        cap: 1_586,
        why: 'the pocket checker, one file of cases',
    },
    '_clio/script/prompt-groom.test.ts': {
        cap: 1_221,
        why: 'the prompt groomer, one file of cases',
    },
    '_clio/script/siesta-gate.test.ts': {
        cap: 1_531,
        why: 'the siesta gate, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-guard/hooks/register.ts': {
        cap: 1_368,
        why: 'the guard mod, every hook in one register',
    },
    'home/.claude/plugin-x/mods/x-mod-guard/hooks/rules/command.ts': {
        cap: 1_236,
        why: 'the command rules the guard refuses or hints',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/board.test.ts': {
        cap: 1_856,
        why: 'the stash board, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/lane.test.ts': {
        cap: 2_736,
        why: 'the stash lane cards, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/orbit.test.ts': {
        cap: 5_531,
        why: 'the orbit tool, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/pace.test.ts': {
        cap: 1_318,
        why: 'the stash pace, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/quiet.test.ts': {
        cap: 4_463,
        why: 'the quiet pings, one file of cases',
    },
    'home/.claude/plugin-x/mods/x-mod-stash/tests/wind.test.ts': {
        cap: 2_780,
        why: 'the second wind, one file of cases',
    },
    'home/.config/herdr-app/mods/x-herdr-deck/main.js': {
        cap: 1_473,
        why: 'the deck mod: orbit and phases in one view',
    },
    'home/.config/herdr-app/mods/x-herdr-status/main.js': {
        cap: 1_463,
        why: 'the status mod, one view',
    },
    'x/go/brief_summon_test.go': {
        cap: 1_312,
        why: 'brief summon, one file of cases',
    },
    'x/go/lane.go': {
        cap: 1_534,
        why: 'the lane family: commit, push and the shared lane steps',
    },
    'x/go/lane_landed.go': { cap: 1_398, why: 'lane landed and its decamp' },
    'x/go/merge_auto.go': {
        cap: 1_707,
        why: 'merge-auto: the gates and the merge',
    },
    'x/go/stacks_test.go': {
        cap: 1_363,
        why: 'the stacked-pr add-on, one file of cases',
    },
    'x/go/verify_red_test.go': {
        cap: 1_279,
        why: 'verify red, one file of cases',
    },
} as const satisfies Record<string, { cap: number; why: string }>;

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
