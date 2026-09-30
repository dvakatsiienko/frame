/**
 * ? claude code re-attaches a loaded skill after a compaction cut at 19,995 chars (probe
 * ? 2026-09-30, cc 2.1.285) — a longer SKILL.md loses its tail in every compacted session.
 */

/* Core */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const reattachCap = 19_995;
const margin = 1_000;
const root = path.resolve(import.meta.dirname, '../..');
const skillDirs = ['home/.claude/plugin-x/skills', 'cclio/plugin-cclio/skills'];

const skills = skillDirs.flatMap((dir) =>
    readdirSync(path.join(root, dir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(dir, entry.name, 'SKILL.md')),
);

test.each(skills)('%s fits the compaction re-attach cap', (file) => {
    const chars = [...readFileSync(path.join(root, file), 'utf8')].length;
    expect(
        chars,
        `${file}: ${chars} chars, cap ${reattachCap} − ${margin} margin`,
    ).toBeLessThan(reattachCap - margin);
});
