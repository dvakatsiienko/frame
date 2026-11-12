import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import type { Thread } from '../hooks/rules/command.ts';
import { liveStore } from './store.ts';

// FRM-479: one sixth sense a lane, reused by message. a summon under a session id whose thread record is a sixth sense of a
// lane that already has a live one is refused, naming the live one and the `next:` message to send it. roles and lanes
// come from x thread list (FRM-570 rule 9), never from a name
const LIVE = '⚡ 🔎 sixth sense: mods lane 4 | main';
const NEW = '0e1b2c3d-0000-4000-8000-000000000001';
const LANE = 'mods-lane-4';
const LIVE_ROW: Thread = {
    lane: LANE,
    name: LIVE,
    pid: 64218,
    role: 'sixth-sense',
    sessionId: 'a0a0a0a0-0000-4000-8000-000000000000',
};
const NEW_ROW: Thread = {
    display: '🔎 mods-lane-4 | FRM-479',
    lane: LANE,
    role: 'sixth-sense',
    sessionId: NEW,
};

// threads: what x thread list answers (null: x does not answer); the session is clio's, who summons a sixth sense
// (FRM-570 round 3: a summon from any other session is refused before this rule)
const CLIO_ENTRY = JSON.stringify({
    name: '🦉 clio',
    sessionId: 'a1a1a1a1-0000',
});
function world(on: On, threads: Thread[] | null) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    const calls: string[][] = [];
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
        if (e.path === '/home/.claude/sessions')
            return {
                value: [
                    {
                        isLink: false,
                        kind: 'file' as const,
                        mtimeMs: 0,
                        name: '1.json',
                        size: 1,
                    },
                ],
            };
        touched.push(e.path);
        return { value: [] };
    });
    on('fs.read', (_$, e) => {
        if (e.path === '/home/.claude/sessions/1.json')
            return { value: CLIO_ENTRY };
        touched.push(e.path);
        throw new Error(`ENOENT ${e.path}`);
    });
    on('process.run', (_$, e) => {
        calls.push([...e.argv]);
        const isList = e.argv.join(' ') === 'x thread list --json';
        return {
            value: {
                exitCode: 0,
                isStderrTruncated: false,
                isStdoutTruncated: false,
                stderr: '',
                stdout:
                    isList && threads !== null
                        ? JSON.stringify({ data: { threads } })
                        : '',
            },
        };
    });
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { calls, ran, store, touched };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// clio's quick-lane summon as x brief summon prints it, the minted id after claude (crew-lead § the quick lane)
const SECOND = `cd ~/frame && claude --session-id ${NEW} --bg -n '${LIVE}' --model opus --effort medium '/x:crew-sixth-sense FRM-479 main:c5d775b4 ⚡ 🔧 codie: mods lane 4 | FRM-479 🦉 clio final: 9d82517f spec: .scratch/mods-lane-4/spec.md trials: none' --remote-control`;

test('a second sixth sense for a live lane is refused with the next: message its summon carries', async ($, on) => {
    const w = world(on, [LIVE_ROW, NEW_ROW]);
    const r = await bash($, SECOND);
    expect(w.ran).toEqual([]);
    expect(r.deny).toContain(`«${LIVE}»`);
    expect(r.deny).toContain(
        'next: FRM-479 main:c5d775b4 final: 9d82517f spec: .scratch/mods-lane-4/spec.md',
    );
});

// exit 15: the summon's own name says nothing; its record alone makes it a sixth sense of the lane
for (const name of [
    'probe',
    '⚡ 🔎 mods lane 4 | x',
    'sixth sense: elsewhere | 1',
])
    test(`a summon named «${name}» whose record is the lane's sixth sense is refused`, async ($, on) => {
        world(on, [LIVE_ROW, NEW_ROW]);
        const r = await bash(
            $,
            `claude --bg --session-id=${NEW} --name='${name}' 'use the skill: /x:crew-sixth-sense FRM-1 https://github.com/x/y/pull/12 c d'`,
        );
        expect(r.deny).toContain(`«${NEW_ROW.display}» would be a second`);
        expect(r.deny).toContain(
            'next: FRM-1 https://github.com/x/y/pull/12 final: <sha> spec: <path>',
        );
    });

const PASSES = [
    ['a lane with no live sixth sense', [NEW_ROW], SECOND],
    [
        'a live sixth sense of another lane',
        [{ ...LIVE_ROW, lane: 'mods-lane-3' }, NEW_ROW],
        SECOND,
    ],
    [
        'a codie record for the lane',
        [LIVE_ROW, { ...NEW_ROW, role: 'codie' }],
        SECOND,
    ],
    [
        'a live sixth sense whose session no longer runs',
        [{ ...LIVE_ROW, pid: undefined }, NEW_ROW],
        SECOND,
    ],
    [
        'a sixth sense name summoned with no session id',
        [LIVE_ROW, NEW_ROW],
        `claude --bg -n '${LIVE}' 'go'`,
    ],
    ['x not answering', null, SECOND],
] as const;

for (const [shape, threads, command] of PASSES)
    test(`${shape} summons as before`, async ($, on) => {
        const w = world(on, threads === null ? null : [...threads]);
        const r = await bash($, command);
        expect(r.deny).toBeUndefined();
        expect(r.context?.join('\n') ?? '').not.toContain('spawn-sixth-sense');
        expect(w.ran).toEqual([command]);
    });

test('the check asks x thread list once', async ($, on) => {
    const w = world(on, [LIVE_ROW, NEW_ROW]);
    await bash($, SECOND);
    expect(
        w.calls.filter((c) => c.join(' ') === 'x thread list --json').length,
    ).toBe(1);
});

test('a second sixth sense through hc run is refused as its claude --bg twin is', async ($, on) => {
    const w = world(on, [LIVE_ROW, NEW_ROW]);
    const r = await bash(
        $,
        SECOND.replace(
            'cd ~/frame && claude',
            'hc run --bg --no-parent --no-notify --name ss --cwd ~/frame -- claude',
        ),
    );
    expect([r.deny, w.ran]).toEqual([expect.stringContaining(`«${LIVE}»`), []]);
});
