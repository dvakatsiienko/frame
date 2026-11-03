import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

import { answerPrompts } from './said.ts';
import { liveStore } from './store.ts';

// FRM-472 exit 8: a script the line writes and then runs is read as its commands, warn-only until its sixth sense says clean
function world(on: On, isError = false) {
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
        // isError fails Bash calls only, so a Write that seeds a script still lands
        return isError && 'command' in e
            ? { isError: true as const, result: {}, text: 'ran' }
            : { result: {}, text: 'ran' };
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
        'a script run by another written on the line',
        "echo 'rm -rf x' > b.sh; echo 'bash b.sh' > a.sh; bash a.sh",
    ],
    // sixth sense round 1: a written script fed on stdin, or run past a shell's valued option
    ['a script fed by <', "echo 'rm -rf x' > s.sh; bash < s.sh"],
    ['a script piped from cat', "echo 'rm -rf x' > s.sh; cat s.sh | sh"],
    ['a script past bash -o', "echo 'rm -rf x' > s.sh; bash -o errexit s.sh"],
    [
        'a script past bash -eo',
        "echo 'rm -rf x' > s.sh; bash -eo pipefail s.sh",
    ],
    [
        'a script fed to bash -s with args',
        "echo 'rm -rf x' > s.sh; bash -s arg < s.sh",
    ],
    [
        'a script piped to bash -s --',
        "echo 'rm -rf x' > s.sh; cat s.sh | bash -s -- a",
    ],
    ['a script fed to bash -', "echo 'rm -rf x' > s.sh; bash - < s.sh"],
    [
        'a script past bash -euo',
        "echo 'rm -rf x' > s.sh; bash -euo pipefail s.sh",
    ],
    [
        'a line appended by tee -a',
        'cat <<EOF > s.sh\nrm -rf x\nEOF\ntee -a s.sh <<EOF\nls\nEOF\nbash s.sh',
    ],
    [
        'a line appended with >>',
        "echo 'rm -rf x' > s.sh; echo 'ls' >> s.sh; bash s.sh",
    ],
    [
        'a dot of a path in a dir',
        "echo 'rm -rf x' > /tmp/d/x.sh; . /tmp/d/x.sh",
    ],
    // sixth sense round 3: an -s past the script is the script's own arg
    ['a script given -s as its arg', "echo 'rm -rf x' > s.sh; bash s.sh -s"],
    [
        'a script given -s and a word',
        "echo 'rm -rf x' > s.sh; bash s.sh -s staging",
    ],
    [
        'a script past -o, given -s',
        "echo 'rm -rf x' > s.sh; bash -o errexit s.sh -s",
    ],
    ['a script past --, given -s', "echo 'rm -rf x' > s.sh; bash -- s.sh -s"],
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
    // local review of round 4: a heredoc to a shell that runs a script is never its script
    ['a heredoc beside a script given -s', 'bash s.sh -s <<EOF\nrm -rf x\nEOF'],
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

test('a line an earlier Bash call appended is read with the text before it', async ($, on) => {
    world(on);
    await bash($, "echo 'rm -rf x' > s.sh");
    await bash($, "echo 'ls' >> s.sh");
    expect(JSON.stringify(await bash($, 'bash s.sh'))).toContain(WARNED);
});

test('a > after a written script replaces its text', async ($, on) => {
    world(on);
    await bash($, "echo 'rm -rf x' > s.sh");
    await bash($, "echo 'ls' > s.sh");
    expect(JSON.stringify(await bash($, 'bash s.sh'))).not.toContain(WARNED);
});

const SELF_RUN = [
    ['runs clean', 'echo hi; bash x.sh\n', false],
    ['warns on its refused line', 'rm -rf y; bash x.sh\n', true],
] as const;
for (const [shape, body, isWarned] of SELF_RUN)
    test(`a written script that runs itself is read once and ${shape}`, async ($, on) => {
        const { ran } = world(on);
        await write($, '/repo/x.sh', body);
        const r = await bash($, 'bash x.sh');
        expect([
            r.deny,
            JSON.stringify(r).includes(WARNED),
            ran.at(-1),
        ]).toEqual([undefined, isWarned, 'bash x.sh']);
    });

// sixth sense round 1: an Edit after the Write changes the text a run reads; a script too long to keep is still warned
const edit = ($: Engine, path: string, from: string, to: string) =>
    $.tool.call({
        file_path: path,
        new_string: to,
        old_string: from,
        tool: 'Edit',
    });
