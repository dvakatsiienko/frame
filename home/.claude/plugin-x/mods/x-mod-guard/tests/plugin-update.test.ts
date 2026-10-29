import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { liveStore } from './store.ts';

// FRM-389 exit 7: a raw plugin update names x plugin bump, every session's door; warn-only until its sixth sense
const SID = 'p1p1p1p1-0000';
const DOOR = 'x plugin bump --apply <plugin>';

function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    const store = liveStore(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('fs.list', () => ({ value: [] }));
    on('fs.read', () => ({ deny: 'no such file' }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran, store };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });

for (const typed of [
    'claude plugin update x@x',
    'claude plugin marketplace update x',
    'cd ~/frame && claude plugin marketplace update',
]) {
    test(`a raw plugin update runs, warned with x plugin bump named: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([
            w.ran.length,
            r.deny,
            r.context?.some((c) => c.includes(DOOR)),
        ]).toEqual([1, undefined, true]);
    });

    test(`with the rule enforced, a raw plugin update is refused: ${typed}`, async ($, on) => {
        const w = world(on);
        w.store.set('rule-mode:raw-plugin-update', 'enforce');
        const r = await bash($, typed);
        expect([w.ran, r.deny?.includes(DOOR)]).toEqual([[], true]);
    });
}

for (const typed of [
    'claude plugin list',
    'claude plugin validate home/.claude/plugin-x/mods/x-mod-stash',
    'claude plugin test home/.claude/plugin-x/mods/x-mod-stash',
    'x plugin bump --apply x',
    "echo 'claude plugin update x'",
    'claude mcp update x',
])
    test(`runs unwarned: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([
            w.ran,
            r.context?.some((c) => c.includes(DOOR)) ?? false,
        ]).toEqual([[typed], false]);
    });
