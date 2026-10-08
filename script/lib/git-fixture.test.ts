import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { bareGitSpawns, gitEnv } from './git-fixture.ts';

const root = path.resolve(import.meta.dirname, '../..');
// the fixtures' calls are spelled in pieces, so the repo-wide lint below never reads them as this file's own spawns
const callOf = (name: string) => `${name}Sync(`;
const IMPORT = `import { gitEnv } from './git-fixture.ts';\n`;

test('a git spawn in a file that never imports gitEnv is caught', () => {
    const source = `const a = 1;\n${callOf('spawn')}'git', ['init'], { cwd: dir });`;
    expect(bareGitSpawns(source)).toEqual([2]);
});

test('a git spawn that passes gitEnv passes', () => {
    const source = `${IMPORT}${callOf('execFile')}'git', ['init'], { env: gitEnv() });`;
    expect(bareGitSpawns(source)).toEqual([]);
});

test('a second git spawn without env is caught though the file imports gitEnv', () => {
    const source = `${IMPORT}const env = gitEnv();\n${callOf('execFile')}'git', ['init'], { env });\n${callOf('execFile')}'git', ['add', '.'], { cwd: dir });`;
    expect(bareGitSpawns(source)).toEqual([4]);
});

test('a git spawn passing the inherited env is caught though the file imports gitEnv', () => {
    const source = `${IMPORT}${callOf('spawn')}'git', ['init'], { env: process.env });\n${callOf('spawn')}'git', ['init'], { env: { ...process.env } });`;
    expect(bareGitSpawns(source)).toEqual([2, 3]);
});

test('a git spawn passing the inherited env is caught in a file that binds env from gitEnv', () => {
    const source = `${IMPORT}const env = gitEnv();\n${callOf('spawn')}'git', ['init'], { cwd, env: process.env });\n${callOf('spawn')}'git', ['init'], { env: opts.env });`;
    expect(bareGitSpawns(source)).toEqual([3, 4]);
});

test('a git spawn whose options only end in process.env is caught in a file that binds env', () => {
    const source = `${IMPORT}const env = gitEnv();\n${callOf('spawn')}'git', ['init'], { cwd, ...process.env });`;
    expect(bareGitSpawns(source)).toEqual([3]);
});

test('a git spawn passing a spread of gitEnv passes', () => {
    const source = `${IMPORT}${callOf('spawn')}'git', ['init'], { env: { ...gitEnv(), X: '1' } });`;
    expect(bareGitSpawns(source)).toEqual([]);
});

test('a git spawn passing a binding not made from gitEnv is caught', () => {
    const source = `${IMPORT}const inherited = process.env;\n${callOf('spawn')}'git', ['init'], { env: inherited });`;
    expect(bareGitSpawns(source)).toEqual([3]);
});

test('a git spawn passing a binding made from gitEnv passes', () => {
    const source = `${IMPORT}const env = gitEnv();\nconst fixtureEnv = gitEnv();\n${callOf('spawn')}'git', ['init'], { env, stdio: 'pipe' });\n${callOf('spawn')}'git', ['init'], { env: fixtureEnv });`;
    expect(bareGitSpawns(source)).toEqual([]);
});

test('git run through a shell string is caught', () => {
    const source = `${callOf('exec')}'cd x && git init', { cwd: dir });`;
    expect(bareGitSpawns(source)).toEqual([1]);
});

test('git run through sh -c is caught', () => {
    const source = `${callOf('spawn')}'sh', ['-c', 'git init -q'], { cwd: dir });`;
    expect(bareGitSpawns(source)).toEqual([1]);
});

test('a spawn of another binary needs no gitEnv', () => {
    const source = `${callOf('spawn')}'node', [script], { cwd: dir });`;
    expect(bareGitSpawns(source)).toEqual([]);
});

test('gitEnv drops every inherited GIT_ variable', () => {
    process.env.GIT_DIR = '/frame/.git';
    try {
        expect(gitEnv().GIT_DIR).toBeUndefined();
    } finally {
        delete process.env.GIT_DIR;
    }
});

test('every tracked test that spawns git passes env from gitEnv in script/lib/git-fixture.ts', () => {
    const files = spawnSync('git', ['ls-files', '*.test.ts'], {
        cwd: root,
        encoding: 'utf8',
        env: gitEnv(),
    }).stdout.split('\n');
    const bare = files
        .filter(Boolean)
        .flatMap((file) =>
            bareGitSpawns(readFileSync(path.join(root, file), 'utf8')).map(
                (line) => `${file}:${line}`,
            ),
        );
    expect(
        bare,
        'spawns git without env: gitEnv() from script/lib/git-fixture.ts',
    ).toEqual([]);
});
