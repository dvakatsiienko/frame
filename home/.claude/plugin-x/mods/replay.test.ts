import { expect, test } from 'vitest';

import { bashCalls, tally } from './replay.ts';

const row = (command: string, cwd: string) =>
    JSON.stringify({
        cwd,
        message: {
            content: [{ input: { command }, name: 'Bash', type: 'tool_use' }],
        },
        type: 'assistant',
    });

test('reads every Bash call with the cwd it ran in', () => {
    const jsonl = [
        row('ls', '/a'),
        '{"type":"user"}',
        'not json "Bash"',
        row('pwd', '/b'),
    ].join('\n');
    expect(bashCalls(jsonl)).toEqual([
        { command: 'ls', cwd: '/a' },
        { command: 'pwd', cwd: '/b' },
    ]);
});

test('counts a hint once per command that fires it, and leaves quiet commands out', () => {
    const fired = tally(
        [
            { command: "rg -n 'x'", cwd: '/home/frame' },
            { command: "rg -n 'x' src", cwd: '/home/frame' },
        ],
        '/home',
    );
    expect([...fired.values()].map((c) => c.length)).toEqual([1]);
});
