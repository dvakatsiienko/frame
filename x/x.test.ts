import { spawnSync } from 'node:child_process';
import {
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

    it('exits 4 on a publishing verb without --apply, naming the confirm command', () => {
        const run = x(['lane', 'push'], fixtureRepo());

        expect(run.code).toBe(4);
        expect(run.envelope().next).toBe('x lane push --apply');
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
        const tree = scratch('x-tree-');
        mkdirSync(join(tree, 'x'));
        mkdirSync(join(tree, 'deep'));
        writeFileSync(join(tree, 'x/main.ts'), "console.log('tree-local');\n");

        expect(x([], join(tree, 'deep')).stdout).toBe('tree-local\n');
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
