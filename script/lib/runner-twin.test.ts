import { execFileSync, spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = join(import.meta.dirname, '../..');

// a repo with two commits on a side branch's tip and main behind it, vitest stubbed on the twin's path
function fixture() {
    const dir = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'runner-twin-'),
    );
    const repo = join(dir, 'repo');
    mkdirSync(join(repo, 'script'), { recursive: true });
    mkdirSync(join(repo, 'node_modules/.bin'), { recursive: true });
    copyFileSync(
        join(root, 'script/runner-twin.sh'),
        join(repo, 'script/runner-twin.sh'),
    );
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
    writeFileSync(
        join(repo, 'node_modules/.bin/vitest'),
        `#!/bin/sh\ngit rev-parse HEAD >"${dir}/tested"\nprintf '%s' "\${GIT_DIR:-unset}" >"${dir}/git-dir"\n`,
    );
    chmodSync(join(repo, 'node_modules/.bin/vitest'), 0o755);
    const git = (...args: string[]) =>
        execFileSync('git', args, {
            cwd: repo,
            encoding: 'utf8',
            env: gitEnv(),
        }).trim();
    git('init', '-q');
    git('add', '-A');
    git('commit', '-q', '-m', 'main');
    const head = git('rev-parse', 'HEAD');
    git('switch', '-q', '-c', 'codie/FRM-1-x');
    git('commit', '-q', '--allow-empty', '-m', 'pushed');
    const pushed = git('rev-parse', 'HEAD');
    git('switch', '-q', '-');
    return { dir, head, pushed, repo };
}

function twin(
    { repo }: ReturnType<typeof fixture>,
    input: string,
    extra: NodeJS.ProcessEnv = {},
    args: string[] = [],
) {
    return spawnSync('bash', [join(repo, 'script/runner-twin.sh'), ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...gitEnv(), PATH: process.env.PATH, ...extra },
        input,
    });
}

const tested = (dir: string) =>
    readFileSync(join(dir, 'tested'), 'utf8').trim();
const zeros = '0'.repeat(40);

describe('runner-twin', () => {
    test('tests the commit the hook names, not the checkout HEAD', () => {
        const context = fixture();
        const got = twin(
            context,
            `refs/heads/codie/FRM-1-x ${context.pushed} refs/heads/codie/FRM-1-x ${zeros}\n`,
        );
        expect(got.status, got.stderr).toBe(0);
        expect(tested(context.dir)).toBe(context.pushed);
    });

    test('a red at push logs its ref, its commit and its exit', () => {
        const context = fixture();
        const state = join(context.dir, 'state');
        writeFileSync(
            join(context.repo, 'node_modules/.bin/vitest'),
            '#!/bin/sh\nexit 4\n',
        );
        const got = twin(
            context,
            `refs/heads/codie/FRM-1-x ${context.pushed} refs/heads/codie/FRM-1-x ${zeros}\n`,
            { VITEST: '', X_STATE: state },
        );
        expect(got.status).toBe(4);
        const row = readFileSync(join(state, 'gate-steps.log'), 'utf8')
            .trimEnd()
            .split('\t');
        expect(row.slice(2, 4)).toEqual(['push', 'refs/heads/codie/FRM-1-x']);
        expect(context.pushed.startsWith(row[4] ?? 'none')).toBe(true);
        expect(row.slice(6)).toEqual(['4', 'test:twin']);
    });

    test('a sha-named push logs its remote ref', () => {
        const context = fixture();
        const state = join(context.dir, 'state');
        const got = twin(
            context,
            `${context.pushed} ${context.pushed} refs/heads/codie/FRM-1-x ${zeros}\n`,
            { VITEST: '', X_STATE: state },
        );
        expect(got.status, got.stderr).toBe(0);
        const row = readFileSync(join(state, 'gate-steps.log'), 'utf8')
            .trimEnd()
            .split('\t');
        expect(row.slice(2, 4)).toEqual(['push', 'refs/heads/codie/FRM-1-x']);
    });

    test.each([
        ['no stdin', () => []],
        ['a named commit', (pushed: string) => [pushed]],
    ])('a hand run with %s logs other and unnamed', (_name, args) => {
        const context = fixture();
        const state = join(context.dir, 'state');
        const got = twin(
            context,
            '',
            { VITEST: '', X_STATE: state },
            args(context.pushed),
        );
        expect(got.status, got.stderr).toBe(0);
        const row = readFileSync(join(state, 'gate-steps.log'), 'utf8')
            .trimEnd()
            .split('\t');
        expect(row.slice(2, 4)).toEqual(['other', 'unnamed']);
    });

    test('a deleted ref on stdin falls back to HEAD', () => {
        const context = fixture();
        const state = join(context.dir, 'state');
        const got = twin(
            context,
            `(delete) ${zeros} refs/heads/gone ${context.head}\n`,
            { VITEST: '', X_STATE: state },
        );
        expect(got.status, got.stderr).toBe(0);
        expect(tested(context.dir)).toBe(context.head);
        const row = readFileSync(join(state, 'gate-steps.log'), 'utf8')
            .trimEnd()
            .split('\t');
        expect(row.slice(2, 4)).toEqual(['push', 'refs/heads/gone']);
    });

    test('no stdin tests HEAD', () => {
        const context = fixture();
        const got = twin(context, '');
        expect(got.status, got.stderr).toBe(0);
        expect(tested(context.dir)).toBe(context.head);
    });

    test('an argument wins over stdin', () => {
        const context = fixture();
        twin(
            context,
            `refs/heads/x ${context.head} refs/heads/x ${zeros}\n`,
            {},
            [context.pushed],
        );
        expect(tested(context.dir)).toBe(context.pushed);
    });

    test('its clone and home sit in TMPDIR, and are gone at exit', () => {
        const context = fixture();
        const scratch = join(context.dir, 'scratch');
        mkdirSync(scratch);
        writeFileSync(
            join(context.repo, 'node_modules/.bin/vitest'),
            `#!/bin/sh\nls "${scratch}" >"${context.dir}/during"\nmkdir -p "$HOME/go/pkg/mod/x"\ntouch "$HOME/go/pkg/mod/x/a.go"\nchmod -R a-w "$HOME/go"\n`,
        );
        const got = twin(context, '', { TMPDIR: scratch });
        expect(got.status, got.stderr).toBe(0);
        expect(readFileSync(join(context.dir, 'during'), 'utf8')).toContain(
            'runner-twin-home.',
        );
        expect(readdirSync(scratch)).toEqual([]);
    });

    test("a hook's GIT_DIR never reaches the clone or its tests", () => {
        const context = fixture();
        const got = twin(context, '', { GIT_DIR: join(context.repo, '.git') });
        expect(got.status, got.stderr).toBe(0);
        expect(readFileSync(join(context.dir, 'git-dir'), 'utf8')).toBe(
            'unset',
        );
        const head = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: context.repo,
            encoding: 'utf8',
            env: gitEnv(),
        }).trim();
        expect(head).toBe(context.head);
    });
});
