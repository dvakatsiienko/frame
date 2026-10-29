import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkBrief, readHolds } from './composer-brief-check.ts';

// a folder outside git: isClean answers false, so a landed hold still counts as held
const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'brief-')));
writeFileSync(
    path.join(root, 'a.md'),
    'one line here\nthe same word\nthe same word\nhalf of a\nsentence goes on\n',
);

const brief = (...chores: string[]) =>
    [
        `# batch bX`,
        '',
        `paths under ${root}/. no commit.`,
        '',
        ...chores,
        'done: rg prints nothing',
    ].join('\n');

describe('composer-brief-check', () => {
    test('passes an anchor that matches once on one line', () => {
        expect(
            checkBrief(
                brief('1 a.md', '- old: `one line here`', '- new: `x`'),
                new Map(),
            ).reds,
        ).toEqual([]);
    });

    test('reds an anchor that matches twice', () => {
        expect(
            checkBrief(brief('1 a.md', '- old: "the same word"'), new Map())
                .reds,
        ).toEqual([expect.stringContaining('matches 2 times')]);
    });

    test('reds an anchor glued from two lines', () => {
        expect(
            checkBrief(
                brief('1 a.md', '- old: `half of a sentence goes`'),
                new Map(),
            ).reds,
        ).toEqual([expect.stringContaining('spans two lines')]);
    });

    test('reds a missing anchor', () => {
        expect(
            checkBrief(brief('1 a.md', '- old: `not here`'), new Map()).reds,
        ).toEqual([expect.stringContaining('is missing')]);
    });

    test('reds a path another session holds, read from the store file', () => {
        const store = mkdtempSync(path.join(tmpdir(), 'holds-'));
        writeFileSync(
            path.join(store, 'x-mod-holds_inline-1.json'),
            JSON.stringify({
                [`hold:8956ae99-full:${path.join(root, 'a.md').toLowerCase()}`]:
                    {
                        at: 1,
                        landed: false,
                    },
            }),
        );
        expect(
            checkBrief(
                brief('1 a.md', '- old: `one line here`'),
                readHolds(store),
            ).reds,
        ).toEqual([expect.stringContaining('held by session 8956ae99')]);
    });

    test('reds a brief with no done: line', () => {
        expect(
            checkBrief(
                `paths under ${root}/.\n1 a.md\n- old: \`one line here\``,
                new Map(),
            ).reds,
        ).toEqual([expect.stringContaining('no done: line')]);
    });
});
