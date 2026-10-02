import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { lintPurpose, verbs, verbsUnder } from './registry.ts';

const shim = join(import.meta.dirname, 'bin/x');

// a commit hook exports GIT_DIR and friends; a fixture repo must not inherit them
const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
        ([key]) =>
            !key.startsWith('GIT_') &&
            key !== 'CLAUDECODE' &&
            key !== 'AI_AGENT',
    ),
);

const x = (args: string[], cwd: string, env: Record<string, string> = {}) => {
    const result = spawnSync(shim, args, {
        cwd,
        encoding: 'utf8',
        env: { ...cleanEnv, ...env },
    });
    return {
        code: result.status,
        envelope: () => JSON.parse(result.stdout),
        stdout: result.stdout,
    };
};

const git = (cwd: string, ...args: string[]) =>
    spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: cleanEnv,
    }).stdout.trim();

const scratch = (prefix: string) =>
    realpathSync(mkdtempSync(join(tmpdir(), prefix)));

function fixtureRepo() {
    const repo = scratch('x-lane-');
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.name', 'fixture');
    git(repo, 'config', 'user.email', 'fixture@example.com');
    git(repo, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(repo, 'readme.txt'), 'one\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'seed');
    return repo;
}

function messageFile() {
    const path = join(scratch('x-msg-'), 'msg.txt');
    writeFileSync(path, 'fixture commit\n');
    return path;
}

// a hand-made worktree of a git-crypt repo, checked out the way the hazard describes:
// the smudge filter off, so the encrypted file stays ciphertext
function lockedWorktree() {
    const repo = fixtureRepo();
    spawnSync('git-crypt', ['init'], { cwd: repo, env: cleanEnv });
    writeFileSync(
        join(repo, '.gitattributes'),
        'secret.txt filter=git-crypt diff=git-crypt\n',
    );
    writeFileSync(join(repo, 'secret.txt'), 'plaintext\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'secret');

    const tree = join(scratch('x-wt-'), 'tree');
    git(
        repo,
        '-c',
        'filter.git-crypt.smudge=cat',
        '-c',
        'filter.git-crypt.required=false',
        'worktree',
        'add',
        '-q',
        tree,
        '-b',
        'side',
    );
    return realpathSync(tree);
}

function xTree() {
    const tree = scratch('x-tree-');
    mkdirSync(join(tree, 'x/bin'), { recursive: true });
    mkdirSync(join(tree, 'deep'));
    writeFileSync(join(tree, 'x/main.ts'), "console.log('tree-local');\n");
    return tree;
}

describe('x lane', () => {
    it('commits the named paths and names the tree it ran from', () => {
        const repo = fixtureRepo();
        writeFileSync(join(repo, 'readme.txt'), 'two\n');

        const run = x(
            [
                'lane',
                'commit',
                '--apply',
                '--json',
                messageFile(),
                '--',
                'readme.txt',
            ],
            repo,
            { CLAUDECODE: '1' },
        );

        expect(run.code).toBe(0);
        expect(run.envelope().data).toMatchObject({
            sha: git(repo, 'rev-parse', 'HEAD'),
            tree: repo,
        });
    });

    it('reads the paths from the tree root when run from a subdir', () => {
        const repo = fixtureRepo();
        mkdirSync(join(repo, 'sub'));
        writeFileSync(join(repo, 'readme.txt'), 'from a subdir\n');

        const run = x(
            [
                'lane',
                'commit',
                '--apply',
                '--json',
                messageFile(),
                '--',
                'readme.txt',
            ],
            join(repo, 'sub'),
            { CLAUDECODE: '1' },
        );

        expect(run.code).toBe(0);
        expect(git(repo, 'status', '--porcelain')).toBe('');
    });

    it('commits only the named paths on the --repo main, from another tree', () => {
        const repo = fixtureRepo();
        writeFileSync(join(repo, 'readme.txt'), 'two\n');
        writeFileSync(join(repo, 'other.txt'), 'untouched\n');

        const run = x(
            [
                'lane',
                'commit',
                '--repo',
                repo,
                messageFile(),
                '--',
                'readme.txt',
            ],
            fixtureRepo(),
        );

        expect(run.code).toBe(0);
        expect(run.envelope().data.sha).toBe(git(repo, 'rev-parse', 'HEAD'));
        expect(git(repo, 'status', '--porcelain')).toBe('?? other.txt');
    });

    it('refuses a --repo that is not a git repo', () => {
        const run = x(
            [
                'lane',
                'commit',
                '--repo',
                scratch('x-plain-'),
                messageFile(),
                '--',
                'readme.txt',
            ],
            fixtureRepo(),
        );

        expect(run.code).toBe(2);
    });

    it('refuses a --repo whose branch is not main, committing nothing', () => {
        const repo = fixtureRepo();
        git(repo, 'switch', '-q', '-c', 'side');
        writeFileSync(join(repo, 'readme.txt'), 'two\n');
        const before = git(repo, 'rev-parse', 'HEAD');

        const run = x(
            [
                'lane',
                'commit',
                '--repo',
                repo,
                messageFile(),
                '--',
                'readme.txt',
            ],
            fixtureRepo(),
        );

        expect(run.code).toBe(1);
        expect(git(repo, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('refuses a --repo that is mid-merge, committing nothing', () => {
        const repo = fixtureRepo();
        const before = git(repo, 'rev-parse', 'HEAD');
        writeFileSync(
            join(repo, git(repo, 'rev-parse', '--git-path', 'MERGE_HEAD')),
            `${before}\n`,
        );
        writeFileSync(join(repo, 'readme.txt'), 'two\n');

        const run = x(
            [
                'lane',
                'commit',
                '--repo',
                repo,
                messageFile(),
                '--',
                'readme.txt',
            ],
            fixtureRepo(),
        );

        expect(run.code).toBe(1);
        expect(git(repo, 'rev-parse', 'HEAD')).toBe(before);
    });

    it('bare x lane lists the --repo form of commit', () => {
        const commit = x(['lane'], fixtureRepo())
            .envelope()
            .data.groups.lane.find(
                (verb: { name: string }) => verb.name === 'lane commit',
            );

        expect(commit.purpose).toContain('--repo <path>');
    });

    it('exits 4 on a publishing verb without --apply, naming the confirm command', () => {
        const run = x(['lane', 'push'], fixtureRepo());

        expect(run.code).toBe(4);
        expect(run.envelope().next).toBe('x lane push --apply');
    });

    it('finds the verb behind a global flag', () => {
        expect(x(['--json', 'lane', 'push'], fixtureRepo()).code).toBe(4);
    });

    it('refuses to commit in a worktree that holds git-crypt ciphertext, naming x lane unlock', () => {
        const tree = lockedWorktree();
        writeFileSync(join(tree, 'readme.txt'), 'two\n');

        const run = x(
            ['lane', 'commit', messageFile(), '--', 'readme.txt'],
            tree,
        );

        expect(run.code).toBe(1);
        expect(run.envelope().next).toBe('x lane unlock');
    });

    it('unlock turns the ciphertext back into plaintext', () => {
        const tree = lockedWorktree();

        expect(x(['lane', 'unlock'], tree).code).toBe(0);
        expect(readFileSync(join(tree, 'secret.txt'), 'utf8')).toBe(
            'plaintext\n',
        );
    });
});

describe('x', () => {
    it('runs the x source of the nearest checkout above the cwd', () => {
        const tree = xTree();
        writeFileSync(join(tree, 'x/registry.ts'), '');
        copyFileSync(shim, join(tree, 'x/bin/x'));

        expect(x([], join(tree, 'deep')).stdout).toBe('tree-local\n');
    });

    it('ignores an x/main.ts that is not an x checkout', () => {
        expect(x([], join(xTree(), 'deep')).stdout).not.toBe('tree-local\n');
    });

    it('prints ansi-free json when stdout is a pipe', () => {
        const cwd = fixtureRepo();
        const outputs = [[], ['lane'], ['lane', 'push'], ['nope']].map(
            (args) => x(args, cwd).stdout,
        );

        for (const stdout of outputs) {
            expect(stdout).not.toContain('\x1b');
            expect(() => JSON.parse(stdout)).not.toThrow();
        }
    });

    it('schema lists exactly the verbs the registry dispatches under a group', () => {
        const names = x(['schema', 'lane'], fixtureRepo())
            .envelope()
            .data.verbs.map((verb: { name: string }) => verb.name);

        expect(names).toEqual(verbsUnder('lane').map((verb) => verb.name));
    });

    it('every registered verb passes the purpose lint', () => {
        const failing = verbs.filter((verb) => lintPurpose(verb).length > 0);

        expect(failing.map((verb) => verb.name)).toEqual([]);
    });

    it('the purpose lint flags a purpose that only restates the name', () => {
        expect(
            lintPurpose({ name: 'lane push', purpose: 'lane push' }),
        ).not.toEqual([]);
    });
});
