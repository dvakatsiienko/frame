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
    return { addTree, env, git, land, prompt, root, tree, write, xCalls };
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

describe('tree-sync seat', () => {
    test('a wing named in the registry syncs its seat tree, whatever its session id', () => {
        const w = world();
        const seat = w.addTree('clio-wing-2');
        const sessions = mkdtempSync(join(tmpdir(), 'tree-sync-s-'));
        writeFileSync(
            join(sessions, '1.json'),
            JSON.stringify({
                name: '🦉🪽 clio: wing 2',
                sessionId: 'after-a-clear',
            }),
        );
        w.write(w.root, 'b.txt', 'b\n');
        const out = spawnSync('bash', [SYNC], {
            encoding: 'utf8',
            env: { ...w.env, TREE_SYNC_SESSIONS: sessions },
            input: JSON.stringify({ session_id: 'after-a-clear' }),
        });
        expect(out.stdout).toContain('tree synced');
        expect(existsSync(join(seat, 'b.txt'))).toBe(true);
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
            `frame: plugin bump --apply clio\nframe: lane commit ${w.tree}/.scratch/plugin-bump-message.txt -- _clio/plugin-clio/.claude-plugin/plugin.json\nframe: lane push --apply\n`,
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
            `frame: plugin bump --apply x\nframe: lane commit ${w.tree}/.scratch/plugin-bump-message.txt -- home/.claude/plugin-x/.claude-plugin/plugin.json\nframe: lane push --apply\n`,
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

    test('a merge that outlasts its limit is stopped and aborted, the tree as it was', () => {
        const w = world();
        w.write(w.root, 'b.txt', 'b\n');
        w.write(w.tree, 'c.txt', 'c\n');
        const head = w.git(w.tree, 'rev-parse', 'HEAD').stdout;
        const bin = join(w.root, '..', 'bin');
        // a commit hook is what a slow signing looks like to the merge
        w.git(w.root, 'config', 'core.hooksPath', join(bin, 'hooks'));
        mkdirSync(join(bin, 'hooks'));
        writeFileSync(
            join(bin, 'hooks', 'pre-merge-commit'),
            '#!/bin/bash\nsleep 30\n',
        );
        chmodSync(join(bin, 'hooks', 'pre-merge-commit'), 0o755);
        const out = spawnSync('bash', [SYNC], {
            encoding: 'utf8',
            env: { ...w.env, TREE_SYNC_MERGE_LIMIT: '1' },
            input: JSON.stringify({ session_id: SID }),
        });
        expect(w.git(w.tree, 'rev-parse', 'HEAD').stdout).toBe(head);
        expect(existsSync(join(w.tree, 'b.txt'))).toBe(false);
        expect(w.git(w.tree, 'status', '--porcelain').stdout).toBe('');
        expect(out.stdout).toContain('tree 1 behind main');
    });

    test('a peer moving main right after the fast-forward is no refusal', () => {
        const w = world();
        w.write(w.tree, 'c.txt', 'c\n');
        // the post-merge hook is the peer: it commits on main as our fast-forward ends
        const bin = join(w.root, '..', 'bin');
        mkdirSync(join(bin, 'hooks'));
        w.git(w.root, 'config', 'core.hooksPath', join(bin, 'hooks'));
        writeFileSync(
            join(bin, 'hooks', 'post-merge'),
            `#!/bin/bash\nunset GIT_DIR GIT_INDEX_FILE\ngit -C '${w.root}' commit -q --allow-empty -m peer\n`,
        );
        chmodSync(join(bin, 'hooks', 'post-merge'), 0o755);
        const out = w.land();
        expect([out.status, w.xCalls()]).toEqual([
            0,
            'frame: lane push --apply\n',
        ]);
    });

    test('a retry after a failed push still bumps what origin lacks', () => {
        const w = world();
        const pushed = w.git(w.root, 'rev-parse', 'HEAD').stdout.trim();
        mkdirSync(join(w.tree, '_clio/plugin-clio'), { recursive: true });
        w.write(w.tree, '_clio/plugin-clio/s.md', 's\n');
        w.git(w.root, 'merge', '--ff-only', '-q', 'worktree-fork-abcd1234');
        w.git(w.root, 'update-ref', 'refs/remotes/origin/main', pushed);
        w.land();
        expect(w.xCalls()).toContain('plugin bump --apply clio');
    });

    test("a peer's brief lock on main is waited out", () => {
        const w = world();
        w.write(w.tree, 'c.txt', 'c\n');
        const lock = join(w.root, '.git', 'index.lock');
        writeFileSync(lock, '');
        const out = spawnSync(
            'bash',
            ['-c', `(sleep 1; rm -f '${lock}') & bash '${SYNC}' land`],
            { encoding: 'utf8', env: w.env },
        );
        expect(out.status).toBe(0);
        expect(existsSync(join(w.root, 'c.txt'))).toBe(true);
    });

    test("a lock that stays stops the landing with git's own words", () => {
        const w = world();
        w.write(w.tree, 'c.txt', 'c\n');
        writeFileSync(join(w.root, '.git', 'index.lock'), '');
        const out = w.land();
        expect([out.status, out.stderr]).toEqual([
            1,
            expect.stringContaining('index.lock'),
        ]);
        expect(w.xCalls()).toBe('');
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
