import { execFileSync, spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = resolve(import.meta.dirname, '../..');
const env = gitEnv();

// the typecheck job's run line, read from frame's lefthook.yaml as the hook runs it
function hookLine(job: string) {
    const lefthook = readFileSync(join(root, 'lefthook.yaml'), 'utf8');
    const line = new RegExp(
        `\\n    ${job}:\\n(?:      #.*\\n)*      run: (.+)\\n`,
    ).exec(lefthook)?.[1];
    if (!line)
        throw new Error(`no pre-commit ${job} run line in lefthook.yaml`);
    return line;
}

test("the hook's typecheck passes a commit while a peer's unstaged edit is broken", () => {
    const repo = mkdtempSync(join(tmpdir(), 'index-run-'));
    mkdirSync(join(repo, 'script'));
    copyFileSync(
        join(root, 'script/index-run.sh'),
        join(repo, 'script/index-run.sh'),
    );
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(
        join(repo, 'package.json'),
        JSON.stringify({
            name: 'fixture',
            private: true,
            scripts: { typecheck: '! grep -q BROKEN peer.ts' },
        }),
    );
    writeFileSync(join(repo, 'peer.ts'), 'export const ok = 1;\n');
    execFileSync('git', ['init', '-q'], { cwd: repo, env });
    execFileSync('git', ['add', '-A'], { cwd: repo, env });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo, env });
    writeFileSync(
        join(repo, 'peer.ts'),
        'export const ok: number = "BROKEN";\n',
    );

    const run = spawnSync('sh', ['-c', hookLine('typecheck')], {
        cwd: repo,
        encoding: 'utf8',
        env,
    });

    expect(run.status, run.stdout + run.stderr).toBe(0);
});

test('the index copy leaves nothing behind', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'index-run-tmp-'));

    const run = spawnSync('bash', [join(root, 'script/index-run.sh'), 'true'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...env, TMPDIR: scratch },
    });

    expect(run.status, run.stderr).toBe(0);
    expect(readdirSync(scratch)).toEqual([]);
});

// a repo whose shared index holds a peer's staged new file, and a pathspec commit's own index that lacks it
function peerStaged() {
    const repo = mkdtempSync(join(tmpdir(), 'index-run-peer-'));
    mkdirSync(join(repo, 'script'));
    copyFileSync(
        join(root, 'script/index-run.sh'),
        join(repo, 'script/index-run.sh'),
    );
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    const git = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
        execFileSync('git', args, {
            cwd: repo,
            encoding: 'utf8',
            env: { ...gitEnv(), ...extra },
        });
    git(['init', '-q']);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'seed']);
    writeFileSync(join(repo, 'peer.test.ts'), 'export {};\n');
    git(['add', 'peer.test.ts']);
    writeFileSync(join(repo, 'mine.txt'), 'mine\n');
    const commitIndex = join(
        mkdtempSync(join(tmpdir(), 'index-run-idx-')),
        'index',
    );
    git(['read-tree', 'HEAD'], { GIT_INDEX_FILE: commitIndex });
    git(['add', 'mine.txt'], { GIT_INDEX_FILE: commitIndex });
    // a gate's git as a test runs it: gitEnv() strips GIT_INDEX_FILE
    const gate = (command: string, extra: NodeJS.ProcessEnv = {}) =>
        spawnSync(
            'bash',
            [
                join(repo, 'script/index-run.sh'),
                'sh',
                '-c',
                `env -u GIT_INDEX_FILE ${command}`,
            ],
            { cwd: repo, encoding: 'utf8', env: { ...gitEnv(), ...extra } },
        );
    return { commitIndex, gate, repo };
}

test("a pathspec commit's gate lists the commit's files, never a peer's staged one", () => {
    const { commitIndex, gate } = peerStaged();

    const run = gate('git ls-files', { GIT_INDEX_FILE: commitIndex });

    expect(run.stdout.split('\n').filter(Boolean), run.stderr).toEqual([
        'a.txt',
        'mine.txt',
        'pnpm-workspace.yaml',
        'script/index-run.sh',
    ]);
});

