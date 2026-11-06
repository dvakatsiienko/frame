import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';

const GUARD = join(
    import.meta.dirname,
    '..',
    '.claude',
    'hooks',
    'fork-guard.sh',
);
const DEAD_PID = '999999';

function run(
    args: string[],
    pid: string,
    state: string,
    input = '{"session_id":"s-1","source":"startup"}',
) {
    return spawnSync('bash', [GUARD, ...args], {
        encoding: 'utf8',
        env: {
            ...process.env,
            FORK_GUARD_CC_PID: pid,
            FORK_GUARD_STATE: state,
        },
        input,
    });
}

describe('fork-guard', () => {
    test('the first session to start becomes the main and records its pid', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        const out = run(['start'], String(process.pid), state);
        expect(out.status).toBe(0);
        expect(out.stdout).toBe('');
        expect(readFileSync(join(state, 'main-session'), 'utf8')).toContain(
            `pid=${process.pid}`,
        );
    });

    test('a second live session in the folder is a fork and gets the banner', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${process.pid}\nsession=s-main\n`,
        );
        const out = run(
            ['start'],
            String(process.ppid),
            state,
            '{"session_id":"s-fork","source":"resume"}',
        );
        expect(out.stdout).toContain("you are clio's wing");
        expect(readFileSync(join(state, 'main-session'), 'utf8')).toContain(
            'session=s-main',
        );
    });

    test('a session whose recorded main pid is dead takes over as the main', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${DEAD_PID}\nsession=s-old\n`,
        );
        const out = run(['start'], String(process.pid), state);
        expect(out.stdout).toBe('');
        expect(readFileSync(join(state, 'main-session'), 'utf8')).toContain(
            `pid=${process.pid}`,
        );
    });

    test('main-only runs its command for the main and passes stdin through', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${process.pid}\nsession=s-main\n`,
        );
        const out = run(
            ['main-only', '--', 'cat'],
            String(process.pid),
            state,
            'hook-json',
        );
        expect(out.stdout).toBe('hook-json');
    });

    test('main-only skips its command in a fork', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${process.pid}\nsession=s-main\n`,
        );
        const out = run(
            ['main-only', '--', 'echo', 'ran'],
            String(process.ppid),
            state,
        );
        expect(out.status).toBe(0);
        expect(out.stdout).toBe('');
    });

    test("a fork's restart keeps its one forks.log line", () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${process.pid}\nsession=s-main\n`,
        );
        run(['start'], String(process.ppid), state);
        run(['start'], String(process.ppid), state);
        expect(
            readFileSync(join(state, 'forks.log'), 'utf8').trim().split('\n'),
        ).toHaveLength(1);
    });
});

describe('fork-guard fork-edit', () => {
    const state = mkdtempSync(join(tmpdir(), 'fg-'));
    writeFileSync(join(state, 'main-session'), `pid=${process.pid}\n`);
    const repo = mkdtempSync(join(tmpdir(), 'fg-repo-'));
    const git = (...args: string[]) =>
        spawnSync('git', ['-C', repo, ...args], {
            encoding: 'utf8',
            env: gitEnv(),
        });
    git('init', '-q');
    git(
        '-c',
        'user.email=t@t',
        '-c',
        'user.name=t',
        'commit',
        '-q',
        '--allow-empty',
        '-m',
        'x',
    );
    const tree = `${repo}-wt`;
    git('worktree', 'add', '-q', tree);
    const edit = (pid: string, file: string) =>
        run(
            ['fork-edit'],
            pid,
            state,
            JSON.stringify({
                session_id: 'd1bbf86b-x',
                tool_input: { file_path: file },
            }),
        ).stdout;

    test('a fork editing a main checkout is refused, named by its worktree', () => {
        expect(edit(String(process.ppid), join(repo, 'new/a.md'))).toContain(
            '«fork-d1bbf86b»',
        );
    });

    test('a fork inside its own worktree, or outside any repo, edits freely', () => {
        expect(edit(String(process.ppid), join(tree, 'a.md'))).toBe('');
        expect(edit(String(process.ppid), join(tmpdir(), 'scratch.md'))).toBe(
            '',
        );
    });

    test('the main edits its checkout freely', () => {
        expect(edit(String(process.pid), join(repo, 'a.md'))).toBe('');
    });

    const bash = (command: string) =>
        run(
            ['fork-bash'],
            String(process.ppid),
            state,
            JSON.stringify({
                cwd: repo,
                session_id: 'd1bbf86b-x',
                tool_input: { command },
            }),
        ).stdout;

    test('a fork commits its own pocket items in a main checkout', () => {
        expect(
            bash(
                'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a side item.md"',
            ),
        ).toBe('');
        expect(
            bash('x lane commit /tmp/m.txt -- "pocket/tasks/pk-9 - a.md"'),
        ).toBe('');
        expect(
            bash(
                'cd ~/frame && x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a.md"',
            ),
        ).toBe('');
    });

    test('a fork commit naming any other path in a main checkout is refused', () => {
        expect(
            bash(
                'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a.md" a.md',
            ),
        ).toContain('«fork-d1bbf86b»');
        expect(
            bash(
                'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a.md"; rm a.md',
            ),
        ).toContain('«fork-d1bbf86b»');
        expect(
            bash(
                'x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-9.md other/b.md',
            ),
        ).toContain('«fork-d1bbf86b»');
    });

    test.each([
        'x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-9/../../memory/habit-cto.md',
        'x lane commit /tmp/m.txt -- home/.claude/pocket/tasks/pk-1.md',
        'cd ~/frame && x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9/../../../home/.claude/CLAUDE.md"',
        'x lane commit --amend -- _clio/pocket/tasks/pk-9.md',
        'cd /etc && x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-9.md',
        'git reset --hard\nx lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a.md"',
        'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 $(rm -rf x).md"',
        'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 `rm -rf x`.md"',
        'x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-*.md',
        'x lane commit T>README.md -- pocket/tasks/pk-a.md',
        'x lane commit T -- pocket/tasks/pk-<(touch${IFS}x).md',
        'x lane commit /tmp/m.txt -- pocket/tasks/pk-a\tREADME.md',
        'x lane commit /tmp/m.txt -- pocket/tasks/pk-a\rREADME.md',
    ])(
        'a pocket-shaped path that escapes the pocket is refused: %s',
        (command) => {
            expect(bash(command)).toContain('«fork-d1bbf86b»');
        },
    );
});

describe('fork-guard announce', () => {
    const state = mkdtempSync(join(tmpdir(), 'fg-'));
    const projects = mkdtempSync(join(tmpdir(), 'fg-p-'));
    mkdirSync(join(projects, 'proj'));
    writeFileSync(join(state, 'main-session'), `pid=${process.pid}\n`);
    writeFileSync(join(state, 'forks.log'), 's-fork 2026-10-27 16:56\n');
    const line = (at: string, content: string) =>
        `${JSON.stringify({ message: { content }, timestamp: at, type: 'user' })}\n`;
    const announce = () =>
        spawnSync('bash', [GUARD, 'announce'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                FORK_GUARD_CC_PID: String(process.pid),
                FORK_GUARD_PROJECTS: projects,
                FORK_GUARD_STATE: state,
                TZ: 'UTC',
            },
        }).stdout;

    test('names a fork by its first prompt after the fork, then never again', () => {
        writeFileSync(
            join(projects, 'proj', 's-fork.jsonl'),
            line('2026-10-27T16:00:00.000Z', 'the main thread, copied') +
                line('2026-10-27T16:57:00.000Z', '<system-reminder>x') +
                line('2026-10-27T16:58:00.000Z', 'look at pm2\nmore'),
        );
        expect(announce()).toBe('🍴 fork «look at pm2» started 16:56\n');
        expect(announce()).toBe('');
    });

    test('a fork never announces itself', () => {
        expect(
            spawnSync('bash', [GUARD, 'announce'], {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    FORK_GUARD_CC_PID: String(process.ppid),
                    FORK_GUARD_STATE: mkdtempSync(join(tmpdir(), 'fg-')),
                },
            }).stdout,
        ).toBe('');
    });
});
