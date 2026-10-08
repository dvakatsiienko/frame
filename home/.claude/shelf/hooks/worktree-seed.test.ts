import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const HOOK = join(import.meta.dirname, 'worktree-seed.sh');
const TYPES = 'mods/m/.claude-plugin/types/claude-code/index.d.ts';
// a git hook's GIT_INDEX_FILE and GIT_DIR would point the fixture's git at the repo being committed
const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
);

// a repo whose mod types are generated and gitignored, and a fresh worktree of it
function fixture() {
    const repo = mkdtempSync(join(tmpdir(), 'seed-'));
    const git = (...args: string[]) =>
        execFileSync('git', ['-C', repo, ...args], { env, stdio: 'ignore' });
    git('init', '-q');
    writeFileSync(join(repo, '.gitignore'), '.claude-plugin/types/\n');
    git('add', '.gitignore');
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'init');
    mkdirSync(join(repo, 'mods/m/.claude-plugin/types/claude-code'), {
        recursive: true,
    });
    writeFileSync(join(repo, TYPES), 'export {};\n');
    const tree = join(repo, '.claude/worktrees/w1');
    git('worktree', 'add', '-q', tree);
    return { repo, tree };
}

it("copies each mod's generated types into a fresh worktree", () => {
    const { tree } = fixture();
    execFileSync('sh', [HOOK], {
        env,
        input: JSON.stringify({ tool_response: { worktreePath: tree } }),
    });
    expect(existsSync(join(tree, TYPES))).toBe(true);
    expect(readFileSync(join(tree, TYPES), 'utf8')).toBe('export {};\n');
});
