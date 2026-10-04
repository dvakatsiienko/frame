import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const rule = readFileSync(
    join(root, 'home/.claude/rules/fleet-vibe.md'),
    'utf8',
);
const aliases = readFileSync(
    join(root, 'home/.config/zsh-custom/aliases.zsh'),
    'utf8',
);

const ruleWords = new Map(
    [...rule.matchAll(/^- `([a-z]+)` — `([^`]+)`$/gm)].map(([, word, cmd]) => [
        word,
        cmd,
    ]),
);
const vibeBlock = aliases.split('# git vibe')[1]?.split('\n# ')[0] ?? '';
const aliasWords = new Map(
    [...vibeBlock.matchAll(/^alias ([a-z]+)='([^']+)'/gm)].map(
        ([, word, cmd]) => [word, cmd],
    ),
);

describe('vibe contract — fleet-vibe.md each shell word maps to its git vibe alias', () => {
    it('maps each word to the same command on both sides', () => {
        for (const [word, cmd] of ruleWords)
            expect(aliasWords.get(word), word).toBe(cmd);
    });
});
