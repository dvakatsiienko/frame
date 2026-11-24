import type { On } from 'claude-code';

import { type Engine, expect, mock, test } from './shared-boot.ts';

const CLIO = '/home/frame/_clio';

// every tree is clean unless it holds `.scratch/` or its HEAD reaches a commit no branch does
function world(
    on: On,
    root: string,
    { scratch = false, orphan = false, broken = false } = {},
) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'c1c1c1c1-0000' }));
    on('session.cwd', () => ({ value: root }));
    on('session.root', () => ({ value: root }));
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home' : '' }));
    on('fs.exists', (_$, e) => ({
        value: !e.path.endsWith('/.scratch') || scratch,
    }));
    on('process.run', () =>
        broken
            ? { deny: 'index.lock held' }
            : {
                  value: {
                      exitCode: 0,
                      isStderrTruncated: false,
                      isStdoutTruncated: false,
                      stderr: '',
                      stdout: orphan ? 'a1b2c3\n' : '',
                  },
              },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

for (const command of [
    'git -C /home/frame worktree remove .claude/worktrees/FRM-1-x',
    'git -C /home/projects/bytes worktree remove /home/projects/bytes/.claude/worktrees/BYT-2-y',
    'git worktree remove /home/.claude/jobs/ab12/tmp/clone',
    'git branch -D scratch/probe scratch/night',
    'git branch -d codie/FRM-1-x',
])
    test(`clio cleans up without dima's word: ${command}`, async ($, on) => {
        const { ran } = world(on, CLIO);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(ran).toEqual([command]);
    });

for (const command of [
    'git -C /home/frame worktree remove /home/projects/other',
    'git -C /home/frame worktree remove --force .claude/worktrees/FRM-1-x',
    'git -C /home/frame worktree remove .claude/worktrees',
    'git branch -D scratch/probe main',
])
    test(`clio still asks: ${command}`, async ($, on) => {
        const { ran } = world(on, CLIO);
        expect((await bash($, command)).deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });

for (const tree of [
    '/home/frame/.claude/worktrees/FRM-1-x',
    '/home/.claude/jobs/ab12/tmp/clone',
]) {
    test(`clio asks to remove a tree holding a .scratch plan: ${tree}`, async ($, on) => {
        const { ran } = world(on, CLIO, { scratch: true });
        const r = await bash($, `git worktree remove ${tree}`);
        expect(r.deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });

    test(`clio asks to remove a tree whose HEAD has commits no branch reaches: ${tree}`, async ($, on) => {
        const { ran } = world(on, CLIO, { orphan: true });
        const r = await bash($, `git worktree remove ${tree}`);
        expect(r.deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });
}

test('clio asks to remove a scratch tree whose lookup fails', async ($, on) => {
    const { ran } = world(on, CLIO, { broken: true });
    const r = await bash(
        $,
        'git -C /home/frame worktree remove .claude/worktrees/FRM-1-x',
    );
    expect(r.deny).toContain('ask clio');
    expect(ran).toEqual([]);
});

test('a session outside clio still asks to remove a scratch tree', async ($, on) => {
    const { ran } = world(on, '/home/frame');
    const r = await bash($, 'git worktree remove .claude/worktrees/FRM-1-x');
    expect(r.deny).toContain('ask clio');
    expect(ran).toEqual([]);
});

// dima's o4 (23 Nov, flyway f86): a branch with every commit on main by content is deleted with no ask, on a line that is
// nothing else: the lookup and the delete then run in one repo, and nothing earlier on the line can write the ref
const REPO = '/home/frame';

// the git reads behind a branch delete, answered the way git answers them:
//   `-C <dir> for-each-ref --format=%(refname) refs/heads/<b>`  the exact name when the branch is in `exists`, nothing else
//   `-C <dir> cherry refs/heads/main refs/heads/<b>`            the text in `cherry`, or fails when the branch has no answer
// every read fails (exit 128) outside REPO, so a lookup run in another dir than the delete shows; `*` answers every branch the
// list does not name; a short name given to cherry reads a TAG of that name (`tagged`), as git resolves a short name tags first
function branchWorld(
    on: On,
    {
        exists,
        cherry,
        isTruncated = false,
        tagged = false,
        timesOut = false,
    }: {
        exists: string[];
        cherry: Record<string, string>;
        // the engine cut cherry's output short: a `+` line may sit past the cut
        isTruncated?: boolean;
        tagged?: boolean;
        // cherry never answers
        timesOut?: boolean;
    },
) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    const asked: string[][] = [];
    on('session.id', () => ({ value: 'c1c1c1c1-0000' }));
    on('session.cwd', () => ({ value: REPO }));
    on('session.root', () => ({ value: REPO }));
    on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home' : '' }));
    on('process.run', (_$, e) => {
        if (e.argv[0] === 'git') asked.push([...e.argv]);
        const [, flag, dir, verb, ...rest] = e.argv;
        const done = (exitCode: number, stdout = '', truncated = false) => ({
            value: {
                exitCode,
                isStderrTruncated: false,
                isStdoutTruncated: truncated,
                stderr: '',
                stdout,
            },
        });
        if (flag !== '-C' || dir !== REPO) return done(128);
        if (verb === 'for-each-ref') {
            const ref = rest.at(-1) ?? '';
            return done(
                0,
                exists.includes(ref.replace('refs/heads/', ''))
                    ? `${ref}\n`
                    : '',
            );
        }
        if (timesOut) return { deny: 'timed out' };
        const [trunk = '', named = ''] = rest;
        if (verb !== 'cherry' || trunk !== 'refs/heads/main') return done(128);
        if (!named.startsWith('refs/heads/') && tagged)
            return done(0, '+ a1b2c3\n');
        const answer = cherry[named.replace('refs/heads/', '')] ?? cherry['*'];
        return answer === undefined ? done(128) : done(0, answer, isTruncated);
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { asked, ran };
}

const MERGED = '- a1b2c3\n- d4e5f6\n';
const ONE = { 'codie/FRM-1-x': MERGED, 'codie/FRM-2-y': '' };
const BOTH = ['codie/FRM-1-x', 'codie/FRM-2-y'];

for (const command of [
    'git branch -D codie/FRM-1-x',
    'git branch -d -f codie/FRM-1-x',
    'git branch --delete --force codie/FRM-1-x',
    `git -C ${REPO} branch -D codie/FRM-1-x`,
    'git branch -D codie/FRM-1-x codie/FRM-2-y',
    'git branch -D codie/FRM-1-x # a leftover',
])
    test(`a branch on main by content is deleted with no tick: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, { cherry: ONE, exists: BOTH });
        expect((await bash($, command)).deny).toBeUndefined();
        expect(ran).toEqual([command]);
    });

test('the lookup runs in the dir the delete runs in, over full ref names', async ($, on) => {
    const { asked } = branchWorld(on, { cherry: ONE, exists: BOTH });
    await bash($, `git -C ${REPO} branch -D codie/FRM-1-x`);
    expect(asked).toEqual([
        [
            'git',
            '-C',
            REPO,
            'for-each-ref',
            '--format=%(refname)',
            'refs/heads/codie/FRM-1-x',
        ],
        [
            'git',
            '-C',
            REPO,
            'cherry',
            'refs/heads/main',
            'refs/heads/codie/FRM-1-x',
        ],
    ]);
});

test('a branch create is no delete: no lookup runs', async ($, on) => {
    const { asked, ran } = branchWorld(on, { cherry: ONE, exists: BOTH });
    const command = 'git branch codie/FRM-3-new';
    expect((await bash($, command)).deny).toBeUndefined();
    expect(ran).toEqual([command]);
    expect(asked).toEqual([]);
});

test('a line whose first word is not git makes no lookup', async ($, on) => {
    const { asked } = branchWorld(on, { cherry: ONE, exists: BOTH });
    await bash($, 'echo branch -D codie/FRM-1-x');
    expect(asked).toEqual([]);
});

test('a tag of the branch name does not stand in for the branch', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: ONE,
        exists: BOTH,
        tagged: true,
    });
    const command = 'git branch -D codie/FRM-1-x';
    expect((await bash($, command)).deny).toBeUndefined();
    expect(ran).toEqual([command]);
});

for (const command of [
    'git branch -D heads/codie/FRM-1-x',
    'git branch -D refs/heads/codie/FRM-1-x',
    'git branch -D codie/frm-1-x',
])
    test(`a name that is not a branch's exact name asks: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, {
            cherry: { '*': '' },
            exists: ['codie/FRM-1-x'],
        });
        expect((await bash($, command)).deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });

for (const command of [
    'git branch -D MAIN',
    'git branch -D Master',
    'git branch -D mAin',
    'git branch -D main',
    'git branch -D master',
])
    test(`a trunk name in any case asks: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, {
            cherry: { '*': '' },
            exists: ['MAIN', 'Master', 'mAin', 'main', 'master'],
        });
        expect((await bash($, command)).deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });

test('a branch with one + line asks, though other lines are -', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: { 'codie/FRM-1-x': '- a1b2c3\n+ d4e5f6\n' },
        exists: ['codie/FRM-1-x'],
    });
    const r = await bash($, 'git branch -D codie/FRM-1-x');
    expect(r.deny).toContain('ask clio');
    expect(ran).toEqual([]);
});

test('one merged branch beside one with a + line asks for the whole command', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: { 'codie/FRM-1-x': '', 'codie/FRM-2-y': '+ d4e5f6\n' },
        exists: BOTH,
    });
    const r = await bash($, 'git branch -D codie/FRM-1-x codie/FRM-2-y');
    expect(r.deny).toContain('ask clio');
    expect(ran).toEqual([]);
});

test('a cherry that fails asks', async ($, on) => {
    const { ran } = branchWorld(on, { cherry: {}, exists: ['codie/FRM-1-x'] });
    expect((await bash($, 'git branch -D codie/FRM-1-x')).deny).toContain(
        'ask clio',
    );
    expect(ran).toEqual([]);
});

test('a cherry that times out asks', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: { '*': '' },
        exists: ['codie/FRM-1-x'],
        timesOut: true,
    });
    expect((await bash($, 'git branch -D codie/FRM-1-x')).deny).toContain(
        'ask clio',
    );
    expect(ran).toEqual([]);
});

test('a cherry read cut short asks, since a + line may sit past the cut', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: { 'codie/FRM-1-x': '- a1b2c3\n' },
        exists: ['codie/FRM-1-x'],
        isTruncated: true,
    });
    expect((await bash($, 'git branch -D codie/FRM-1-x')).deny).toContain(
        'ask clio',
    );
    expect(ran).toEqual([]);
});

test('a branch that does not exist asks', async ($, on) => {
    const { ran } = branchWorld(on, {
        cherry: { 'codie/FRM-1-x': '' },
        exists: [],
    });
    expect((await bash($, 'git branch -D codie/FRM-1-x')).deny).toContain(
        'ask clio',
    );
    expect(ran).toEqual([]);
});

for (const command of [
    'git push origin --delete codie/FRM-1-x',
    'git push origin :codie/FRM-1-x',
])
    test(`a remote delete asks though the branch is merged: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, { cherry: ONE, exists: BOTH });
        expect((await bash($, command)).deny).toContain(
            'a remote branch delete cannot be undone',
        );
        expect(ran).toEqual([]);
    });

// the line moves the dir, writes the ref, or is more than a branch delete: the lookup would not be the delete that runs
for (const command of [
    'git branch -D codie/FRM-1-x && git branch -D codie/FRM-2-y',
    'git branch -D codie/FRM-1-x; git branch -D codie/FRM-2-y',
    '(cd /home/old-clone; git branch -D codie/FRM-1-x)',
    'cd /home/old-clone && git branch -D codie/FRM-1-x',
    'false && cd /home/old-clone; git branch -D codie/FRM-1-x',
    'cd /home/old-clone | git branch -D codie/FRM-1-x',
    'pushd /home/old-clone; git branch -D codie/FRM-1-x',
    'git -C /home/old-clone branch -D codie/FRM-1-x',
    'git -C old-clone branch -D codie/FRM-1-x',
    'git switch codie/FRM-1-x && git commit -m y && git switch main && git branch -D codie/FRM-1-x',
    'git branch -f codie/FRM-1-x main && git branch -D codie/FRM-1-x',
    'git fetch origin y:codie/FRM-1-x && git branch -D codie/FRM-1-x',
    'git update-ref refs/heads/codie/FRM-1-x HEAD && git branch -D codie/FRM-1-x',
    'env GIT_DIR=/home/old-clone/.git git branch -D codie/FRM-1-x',
    'GIT_DIR=/home/old-clone/.git git branch -D codie/FRM-1-x',
    'declare GIT_DIR=/home/old-clone/.git; export GIT_DIR; git branch -D codie/FRM-1-x',
    'git --git-dir=/home/old-clone/.git branch -D codie/FRM-1-x',
    'git -c core.worktree=/home/old-clone branch -D codie/FRM-1-x',
    'git branch -D codie/FRM-1-x > $(echo /dev/null)',
    'git branch -D codie/FRM-1-x &',
    'B=codie/FRM-1-x; git branch -D $B',
    'git branch -D $B',
    'git branch -D $(echo codie/FRM-1-x)',
])
    test(`a line that is more than a lone branch delete asks: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, {
            cherry: { '*': '' },
            exists: BOTH.concat('y'),
        });
        expect((await bash($, command)).deny).toContain('ask clio');
        expect(ran).toEqual([]);
    });

for (const command of [
    "git branch -D 'weird name'",
    "git branch -D 'a;b'",
    'git branch -D -- -x',
    'git branch -D -r origin/codie/FRM-1-x',
    'git branch -rD origin/codie/FRM-1-x',
    'git branch -D --list codie/FRM-1-x',
])
    test(`a name or a flag outside the plain shape asks: ${command}`, async ($, on) => {
        const { ran } = branchWorld(on, {
            cherry: { '*': '' },
            // every name the commands spell exists and is merged, so only its shape or a flag can stop the delete
            exists: [
                'weird name',
                'a;b',
                '-x',
                'origin/codie/FRM-1-x',
                'codie/FRM-1-x',
            ],
        });
        expect((await bash($, command)).deny).toBeDefined();
        expect(ran).toEqual([]);
    });
