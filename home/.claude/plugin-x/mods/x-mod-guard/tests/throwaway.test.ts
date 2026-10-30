import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-467: a throwaway repo under the job's own tmp runs its git; frame's checkout and every command that starts in the tmp
// but acts outside it keep the refusals
const JOB = '/home/.claude/jobs/j1';
const TMP = `${JOB}/tmp/r`;

// reals: a path to where it really lands (a symlink); commonDirs: the git common dir `git -C <dir> rev-parse` prints
function world(
    on: On,
    opts: {
        jobDir?: string;
        reals?: Record<string, string>;
        commonDirs?: Record<string, string>;
    } = {},
) {
    const { jobDir = JOB, reals = {}, commonDirs = {} } = opts;
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'CLAUDE_JOB_DIR' ? jobDir : '/home',
    }));
    on('fs.exists', () => ({ value: true }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'dir',
            mtimeMs: 0,
            realPath: reals[e.path] ?? e.path,
            size: 0,
        },
    }));
    on('process.run', (_$, e) => {
        const common = commonDirs[e.argv[2] ?? ''];
        return {
            value: {
                exitCode: common ? 0 : 128,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout: common ? `${common}\n` : '',
            },
        };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// the four commands of the done test, then the neighbours the lift must carry
const LIFTED = [
    [
        'a -c user identity commit',
        `cd ${TMP} && git -c user.name=t -c user.email=t@t commit -m x`,
    ],
    ['git add -A', `cd ${TMP} && git add -A`],
    ['a pathless commit', `cd ${TMP} && git commit -m x`],
    ['git log piped to tail', `cd ${TMP} && git log | tail -3`],
    ['a gate piped to tail', `cd ${TMP} && pnpm test | tail -3`],
    ['a HOME inside the job tmp', `cd ${TMP} && HOME=${JOB}/tmp/h git status`],
    [
        'a repo from mktemp -d under the job tmp, held in a variable',
        'R=$(mktemp -d "$CLAUDE_JOB_DIR/tmp/r.XXXX") && cd "$R" && git init -q && git add -A && git commit -m x',
    ],
    ['a repo path held in a variable', `R=${TMP}; git -C "$R" add -A`],
    ['the lifts inside a nested shell', `bash -c 'cd ${TMP} && git add -A'`],
] as const;

for (const [shape, command] of LIFTED)
    test(`${shape} in a throwaway repo runs`, async ($, on) => {
        const w = world(on);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

// the same four, one step outside: each is refused
const FOUR = [
    ['-c user.name', 'git -c user.name=t commit -m x'],
    ['git add -A', 'git add -A'],
    ['a pathless commit', 'git commit -m x'],
    ['a gate piped to tail', 'pnpm test | tail -3'],
] as const;

for (const [shape, command] of FOUR) {
    test(`${shape} in frame's checkout is refused`, async ($, on) => {
        const w = world(on);
        expect((await bash($, command)).deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });
    test(`${shape} in a repo under /tmp outside the job dir is refused`, async ($, on) => {
        const w = world(on);
        const r = await bash($, `cd /tmp/fixture && ${command}`);
        expect(r.deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });
    test(`${shape} is refused in a job-tmp repo when CLAUDE_JOB_DIR is empty`, async ($, on) => {
        const w = world(on, { jobDir: '' });
        const r = await bash($, `cd ${TMP} && ${command}`);
        expect(r.deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });
}

const OUTSIDE = [
    [
        'a chain that cds out of the tmp',
        `cd ${TMP} && git add -A && cd /repo && git commit -m x`,
        {},
    ],
    ['git -C frame from the tmp', `cd ${TMP} && git -C /repo add -A`, {}],
    [
        'GIT_DIR pointed at frame',
        `cd ${TMP} && GIT_DIR=/repo/.git git add -A`,
        {},
    ],
    [
        'a --git-dir pointed at frame',
        `cd ${TMP} && git --git-dir=/repo/.git add -A`,
        {},
    ],
    [
        'a worktree of frame in the tmp',
        `cd ${TMP} && git add -A`,
        { commonDirs: { [TMP]: '/repo/.git' } },
    ],
    [
        'a symlink in the tmp pointing at frame',
        `cd ${TMP} && git add -A`,
        { reals: { [TMP]: '/repo' } },
    ],
    [
        'a HOME inside the tmp beside git -C frame',
        `cd ${TMP} && HOME=${JOB}/tmp/h git -C /repo add -A`,
        {},
    ],
    ['a HOME outside the tmp', `cd ${TMP} && HOME=/elsewhere git status`, {}],
    [
        'a force-push behind a lifted -c user',
        `cd ${TMP} && git -c user.name=t push --force origin main`,
        {},
    ],
    [
        'a skipped hook beside a -c user',
        `cd ${TMP} && git -c user.name=t commit --no-verify -m x`,
        {},
    ],
    ['a variable that holds frame', 'R=/repo; cd "$R" && git add -A', {}],
] as const;

for (const [shape, command, opts] of OUTSIDE)
    test(`${shape} is refused`, async ($, on) => {
        const w = world(on, opts);
        expect((await bash($, command)).deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });
