import { execFileSync, spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from './git-fixture.ts';

const root = join(import.meta.dirname, '../..');

// a repo with two commits on a side branch's tip and main behind it, vitest and trash stubbed on the twin's paths
function fixture() {
    const dir = mkdtempSync(
        join(process.env.TMPDIR ?? tmpdir(), 'runner-twin-'),
    );
    const repo = join(dir, 'repo');
    const bin = join(dir, 'bin');
    mkdirSync(join(repo, 'script'), { recursive: true });
    mkdirSync(join(repo, 'node_modules/.bin'), { recursive: true });
    mkdirSync(bin);
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
    writeFileSync(join(bin, 'trash'), '#!/bin/sh\n');
    chmodSync(join(bin, 'trash'), 0o755);
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
    return { bin, dir, head, pushed, repo };
}

function twin(
    { bin, repo }: ReturnType<typeof fixture>,
    input: string,
    extra: NodeJS.ProcessEnv = {},
    args: string[] = [],
) {
    return spawnSync('bash', [join(repo, 'script/runner-twin.sh'), ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...gitEnv(), PATH: `${bin}:${process.env.PATH}`, ...extra },
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

    test('a deleted ref on stdin falls back to HEAD', () => {
        const context = fixture();
        const got = twin(
            context,
            `(delete) ${zeros} refs/heads/gone ${context.head}\n`,
        );
        expect(got.status, got.stderr).toBe(0);
        expect(tested(context.dir)).toBe(context.head);
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