test('a gate with no commit index lists exactly the real index', () => {
    const { gate } = peerStaged();

    const run = gate('git ls-files');

    expect(run.stdout.split('\n').filter(Boolean), run.stderr).toEqual([
        'a.txt',
        'peer.test.ts',
        'pnpm-workspace.yaml',
        'script/index-run.sh',
    ]);
});

test("a fixture's git inside a gate never reaches the real repo under a hook's GIT_DIR", () => {
    const { gate, repo } = peerStaged();
    const fixture = mkdtempSync(join(tmpdir(), 'index-run-fixture-'));

    const run = gate(
        `sh -c 'cd ${fixture} && git init -q && git config user.name escaped'`,
        { GIT_DIR: join(repo, '.git') },
    );

    expect(run.status, run.stderr).toBe(0);
    const config = readFileSync(join(repo, '.git/config'), 'utf8');
    expect(config).toContain('bare = false');
    expect(config).not.toContain('escaped');
    expect(readFileSync(join(fixture, '.git/config'), 'utf8')).toContain(
        'escaped',
    );
});

test.each([
    ['a commit hook', { GIT_EDITOR: ':' }, 'commit'],
    ['any other caller', {}, 'other'],
])("%s's gate logs one step row, with its exit", (_name, extra, source) => {
    const { gate, repo } = peerStaged();
    const state = mkdtempSync(join(tmpdir(), 'index-run-state-'));
    execFileSync('git', ['switch', '-q', '-c', 'codie/FRM-1-x'], {
        cwd: repo,
        env: gitEnv(),
    });

    const run = gate('sh -c "exit 7"', {
        ...extra,
        VITEST: '',
        X_STATE: state,
    });

    expect(run.status, run.stderr).toBe(7);
    const row = readFileSync(join(state, 'gate-steps.log'), 'utf8')
        .trimEnd()
        .split('\t');
    expect(row).toHaveLength(8);
    expect(row.slice(2, 4)).toEqual([source, 'codie/FRM-1-x']);
    expect(row[4]).toMatch(/^[0-9a-f]+$/);
    expect(row[6]).toBe('7');
    expect(row[7]).toContain('exit 7');
});

test('a gate under vitest writes no step row', () => {
    const { gate } = peerStaged();
    const state = mkdtempSync(join(tmpdir(), 'index-run-state-'));

    gate('true', { VITEST: 'true', X_STATE: state });

    expect(readdirSync(state)).toEqual([]);
});

test("a gate's staged diff names only the commit's files", () => {
    const { commitIndex, gate } = peerStaged();

    const run = gate('git diff --cached --name-only', {
        GIT_INDEX_FILE: commitIndex,
    });

    expect(run.stdout.trim(), run.stderr).toBe('mine.txt');
});

test('a gate reads the branch its detached copy cannot', () => {
    const { gate, repo } = peerStaged();
    execFileSync('git', ['switch', '-q', '-c', 'codie/FRM-1-x'], {
        cwd: repo,
        env: gitEnv(),
    });

    const run = gate('printenv INDEX_RUN_BRANCH');

    expect(run.stdout.trim(), run.stderr).toBe('codie/FRM-1-x');
});

test('the gate copy never shows in git worktree list, and its temp dir is gone after', () => {
    const { commitIndex, gate, repo } = peerStaged();
    const scratch = mkdtempSync(join(tmpdir(), 'index-run-tmp-'));

    const run = gate(`git -C ${repo} worktree list`, {
        GIT_INDEX_FILE: commitIndex,
        TMPDIR: scratch,
    });

    expect([
        run.stdout.trim().split('\n').length,
        readdirSync(scratch),
    ]).toEqual([1, []]);
});
