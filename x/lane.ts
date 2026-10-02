import { spawnSync } from 'node:child_process';
import {
    closeSync,
    existsSync,
    openSync,
    readFileSync,
    readSync,
    unlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { Flags, Verb } from './verb.ts';
import { Fail } from './verb.ts';

const cryptMagic = Buffer.from('\0GITCRYPT\0');
const wrapPath = join(
    import.meta.dirname,
    '../home/.claude/plugin-x/bin/github-token-wrap',
);

export const laneVerbs = [
    {
        args: [
            {
                description: 'file holding the commit message',
                name: 'msg-file',
            },
            {
                description:
                    'paths that go into the commit, read from the tree root, after --',
                isVariadic: true,
                name: 'paths',
            },
        ],
        flags: {
            repo: {
                description:
                    'commit in that repo instead, only on its main and never mid-merge; paths are relative to its root',
                type: 'string',
                value: 'path',
            },
        },
        name: 'lane commit',
        needsApply: false,
        purpose:
            "commit only the named paths, print the new sha; mid-merge concludes it; --repo <path> commits on that repo's main",
        run: commit,
    },
    {
        args: [],
        name: 'lane push',
        needsApply: true,
        plan: pushPlan,
        purpose:
            "push HEAD's sha to its branch and read the remote back; a frame worktree pushes from the main checkout",
        run: push,
    },
    {
        args: [
            { description: 'pr title', name: 'title' },
            { description: 'file holding the pr body', name: 'body-file' },
        ],
        name: 'lane pr-open',
        needsApply: true,
        plan: prPlan,
        purpose:
            'open a pr from the pushed branch onto main as the x-coder-cc app',
        run: prOpen,
    },
    {
        args: [],
        name: 'lane merge-main',
        needsApply: false,
        purpose:
            'fetch and merge origin/main into this branch; a conflict prints the files and stops',
        run: mergeMain,
    },
    {
        args: [],
        name: 'lane unlock',
        needsApply: false,
        purpose:
            'decrypt the git-crypt files of a worktree that holds ciphertext, so staging stops dying',
        run: unlock,
    },
] as const satisfies readonly Verb[];

/* Verbs */
function commit(args: string[], flags: Flags) {
    const [msgFile, ...paths] = args;
    if (!(msgFile && existsSync(msgFile)))
        throw new Fail(
            `no message file at ${msgFile}`,
            'x lane commit <msg-file> -- <paths…>',
            true,
        );
    if (paths.length === 0)
        throw new Fail(
            'no paths — name what goes into the commit',
            `x lane commit ${msgFile} -- <paths…>`,
            true,
        );

    const message = resolve(msgFile);
    if (typeof flags.repo === 'string') enterMain(flags.repo);

    const tree = top();
    // paths are written from the root; a cwd that drifted into a subdir would miss them
    process.chdir(tree);
    assertUnlocked(tree);

    // a path gone from both the tree and the index (the old side of a mv) kills `add`,
    // so stage only what exists and let the index carry the removal
    const present = paths.filter(
        (path) =>
            existsSync(path) ||
            git(['ls-files', '--error-unmatch', '--', path]).isOk,
    );
    if (present.length > 0) mustGit(['add', '-A', '--', ...present], 'add');

    const isMerging = existsSync(
        resolve(
            mustGit(['rev-parse', '--git-path', 'MERGE_HEAD'], 'rev-parse'),
        ),
    );
    if (!isMerging && git(['diff', '--cached', '--quiet', '--', ...paths]).isOk)
        throw new Fail(
            'nothing staged under those paths — empty diff, no commit',
            'x lane commit <msg-file> -- <paths that changed>',
        );

    const committed = git(
        isMerging
            ? ['commit', '-F', message]
            : ['commit', '-F', message, '--', ...paths],
    );
    if (!committed.isOk) {
        process.stderr.write(`${committed.log}\n`);
        throw new Fail(
            'commit failed — the hook output is above',
            `x lane commit ${msgFile} -- ${paths.join(' ')}`,
        );
    }

    return {
        branch: git(['symbolic-ref', '--quiet', '--short', 'HEAD']).out,
        sha: head(),
        tree,
    };
}

function pushPlan() {
    return { branch: branch(), sha: head(), ...pushHome() };
}

function push() {
    const { branch: name, from, sha } = pushPlan();
    const pushed = git(
        ['push', '-q', 'origin', `${sha}:refs/heads/${name}`],
        from,
    );
    if (!pushed.isOk) {
        process.stderr.write(`${pushed.log}\n`);
        throw new Fail(
            'push failed — the git and hook output is above',
            'fix what the pre-push hooks name, then x lane push --apply',
        );
    }

    const remote = remoteSha(name);
    if (remote !== sha)
        throw new Fail(
            `remote is ${remote || 'empty'}, HEAD is ${sha}`,
            'x lane push --apply',
        );
    return { branch: name, from, remote, sha };
}

function prPlan(args: string[]) {
    const [title = '', bodyFile = ''] = args;
    if (!existsSync(bodyFile))
        throw new Fail(
            `no body file at ${bodyFile}`,
            'x lane pr-open <title> <body-file>',
            true,
        );

    const name = branch();
    if (remoteSha(name) !== head())
        throw new Fail(`origin/${name} is not at HEAD`, 'x lane push --apply');

    const argv = [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        name,
        '--title',
        title,
        '--body-file',
        bodyFile,
    ];
    return { argv, branch: name };
}

function prOpen(args: string[]) {
    const { argv, branch: name } = prPlan(args);
    const opened = run(wrapPath, argv);
    if (!opened.isOk) {
        process.stderr.write(`${opened.log}\n`);
        throw new Fail(
            'gh pr create failed — its output is above',
            'gh pr view',
        );
    }
    return { branch: name, url: opened.out };
}

function mergeMain() {
    branch();
    mustGit(['fetch', '-q', 'origin', 'main'], 'fetch');

    const merged = git(['merge', '--no-edit', 'origin/main']);
    if (!merged.isOk) {
        const conflicts = git(['diff', '--name-only', '--diff-filter=U']).out;
        if (!conflicts) {
            process.stderr.write(`${merged.log}\n`);
            throw new Fail(
                'merge failed without conflicts — its output is above',
                'git status',
            );
        }
        throw new Fail(
            `conflicts: ${conflicts.split('\n').join(', ')}`,
            'resolve them, then x lane commit <msg-file> -- <resolved paths>',
        );
    }
    return { sha: head() };
}

// the recipe from shelf/hooks/worktree-seed.sh: the key lives in the main .git, and the
// unlock runs `git status`, which dies on the clean filter unless both filters are off
function unlock() {
    const tree = top();
    const locked = lockedPaths(tree);
    if (locked.length === 0) return { tree, unlocked: 0 };

    const key = join(
        mustGit(
            ['rev-parse', '--path-format=absolute', '--git-common-dir'],
            'rev-parse',
        ),
        'git-crypt/keys/default',
    );
    if (!existsSync(key))
        throw new Fail(
            `no git-crypt key at ${key}`,
            'run git-crypt unlock in the main checkout first',
        );

    const gitDir = mustGit(
        ['rev-parse', '--path-format=absolute', '--git-dir'],
        'rev-parse',
    );
    if (!existsSync(join(gitDir, 'git-crypt'))) {
        const unlocked = run('git-crypt', ['unlock', key], tree, {
            GIT_CONFIG_COUNT: '2',
            GIT_CONFIG_KEY_0: 'filter.git-crypt.clean',
            GIT_CONFIG_KEY_1: 'filter.git-crypt.required',
            GIT_CONFIG_VALUE_0: 'cat',
            GIT_CONFIG_VALUE_1: 'false',
        });
        if (!unlocked.isOk) {
            process.stderr.write(`${unlocked.log}\n`);
            throw new Fail(
                'git-crypt unlock failed — its output is above',
                'git-crypt status',
            );
        }
    }

    // in a real frame tree the unlock decrypts by itself; in a fresh fixture git sees the
    // ciphertext as unchanged and never re-smudges it. so the set is read again, and a file
    // is removed only while its raw bytes ARE its index blob
    for (const path of lockedPaths(tree)) {
        const raw = mustGit(
            ['hash-object', '--no-filters', '--', path],
            'hash-object',
            tree,
        );
        const staged = mustGit(
            ['ls-files', '-s', '--', path],
            'ls-files',
            tree,
        ).split(' ')[1];
        if (raw !== staged)
            throw new Fail(
                `${path} differs from its index blob — not touching it`,
                `git -c filter.git-crypt.clean=cat diff -- ${path}`,
            );
        unlinkSync(join(tree, path));
        mustGit(['checkout', '--', path], 'checkout', tree);
    }

    const left = lockedPaths(tree);
    if (left.length > 0)
        throw new Fail(
            `still ciphertext: ${left.join(', ')}`,
            'git-crypt status',
        );
    return { tree, unlocked: locked.length };
}

/* Git */
// a worktree coder's other-repo half lands on that repo's main and nowhere else
function enterMain(repo: string) {
    const root = git(['rev-parse', '--show-toplevel'], repo);
    if (!root.isOk)
        throw new Fail(
            `${repo} is not a git repo`,
            'x lane commit --repo <git repo on main> <msg-file> -- <paths…>',
            true,
        );

    const name = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], root.out);
    if (name.out !== 'main')
        throw new Fail(
            `${root.out} is on ${name.out || 'a detached HEAD'}, not main`,
            `switch ${root.out} to main, then rerun`,
        );

    // the bare mid-merge commit would conclude someone else's merge under this message
    const mergeHead = git(['rev-parse', '--git-path', 'MERGE_HEAD'], root.out);
    if (existsSync(resolve(root.out, mergeHead.out)))
        throw new Fail(
            `${root.out} is mid-merge — not committing into someone else's merge`,
            `finish the merge in ${root.out}, then rerun`,
        );
    process.chdir(root.out);
}

