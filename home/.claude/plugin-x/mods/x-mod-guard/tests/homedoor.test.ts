import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-470: a mods test runs a hook with HOME set to an empty dir the same command made; every other HOME override stays refused
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
    ['a fresh dir, chained', 'H=$(mktemp -d) && HOME=$H node hook.js'],
    ['a fresh dir, a semicolon', 'H=$(mktemp -d); HOME=$H node hook.js'],
    ['a quoted use', 'H=$(mktemp -d) && HOME="$H" node hook.js'],
    ['a braced use', 'H=$(mktemp -d) && HOME=${H} node hook.js'],
    ['a long mktemp flag', 'H=$(mktemp --directory) && HOME=$H node hook.js'],
] as const;
for (const [shape, command] of DOOR)
    test(`a hook under a HOME made in the same command runs: ${shape}`, async ($, on) => {
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
    ['a dir mktemp -p put elsewhere', 'H=$(mktemp -dp /tmp) && HOME=$H node x'],
    [
        'a variable set again',
        'H=$(mktemp -d) && H=/etc && HOME=$H node hook.js',
    ],
    [
        'a variable read again',
        'H=$(mktemp -d) && read H && HOME=$H node hook.js',
    ],
    ['the same segment', 'H=$(mktemp -d) HOME=$H node hook.js'],
    ['git, which keeps the signing', 'H=$(mktemp -d) && HOME=$H git status'],
    ['a second HOME beside it', 'H=$(mktemp -d) && HOME=$H HOME=/etc node x'],
    ['a hidden substitution', 'H=$(mktemp -d) && HOME=$H node <(echo x)'],
    ['a heredoc', "H=$(mktemp -d) && HOME=$H node <<'X'\nx\nX"],
    ['a mktemp with a pipe', 'H=$(mktemp -d | tr a b) && HOME=$H node hook.js'],
    ['a nested shell', "H=$(mktemp -d) && bash -c 'HOME=$H node hook.js'"],
] as const;
for (const [shape, command] of REFUSED)
    test(`a HOME override stays refused: ${shape}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, command);
        expect(r.deny).toBeDefined();
        expect(String(r.deny)).toContain('HOME');
        expect(w.ran).toEqual([]);
    });

test('the rules behind the lifted HOME still judge the rest of the command', async ($, on) => {
    const w = world(on);
    const r = await bash($, 'H=$(mktemp -d) && HOME=$H rm -rf build');
    expect(r.deny).toBeDefined();
    expect(String(r.deny)).toContain('trash');
    expect(w.ran).toEqual([]);
});
