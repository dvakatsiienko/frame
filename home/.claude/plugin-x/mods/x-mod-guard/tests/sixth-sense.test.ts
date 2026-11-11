import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-479: one sixth sense a lane, reused by message. a `claude --bg` summon of a sixth sense whose lane already has a
// live one is refused, naming the live one and the `next:` message to send it. the registry is a fixture under /home
const LIVE = '⚡ 🔎 sixth sense: mods lane 4 | main';
const START = 'Mon Nov  2 10:49:58 2026';
type Row = { name: string; pid: number; procStart?: string };
const ROW: Row = { name: LIVE, pid: 64218, procStart: START };

function world(on: On, rows: Row[], alive: Record<number, string> = {}) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    const touched: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('session.root', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'HOME' ? '/home' : undefined,
    }));
    on('fs.exists', (_$, e) => {
        touched.push(e.path);
        return { value: false };
    });
    on('fs.list', (_$, e) => {
        touched.push(e.path);
        return {
            value:
                e.path === '/home/.claude/sessions'
                    ? rows.map((r) => ({
                          isLink: false,
                          kind: 'file' as const,
                          mtimeMs: 0,
                          name: `${r.pid}.json`,
                          size: 1,
                      }))
                    : [],
        };
    });
    on('fs.read', (_$, e) => {
        touched.push(e.path);
        const row = rows.find(
            (r) => e.path === `/home/.claude/sessions/${r.pid}.json`,
        );
        if (!row) throw new Error(`ENOENT ${e.path}`);
        return {
            value: JSON.stringify({ kind: 'bg', status: 'busy', ...row }),
        };
    });
    // ps prints the registry's own form only in UTC under the C locale; any other zone or locale reads as another process
    on('process.run', (_$, e) => {
        const isRegistryForm =
            e.init?.env?.TZ === 'UTC' && e.init?.env?.LC_ALL === 'C';
        const stdout = Object.entries(alive)
            .map(
                ([pid, start]) =>
                    `${pid.padStart(5)} ${isRegistryForm ? start : 'Mon Nov  2 12:49:58 2026'}    `,
            )
            .join('\n');
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout,
            },
        };
    });
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store, touched };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// clio's quick-lane summon, in crew-lead's shape (SKILL.md § the quick lane)
const SECOND = `cd ~/frame && claude --bg -n '${LIVE}' --model opus --effort medium '/x:crew-sixth-sense FRM-479 main:c5d775b4 ⚡ 🔧 codie: mods lane 4 | FRM-479 🦉 clio final: 9d82517f spec: .scratch/mods-lane-4/spec.md trials: none' --remote-control`;

test('a second sixth sense for a lane with a live one is refused with no store switch', async ($, on) => {
    const w = world(on, [ROW], { 64218: START });
    const r = await bash($, SECOND);
    expect(w.ran).toEqual([]);
    expect(r.deny).toContain(`«${LIVE}»`);
});

test('a second sixth sense for a live lane is refused with the next: message its summon carries', async ($, on) => {
    const w = world(on, [ROW], { 64218: START });
    const r = await bash($, SECOND);
    expect(w.ran).toEqual([]);
    expect(r.deny).toContain(`«${LIVE}»`);
    expect(r.deny).toContain(
        'next: FRM-479 main:c5d775b4 final: 9d82517f spec: .scratch/mods-lane-4/spec.md',
    );
});

test('a --name= spelling names the summoned thread, its skill line read mid-prompt', async ($, on) => {
    world(on, [ROW], { 64218: START });
    const r = await bash(
        $,
        `claude --bg --name='⚡ 🔎 sixth sense: mods lane 4 | x' 'use the skill: /x:crew-sixth-sense FRM-1 https://github.com/x/y/pull/12 c d'`,
    );
    expect(r.deny).toContain(
        '«⚡ 🔎 sixth sense: mods lane 4 | x» would be a second',
    );
    expect(r.deny).toContain(
        'next: FRM-1 https://github.com/x/y/pull/12 final: <sha> spec: <path>',
    );
});

test('a re-cased name under another mode badge names the same lane', async ($, on) => {
    world(on, [ROW], { 64218: START });
    const r = await bash(
        $,
        `claude --bg -n '🌗 🔎 sixth sense: Mods Lane 4 | #12' 'go'`,
    );
    expect(r.deny).toContain(`«${LIVE}»`);
});

const PASSES = [
    ['a lane with no live sixth sense', [], {}, SECOND],
    [
        'a live sixth sense of another lane',
        [{ ...ROW, name: '⚡ 🔎 sixth sense: mods lane 3 | main' }],
        { 64218: START },
        SECOND,
    ],
    [
        'a codie summon for the lane',
        [ROW],
        { 64218: START },
        `claude --bg -n '⚡ 🔧 codie: mods lane 4 | FRM-479' 'go on'`,
    ],
    [
        'a sixth sense whose name has no scope, beside a live one with none',
        [{ ...ROW, name: '⚡ 🔎 sixth sense: main' }],
        { 64218: START },
        `claude --bg -n '⚡ 🔎 sixth sense: main' 'go'`,
    ],
    ['a registry row whose process is gone', [ROW], {}, SECOND],
    [
        'a registry row with no start time whose process is gone',
        [{ name: LIVE, pid: 64218 }],
        {},
        SECOND,
    ],
    [
        'a registry row whose pid now runs another process',
        [ROW],
        { 64218: 'Mon Nov  2 16:01:02 2026' },
        SECOND,
    ],
    [
        'a codie of the lane beside a sixth sense of another lane',
        [ROW],
        { 64218: START },
        `claude --bg -n '⚡ 🔎 sixth sense: mods lane 3 | main' 'go'; claude --bg -n '⚡ 🔧 codie: mods lane 4 | FRM-479' 'go on'`,
    ],
] as const;

for (const [shape, rows, alive, command] of PASSES)
    test(`${shape} summons as before`, async ($, on) => {
        const w = world(on, [...rows], alive);
        const r = await bash($, command);
        expect(r.deny).toBeUndefined();
        expect(r.context?.join('\n') ?? '').not.toContain('spawn-sixth-sense');
        expect(w.ran).toEqual([command]);
    });

test('the check reads only the fixture registry', async ($, on) => {
    const w = world(on, [ROW], { 64218: START });
    await bash($, SECOND);
    expect(
        w.touched.filter(
            (p) => p.includes('/.claude/sessions') && !p.startsWith('/home/'),
        ),
    ).toEqual([]);
    expect(w.touched.some((p) => p.includes('/.local/state'))).toBe(false);
});

test('a second sixth sense through hc run is refused as its claude --bg twin is', async ($, on) => {
    const w = world(on, [ROW], { 64218: START });
    const r = await bash(
        $,
        SECOND.replace(
            'cd ~/frame && claude --bg',
            'hc run --bg --no-parent --no-notify --name ss --cwd ~/frame -- claude',
        ),
    );
    expect([r.deny, w.ran]).toEqual([expect.stringContaining(`«${LIVE}»`), []]);
});
