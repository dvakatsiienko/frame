import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';

const SYNC = join(
    import.meta.dirname,
    '..',
    '.claude',
    'hooks',
    'tree-sync.sh',
);
const SID = 'abcd1234-rest';

function world() {
    const base = mkdtempSync(join(tmpdir(), 'tree-sync-'));
    const root = join(base, 'frame');
    mkdirSync(root);
    const git = (dir: string, ...args: string[]) =>
        spawnSync('git', ['-C', dir, ...args], {
            encoding: 'utf8',
            env: gitEnv(),
        });
    git(root, 'init', '-q', '-b', 'main');
    const write = (dir: string, file: string, text: string, commit = true) => {
        writeFileSync(join(dir, file), text);
        if (commit) {
            git(dir, 'add', file);
            git(dir, 'commit', '-q', '-m', file);
        }
    };
    write(root, 'a.txt', 'a\n');
    const addTree = (name: string) => {
        const tree = join(root, '.claude', 'worktrees', name);
        git(root, 'worktree', 'add', '-q', '-b', `worktree-${name}`, tree);
        return tree;
    };
    const tree = addTree('fork-abcd1234');
    const bin = join(base, 'bin');
    mkdirSync(bin);
    const calls = join(base, 'x-calls');
    writeFileSync(
        join(bin, 'x'),
        `#!/bin/bash\necho "$(basename "$PWD"): $*" >> '${calls}'\n`,
    );
    chmodSync(join(bin, 'x'), 0o755);
    const env = {
        ...gitEnv(),
        CLAUDE_CODE_SESSION_ID: SID,
        PATH: `${bin}:${process.env.PATH}`,
        TREE_SYNC_ROOT: root,
    };
    const prompt = (session = SID) =>
        spawnSync('bash', [SYNC], {
            encoding: 'utf8',
            env,
            input: JSON.stringify({ session_id: session }),
        });
    const land = () =>
        spawnSync('bash', [SYNC, 'land'], { encoding: 'utf8', env });
    const xCalls = () => (existsSync(calls) ? readFileSync(calls, 'utf8') : '');
    return { addTree, git, land, prompt, root, tree, write, xCalls };
}

describe('tree-sync on a prompt', () => {
    test('a clean tree behind main merges main in and says so', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        expect(w.prompt().stdout).toContain('tree synced: 1 new from main');
        expect(existsSync(join(w.tree, 'b.txt'))).toBe(true);
    });

    test('a level tree prints nothing', () => {
        expect(world().prompt().stdout).toBe('');
    });

    test('a session with no tree prints nothing and touches nothing', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        expect(w.prompt('99999999-other').stdout).toBe('');
        expect(existsSync(join(w.tree, 'b.txt'))).toBe(false);
    });

    test('uncommitted edits survive a fast-forward beside them', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        w.write(w.tree, 'a.txt', 'edit\n', false);
        expect(w.prompt().stdout).toContain('tree synced');
        expect(readFileSync(join(w.tree, 'a.txt'), 'utf8')).toBe('edit\n');
        expect(existsSync(join(w.tree, 'b.txt'))).toBe(true);
    });

    test('uncommitted edits with commits on both sides wait, nothing merged', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        w.write(w.tree, 'c.txt', 'c\n');
        w.write(w.tree, 'a.txt', 'edit\n', false);
        expect(w.prompt().stdout).toContain('waits for your commit');
        expect(readFileSync(join(w.tree, 'a.txt'), 'utf8')).toBe('edit\n');
        expect(existsSync(join(w.tree, 'b.txt'))).toBe(false);
    });

    test('a conflict aborts, names the file and leaves the tree as it was', () => {
        const w = world();
        w.write(w.root, 'a.txt', 'main\n');
        w.write(w.tree, 'a.txt', 'tree\n');
        const head = w.git(w.tree, 'rev-parse', 'HEAD').stdout;
        const out = w.prompt().stdout;
        expect(out).toContain('conflict left for you to merge: a.txt');
        expect(w.git(w.tree, 'rev-parse', 'HEAD').stdout).toBe(head);
        expect(w.git(w.tree, 'status', '--porcelain').stdout).toBe('');
    });

    test('commits not yet on main get one line naming the landing', () => {
        const w = world();
        w.write(w.tree, 'c.txt', 'c\n');
        expect(w.prompt().stdout).toContain('1 commits not on main yet');
    });
});

describe('tree-sync land', () => {
    test('merges main in, moves main, pushes, keeps the tree', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        w.write(w.tree, 'c.txt', 'c\n');
        const out = w.land();
        expect(out.status).toBe(0);
        expect(existsSync(join(w.root, 'c.txt'))).toBe(true);
        // from the main checkout: from a tree, x pushes the tree's branch and refuses a bump
        expect(w.xCalls()).toBe('frame: lane push --apply\n');
        expect(existsSync(w.tree)).toBe(true);
    });

    test('a changed clio plugin file bumps clio; a mods file bumps nothing', () => {
        const w = world();
        mkdirSync(join(w.tree, '_clio/plugin-clio'), { recursive: true });
        mkdirSync(join(w.tree, 'home/.claude/plugin-x/mods'), {
            recursive: true,
        });
        w.write(w.tree, '_clio/plugin-clio/s.md', 's\n');
        w.write(w.tree, 'home/.claude/plugin-x/mods/m.ts', 'm\n');
        w.land();
        expect(w.xCalls()).toBe(
            'frame: lane push --apply\nframe: plugin bump --apply clio\n',
        );
    });

    test('a changed skill of plugin x bumps x', () => {
        const w = world();
        mkdirSync(join(w.tree, 'home/.claude/plugin-x/skills'), {
            recursive: true,
        });
        w.write(w.tree, 'home/.claude/plugin-x/skills/s.md', 's\n');
        w.land();
        expect(w.xCalls()).toBe(
            'frame: lane push --apply\nframe: plugin bump --apply x\n',
        );
    });

    test('a conflict stops before main moves or anything is pushed', () => {
        const w = world();
        w.write(w.root, 'a.txt', 'main\n');
        w.write(w.tree, 'a.txt', 'tree\n');
        const head = w.git(w.root, 'rev-parse', 'HEAD').stdout;
        expect(w.land().status).toBe(1);
        expect(w.git(w.root, 'rev-parse', 'HEAD').stdout).toBe(head);
        expect(w.xCalls()).toBe('');
    });

    test("another wing's clean tree comes level; a dirty one keeps its edits", () => {
        const w = world();
        const clean = w.addTree('fork-11111111');
        const dirty = w.addTree('fork-22222222');
        w.write(dirty, 'd.txt', 'd\n');
        w.write(dirty, 'a.txt', 'edit\n', false);
        w.write(w.tree, 'c.txt', 'c\n');
        w.land();
        expect(existsSync(join(clean, 'c.txt'))).toBe(true);
        expect(readFileSync(join(dirty, 'a.txt'), 'utf8')).toBe('edit\n');
        expect(existsSync(join(dirty, 'c.txt'))).toBe(false);
    });

    test('a session with no tree is refused with its path', () => {
        const w = world();
        const out = spawnSync('bash', [SYNC, 'land'], {
            encoding: 'utf8',
            env: {
                ...gitEnv(),
                CLAUDE_CODE_SESSION_ID: '',
                TREE_SYNC_ROOT: w.root,
            },
        });
        expect([out.status, out.stderr]).toEqual([
            2,
            expect.stringContaining('no tree'),
        ]);
    });
});
