import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';

const RM = 'rm -rf build # dima-ok: build';
const SID = 'b1b1b1b1-0000';

// a --bg session: its registry entry says `kind: bg`
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: SID }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: false }));
    on('fs.list', () => ({
        value: [
            {
                isLink: false,
                kind: 'file' as const,
                mtimeMs: 0,
                name: '9.json',
                size: 1,
            },
        ],
    }));
    on('fs.read', () => ({
        value: JSON.stringify({ kind: 'bg', pid: 9, sessionId: SID }),
    }));
    on('ui.log', () => ({ value: undefined }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

test('in a bg session a composer prompt never proves a dima-ok marker', async ($, on) => {
    const { ran } = world(on);
    await $.prompt.submit({
        origin: { kind: 'composer' },
        text: 'spawn brief: rm build',
        wait: false,
    });
    expect([(await bash($, RM)).deny?.includes('build'), ran]).toEqual([
        true,
        [],
    ]);
});

test("in a bg session dima's bridge prompt proves a dima-ok marker", async ($, on) => {
    const { ran } = world(on);
    await $.prompt.submit({
        origin: { kind: 'bridge' },
        text: 'drop build',
        wait: false,
    });
    const r = await bash($, RM);
    expect([r.deny, ran]).toEqual([undefined, [RM]]);
});
