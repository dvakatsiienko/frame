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
    [
        'a HOME inside the job tmp for a command that is not git',
        `HOME=${JOB}/tmp/h pnpm test`,
    ],
    ['a gate with its stderr merged', `cd ${TMP} && pnpm test 2>&1 | tail -3`],
    [
        'a sweep with output to /dev/null',
        `cd ${TMP} && git add -A >/dev/null 2>&1`,
    ],
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
    [
        'a git config --global from the tmp',
        `cd ${TMP} && git config --global user.email t@x`,
        {},
    ],
    [
        'a HOME inside the tmp for a git command acting in frame',
        `HOME=${JOB}/tmp/h git commit -m x -- a.ts`,
        {},
    ],
    ['an export of HOME', `export HOME=${JOB}/tmp/h`, {}],
    [
        'a mktemp that is only the second half of the substitution',
        'R=$(echo /repo || mktemp -d "$CLAUDE_JOB_DIR/tmp/x.XXXX"); cd "$R" && git add -A',
        {},
    ],
    [
        'a mktemp substitution followed by a path that climbs out',
        'R=$(mktemp -d "$CLAUDE_JOB_DIR/tmp/x.XXXX")/../../../../repo; cd "$R" && git add -A',
        {},
    ],
    [
        'a variable rebound by for',
        `R=${TMP}; for R in /repo; do cd "$R" && git add -A; done`,
        {},
    ],
    [
        'a variable rebound by read',
        `R=${TMP}; read R <<< /repo; cd "$R" && git add -A`,
        {},
    ],
    [
        'a variable rebound by +=',
        `R=${TMP}; R+=/../../../../repo; cd "$R" && git add -A`,
        {},
    ],
    [
        'a cd - back to frame',
        `cd /repo; cd ${TMP}; cd -; git config user.name x`,
        {},
    ],
    ['a pushd into frame', `cd ${TMP} && pushd /repo && git add -A`, {}],
    [
        'a GIT_DIR exported by an earlier part',
        `cd ${TMP} && export GIT_DIR=/repo/.git; git add -A`,
        {},
    ],
    [
        'a dir with a variable left in it',
        'X=../../../../repo; cd $CLAUDE_JOB_DIR/tmp/$X && git -c user.name=x commit -am y',
        {},
    ],
    [
        'a core.worktree pointed at frame',
        `cd ${TMP} && git -c core.worktree=/repo reset --hard`,
        {},
    ],
    [
        'a symlink the same command makes',
        `ln -s /repo ${JOB}/tmp/x && cd ${JOB}/tmp/x && git add -A`,
        {},
    ],
    [
        'a worktree the same command makes',
        `git worktree add ${JOB}/tmp/w && cd ${JOB}/tmp/w && git -c user.name=x commit -am y`,
        {},
    ],
    // FRM-467 round 1: the lift rests on the whole command being plain, so each class of escape stays refused
    [
        'a gitdir pointer written in the chain',
        `cd ${TMP} && printf 'gitdir: /repo/.git' > .git && git add -A`,
        {},
    ],
    [
        'a gitdir pointer written by echo',
        `cd ${TMP} && echo 'gitdir: /repo/.git' > ./x/../.git && git add -A`,
        {},
    ],
    [
        'a separate git dir on init',
        `cd ${TMP} && git init -q --separate-git-dir /repo/.git && git add -A`,
        {},
    ],
    [
        'a separate git dir on clone',
        `cd ${JOB}/tmp && git clone --separate-git-dir=/repo/.git x y && cd y && git add -A`,
        {},
    ],
    [
        'a symlink copied in',
        `cp -a /home/.claude/link ${JOB}/tmp/p && cd ${JOB}/tmp/p && git add -A`,
        {},
    ],
    ['a repo moved in', `cd ${TMP} && mv /repo x && cd x && git add -A`, {}],
    [
        'a git config that moves the worktree',
        `cd ${TMP} && git config core.worktree /repo && git add -A`,
        {},
    ],
    [
        'a config glued to -c',
        `cd ${TMP} && git -ccore.worktree=/repo add -A`,
        {},
    ],
    [
        'GIT_INDEX_FILE',
        `cd ${TMP} && GIT_INDEX_FILE=/repo/.git/index git add -A`,
        {},
    ],
    ['GIT_COMMON_DIR', `cd ${TMP} && GIT_COMMON_DIR=/repo/.git git add -A`, {}],
    [
        'typeset -x GIT_DIR',
        `cd ${TMP} && typeset -x GIT_DIR=/repo/.git; git add -A`,
        {},
    ],
    [
        'declare -x GIT_DIR',
        `cd ${TMP} && declare -x GIT_DIR=/repo/.git; git add -A`,
        {},
    ],
    [
        'an outer export before bash -c',
        `export GIT_DIR=/repo/.git; bash -c 'cd ${TMP} && git add -A'`,
        {},
    ],
    [
        'a GIT_DIR prefix on bash -c',
        `GIT_DIR=/repo/.git bash -c 'cd ${TMP} && git add -A'`,
        {},
    ],
    [
        'an export before eval',
        `cd ${TMP} && export GIT_DIR=/repo/.git; eval git add -A`,
        {},
    ],
    ['env -C', `cd ${TMP} && env -C /repo git add -A`, {}],
    ['sudo -D', `cd ${TMP} && sudo -D /repo git add -A`, {}],
    ['eval cd', `cd ${TMP} && eval cd /repo && git add -A`, {}],
    ['zsh chdir', `cd ${TMP} && chdir /repo && git add -A`, {}],
    ['zsh two-arg cd', `cd ${TMP} && cd ${TMP} /repo && git add -A`, {}],
    [
        'a function that cds',
        `cd ${TMP} && f() { cd /repo; }; f; git add -A`,
        {},
    ],
    ['a subshell that cds', `cd ${TMP} && (cd /repo && git add -A)`, {}],
    ['a brace group that cds', `cd ${TMP} && { cd /repo; git add -A; }`, {}],
    ['two -C', `cd ${TMP} && git -C /repo -C . add -A`, {}],
    [
        'a variable rebound by eval',
        `R=${TMP}; eval R=/repo; cd "$R" && git add -A`,
        {},
    ],
    [
        'a variable rebound by zsh ::=',
        `R=${TMP}; : \${R::=/repo}; cd "$R" && git add -A`,
        {},
    ],
    ['a source that rebinds', `cd ${TMP} && source /x.sh && git add -A`, {}],
    [
        'pnpm -C frame piped to tail',
        `cd ${TMP} && pnpm -C /repo test | tail -3`,
        {},
    ],
    [
        'a backtick substitution',
        `cd ${TMP} && git -C \`echo /repo\` add -A`,
        {},
    ],
    [
        'a CDPATH that lands the cd in frame',
        `cd ${TMP} && CDPATH=/ cd repo && git add -A`,
        {},
    ],
    [
        'a gitdir pointer written through >&',
        `cd ${TMP} && echo 'gitdir: /repo/.git' >& .git && git add -A`,
        {},
    ],
    [
        'a gitdir pointer written through >&.git',
        `cd ${TMP} && echo 'gitdir: /repo/.git' >&.git && git add -A`,
        {},
    ],
    [
        'a gitdir pointer written through >|',
        `cd ${TMP} && echo 'gitdir: /repo/.git' >| .git && git add -A`,
        {},
    ],
    [
        'a shell startup file written under a HOME in the tmp',
        `HOME=${JOB}/tmp/h; echo 'cd /repo' >> ${JOB}/tmp/h/.zshenv; cd ${TMP} && git add -A`,
        {},
    ],
    ['a ~user path after -C', `cd ${TMP} && git -C ~dima/frame add -A`, {}],
    ['a ~- path after -C', `cd ${TMP} && git -C ~- commit -m x`, {}],
    [
        'a command hidden in $(( ))',
        `cd ${TMP} && git add -A && echo $(( $(git -C /repo add -A; echo 1) ))`,
        {},
    ],
    [
        'a command hidden in a heredoc body',
        `cd ${TMP} && git add -A && cat <<EOF\n$(git -C /repo add -A)\nEOF`,
        {},
    ],
] as const;

for (const [shape, command, opts] of OUTSIDE)
    test(`${shape} is refused`, async ($, on) => {
        const w = world(on, opts);
        expect((await bash($, command)).deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });

// the done test as one fixture: codie works a throwaway repo, and nothing needs a retry
const WORK = (dir: string) =>
    `cd ${dir} && git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -m x && git log | tail -3 && pnpm test | tail -3`;

test('a throwaway repo takes init, stage-all, a commit with an identity and a tailed log in one command', async ($, on) => {
    const w = world(on);
    expect((await bash($, WORK(TMP))).deny).toBeUndefined();
    expect(w.ran).toEqual([WORK(TMP)]);
});

test("the same command in frame's checkout is refused", async ($, on) => {
    const w = world(on);
    expect((await bash($, WORK('/repo'))).deny).toBeDefined();
    expect(w.ran).toEqual([]);
});
