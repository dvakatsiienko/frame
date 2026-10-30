import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-470: a mods test runs a hook with HOME set to an empty dir the same line made, as exactly `NAME=$(mktemp -d) && HOME=$NAME
// <runner> …`; every other HOME override stays refused, since a parse of which variables survive kept leaking
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'CLAUDE_JOB_DIR' ? '/home/.claude/jobs/j1' : '/home',
    }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const DOOR = [
    ['a node hook, chained', 'H=$(mktemp -d) && HOME=$H node hook.js'],
    ['a semicolon', 'H=$(mktemp -d); HOME=$H node hook.js'],
    ['a quoted use', 'H=$(mktemp -d) && HOME="$H" node hook.js'],
    ['a braced use', 'H=$(mktemp -d) && HOME=${H} node hook.js'],
    ['a long mktemp flag', 'H=$(mktemp --directory) && HOME=$H node hook.js'],
    ['another name', 'dir=$(mktemp -d) && HOME=$dir node hook.js a b'],
    ['pnpm', 'H=$(mktemp -d) && HOME=$H pnpm mods:test x-mod-guard'],
    ['a quoted argument', 'H=$(mktemp -d) && HOME=$H node hook.js "a b"'],
] as const;
for (const [shape, command] of DOOR)
    test(`a hook under a HOME made in the same line runs: ${shape}`, async ($, on) => {
        const w = world(on);
        expect((await bash($, command)).deny).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

const REFUSED = [
    ['a literal dir', 'HOME=/tmp/x node hook.js'],
    ['a dir under the real home', 'HOME=~/other node hook.js'],
    ['an export', 'export HOME=/tmp/x'],
    ['an export of the fresh dir', 'H=$(mktemp -d) && export HOME=$H'],
    ['a variable never set', 'HOME=$H node hook.js'],
    ['a template', 'H=$(mktemp -d /tmp/x.XXXX) && HOME=$H node hook.js'],
    ['mktemp -p', 'H=$(mktemp -dp /tmp) && HOME=$H node x'],
    [
        'a variable set again',
        'H=$(mktemp -d) && H=/etc && HOME=$H node hook.js',
    ],
    ['a read between', 'H=$(mktemp -d) && read H && HOME=$H node hook.js'],
    [
        'printf -v between',
        'H=$(mktemp -d) && printf -vH %s ~ && HOME=$H node x',
    ],
    ['eval between', 'H=$(mktemp -d) && eval H=~ && HOME=$H node hook.js'],
    ['let between', 'H=$(mktemp -d) && let H=5 && HOME=$H node hook.js'],
    ['a variable of the shell', 'PWD=$(mktemp -d) && cd ~ && HOME=$PWD node x'],
    ['a subshell assignment', '(H=$(mktemp -d)) && HOME=$H node hook.js'],
    ['a skipped assignment', 'false && H=$(mktemp -d); HOME=$H node hook.js'],
    ['a piped assignment', 'H=$(mktemp -d) | cat; HOME=$H node hook.js'],
    ['a command-scoped assignment', 'H=$(mktemp -d) true; HOME=$H node x'],
    ['the same segment', 'H=$(mktemp -d) HOME=$H node hook.js'],
    ['a single-quoted name', "H=$(mktemp -d) && HOME='$H' node hook.js"],
    ['git', 'H=$(mktemp -d) && HOME=$H git status'],
    ['git through bash -c', "H=$(mktemp -d) && HOME=$H bash -c 'git status'"],
    ['git through env', 'H=$(mktemp -d) && HOME=$H env git status'],
    ['git through xcrun', 'H=$(mktemp -d) && HOME=$H xcrun git status'],
    ['a subpath of the fresh dir', 'H=$(mktemp -d) && HOME=$H/sub node x'],
    ['a second HOME', 'H=$(mktemp -d) && HOME=$H HOME=/etc node x'],
    ['a process substitution', 'H=$(mktemp -d) && HOME=$H node <(echo x)'],
    ['a heredoc', "H=$(mktemp -d) && HOME=$H node <<'X'\nx\nX"],
    ['a command chained after', 'H=$(mktemp -d) && HOME=$H node x && git push'],
    ['a pipe after', 'H=$(mktemp -d) && HOME=$H node x | sh'],
    ['a mktemp with a pipe', 'H=$(mktemp -d | tr a b) && HOME=$H node hook.js'],
    [
        'an assignment inside a shell',
        "H=$(mktemp -d) && bash -c 'HOME=$H node x'",
    ],
] as const;
for (const [shape, command] of REFUSED)
    test(`a HOME override stays refused: ${shape}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect(r.deny).toBeDefined();
        expect(w.ran).toEqual([]);
    });

test('a HOME override that is refused names the HOME rule', async ($, on) => {
    world(on);
    const r = await bash($, 'HOME=/tmp/x node hook.js');
    expect(String(r.deny)).toContain('HOME');
});

test('the rules behind the lifted HOME still judge the rest of the line', async ($, on) => {
    const w = world(on);
    const r = await bash($, "H=$(mktemp -d) && HOME=$H claude -p 'hi'");
    expect(r.deny).toBeDefined();
    expect(String(r.deny)).not.toContain('HOME');
    expect(w.ran).toEqual([]);
});
