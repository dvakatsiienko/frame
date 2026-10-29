import { describe, expect, test } from 'vitest';

import { commitMsgLint } from './commit-msg-lint.ts';

describe('commitMsgLint', () => {
    test.each([
        '🔧 sline: fix reset glyph rendering',
        '🗑️ deps: drop the old pin',
        '🗑 deps: drop the old pin',
        '📜 clio:halt: the last act resets phases',
        '🔧 x lane commit: the message on stdin',
        '📜 rules + memory: the screenshot rule',
        '🔧 pocket: Backlog.md 1.54 — done items archive',
        '📜 pocket: PK-147 band wisp',
        '📜 docs: the skill split scan',
        '🐞 ci: the backup never mirrors destruction',
        "Merge remote-tracking branch 'origin/main'",
        '🐞 x: a fix\n\n- ticket: FRM-12\n\nAgent: clio · Claude Opus 5.5\n',
        '🔧 x: a change\n# Please enter the commit message\n# fixes FRM-1 in a comment\n',
    ])('passes %j', (message) => {
        expect(commitMsgLint(message).errors).toEqual([]);
    });

    test.each([
        ['🐛 sline: a bug', 'emoji canon'],
        ['♻️ sline: a refactor', 'emoji canon'],
        ['sline: no emoji', 'subject reads'],
        ['🔧 a subject with no scope', 'subject reads'],
        ['🔧 chore: bump things', 'conventional-commit'],
        ['🐞 fix: a bug', 'conventional-commit'],
        ['🔧 x: a change.', 'without a period'],
        ['🐞 x: a fix\n\nfixes FRM-12', 'linear'],
        ['🐞 x: a fix\n\n- Closes: BYT-3', 'linear'],
        ['🐞 x: resolved DOT-9 at last', 'linear'],
    ])('refuses %j', (message, reason) => {
        expect(commitMsgLint(message).errors.join(' ')).toContain(reason);
    });

    test('warns on a capital, never refuses it', () => {
        const verdict = commitMsgLint('🔧 deps: Update dependency vitest');
        expect(verdict.errors).toEqual([]);
        expect(verdict.warnings).toHaveLength(1);
    });
});
