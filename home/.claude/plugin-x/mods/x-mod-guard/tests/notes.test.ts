import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// PK-150: `backlog task edit <id> --notes` over notes already there is a silent wipe; the door is --append-notes
const NOTED =
    '## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\nfirst note\n<!-- SECTION:NOTES:END -->\n';
const EMPTY =
    '## Implementation Notes\n\n<!-- SECTION:NOTES:BEGIN -->\n<!-- SECTION:NOTES:END -->\n';

// tasks: each project's tasks dir and the one task file in it
function world(on: On, tasks: Record<string, string>) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'n1n1n1n1-0000' }));
    on('session.cwd', () => ({ value: '/repo/src' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', (_$, e) =>
        e.path in tasks
            ? {
                  value: [
                      {
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: 'sp-1 - a task.md',
                          size: 1,
                      },
                  ],
              }
            : { deny: 'no such dir' },
    );
    on('fs.read', (_$, e) => {
        const dir = e.path.slice(0, e.path.lastIndexOf('/'));
        return dir in tasks
            ? { value: tasks[dir] as string }
            : { deny: 'no such file' };
    });
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

const DOOR = 'backlog task edit SP-1 --append-notes';

test('--notes over a task that holds notes is refused inside bash -c and eval too', async ($, on) => {
    const w = world(on, { '/repo/.backlog/tasks': NOTED });
    for (const command of [
        `bash -c "backlog task edit SP-1 --notes 'new'"`,
        `eval "backlog task edit SP-1 --notes 'new'"`,
    ])
        expect((await bash($, command)).deny).toContain(DOOR);
    expect(w.ran).toEqual([]);
});

test('--notes over a task that holds notes is refused naming --append-notes', async ($, on) => {
    const w = world(on, { '/repo/.backlog/tasks': NOTED });
    const r = await bash($, "backlog task edit SP-1 --notes 'new'");
    expect([w.ran, r.deny?.includes(DOOR)]).toEqual([[], true]);
});

test('--notes= over a task that holds notes is refused naming --append-notes', async ($, on) => {
    const w = world(on, { '/repo/.backlog/tasks': NOTED });
    const r = await bash($, "backlog task edit SP-1 --notes='new'");
    expect([w.ran, r.deny?.includes(DOOR)]).toEqual([[], true]);
});

test('BACKLOG_CWD names the project whose task is read', async ($, on) => {
    const w = world(on, { '/proj/.backlog/tasks': NOTED });
    const r = await bash(
        $,
        "BACKLOG_CWD=/proj backlog task edit SP-1 --notes 'n'",
    );
    expect(r.deny).toContain(DOOR);
});

for (const [shape, tasks, command] of [
    [
        'a task with an empty notes block',
        { '/repo/.backlog/tasks': EMPTY },
        "backlog task edit SP-1 --notes 'n'",
    ],
    [
        'a task with no notes section',
        { '/repo/.backlog/tasks': '## Description\n\nx\n' },
        "backlog task edit SP-1 --notes 'n'",
    ],
    [
        '--append-notes over notes',
        { '/repo/.backlog/tasks': NOTED },
        "backlog task edit SP-1 --append-notes 'n'",
    ],
    [
        'a task id no file matches',
        { '/repo/.backlog/tasks': NOTED },
        "backlog task edit SP-9 --notes 'n'",
    ],
] as const)
    test(`${shape} runs with no warning`, async ($, on) => {
        const w = world(on, { ...tasks });
        const r = await bash($, command);
        expect([w.ran.length, r.deny, r.context ?? []]).toEqual([
            1,
            undefined,
            [],
        ]);
    });