function assertUnlocked(tree: string) {
    const locked = lockedPaths(tree);
    if (locked.length > 0)
        throw new Fail(
            `git-crypt files hold ciphertext here (${locked.join(', ')}) — any add dies on the clean filter`,
            'x lane unlock',
        );
}

function lockedPaths(tree: string) {
    const attributes = join(tree, '.gitattributes');
    if (
        !(
            existsSync(attributes) &&
            readFileSync(attributes, 'utf8').includes('git-crypt')
        )
    )
        return [];

    const files = mustGit(['ls-files', '-z'], 'ls-files', tree);
    const attrs = run(
        'git',
        ['check-attr', '-z', '--stdin', 'filter'],
        tree,
        {},
        files,
    );
    const fields = attrs.out.split('\0');
    const crypted: string[] = [];
    for (let i = 0; i + 2 < fields.length; i += 3)
        if (fields[i + 2] === 'git-crypt') crypted.push(fields[i] ?? '');

    return crypted.filter((path) => startsWithMagic(join(tree, path)));
}

function startsWithMagic(path: string) {
    if (!existsSync(path)) return false;
    const fd = openSync(path, 'r');
    const head = Buffer.alloc(cryptMagic.length);
    readSync(fd, head, 0, head.length, 0);
    closeSync(fd);
    return head.equals(cryptMagic);
}

