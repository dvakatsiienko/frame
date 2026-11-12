import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';

// a hooksPath override swaps out the hooks a commit or push runs, so it is refused naming its door; a plain push runs
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

const FLAGGED = [
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
    test(`${shape} is refused with its rule and door`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, command);
        expect([
            String(r.deny).includes('without the override'),
            rule,
            ran,
        ]).toEqual([true, 'hooks-bypass', []]);
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