const EDITED = [
    ['an Edit that adds a refused line', 'ls\n', 'ls', 'rm -rf x', true],
    [
        'an Edit that takes a refused line out',
        'rm -rf x\n',
        'rm -rf x',
        'ls',
        false,
    ],
] as const;
for (const [shape, body, from, to, isWarned] of EDITED)
    test(`a written script is read as edited since: ${shape}`, async ($, on) => {
        world(on);
        await write($, '/repo/x.sh', body);
        await edit($, '/repo/x.sh', from, to);
        expect(
            JSON.stringify(await bash($, 'bash x.sh')).includes(WARNED),
        ).toBe(isWarned);
    });

// sixth sense round 2: a Bash rewrite of a kept script leaves its text unread; a write inside sh -c is kept too
for (const rewrite of [
    "sd 'ls' 'pwd' x.sh",
    "sed -i '' 's/ls/pwd/' x.sh",
    'echo pwd | tee x.sh',
])
    test(`a written script a Bash call rewrites warns as unread: ${rewrite}`, async ($, on) => {
        world(on);
        await write($, '/repo/x.sh', 'ls\n');
        await bash($, rewrite);
        expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
    });

// sixth sense round 3: a rewrite in the line that runs the script, or in a line that errors, leaves its text unread too
const REWRITTEN_IN_LINE = [
    ['after a Write', "sed -i '' 's/ls/pwd/' x.sh && bash x.sh", true],
    [
        'after a heredoc in the line',
        "cat > x.sh <<EOF\nls\nEOF\nsed -i '' 's/ls/pwd/' x.sh; bash x.sh",
        false,
    ],
] as const;
for (const [shape, line, isWrite] of REWRITTEN_IN_LINE)
    test(`a written script rewritten in the line that runs it warns as unread: ${shape}`, async ($, on) => {
        world(on);
        if (isWrite) await write($, '/repo/x.sh', 'ls\n');
        expect(JSON.stringify(await bash($, line))).toContain(WARNED);
    });

test('a script a line writes, then rewrites, warns as unread in a later call', async ($, on) => {
    world(on);
    await bash($, "echo ls > x.sh && sed -i '' 's/ls/pwd/' x.sh");
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

// sixth sense round 4: a rewrite then an append in one line leaves a script kept from an earlier call unread
test('a written script rewritten then appended to in one line warns as unread in a later call', async ($, on) => {
    world(on);
    await write($, '/repo/x.sh', 'ls\n');
    await bash($, "sed -i '' 's/ls/rm -rf x/' x.sh; echo pwd >> x.sh");
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

test('a script never kept that a line rewrites stays unkept, so its run passes', async ($, on) => {
    world(on);
    await bash($, "sed -i '' 's/a/b/' y.sh");
    expect(JSON.stringify(await bash($, 'bash y.sh'))).not.toContain(WARNED);
});

// local review of round 5: a new script a line that errors wrote is unread; two rewrites of an unkept file keep nothing
test('a new script a line that errors wrote warns as unread', async ($, on) => {
    world(on, true);
    await bash($, "echo 'ls' > n.sh; false");
    expect(JSON.stringify(await bash($, 'bash n.sh'))).toContain(WARNED);
});

test('two rewrites of a script never kept keep nothing, so its run passes', async ($, on) => {
    world(on);
    await bash($, "sed -i '' 's/a/b/' y.sh; sed -i '' 's/c/d/' y.sh");
    expect(JSON.stringify(await bash($, 'bash y.sh'))).not.toContain(WARNED);
});

test('a written script a line that errors writes over warns as unread', async ($, on) => {
    world(on, true);
    await write($, '/repo/x.sh', 'ls\n');
    await bash($, "echo 'rm -rf x' > x.sh; false");
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

test('a written script rewritten in a line that errors warns as unread', async ($, on) => {
    world(on, true);
    await write($, '/repo/x.sh', 'ls\n');
    await bash($, "sed -i '' 's/ls/pwd/' x.sh; false");
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

test('a script written inside sh -c is read when a later call runs it', async ($, on) => {
    world(on);
    await bash($, `sh -c "echo 'rm -rf x' > s.sh"`);
    expect(JSON.stringify(await bash($, 'bash s.sh'))).toContain(WARNED);
});

test('a written script a MultiEdit changes is read as edited', async ($, on) => {
    world(on);
    await write($, '/repo/x.sh', 'ls\n');
    await $.tool.call({
        edits: [{ new_string: 'rm -rf x', old_string: 'ls' }],
        file_path: '/repo/x.sh',
        tool: 'MultiEdit',
    } as never);
    expect(JSON.stringify(await bash($, 'bash x.sh'))).toContain(WARNED);
});

test('a written script longer than the guard keeps still warns when run', async ($, on) => {
    world(on);
    await write($, '/repo/x.sh', `${'echo a\n'.repeat(6000)}rm -rf x\n`);
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
