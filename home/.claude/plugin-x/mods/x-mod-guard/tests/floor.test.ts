import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

const SID = 'a1a1a1a1-0000';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const logs: string[] = [];
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    // an empty disk: nothing a command names exists yet
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', (_$, e) => {
        logs.push(e.text);
        return { value: undefined };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { logs, ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// one command per floor family, the door its refusal names, and the target its escape names
const FAMILIES = [
    ['rm', 'rm -rf build', 'trash', 'build'],
    ['find -delete', 'find dist -name "*.map" -delete', 'trash', 'dist'],
    ['xargs rm', 'ls | xargs rm', 'trash', 'rm'],
    ['kill by pattern', 'pkill -f vite', 'claude stop', 'vite'],
    ['kill fed by pgrep', 'kill $(pgrep -f next)', 'claude stop', 'next'],
    [
        'git reset --hard',
        'git reset --hard',
        'git stash push -u -- <your paths>',
        'HEAD',
    ],
    [
        'git checkout --',
        'git checkout -- src/a.ts',
        'git stash push -u -- <your paths>',
        'src/a.ts',
    ],
    ['git clean -f', 'git clean -fd', 'git stash push -u -- <your paths>', '.'],
    ['git stash drop', 'git stash drop', 'ask clio', 'stash@{0}'],
    [
        'force-push',
        'git push --force origin main',
        'x lane rebase-main',
        'origin main',
    ],
    [
        'force-with-lease',
        'git push --force-with-lease origin codie/x',
        'x lane rebase-main',
        'origin codie/x',
    ],
    ['git branch -D', 'git branch -D old', 'ask clio', 'old'],
    [
        'git worktree remove',
        'git worktree remove .claude/worktrees/w1',
        'ask clio',
        '.claude/worktrees/w1',
    ],
    [
        '--no-verify',
        'git commit --no-verify -F m -- a.ts',
        'without the flag',
        '--no-verify',
    ],
    [
        '-c user.email',
        'git -c user.email=x@y commit -F m -- a.ts',
        'without the flag',
        'user.email',
    ],
] as const;

for (const [family, command, door] of FAMILIES)
    test(`${family} is refused with its door`, async ($, on) => {
        mock.store(on);
        const w = world(on);
        expect((await bash($, command)).deny).toContain(door);
        expect(w.ran).toEqual([]);
    });

// a refusal his tick can open says so, since a quoted command ticked runs once; plain rm never opens
for (const [family, command, door] of FAMILIES)
    test(`${family}'s refusal ${door === 'trash' ? 'names no tick door' : 'names the tick door'}`, async ($, on) => {
        mock.store(on);
        world(on);
        const said = (await bash($, command)).deny ?? '';
        expect(
            said.includes(
                'his tick on an orbit ask quoting this whole command',
            ),
        ).toBe(door !== 'trash');
    });

// shapes the first review found slipping past the reader
const SLIPS = [
    ['a shell keyword', 'if true; then rm x; fi', 'trash'],
    ['a loop body', 'for f in a; do rm $f; done', 'trash'],
    ['a brace group', '{ rm x; }', 'trash'],
    [
        'a substitution in double quotes',
        'x="$(git reset --hard)"',
        'git stash push -u -- <your paths>',
    ],
    ['git commit -n', 'git commit -n -m x -- a.ts', 'without the flag'],
    ['sudo with a user', 'sudo -u root rm x', 'trash'],
    ['timeout as a wrapper', 'timeout 5 rm x', 'trash'],
    ['find -exec sudo rm', 'find . -exec sudo rm {} +', 'trash'],
    ['a +refspec push', 'git push origin +main', 'x lane rebase-main'],
    ['a :refspec push', 'git push origin :main', 'no safe door'],
    ['a push --delete', 'git push --delete origin old', 'no safe door'],
    ['a push -d', 'git push -d origin old', 'no safe door'],
    ['git branch -d -f', 'git branch -d -f old', 'ask clio'],
    ['bash -lc', "bash -lc 'rm x'", 'trash'],
    [
        'a kill fed by ps',
        "kill -9 $(ps aux | grep x | awk '{print $2}')",
        'claude stop',
    ],
    ['a kill fed through xargs', 'pgrep node | xargs kill', 'claude stop'],
    ['unlink', 'unlink x', 'trash'],
    [
        'git checkout -f',
        'git checkout -f main',
        'git stash push -u -- <your paths>',
    ],
    ['git worktree prune', 'git worktree prune', 'ask clio'],
    ['git worktree prune -v', 'git worktree prune -v', 'ask clio'],
    [
        'a dry run turned off again',
        'git worktree prune -n --no-dry-run',
        'ask clio',
    ],
    ['git config user.name', 'git config user.name bot', 'without the flag'],
    ['a command after arithmetic', 'echo $((1<<2))\nrm x', 'trash'],
] as const;

for (const [shape, command, door] of SLIPS)
    test(`${shape} is refused`, async ($, on) => {
        mock.store(on);
        world(on);
        expect((await bash($, command)).deny).toContain(door);
    });

// everyday commands the first review found refused
const NEAR = [
    ['a pgrep beside a kill by pid', 'pgrep -l node; kill 12345'],
    ['a kill of a captured pid', 'kill $(cat .dev.pid)'],
    ['a search for a flag', "rg -n -- '--no-verify' docs"],
    ['a host and a path', 'scp f $HOST:/tmp'],
    ['a host and a port', 'curl http://$HOST:8080/'],
    ['arithmetic with a shift', 'echo $((1<<2))'],
    ['a pip that only lists', 'python3 -m pip list'],
    // FRM-519 item 17: a dry run only prints what a prune would remove
    ['a worktree prune dry run', 'git worktree prune -n'],
    ['a verbose worktree prune dry run', 'git worktree prune --dry-run -v'],
    ['a joined worktree prune dry run', 'git worktree prune -nv'],
    [
        'a heredoc commit message in a substitution',
        'git commit -F "$(cat <<\'EOF\'\nfix $PATH:x and rm -rf docs\nEOF\n)" -- a.ts',
    ],
] as const;

for (const [shape, command] of NEAR)
    test(`${shape} runs`, async ($, on) => {
        mock.store(on);
        world(on);
        expect((await bash($, command)).deny).toBeUndefined();
    });

test('a multi-line refusal is kept on one line', async ($, on) => {
    const store = liveStore(on);
    world(on);
    await bash($, 'cd build &&\n  rm -rf out');
    expect([...store.values()][0]).toMatchObject({
        command: 'cd build && rm -rf out',
    });
});

test('a long refusal is cut by whole code points, no half emoji kept (R5)', async ($, on) => {
    const store = liveStore(on);
    world(on);
    const head = `rm x ${'a'.repeat(154)}😀`;
    await bash($, `${head}bbb`);
    expect([...store.values()][0]).toMatchObject({ command: `${head}…` });
});

test('a refusal is kept as a guard event', async ($, on) => {
    const store = liveStore(on);
    world(on);
    await bash($, 'rm -rf build');
    expect([...store.values()][0]).toMatchObject({
        command: 'rm -rf build',
        kind: 'refused',
        sid: SID,
        target: 'build',
    });
});

test("a refusal's event keeps why it was refused", async ($, on) => {
    const store = liveStore(on);
    world(on);
    await bash($, 'rm -rf build');
    expect([...store.values()][0]).toMatchObject({
        why: 'rm deletes for good',
    });
});

test('quoted text and heredoc bodies are never read as commands', async ($, on) => {
    mock.store(on);
    const w = world(on);
    const command =
        "echo 'git reset --hard'; x lane commit -F - <<'EOF'\nrm -rf build\nEOF";
    expect((await bash($, command)).deny).toBeUndefined();
    expect(w.ran).toEqual([command]);
});

test('a script under bash -c is checked too', async ($, on) => {
    mock.store(on);
    world(on);
    expect((await bash($, "bash -c 'rm -rf build'")).deny).toContain('trash');
});

// the harness throws on an unmocked store, so the escape cannot be logged; without .catch the hook is skipped and the command runs
test('a guard that fails refuses the command', async ($, on) => {
    const ran: string[] = [];
    mock.clock(on, { now: 1_000_000 });
    on('ui.log', () => ({ value: undefined }));
    on('session.cwd', () => ({ deny: 'no cwd' }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    const r = await bash($, 'git status');
    expect(r.deny).toContain('fail closed');
    expect(ran).toEqual([]);
});
