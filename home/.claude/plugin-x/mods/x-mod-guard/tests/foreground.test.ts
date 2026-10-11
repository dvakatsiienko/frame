import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-395: a foreground `claude -p` holds the thread, so it is refused (dima's o102); `# fg-ok:` lets a real need through
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string, isBackground = false) =>
    $.tool.call({
        command,
        tool: 'Bash',
        ...(isBackground ? { run_in_background: true } : {}),
    });

for (const typed of [
    "claude -p 'hi'",
    "cd /tmp && claude --print --model haiku 'hi'",
    "for i in 1 2; do claude -p 'x'; done",
])
    test(`a foreground claude -p is refused with run_in_background named: ${typed}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed);
        expect([w.ran, r.deny?.includes('run_in_background')]).toEqual([
            [],
            true,
        ]);
    });

for (const [typed, isBackground] of [
    ["claude -p 'hi'", true],
    ["claude -p 'hi' # fg-ok: one probe dima waits on", false],
    ['sleep 30', false],
    ['gh run watch 12', false],
    ['claude plugin test .', false],
] as const)
    test(`runs: ${typed}${isBackground ? ' (background)' : ''}`, async ($, on) => {
        const w = world(on);
        const r = await bash($, typed, isBackground);
        expect([r.deny, w.ran]).toEqual([undefined, [typed]]);
    });
