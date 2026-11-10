import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
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
        timeout: 10_000,
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
        expect(out.stdout).toContain('in a wing seat');
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

    const deadMain = () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${DEAD_PID}\nsession=s-main\n`,
        );
        return state;
    };
    const seat = (state: string) =>
        readFileSync(join(state, 'main-session'), 'utf8');

    test('a compact never takes the seat, even an empty one', () => {
        const state = deadMain();
        const out = run(
            ['start'],
            String(process.pid),
            state,
            '{"session_id":"s-wing","source":"compact"}',
        );
        expect(out.stdout).toContain('in a wing seat');
        expect(seat(state)).toContain(`pid=${DEAD_PID}`);
    });

    test('a /clear never takes an empty seat', () => {
        const state = deadMain();
        const out = run(
            ['start'],
            String(process.pid),
            state,
            '{"session_id":"s-new","source":"clear"}',
        );
        expect(out.stdout).toContain('in a wing seat');
        expect(seat(state)).toContain(`pid=${DEAD_PID}`);
    });

    test('a wing in forks.log resuming finds the seat empty and stays a wing', () => {
        const state = deadMain();
        writeFileSync(join(state, 'forks.log'), 's-wing 2026-11-07 14:01\n');
        const out = run(
            ['start'],
            String(process.pid),
            state,
            '{"session_id":"s-wing","source":"resume"}',
        );
        expect(out.stdout).toContain('in a wing seat');
        expect(seat(state)).toContain(`pid=${DEAD_PID}`);
    });

    test('a session the registry names a wing never takes the seat', () => {
        const state = deadMain();
        const sessions = mkdtempSync(join(tmpdir(), 'fg-s-'));
        writeFileSync(
            join(sessions, `${process.pid}.json`),
            JSON.stringify({ kind: 'interactive', name: '🦉🪽 clio: wing 3' }),
        );
        const out = spawnSync('bash', [GUARD, 'start'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                FORK_GUARD_CC_PID: String(process.pid),
                FORK_GUARD_SESSIONS: sessions,
                FORK_GUARD_STATE: state,
            },
            input: '{"session_id":"s-new","source":"resume"}',
            timeout: 10_000,
        });
        expect(out.stdout).toContain('in a wing seat');
        expect(seat(state)).toContain(`pid=${DEAD_PID}`);
    });

    test('a parked sidecar takes no seat, no banner and no forks.log line', () => {
        const state = deadMain();
        const sessions = mkdtempSync(join(tmpdir(), 'fg-s-'));
        writeFileSync(
            join(sessions, `${process.pid}.json`),
            JSON.stringify({ kind: 'bg', name: '🎀 helga' }),
        );
        const out = spawnSync('bash', [GUARD, 'start'], {
            encoding: 'utf8',
            env: {
                ...process.env,
                FORK_GUARD_CC_PID: String(process.pid),
                FORK_GUARD_SESSIONS: sessions,
                FORK_GUARD_STATE: state,
            },
            input: '{"session_id":"s-helga","source":"startup"}',
            timeout: 10_000,
        });
        expect(out.stdout).toBe('');
        expect(seat(state)).toContain(`pid=${DEAD_PID}`);
        expect(existsSync(join(state, 'forks.log'))).toBe(false);
    });

    test('the recorded main restarting takes her seat back from any pid', () => {
        const state = mkdtempSync(join(tmpdir(), 'fg-'));
        writeFileSync(
            join(state, 'main-session'),
            `pid=${process.ppid}\nsession=s-main\n`,
        );
        const out = run(
            ['start'],
            String(process.pid),
            state,
            '{"session_id":"s-main","source":"resume"}',
        );
        expect(out.stdout).toBe('');
        expect(seat(state)).toContain(`pid=${process.pid}`);
    });

    test('with the main dead, a wing stays guarded and main-only stays off', () => {
        const state = deadMain();
        const repo = mkdtempSync(join(tmpdir(), 'fg-repo-'));
        spawnSync('git', ['-C', repo, 'init', '-q'], {
            env: gitEnv(),
            timeout: 10_000,
        });
        const pid = String(process.pid);
        expect(run(['main-only', '--', 'echo', 'ran'], pid, state).stdout).toBe(
            '',
        );
        expect(
            run(
                ['fork-edit'],
                pid,
                state,
                JSON.stringify({
                    session_id: 'abcd1234-x',
                    tool_input: { file_path: join(repo, 'a.md') },
                }),
            ).stdout,
        ).toContain('edits only inside');
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
            timeout: 10_000,
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
            'edits only inside',
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

    const bashIn = (cwd: string, command: string) =>
        run(
            ['fork-bash'],
            String(process.ppid),
            state,
            JSON.stringify({
                cwd,
                session_id: 'd1bbf86b-x',
                tool_input: { command },
            }),
        ).stdout;

    test.each([
        ['git -C', () => `git -C ${repo} commit -m x -- a`],
        ['git add -C', () => `git -C ${repo} add a`],
        ['git --git-dir', () => `git --git-dir=${repo}/.git commit -m x`],
        ['a cd before a redirect', () => `cd ${repo} && echo x > y`],
        ['a quoted redirect', () => `echo x > "${repo}/y"`],
        ['touch', () => `touch ${repo}/y`],
        ['a variable it can read', () => `d=${repo}; touch $d/y`],
        ['sed -i', () => `sed -i '' s/a/b/ ${repo}/y`],
        ['cp', () => `cp /tmp/f ${repo}/y`],
        ['tee', () => `echo x | tee ${repo}/y`],
        ['a heredoc into a file', () => `cat > ${repo}/y <<'EOF'\ntext\nEOF`],
        ['python open', () => `python3 -c "open('${repo}/y', 'w')"`],
        ['xargs rm', () => `echo y | xargs rm ${repo}/y`],
        ['find -delete', () => `find ${repo} -name y -delete`],
        ['a nested shell', () => `bash -c 'touch ${repo}/y'`],
    ])('a real write into a main checkout is refused: %s', (_, command) => {
        expect(bashIn(tree, command())).toContain('edits only inside');
    });

    test('a plain verb standing in a main checkout is refused', () => {
        expect(bashIn(repo, 'rm a.txt')).toContain('edits only inside');
        expect(bashIn(repo, 'x lane commit /tmp/m.txt -- a.md')).toContain(
            'edits only inside',
        );
    });

    test.each([
        ['a >= in a jq string', `jq 'select(.t>="a")' /tmp/f`],
        ['a > in an rg pattern', `rg 'id>"' /tmp/f`],
        [
            'tee inside a word',
            'backlog task edit PK-1 --append-notes "his steer on it"',
        ],
        ['a > in prose', `echo "a > b" `],
        ['a variable it cannot read', '> $UNKNOWN/file'],
        ['git reads', 'git status; git log -1; git rev-parse HEAD'],
        ['a tree added from main', 'git worktree add /tmp/t main'],
    ])('a read in a main checkout passes: %s', (_, command) => {
        expect(bashIn(repo, command)).toBe('');
    });

    test.each([
        ['find -exec is walked, not a write', 'find . -exec grep -l x {} +'],
        ['a mode is no path', `chmod +x ${tree}/a.sh`],
        ['a size is no path', `truncate -s 0 ${tree}/a`],
        ['an unknown variable in git -C', 'git -C "$T" commit -m x'],
        ['a cd into an unknown variable', 'cd "$T" && rm a'],
        [
            'python text in a heredoc into a tree',
            `cat > ${tree}/p.py <<'EOF'\nopen('o', 'w')\nEOF`,
        ],
    ])('a line standing in a main checkout passes: %s', (_, command) => {
        expect(bashIn(repo, command)).toBe('');
    });

    test.each([
        ['mv takes its source away', () => [repo, 'mv a.txt /tmp/b']],
        [
            'a repo verb under .scratch acts on main',
            () => [repo, `cd ${repo}/.scratch && git commit -am x`],
        ],
        [
            'python after a cd',
            () => [tree, `cd ${repo} && python3 -c "open('y', 'w')"`],
        ],
        [
            'a python heredoc',
            () => [repo, `python3 <<'EOF'\nopen('y', 'w')\nEOF`],
        ],
        ['find -delete with no path', () => [repo, 'find -name y -delete']],
    ])('a real write still refused: %s', (_, line) => {
        const [cwd, command] = line();
        expect(bashIn(cwd as string, command as string)).toContain(
            'edits only inside',
        );
    });

    test("the shared flawlog takes a wing's own log", () => {
        expect(
            edit(
                String(process.ppid),
                join(repo, 'home/.claude/shelf/flawlog/wing.md'),
            ),
        ).toBe('');
    });

    test("main's .scratch takes a wing's spec, by Bash and by Edit", () => {
        expect(bashIn(tree, `echo x > ${repo}/.scratch/lane/spec.md`)).toBe('');
        expect(edit(String(process.ppid), join(repo, '.scratch/spec.md'))).toBe(
            '',
        );
    });

    test('a pocket commit under the timeout a background call needs passes', () => {
        expect(
            bashIn(
                repo,
                'timeout 600 x lane commit /tmp/m -- pocket/tasks/pk-9.md',
            ),
        ).toBe('');
        expect(
            bashIn(repo, 'timeout 600 x lane commit /tmp/m -- other/b.md'),
        ).toContain('edits only inside');
    });

    test('an empty .git folder is no repo, so a write under it passes', () => {
        const home = mkdtempSync(join(tmpdir(), 'fg-home-'));
        mkdirSync(join(home, '.git'));
        expect(bashIn(home, 'touch y; mkdir -p a/b')).toBe('');
    });

    test('work in its own tree passes, a cd into it is followed', () => {
        expect(bashIn(tree, 'rm a.txt; touch b; git commit -m x')).toBe('');
        expect(
            bashIn(repo, `cd ${tree} && x lane commit /tmp/m -- a > log`),
        ).toBe('');
        expect(bashIn(repo, `git -C ${tree} commit -m x`)).toBe('');
        expect(bashIn(repo, `echo x > ${tree}/y`)).toBe('');
    });

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
        ).toContain('edits only inside');
        expect(
            bash(
                'x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9 - a.md"; rm a.md',
            ),
        ).toContain('edits only inside');
        expect(
            bash(
                'x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-9.md other/b.md',
            ),
        ).toContain('edits only inside');
    });

    test.each([
        'x lane commit /tmp/m.txt -- _clio/pocket/tasks/pk-9/../../memory/habit-cto.md',
        'x lane commit /tmp/m.txt -- home/.claude/pocket/tasks/pk-1.md',
        `cd ${repo} && x lane commit /tmp/m.txt -- "_clio/pocket/tasks/pk-9/../../../home/.claude/CLAUDE.md"`,
        'x lane commit --amend -- _clio/pocket/tasks/pk-9.md',
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
            expect(bash(command)).toContain('edits only inside');
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
            timeout: 10_000,
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
                timeout: 10_000,
            }).stdout,
        ).toBe('');
    });
});
