import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts, dimaSays } from './said.ts';

// FRM-472 07a: a plain push from frame's main checkout and a hooksPath override are flagged naming their door, warn-only
// until their sixth sense says clean; a rule that refuses today still refuses beside them
function world(on: On, cwd = '/home/frame') {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'd1d1d1d1-0000' }));
    on('session.cwd', () => ({ value: cwd }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', () => ({ value: true }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? {
                  value: JSON.stringify({
                      name: '⚡ 🔧 codie',
                      sessionId: 'd1d1d1d1-0000',
                  }),
              }
            : { deny: 'no such file' },
    );
    on('fs.list', () => ({
        value: [
            {
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: '1.json',
                size: 1,
            },
        ],
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
const warned = (r: unknown, rule: string) =>
    JSON.stringify(r).includes(`would refuse this (rule ${rule},`);

const FLAGGED = [
    ['bare-push', 'a plain git push', 'git push'],
    ['bare-push', 'a push of main to origin', 'git push origin main'],
    ['bare-push', 'a push after a cd into frame', 'cd ~/frame && git push'],
    [
        'bare-push',
        'a push pointed at frame by -C',
        'git -C ~/frame push -u origin x',
    ],
    ['bare-push', 'a push inside $(( ))', 'echo $(( $(git push) ))'],
    [
        'hooks-bypass',
        'a commit with hooksPath emptied',
        'git -c core.hooksPath=/dev/null commit -m x -- a.ts',
    ],
    [
        'hooks-bypass',
        'a push with hooksPath, any case',
        'git -c core.hookspath= push',
    ],
    // sixth sense round 1, exit 3 twins
    [
        'hooks-bypass',
        'a persisted hooksPath',
        'git config core.hooksPath /dev/null',
    ],
    [
        'hooks-bypass',
        'a hooksPath set through GIT_CONFIG_KEY',
        'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x -- a.ts',
    ],
    // sixth sense round 2, exit 3 twins
    [
        'hooks-bypass',
        'a hooksPath persisted to a named config file',
        'git config -f .git/config core.hooksPath /dev/null',
    ],
    [
        'hooks-bypass',
        'a hooksPath in GIT_CONFIG_PARAMETERS',
        "GIT_CONFIG_PARAMETERS=\"'core.hooksPath'='/dev/null'\" git commit -m x -- a.ts",
    ],
    [
        'hooks-bypass',
        'a hooksPath key exported for later calls',
        'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null',
    ],
    [
        'hooks-bypass',
        'a hooksPath through --config-env',
        'git --config-env=core.hooksPath=H commit -m x -- a.ts',
    ],
] as const;
for (const [rule, shape, command] of FLAGGED)
    test(`${shape} runs flagged with its rule and door`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, command);
        expect([
            r.deny,
            warned(r, rule),
            JSON.stringify(r).includes(
                rule === 'bare-push' ? 'x lane push' : 'without the override',
            ),
            ran,
        ]).toEqual([undefined, true, true, [command]]);
    });

const PLAIN = [
    ['x lane push', '/home/frame', 'x lane push'],
    ['a push from another repo', '/home/projects/bytes', 'git push'],
    [
        'a push from a frame worktree',
        '/home/frame/.claude/worktrees/a',
        'git push',
    ],
    ['a dry-run push', '/home/frame', 'git push --dry-run'],
    // local review of round 1: reading or unsetting hooksPath swaps nothing
    ['a hooksPath read', '/home/frame', 'git config core.hooksPath'],
    ['a hooksPath --get', '/home/frame', 'git config --get core.hooksPath'],
    ['a hooksPath --unset', '/home/frame', 'git config --unset core.hooksPath'],
    [
        'a hooksPath --unset of one value',
        '/home/frame',
        'git config --unset core.hooksPath /dev/null',
    ],
    [
        'another -c on a commit',
        '/home/frame',
        'git -c core.editor=true commit -m x -- a.ts',
    ],
] as const;
for (const [shape, cwd, command] of PLAIN)
    test(`${shape} runs unflagged`, async ($, on) => {
        const { ran } = world(on, cwd);
        const r = await bash($, command);
        expect([
            r.deny,
            JSON.stringify(r).includes('would refuse'),
            ran,
        ]).toEqual([undefined, false, [command]]);
    });

// sixth sense round 1: a push pointed at frame by its git dir is the same push, from any cwd
for (const command of [
    'git --git-dir=/home/frame/.git push',
    'git --git-dir /home/frame/.git push',
    'GIT_DIR=/home/frame/.git git push',
])
    test(`a push pointed at frame's git dir is flagged from another repo: ${command}`, async ($, on) => {
        world(on, '/home/projects/bytes');
        expect(warned(await bash($, command), 'bare-push')).toBe(true);
    });

// exit 7: sudo drops CLAUDECODE, so what the guard refuses bare it refuses under sudo; a warn-only rule never lets it through
const STILL_REFUSED = [
    ['sudo ahead of a push', 'sudo git push'],
    ['sudo ahead of an rm', 'sudo rm -rf x'],
    ['sudo ahead of a bash -c', "sudo bash -c 'rm -rf x'"],
    [
        'a hooksPath commit that sweeps',
        'git -c core.hooksPath=/dev/null commit -m x',
    ],
] as const;
for (const [shape, command] of STILL_REFUSED)
    test(`${shape} stays refused beside a warn-only flag`, async ($, on) => {
        const { ran } = world(on);
        expect([(await bash($, command)).deny !== undefined, ran]).toEqual([
            true,
            [],
        ]);
    });

// exit 9: raw linear has `issue update`, no `edit` alias; the door names x linear, never a verb raw linear lacks — a
// regression guard only: the `edit` branch was dead, so base passes it too
test('a raw linear body write is pointed at x linear body, never at an edit alias', async ($, on) => {
    world(on);
    const text = String(
        (await bash($, 'linear issue update FRM-1 --description x')).deny,
    );
    expect([text.includes('x linear body'), /\bedit\b/.test(text)]).toEqual([
        true,
        false,
    ]);
});

// R3 row 18: a dima-ok marker his prompt proves still lets its refusal through beside a warn-only flag it does not name
test('a proven dima-ok runs beside a warn-only flag, the flag still said', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'go ahead and rm -rf build');
    const command = 'git push; rm -rf build # dima-ok: build';
    const r = await bash($, command);
    expect([r.deny, warned(r, 'bare-push'), ran]).toEqual([
        undefined,
        true,
        [command],
    ]);
});

// FRM-472 review: a door flag is said on a command whose own refusal a proven marker lets through
test('a hooksPath commit his marker lets through still says hooks-bypass', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'commit everything staged');
    const command =
        'git -c core.hooksPath=/dev/null commit -m x # dima-ok: commit';
    const r = await bash($, command);
    expect([r.deny, warned(r, 'hooks-bypass'), ran]).toEqual([
        undefined,
        true,
        [command],
    ]);
});

test('an unproven dima-ok beside a warn-only flag stays refused', async ($, on) => {
    const { ran } = world(on);
    await dimaSays($, 'push it');
    const r = await bash($, 'git push; rm -rf build # dima-ok: build');
    expect([r.deny !== undefined, ran]).toEqual([true, []]);
});
