import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { gitEnv, spawnsGitBare } from './git-fixture.ts';

const root = path.resolve(import.meta.dirname, '../..');

test('a test that spawns git without gitEnv is caught', () => {
    const source = `import { spawnSync } from 'node:child_process';\nspawnSync(\n    'git', ['init'], { cwd: dir });`;
    expect(spawnsGitBare(source)).toBe(true);
});

test('a test that spawns git with gitEnv passes', () => {
    const source = `import { gitEnv } from './git-fixture.ts';\nexecFileSync('git', ['init'], { env: gitEnv() });`;
    expect(spawnsGitBare(source)).toBe(false);
});

test('gitEnv drops every inherited GIT_ variable', () => {
    process.env.GIT_DIR = '/frame/.git';
    try {
        expect(gitEnv().GIT_DIR).toBeUndefined();
    } finally {
        delete process.env.GIT_DIR;
    }
});

test('every tracked test that spawns git takes its env from gitEnv in script/lib/git-fixture.ts', () => {
    const files = spawnSync('git', ['ls-files', '*.test.ts'], {
        cwd: root,
        encoding: 'utf8',
        env: gitEnv(),
    }).stdout.split('\n');
    const bare = files
        .filter(Boolean)
        .filter((file) =>
            spawnsGitBare(readFileSync(path.join(root, file), 'utf8')),
        );
    expect(
        bare,
        'spawns git without gitEnv() from script/lib/git-fixture.ts',
    ).toEqual([]);
});
