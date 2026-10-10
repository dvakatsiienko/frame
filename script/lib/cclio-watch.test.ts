import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { gitEnv } from './git-fixture.ts';

// cclio's two watches, run against a stub `gh`, `vercel` and `sleep` on PATH: `gh` answers from fixture json through
// the script's own --jq program, so the jq the script ships is what is tested
const HOOKS = resolve(import.meta.dirname, '../../cclio/.claude/hooks');

function bin(fixtures: Record<string, unknown>) {
    const dir = mkdtempSync(join(tmpdir(), 'cclio-watch-'));
    mkdirSync(join(dir, '.claude/shelf'), { recursive: true });
    for (const [name, value] of Object.entries(fixtures))
        writeFileSync(join(dir, name), JSON.stringify(value));
    const stub = (name: string, body: string) => {
        writeFileSync(join(dir, name), `#!/bin/bash\n${body}\n`);
        chmodSync(join(dir, name), 0o755);
    };
    stub(
        'gh',
        `F="${dir}"; jqp=; prev=; for a in "$@"; do [ "$prev" = --jq ] && jqp=$a; prev=$a; done
case "$1 $2" in
  "pr list") src=prs.json ;;
  "run view") echo "2026-10-09T10:00:00Z to deploy: shop"; exit 0 ;;
  "run list") case " $* " in *" --workflow "*) src=deploys.json ;; *) src=runs.json ;; esac ;;
  *) src=empty.json ;;
esac
[ -f "$F/$src" ] || echo '[]' > "$F/$src"
jq -r "$jqp" "$F/$src"`,
    );
    stub(
        'vercel',
        'case "$1" in ls) echo https://shop-x.vercel.app ;; inspect) echo "  status   ● Ready" ;; esac',
    );
    stub('sleep', 'exit 0');
    return dir;
}

const run = (script: string, args: string[], dir: string, cwd = dir) =>
    execFileSync('bash', [join(HOOKS, script), ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, HOME: dir, PATH: `${dir}:${process.env.PATH}` },
    });

describe('pr-watch', () => {
    const conflicted = [
        {
            author: { login: 'dvakatsiienko' },
            headRefOid: 'abcdef1234567890',
            mergeStateStatus: 'DIRTY',
            mergeable: 'CONFLICTING',
            number: 7,
            statusCheckRollup: [{ conclusion: 'SUCCESS' }],
            title: 'a coder pr',
            url: 'https://github.com/x/y/pull/7',
        },
    ];

    it('names a conflicted pr once per head', () => {
        const dir = bin({ 'prs.json': conflicted });
        const first = run('pr-watch.sh', ['--once'], dir);
        const second = run('pr-watch.sh', ['--once'], dir);
        expect([
            first.includes('frame#7 conflict on abcdef12'),
            second.includes('conflict'),
        ]).toEqual([true, false]);
    });

    // the stub gh answers every repo with the same pr; the verified record is frame's
    const frameLines = (out: string) =>
        out.split('\n').filter((l) => l.includes('frame#7 '));
    const clean = [
        {
            ...conflicted[0],
            headRefOid: 'bbbbbbbb1234567890',
            mergeStateStatus: 'CLEAN',
            mergeable: 'MERGEABLE',
        },
    ];

    it('names a head past the verified one as an unverified delta, never ready', () => {
        const dir = bin({ 'prs.json': clean });
        run(
            'pr-watch.sh',
            ['--verified', 'dvakatsiienko/frame', '7', 'aaaaaaaa'],
            dir,
        );
        const lines = frameLines(run('pr-watch.sh', ['--once'], dir));
        expect([
            lines.filter((l) =>
                l.includes(
                    'verified aaaaaaaa, head bbbbbbbb: unverified delta',
                ),
            ).length,
            lines.filter((l) => l.includes('ready')).length,
        ]).toEqual([1, 0]);
    });

    it('calls a pr ready when the verified head is the current one', () => {
        const dir = bin({ 'prs.json': clean });
        run(
            'pr-watch.sh',
            ['--verified', 'dvakatsiienko/frame', '7', 'bbbbbbbb1234567890'],
            dir,
        );
        const lines = frameLines(run('pr-watch.sh', ['--once'], dir));
        expect(lines.filter((l) => l.includes('ready to merge')).length).toBe(
            1,
        );
    });

    it('refuses a verified record without a sha', () => {
        const dir = bin({});
        expect(() =>
            run('pr-watch.sh', ['--verified', 'dvakatsiienko/frame', '7'], dir),
        ).toThrow(/usage/);
    });
});

describe('deploy-watch', () => {
    function repo(dir: string) {
        const git = (...args: string[]) =>
            execFileSync('git', args, {
                cwd: dir,
                encoding: 'utf8',
                env: gitEnv(),
            }).trim();
        git('init', '-q');
        git(
            '-c',
            'user.name=t',
            '-c',
            'user.email=t@t',
            'commit',
            '-q',
            '--allow-empty',
            '-m',
            'x',
        );
        return git('rev-parse', 'HEAD');
    }
    const done = [
        { conclusion: 'success', name: 'ci', status: 'completed', url: 'u' },
    ];

    it('reads the workflow_run deploy by its «deploy <sha>» title', () => {
        const dir = bin({ 'runs.json': done });
        const sha = repo(dir);
        writeFileSync(
            join(dir, 'deploys.json'),
            JSON.stringify([
                {
                    conclusion: 'skipped',
                    databaseId: 1,
                    displayTitle: 'deploy other',
                    event: 'workflow_run',
                    headSha: 'main',
                    status: 'completed',
                },
                {
                    conclusion: 'success',
                    databaseId: 2,
                    displayTitle: `deploy ${sha}`,
                    event: 'workflow_run',
                    headSha: 'main',
                    status: 'completed',
                },
            ]),
        );
        expect(run('deploy-watch.sh', [sha, dir], dir)).toContain(
            'deploy shop → Ready',
        );
    });

    it('never reports a skipped run as the deploy', () => {
        const dir = bin({ 'runs.json': done });
        const sha = repo(dir);
        writeFileSync(
            join(dir, 'deploys.json'),
            JSON.stringify([
                {
                    conclusion: 'skipped',
                    databaseId: 3,
                    displayTitle: `deploy ${sha}`,
                    event: 'workflow_run',
                    headSha: 'main',
                    status: 'completed',
                },
            ]),
        );
        const out = run('deploy-watch.sh', [sha, dir], dir);
        expect([out.includes('Ready'), out.includes('no Deploy run')]).toEqual([
            false,
            true,
        ]);
    });
});