// frame's pre-push mirror gate reads ~ symlinks that point at the main checkout, so a
// frame worktree's own push always fails; the main checkout pushes the same sha (shared objects)
function pushHome() {
    const tree = top();
    const gitDir = mustGit(
        ['rev-parse', '--path-format=absolute', '--git-dir'],
        'rev-parse',
    );
    const common = mustGit(
        ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        'rev-parse',
    );
    if (gitDir === common) return { from: tree, reason: 'main checkout' };

    const frameCommon = mustGit(
        ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        'rev-parse',
        import.meta.dirname,
    );
    if (frameCommon !== common) return { from: tree, reason: 'worktree' };
    return {
        from: dirname(common),
        reason: 'frame worktree: the mirror gate passes only in the main checkout',
    };
}

const top = () => mustGit(['rev-parse', '--show-toplevel'], 'rev-parse');
const head = () => mustGit(['rev-parse', 'HEAD'], 'rev-parse');

function branch() {
    const found = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!found.isOk) throw new Fail('detached HEAD', 'git switch -c <branch>');
    return found.out;
}

const remoteSha = (name: string) =>
    mustGit(['ls-remote', 'origin', `refs/heads/${name}`], 'ls-remote').split(
        '\t',
    )[0] ?? '';

function mustGit(args: string[], step: string, cwd?: string) {
    const result = git(args, cwd);
    if (!result.isOk)
        throw new Fail(`git ${step} failed: ${result.log}`, 'git status');
    return result.out;
}

const git = (args: string[], cwd?: string) => run('git', args, cwd);

function run(
    command: string,
    args: string[],
    cwd?: string,
    env: Record<string, string> = {},
    input?: string,
) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...env },
        input,
    });
    const out = (result.stdout ?? '').trim();
    return {
        isOk: result.status === 0,
        log: `${out}\n${result.stderr ?? result.error?.message ?? ''}`.trim(),
        out,
    };
}
