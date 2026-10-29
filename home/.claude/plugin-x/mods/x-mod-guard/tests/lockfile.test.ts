import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// FRM-393: `CI=1` freezes pnpm's lockfile; a dep change under it ships half. warn-only until a sixth sense says clean (o70)
function world(on: On, changed: string[] = []) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('process.run', (_$, e) => ({
        value: {
            exitCode: 0,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: e.argv.includes('diff') ? changed.join('\n') : '',
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });
const flagged = (context: readonly string[] | undefined) =>
    (context ?? []).some((l) => l.includes('rule frozen-lockfile'));

for (const typed of [
    'CI=1 pnpm add zod',
    'CI=1 pnpm remove zod',
    'cd /repo && env CI=1 pnpm add -D vitest',
])
    test(`a frozen dep change is flagged with the flag named: ${typed}`, async ($, on) => {
        world(on);
        const r = await bash($, typed);
        expect([
            flagged(r.context),
            (r.context ?? []).some((l) => l.includes('--no-frozen-lockfile')),
        ]).toEqual([true, true]);
    });

test('CI=1 pnpm install over a changed package.json is flagged', async ($, on) => {
    world(on, ['apps/web/package.json']);
    expect(flagged((await bash($, 'CI=1 pnpm install')).context)).toBe(true);
});

for (const [typed, changed] of [
    ['CI=1 pnpm install', []],
    ['CI=1 pnpm install --no-frozen-lockfile', ['package.json']],
    ['CI=1 pnpm add zod --no-frozen-lockfile', []],
    ['pnpm add zod', []],
] as const)
    test(`runs unflagged: ${typed}`, async ($, on) => {
        const w = world(on, [...changed]);
        const r = await bash($, typed);
        expect([w.ran, flagged(r.context)]).toEqual([[typed], false]);
    });
