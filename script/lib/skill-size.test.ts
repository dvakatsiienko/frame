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

// crew-dna rides every member's step 0, so the dna and the role skills it slimmed hold tighter caps
const crewCaps = {
    'crew-adviser': 12_000,
    'crew-designer': 12_000,
    'crew-dna': 7_000,
    'crew-verifier': 12_000,
} as const satisfies Record<string, number>;

const countChars = (file: string) =>
    [...readFileSync(path.join(root, file), 'utf8')].length;

test.each(skills)('%s fits the compaction re-attach cap', (file) => {
    const chars = countChars(file);
    expect(
        chars,
        `${file}: ${chars} chars, cap ${reattachCap} − ${margin} margin`,
    ).toBeLessThan(reattachCap - margin);
});

test.each(Object.entries(crewCaps))('%s fits its crew cap', (name, cap) => {
    const file = `home/.claude/plugin-x/skills/${name}/SKILL.md`;
    const chars = countChars(file);
    expect(
        chars,
        `${file}: ${chars} chars, crew cap ${cap}`,
    ).toBeLessThanOrEqual(cap);
});
