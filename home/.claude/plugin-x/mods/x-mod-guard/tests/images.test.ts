import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

function world(on: On, root: string) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: root }));
    on('session.root', () => ({ value: root }));
    on('env.get', () => ({ value: '/home' }));
    on('fs.stat', (_$, e) => ({
        value: {
            isLink: false,
            kind: 'file' as const,
            mtimeMs: 0,
            realPath: e.path,
            size: 1,
        },
    }));
    on('prompt.submit', (_$, e) => ({ text: e.text }));
    on('tool.call', () => ({ result: {}, text: 'read' }));
}

const read = ($: Engine, file: string) =>
    $.tool.call({ file_path: file, tool: 'Read' });
const nudges = (context: readonly string[] | undefined) =>
    (context ?? []).filter(
        (l) =>
            l.includes('helper-lite') && l.includes('rules/fleet-tooling.md'),
    ).length;
const newTurn = ($: Engine) =>
    $.prompt.submit({ origin: { kind: 'composer' }, text: 'go', wait: false });

test("clio's 3rd image Read in a turn gets the helper-lite nudge, once", async ($, on) => {
    world(on, '/home/frame/_clio');
    const counts: number[] = [];
    for (const f of ['a.png', 'b.jpg', 'c.jpeg', 'd.webp'])
        counts.push(nudges((await read($, `/tmp/shots/${f}`)).context));
    expect(counts).toEqual([0, 0, 1, 0]);
});

test('a new turn starts the image count over', async ($, on) => {
    world(on, '/home/frame/_clio');
    await read($, '/tmp/a.png');
    await read($, '/tmp/b.png');
    await newTurn($);
    expect(nudges((await read($, '/tmp/c.png')).context)).toBe(0);
});

test('a text Read never counts as an image', async ($, on) => {
    world(on, '/home/frame/_clio');
    await read($, '/tmp/a.png');
    await read($, '/tmp/b.md');
    expect(nudges((await read($, '/tmp/c.ts')).context)).toBe(0);
});

test('a session booted anywhere else gets no nudge', async ($, on) => {
    world(on, '/home/frame');
    const counts: number[] = [];
    for (const f of ['a.png', 'b.png', 'c.png'])
        counts.push(nudges((await read($, `/tmp/${f}`)).context));
    expect(counts).toEqual([0, 0, 0]);
});
