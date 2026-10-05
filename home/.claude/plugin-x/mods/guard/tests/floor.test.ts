import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const SID = 'a1a1a1a1-0000';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const logs: string[] = [];
    const ran: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
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
    ['git reset --hard', 'git reset --hard', 'git stash -u', 'HEAD'],
    ['git checkout --', 'git checkout -- src/a.ts', 'git stash -u', 'src/a.ts'],
    ['git clean -f', 'git clean -fd', 'git stash -u', '.'],
    ['git stash drop', 'git stash drop', 'ask cclio', 'stash@{0}'],
    ['force-push', 'git push --force origin main', 'ask cclio', 'origin main'],
    ['git branch -D', 'git branch -D old', 'ask cclio', 'old'],
    [
        'git worktree remove',
        'git worktree remove .claude/worktrees/w1',
        'ask cclio',
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
    [
        'mv in the vault',
        'mv "/v/iCloud~md~obsidian/a.md" "/v/iCloud~md~obsidian/b.md"',
        'obsidian rename',
        '/v/iCloud~md~obsidian/a.md /v/iCloud~md~obsidian/b.md',
    ],
    [
        'HOME override',
        'HOME=/tmp/h git status',
        'without the HOME override',
        'HOME',
    ],
    ['npm -g', 'npm i -g vercel', 'pnpm add -g', 'npm'],
    ['pip install', 'pip3 install requests', 'uv pip install', 'pip'],
] as const;

for (const [family, command, door] of FAMILIES)
    test(`${family} is refused with its door`, async ($, on) => {
        mock.store(on);
        const w = world(on);
        expect((await bash($, command)).deny).toContain(door);
        expect(w.ran).toEqual([]);
    });

for (const [family, command, , target] of FAMILIES)
    test(`${family} runs with a dima-ok naming its target`, async ($, on) => {
        mock.store(on);
        const w = world(on);
        const r = await bash($, `${command} # dima-ok: ${target}`);
        expect(r.deny).toBeUndefined();
        expect(w.logs).toContainEqual(`guard: ran on dima-ok: ${target}`);
    });

test('a dima-ok naming another target is refused', async ($, on) => {
    mock.store(on);
    const w = world(on);
    expect((await bash($, 'rm -rf build # dima-ok: dist')).deny).toContain(
        'trash',
    );
    expect(w.ran).toEqual([]);
});

test('a dima-ok naming one of two targets is refused', async ($, on) => {
    mock.store(on);
    world(on);
    expect(
        (await bash($, 'rm -rf ~/keep tmp.txt # dima-ok: tmp.txt')).deny,
    ).toContain('trash');
});

// shapes the first review found slipping past the reader
const SLIPS = [
    ['a shell keyword', 'if true; then rm x; fi', 'trash'],
    ['a loop body', 'for f in a; do rm $f; done', 'trash'],
    ['a brace group', '{ rm x; }', 'trash'],
    [
        'a substitution in double quotes',
        'x="$(git reset --hard)"',
        'git stash -u',
    ],
    ['git commit -n', 'git commit -n -m x -- a.ts', 'without the flag'],
    ['sudo with a user', 'sudo -u root rm x', 'trash'],
    ['timeout as a wrapper', 'timeout 5 rm x', 'trash'],
    ['find -exec sudo rm', 'find . -exec sudo rm {} +', 'trash'],
    ['a +refspec push', 'git push origin +main', 'ask cclio'],
    ['a :refspec push', 'git push origin :main', 'ask cclio'],
    ['a push --delete', 'git push --delete origin old', 'ask cclio'],
    ['git branch -d -f', 'git branch -d -f old', 'ask cclio'],
    ['bash -lc', "bash -lc 'rm x'", 'trash'],
    [
        'a kill fed by ps',
        "kill -9 $(ps aux | grep x | awk '{print $2}')",
        'claude stop',
    ],
    ['a kill fed through xargs', 'pgrep node | xargs kill', 'claude stop'],
    ['unlink', 'unlink x', 'trash'],
    ['git checkout -f', 'git checkout -f main', 'git stash -u'],
    ['git worktree prune', 'git worktree prune', 'ask cclio'],
    ['npm --location=global', 'npm install --location=global x', 'pnpm add -g'],
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

test('a refusal is kept as a guard event', async ($, on) => {
    const store = new Map<string, unknown>();
    on('store.set', (_$, e) => {
        store.set(e.key, e.value);
        return { value: undefined };
    });
    on('store.keys', () => ({ value: [...store.keys()] }));
    on('store.delete', (_$, e) => {
        store.delete(e.key);
        return { value: undefined };
    });
    world(on);
    await bash($, 'rm -rf build');
    expect([...store.values()][0]).toMatchObject({
        command: 'rm -rf build',
        kind: 'refused',
        sid: SID,
        target: 'build',
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
    const w = world(on);
    const r = await bash($, 'rm -rf build # dima-ok: build');
    expect(r.deny).toContain('fail closed');
    expect(w.ran).toEqual([]);
});
