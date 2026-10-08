/* Core */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

const script = path.resolve(
    import.meta.dirname,
    '../git-crypt-rename-check.ts',
);

// a commit hook runs this suite with GIT_DIR, GIT_INDEX_FILE and friends set for frame; a fixture
// that inherits them writes frame's index instead of its own
const env = {
    ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    ),
    GIT_AUTHOR_EMAIL: 'fixture@example.com',
    GIT_AUTHOR_NAME: 'fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.com',
    GIT_COMMITTER_NAME: 'fixture',
    GIT_CONFIG_GLOBAL: '/dev/null',
};

function git(dir: string, ...args: string[]) {
    const run = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env });
    expect(run.status, run.stderr).toBe(0);
}

// a repo whose secret.txt is git-crypt by .gitattributes, then `git mv secret.txt <to>` staged
function renamed(to: string, attributesAfter: string) {
    const dir = mkdtempSync(path.join(tmpdir(), 'crypt-rename-'));
    onTestFinished(() => rmSync(dir, { recursive: true }));
    git(dir, 'init', '-q');
    writeFileSync(
        path.join(dir, '.gitattributes'),
        'secret.txt filter=git-crypt diff=git-crypt\n',
    );
    writeFileSync(path.join(dir, 'secret.txt'), 'a secret\n');
    writeFileSync(path.join(dir, 'plain.txt'), 'nothing\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'init');
    git(dir, 'mv', 'secret.txt', to);
    writeFileSync(path.join(dir, '.gitattributes'), attributesAfter);
    git(dir, 'add', '.gitattributes');
    return spawnSync('node', [script], { cwd: dir, encoding: 'utf8', env });
}

test('a git-crypt file renamed to a plain path is refused, naming both paths', () => {
    const run = renamed(
        'moved.txt',
        'secret.txt filter=git-crypt diff=git-crypt\n',
    );

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('secret.txt → moved.txt');
});

test('a git-crypt file renamed under a path that keeps the filter goes through', () => {
    const run = renamed(
        'moved.txt',
        'secret.txt filter=git-crypt diff=git-crypt\nmoved.txt filter=git-crypt diff=git-crypt\n',
    );

    expect(run.status, run.stderr).toBe(0);
});

test('a rename that also drops the old pattern is still refused', () => {
    const run = renamed('moved.txt', '');

    expect(run.status).toBe(1);
});
