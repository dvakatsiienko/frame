import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const script = join(import.meta.dirname, '../test-commit.sh');

function fixture(files: Record<string, string> = { 'old.ts': 'old\n' }) {
    const dir = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'test-commit-'),
    );
    const repo = join(dir, 'repo');
    const bin = join(dir, 'bin');
    mkdirSync(repo);
    mkdirSync(bin);
    const git = (...args: string[]) =>
        spawnSync('git', args, {
            cwd: repo,
            encoding: 'utf8',
            env: gitEnv(),
        });
    git('init', '-q');
    for (const [path, body] of Object.entries(files)) write(repo, path, body);
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'base');
    // a stub on PATH: the suite is never really run
    writeFileSync(
        join(bin, 'pnpm'),
        `#!/bin/sh\nIFS='|'; printf '%s\\n' "$*" >>"${dir}/calls"\nexit "\${STUB_EXIT:-0}"\n`,
    );
    chmodSync(join(bin, 'pnpm'), 0o755);
    return { bin, dir, git, repo };
}

function write(repo: string, path: string, body: string) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), body);
}

function runGate(
    { bin, dir, repo }: ReturnType<typeof fixture>,
    branch: string,
    stubExit = '0',
    extra: NodeJS.ProcessEnv = {},
) {
    const got = spawnSync(script, ['pnpm', 'test'], {
        cwd: repo,
        encoding: 'utf8',
        env: {
            ...gitEnv(),
            INDEX_RUN_BRANCH: branch,
            PATH: `${bin}:${process.env.PATH}`,
            STUB_EXIT: stubExit,
            X_STATE: join(dir, 'state'),
            ...extra,
        },
    });
    const callsFile = join(dir, 'calls');
    const calls = existsSync(callsFile) ? readFileSync(callsFile, 'utf8') : '';
    const row = readFileSync(join(dir, 'state/test-commit.log'), 'utf8')
        .trimEnd()
        .split('\t');
    return {
        calls: calls.trimEnd(),
        fields: row.slice(2),
        status: got.status,
    };
}

function staged(files: Record<string, string>, base?: Record<string, string>) {
    const context = fixture(base);
    for (const [path, body] of Object.entries(files))
        write(context.repo, path, body);
    context.git('add', '-A');
    return context;
}

