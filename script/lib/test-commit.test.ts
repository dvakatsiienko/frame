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
        `#!/bin/sh\nIFS='|'; printf '%s\\n' "$*" >>"${dir}/calls"\n[ -z "\${STUB_OUT:-}" ] || echo "$STUB_OUT"\nexit "\${STUB_EXIT:-0}"\n`,
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
    gateDir = dirname(script),
) {
    const got = spawnSync(join(gateDir, 'test-commit.sh'), ['pnpm', 'test'], {
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
    const row = (
        readFileSync(join(dir, 'state/test-commit.log'), 'utf8')
            .trimEnd()
            .split('\n')
            .at(-1) ?? ''
    ).split('\t');
    return {
        calls: calls.trimEnd(),
        // branch, mode, staged, commit, seconds, exit, source, paths by kind, the mode before 2026-11-10
        fields: row.slice(2),
        status: got.status,
        stdout: got.stdout,
    };
}

const noneLine = 'test-commit: no related tests, the push and ci run the suite';

// what the import graph cannot judge runs nothing at commit, says so once, and leaves the suite to the push and ci
function expectNone(got: ReturnType<typeof runGate>) {
    expect(got.calls).toBe('');
    expect(got.stdout.split(noneLine)).toHaveLength(2);
    expect(got.fields[1]).toBe('none');
    expect(got.fields.at(-1)).toBe('whole');
    expect(got.status).toBe(0);
}

function staged(files: Record<string, string>, base?: Record<string, string>) {
    const context = fixture(base);
    for (const [path, body] of Object.entries(files))
        write(context.repo, path, body);
    context.git('add', '-A');
    return context;
}

const branchKinds = [
    'main',
    'clio-wing-1',
    'worktree-fork-x',
    'codie/FRM-1-x',
    'scratch/x',
];

describe('test-commit', () => {
    test.each(branchKinds)(
        'on «%s» staged code runs only the tests related to it',
        (branch) => {
            const got = runGate(
                staged({ 'a b.ts': 'a\n', 'c.tsx': 'c\n', 'e.png': 'e\n' }),
                branch,
            );
            expect(got.calls).toBe(
                'exec|vitest|related|--run|--passWithNoTests|a b.ts|c.tsx',
            );
            expect(got.fields.slice(0, 3)).toEqual([branch, 'related', '3']);
        },
    );

    test('a detached HEAD runs none and logs its kind as detached', () => {
        const got = runGate(staged({ 'a.ts': 'a\n' }), '');
        expectNone(got);
        expect(got.fields.slice(0, 3)).toEqual(['detached', 'none', '1']);
    });

    test('staged code no test imports runs none, never the whole suite', () => {
        const got = runGate(staged({ 'script/a.ts': 'a\n' }), 'main', '0', {
            STUB_OUT: 'No affected test files found, exiting with code 0',
        });
        expect(got.calls).toBe(
            'exec|vitest|related|--run|--passWithNoTests|script/a.ts',
        );
        expect(got.stdout.split(noneLine)).toHaveLength(2);
        expect(got.fields[1]).toBe('none');
        expect(got.fields.at(-1)).toBe('whole');
    });

    test('the row counts its staged paths by kind', () => {
        const got = runGate(
            staged({
                'a.ts': 'a\n',
                'b.mjs': 'b\n',
                'c.png': 'c\n',
                'd.md': 'd\n',
                'package.json': '{}\n',
            }),
            'main',
        );
        expect(got.fields.at(-2)).toBe('code=2,config=1,asset=1,other=1');
    });

    test('a kind taken off the branch-kind list runs the whole suite', () => {
        const context = staged({ 'a.ts': 'a\n' });
        const copy = join(context.dir, 'gate');
        mkdirSync(join(copy, 'lib'), { recursive: true });
        const body = readFileSync(script, 'utf8');
        const lever = body.replace(/^(related_kinds=.*) codie /m, '$1 ');
        expect(lever).not.toBe(body);
        writeFileSync(join(copy, 'test-commit.sh'), lever, { mode: 0o755 });
        writeFileSync(
            join(copy, 'lib/memory-only.sh'),
            readFileSync(join(dirname(script), 'lib/memory-only.sh')),
        );
        expect(runGate(context, 'codie/FRM-1-x', '0', {}, copy).calls).toBe(
            'test',
        );
        expect(runGate(context, 'main', '0', {}, copy).fields[1]).toBe(
            'related',
        );
    });

    test.each(['e.png', 'f.svg', 'g/h.jpg', 'i.gif', 'j.webp'])(
        'a staged set wholly on the no-test list runs nothing: %s',
        (path) => {
            const got = runGate(staged({ [path]: 'x\n' }), 'main');
            expect(got.calls).toBe('');
            expect(got.status).toBe(0);
            expect(got.fields.slice(1, 2)).toEqual(['none']);
        },
    );

    test.each([
        [{ INDEX_RUN_SOURCE: 'commit' }, 'commit'],
        [{ INDEX_RUN_SOURCE: 'other' }, 'other'],
        // this test runs inside a gate at commit, whose own source it would inherit
        [{ INDEX_RUN_SOURCE: undefined }, 'other'],
    ])('its source column: %j', (extra, source) => {
        const got = runGate(staged({ 'a.ts': 'a\n' }), 'main', '0', extra);
        expect(got.fields[6]).toBe(source);
    });

    test.each([
        'd.md',
        'x/go/a.go',
        'script/a.sh',
        'script/lib/a.sh',
        'data.json',
        'rows.tsv',
    ])('a staged path off the no-test list runs none: %s', (path) => {
        expectNone(runGate(staged({ [path]: 'x\n', 'a.ts': 'a\n' }), 'main'));
    });

    describe('a memory-only commit', () => {
        const memory = '_clio/memory/habit-x.md';
        const skill = 'home/.claude/plugin-x/skills/a/SKILL.md';
        const manifest = '_clio/plugin-clio/.claude-plugin/plugin.json';

        test.each(['main', 'clio-wing-1'])(
            'runs only the tests that read memory on «%s»',
            (branch) => {
                const got = runGate(
                    staged({ [memory]: 'a\n', [skill]: 'b\n' }),
                    branch,
                );
                expect(got.calls).toMatch(/vitest\|run\|.*recipe-shape/);
                expect(got.calls).not.toBe('test');
                expect(got.status).toBe(0);
            },
        );

        test('a plugin bump alone counts as memory', () => {
            const got = runGate(staged({ [manifest]: '{}\n' }), 'main');
            expect(got.calls).toMatch(/vitest\|run/);
        });

        test('a code file beside it runs none', () => {
            expectNone(
                runGate(staged({ [memory]: 'a\n', 'a.ts': 'a\n' }), 'main'),
            );
        });

        test('a script under skills is code, never memory', () => {
            const got = runGate(
                staged({ 'home/.claude/plugin-x/skills/a/run.ts': 'a\n' }),
                'main',
            );
            expect(got.fields.slice(1, 2)).toEqual(['related']);
        });

        test('a red in the memory tests reds the commit', () => {
            const got = runGate(staged({ [memory]: 'a\n' }), 'main', '1');
            expect(got.status).toBe(1);
        });
    });

    describe('a pocket-only commit', () => {
        const pocket = '_clio/pocket/tasks/pk-1.md';
        const moved = '_clio/pocket/archive/pk-1.md';

        test.each([
            'main',
            'clio-wing-1',
            'codie/FRM-1-x',
            'worktree-fork-1',
            '',
        ])('on branch «%s» runs no suite', (branch) => {
            const got = runGate(staged({ [pocket]: 'a\n' }), branch);
            expect(got.calls).toBe('');
            expect(got.status).toBe(0);
            expect(got.fields.slice(1, 3)).toEqual(['none', '1']);
        });

        test.each(['main', 'clio-wing-1'])(
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

        test('a pocket path beside code adds no test', () => {
            const got = runGate(
                staged({ [pocket]: 'a\n', 'a.ts': 'a\n' }),
                'main',
            );
            expect(got.calls).toBe(
                'exec|vitest|related|--run|--passWithNoTests|a.ts',
            );
        });

        test.each([
            ['out of', pocket, 'docs/pk-1.md'],
            ['into', 'docs/pk-1.md', pocket],
        ])('a rename %s the pocket runs none', (_name, from, to) => {
            const context = fixture({ [from]: 'a body long enough\n' });
            rmSync(join(context.repo, from));
            write(context.repo, to, 'a body long enough\n');
            context.git('add', '-A');
            expectNone(runGate(context, 'main'));
        });

        test('a failed read of the staged paths runs none', () => {
            const context = staged({ [pocket]: 'a\n' });
            expectNone(
                runGate(context, 'main', '0', {
                    GIT_DIR: join(context.dir, 'missing'),
                }),
            );
        });
    });

    test('a failed read of the staged paths runs none', () => {
        const context = staged({ 'a.ts': 'a\n' });
        expectNone(
            runGate(context, 'main', '0', {
                GIT_DIR: join(context.dir, 'missing'),
            }),
        );
    });

    test('a non-ascii path reaches vitest whole', () => {
        const got = runGate(staged({ 'é.ts': 'a\n' }), 'main');
        expect(got.calls).toContain('|é.ts');
    });

    test('a deleted file runs none', () => {
        const context = fixture();
        rmSync(join(context.repo, 'old.ts'));
        context.git('add', '-A');
        expectNone(runGate(context, 'main'));
    });

    test('a renamed file runs none', () => {
        const context = fixture();
        context.git('mv', 'old.ts', 'new.ts');
        expectNone(runGate(context, 'main'));
    });

    test.each([
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'vitest.config.ts',
        'tsconfig.json',
        'tsconfig.base.json',
        'lefthook.yaml',
        'script/lib/test-temp-dir.ts',
    ])('%s runs none', (path) => {
        expectNone(runGate(staged({ [path]: 'x\n' }), 'main'));
    });

    test.each([
        ['main', {}],
        ['clio-wing-1', {}],
    ])('on %s a red hands back its exit and logs it', (branch) => {
        const got = runGate(staged({ 'a.ts': 'a\n' }), branch, '3');
        expect(got.status).toBe(3);
        expect(got.fields[5]).toBe('3');
    });
});
