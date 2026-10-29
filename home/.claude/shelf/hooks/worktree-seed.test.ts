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

import { gitEnv } from '../../../../script/lib/git-fixture.ts';

const HOOK = join(import.meta.dirname, 'worktree-seed.sh');
const TYPES = 'mods/m/.claude-plugin/types/claude-code/index.d.ts';
const env = gitEnv();

// a repo whose mod types are generated and gitignored, and a fresh worktree of it on `branch`, as EnterWorktree names it
function fixture(branch = 'worktree-w1') {
    const repo = mkdtempSync(join(tmpdir(), 'seed-'));
    const git = (...args: string[]) =>
        execFileSync('git', ['-C', repo, ...args], { env, stdio: 'ignore' });
    git('init', '-q');
    writeFileSync(join(repo, '.gitignore'), '.claude-plugin/types/\n');
    git('add', '.gitignore');
    // the ci runner has no git identity
    git(
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=fixture',
        '-c',
        'user.email=fixture@local',
        'commit',
        '-qm',
        'init',
    );
    mkdirSync(join(repo, 'mods/m/.claude-plugin/types/claude-code'), {
        recursive: true,
    });
    writeFileSync(join(repo, TYPES), 'export {};\n');
    const tree = join(repo, '.claude/worktrees/w1');
    git('worktree', 'add', '-q', '-b', branch, tree);
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

const seed = (tree: string) =>
    execFileSync('sh', [HOOK], {
        env,
        input: JSON.stringify({ tool_response: { worktreePath: tree } }),
    });
const branchOf = (tree: string) =>
    execFileSync('git', ['-C', tree, 'symbolic-ref', '--short', 'HEAD'], {
        encoding: 'utf8',
        env,
    }).trim();

it('renames a ticket-named worktree branch to codie/<ticket>-<slug>', () => {
    const { tree } = fixture('worktree-FRM-297-branch-name');
    seed(tree);
    expect(branchOf(tree)).toBe('codie/FRM-297-branch-name');
});

it('keeps the branch of a worktree named without a ticket', () => {
    const { tree } = fixture('worktree-ab-knowledge-a');
    seed(tree);
    expect(branchOf(tree)).toBe('worktree-ab-knowledge-a');
});
