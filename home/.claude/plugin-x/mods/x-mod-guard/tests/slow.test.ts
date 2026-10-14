import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

// a session whose Bash takes `takes` ms, the clock moved by the tool itself
function world(on: On, takes: number) {
    const clock = mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/home/frame/x/go' }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.exists', () => ({ value: true }));
    on('tool.call', async () => {
        await clock.advance(takes);
        return { result: {}, text: 'ran' };
    });
}

const bash = ($: Engine, command: string, isBackground = false) =>
    $.tool.call({ command, run_in_background: isBackground, tool: 'Bash' });
const slowLines = (context: readonly string[] | undefined) =>
    (context ?? []).filter((l) => l.includes('held the foreground'));

test('a foreground call that held over a minute hints its next foreground run', async ($, on) => {
    world(on, 90_000);
    const first = await bash($, 'go test -count=1 ./...');
    const second = await bash($, 'go test -count=1 ./...');
    expect([slowLines(first.context), slowLines(second.context)]).toEqual([
        [],
        [expect.stringContaining('`go test` held the foreground 90 s')],
    ]);
});

test('a quick call leaves no memory, so its next run gets no hint', async ($, on) => {
    world(on, 2_000);
    await bash($, 'go test -count=1 ./...');
    expect(
        slowLines((await bash($, 'go test -count=1 ./...')).context),
    ).toEqual([]);
});

test('a run already in the background is neither remembered nor hinted', async ($, on) => {
    world(on, 90_000);
    await bash($, 'go test ./...', true);
    expect(slowLines((await bash($, 'go test ./...')).context)).toEqual([]);
});

test('the shell glue around a slow call carries no shape', async ($, on) => {
    world(on, 90_000);
    await bash($, 'cd /home/frame && pnpm test');
    const glue = slowLines((await bash($, 'cd /home/frame && ls')).context);
    const same = slowLines((await bash($, 'pnpm test')).context);
    expect([glue, same.length]).toEqual([[], 1]);
});
