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