describe('test-commit', () => {
    test.each(['main', 'worktree-fork-1', ''])(
        'branch «%s» runs the whole suite',
        (branch) => {
            const got = runGate(staged({ 'a.ts': 'a\n' }), branch);
            expect(got.calls).toBe('test');
            expect(got.fields.slice(1, 3)).toEqual(['whole', '0']);
        },
    );

    test('a codie branch runs only the tests related to its staged code', () => {
        const got = runGate(
            staged({ 'a b.ts': 'a\n', 'c.tsx': 'c\n', 'd.md': 'd\n' }),
            'codie/FRM-1-x',
        );
        expect(got.calls).toBe(
            'exec|vitest|related|--run|--passWithNoTests|a b.ts|c.tsx',
        );
        expect(got.fields.slice(0, 3)).toEqual([
            'codie/FRM-1-x',
            'related',
            '3',
        ]);
    });

    test.each([
        [{ INDEX_RUN_SOURCE: 'commit' }, 'commit'],
        [{ INDEX_RUN_SOURCE: 'other' }, 'other'],
        // this test runs inside a gate at commit, whose own source it would inherit
        [{ INDEX_RUN_SOURCE: undefined }, 'other'],
    ])('its last column is the source: %j', (extra, source) => {
        const got = runGate(staged({ 'a.ts': 'a\n' }), 'main', '0', extra);
        expect(got.fields.at(-1)).toBe(source);
    });

    test('a codie commit with no code staged runs nothing and logs it', () => {
        const got = runGate(staged({ 'd.md': 'd\n' }), 'codie/FRM-1-x');
        expect(got.calls).toBe('');
        expect(got.status).toBe(0);
        expect(got.fields.slice(1, 2)).toEqual(['none']);
    });

    describe('a pocket-only commit', () => {
        const pocket = '_clio/pocket/tasks/pk-1.md';
        const moved = '_clio/pocket/archive/pk-1.md';

        test.each(['main', 'codie/FRM-1-x', 'worktree-fork-1', ''])(
            'on branch «%s» runs no suite',
            (branch) => {
                const got = runGate(staged({ [pocket]: 'a\n' }), branch);
                expect(got.calls).toBe('');
                expect(got.status).toBe(0);
                expect(got.fields.slice(1, 3)).toEqual(['none', '1']);
            },
        );

        test.each(['main', 'codie/FRM-1-x'])(
            'a rename with both ends in the pocket runs no suite on «%s»',
            (branch) => {
                const context = fixture({ [pocket]: 'a body long enough\n' });
                rmSync(join(context.repo, pocket));
                write(context.repo, moved, 'a body long enough\n');
                context.git('add', '-A');
                const got = runGate(context, branch);
                expect(got.calls).toBe('');
                expect(got.fields.slice(1, 2)).toEqual(['none']);
            },
        );

        test('one path outside runs the whole suite on main', () => {
            const got = runGate(
                staged({ [pocket]: 'a\n', 'a.ts': 'a\n' }),
                'main',
            );
            expect(got.calls).toBe('test');
            expect(got.fields.slice(1, 2)).toEqual(['whole']);
        });

        test('one path outside runs the related tests on a codie branch', () => {
            const got = runGate(
                staged({ [pocket]: 'a\n', 'a.ts': 'a\n' }),
                'codie/FRM-1-x',
            );
            expect(got.fields.slice(1, 2)).toEqual(['related']);
        });

        test.each([
            ['out of', pocket, 'docs/pk-1.md'],
            ['into', 'docs/pk-1.md', pocket],
        ])('a rename %s the pocket runs the whole suite', (_name, from, to) => {
            const context = fixture({ [from]: 'a body long enough\n' });
            rmSync(join(context.repo, from));
            write(context.repo, to, 'a body long enough\n');
            context.git('add', '-A');
            expect(runGate(context, 'main').calls).toBe('test');
        });

        test('a failed read of the staged paths runs the whole suite', () => {
            const context = staged({ [pocket]: 'a\n' });
            const got = runGate(context, 'main', '0', {
                GIT_DIR: join(context.dir, 'missing'),
            });
            expect(got.calls).toBe('test');
        });
    });

    test('a failed read of the staged paths runs the whole suite', () => {
        const context = staged({ 'a.ts': 'a\n' });
        const got = runGate(context, 'codie/FRM-1-x', '0', {
            GIT_DIR: join(context.dir, 'missing'),
        });
        expect(got.calls).toBe('test');
    });

    test('a non-ascii path reaches vitest whole', () => {
        const got = runGate(staged({ 'é.ts': 'a\n' }), 'codie/FRM-1-x');
        expect(got.calls).toContain('|é.ts');
    });

    test('a deleted file runs the whole suite', () => {
        const context = fixture();
        rmSync(join(context.repo, 'old.ts'));
        context.git('add', '-A');
        expect(runGate(context, 'codie/FRM-1-x').calls).toBe('test');
    });

    test('a renamed file runs the whole suite', () => {
        const context = fixture();
        context.git('mv', 'old.ts', 'new.ts');
        expect(runGate(context, 'codie/FRM-1-x').calls).toBe('test');
    });

    test.each([
        'package.json',
        'pnpm-lock.yaml',
        'vitest.config.ts',
        'tsconfig.json',
        'lefthook.yaml',
        'script/lib/test-temp-dir.ts',
    ])('%s runs the whole suite', (path) => {
        const got = runGate(staged({ [path]: 'x\n' }), 'codie/FRM-1-x');
        expect(got.calls).toBe('test');
    });

    test.each([
        ['main', {}],
        ['codie/FRM-1-x', {}],
    ])('on %s a red hands back its exit and logs it', (branch) => {
        const got = runGate(staged({ 'a.ts': 'a\n' }), branch, '3');
        expect(got.status).toBe(3);
        expect(got.fields.at(-2)).toBe('3');
    });
});
