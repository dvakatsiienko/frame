import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// FRM-472 exit 8: a script the line writes and then runs is read as its commands, warn-only until its sixth sense says clean
function world(on: On) {
    mock.clock(on, { now: 1_000_000 });
    liveStore(on);
    const ran: string[] = [];
    answerPrompts(on);
    on('session.id', () => ({ value: 'w1w1w1w1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('fs.exists', () => ({ value: false }));
    on('env.get', () => ({ value: '/home' }));
    on('ui.log', () => ({ value: undefined }));
    on('turn.complete', () => ({ text: '' }));
    // nothing is tracked by git here, so a Write over a new file runs
    on('process.run', () => ({
        value: {
            exitCode: 1,
            isStderrTruncated: false,
            isStdoutTruncated: false,
            stderr: '',
            stdout: '',
        },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}
const bash = ($: Engine, command: string) =>
    $.tool.call({ command, run_in_background: true, tool: 'Bash' });
const WARNED = 'would refuse this (rule write-then-run';

const RUN_AFTER_WRITE = [
    ['a cat heredoc run by bash', 'cat <<EOF > s.sh\nrm -rf x\nEOF\nbash s.sh'],
    ['a tee heredoc sourced', 'tee s.sh <<EOF\nrm -rf x\nEOF\nsource s.sh'],
    ['an echo run by its path', "echo 'rm -rf x' > x.sh && ./x.sh"],
    ['a printf run by sh', "printf 'rm -rf x\\n' > x.sh; sh x.sh"],
    [
        'a dot of a path in a dir',
        "echo 'rm -rf x' > /tmp/d/x.sh; . /tmp/d/x.sh",
    ],
] as const;
for (const [shape, command] of RUN_AFTER_WRITE)
    test(`a script written then run warns naming the rule its body trips: ${shape}`, async ($, on) => {
        world(on);
        const text = JSON.stringify(await bash($, command));
        expect([text.includes(WARNED), text.includes('trash')]).toEqual([
            true,
            true,
        ]);
    });

const PLAIN = [
    [
        'a written script with no refused command',
        "echo 'ls' > x.sh && bash x.sh",
    ],
    [
        'a heredoc kept as a file',
        'cat > file.md <<EOF\nrm -rf x\nEOF\ncat file.md',
    ],
    ['another script run', "echo 'rm -rf x' > a.sh && bash b.sh"],
    [
        'a comment after a command in the file',
        "echo 'ls # list' > x.sh && bash x.sh",
    ],
    ['a background job in the file', "echo 'sleep 1 &' > x.sh && bash x.sh"],
] as const;
for (const [shape, command] of PLAIN)
    test(`a write then run passes unwarned: ${shape}`, async ($, on) => {
        const { ran } = world(on);
        const r = await bash($, command);
        expect([r.deny, JSON.stringify(r).includes(WARNED), ran]).toEqual([
            undefined,
            false,
            [command],
        ]);
    });

// FRM-472 exit 8, across calls: a file an earlier call of the same turn wrote is read when Bash runs it
const write = ($: Engine, path: string, content: string) =>
    $.tool.call({ content, file_path: path, tool: 'Write' });
const RUN_LATER = [
    ['bash ./x.sh', 'bash ./x.sh'],
    ['its path', './x.sh'],
    ['sh x.sh', 'sh x.sh'],
    ['an absolute path', 'bash /repo/x.sh'],
] as const;
for (const [shape, run] of RUN_LATER)
    test(`a script a Write made this turn warns when Bash runs it: ${shape}`, async ($, on) => {
        world(on);
        await write($, '/repo/x.sh', '#!/bin/sh\nrm -rf x\n');
        const text = JSON.stringify(await bash($, run));
        expect([text.includes(WARNED), text.includes('trash')]).toEqual([
            true,
            true,
        ]);
    });

test('a script an earlier Bash call wrote warns when a later one runs it', async ($, on) => {
    world(on);
    await bash($, "echo 'rm -rf x' > x.sh");
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

test('a Write with no refused command runs its script unwarned', async ($, on) => {
    world(on);
    await write($, '/repo/x.sh', 'ls\n');
    expect(JSON.stringify(await bash($, 'bash x.sh'))).not.toContain(WARNED);
});

test('a script written in an earlier turn is not read', async ($, on) => {
    world(on);
    await write($, '/repo/x.sh', 'rm -rf x\n');
    await $.turn.complete({
        answer: '',
        durationMs: 1,
        isAborted: false,
        reason: 'answer',
        turnId: 't',
    });
    expect(JSON.stringify(await bash($, 'bash x.sh'))).not.toContain(WARNED);
});
