import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-398: a member reads and comments on tickets through x linear; the raw cli is refused with the door named
const SID = 'm1m1m1m1-0000';

function world(on: On, name: string | null = '☕️ 🔧 codie') {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.list', () => ({
        value:
            name === null
                ? []
                : [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: '1.json',
                          size: 1,
                      },
                  ],
    }));
    on('fs.read', (_$, e) =>
        e.path === '/home/.claude/sessions/1.json'
            ? { value: JSON.stringify({ name, sessionId: SID }) }
            : { deny: 'no such file' },
    );
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

for (const [typed, door] of [
    ['linear issue view FRM-1', 'x linear read <id> --comments --relations'],
    [
        "linear api '{ viewer { id } }'",
        'x linear read <id> --comments --relations',
    ],
    [
        'linear issue comment add FRM-1 --body-file f.md',
        'x linear comment <id> --body-file <file>',
    ],
    ['cd /tmp && linear issue view FRM-1 | jq .', 'x linear read'],
] as const) {
    test(`a member's raw linear is refused with the door named: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, r.deny?.includes(door)]).toEqual([[], true]);
    });
}

test("clio's session runs the raw linear cli", async ($, on) => {
    const w = world(on, '🦉 clio');
    await bash($, 'linear issue view FRM-1');
    expect(w.ran).toEqual(['linear issue view FRM-1']);
});

test("clio's raw linear api still takes the x linear rewrite", async ($, on) => {
    const w = world(on, '🦉 clio');
    await bash($, "linear api '{ viewer { id } }'");
    expect(w.ran).toEqual(["x linear api '{ viewer { id } }'"]);
});

test('a session the registry does not list runs it, fail open', async ($, on) => {
    const w = world(on, null);
    await bash($, 'linear issue view FRM-1');
    expect(w.ran).toEqual(['linear issue view FRM-1']);
});

for (const typed of [
    'x linear read FRM-1 --comments --relations',
    'x linear comment FRM-1 --as codie --body-file f.md',
    "echo 'linear issue view FRM-1'",
    'linear issue list',
])
    test(`a member runs: ${typed}`, async ($, on) => {
        const w = world(on);
        await bash($, typed);
        expect(w.ran).toEqual([typed]);
    });
