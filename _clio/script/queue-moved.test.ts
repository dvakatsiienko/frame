import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgottenLines, isQueueMove } from './queue-moved.ts';

describe('isQueueMove, a run that moves the queue', () => {
    test.each([
        'x lane dispatch FRM-1 --apply',
        'x lane landed FRM-2 --apply',
        'cd /tmp && x lane landed FRM-2 --apply',
        'timeout 60 x lane dispatch FRM-1 --apply',
        '~/.local/bin/x lane dispatch FRM-1 --apply',
        'x lane dispatch FRM-1 \\\n  --apply',
        'x linear set FRM-1 --state Done',
        'x linear set FRM-1 --state="In Progress"',
        'x linear set FRM-1 --milestone "m 2"',
        'x linear set FRM-1 --before FRM-2',
        'x linear set FRM-1 --after FRM-2',
        'if true; then :; else x linear link FRM-1 blocks FRM-2; fi',
        'f=$(x linear body FRM-1 --set f.md)',
        '( x linear link FRM-1 blocks FRM-2 )',
        'timeout 60s x linear set FRM-1 --state Todo',
        'x linear set FRM-1 --add-label signed',
        'x linear set FRM-1 --add-label "signed"',
        'x linear link FRM-1 blocks FRM-2',
        'x linear body FRM-1 --set "new text"',
        'for t in FRM-1 FRM-2; do x linear set $t --state Done; done',
        'echo go\nx linear link FRM-1 blocks FRM-2',
        'x linear read FRM-1 | cat; x lane landed FRM-3 --apply',
    ])('%j is a move', (command) => {
        expect(isQueueMove(command)).toBe(true);
    });
});

describe('isQueueMove, a run that leaves the queue alone', () => {
    test.each([
        ['a dry run of a dispatch', 'x lane dispatch FRM-1'],
        ['a dry run of a landing', 'x lane landed FRM-1 --json'],
        ['a set of a field the queue ignores', 'x linear set FRM-1 --title t'],
        ['a label that is no sign', 'x linear set FRM-1 --add-label bug'],
        ['a read of a body', 'x linear body FRM-1'],
        ['a read of a ticket', 'x linear read FRM-1 --relations'],
        [
            'the sign stamp, a file only',
            'node _clio/script/ticket-sign.ts FRM-1 signed',
        ],
        ['a grep naming a move', 'grep -n "x linear set --state" _clio/memory'],
        ['an rg naming a move', "rg 'x lane dispatch FRM-1 --apply' _clio"],
        ['a sed naming a move', "sed -n 's/x linear link/y/p' notes.md"],
        ['a cat of a file named so', 'cat x-linear-set--state.md'],
        ['an echo of a move', 'echo "x linear link FRM-1 blocks FRM-2"'],
        [
            'a separator inside quotes',
            'echo "ok && x lane landed FRM-1 --apply"',
        ],
        ['a flag inside quotes', 'x linear set FRM-1 --title "a --state b"'],
        [
            'a line inside a quoted message',
            'git commit -m "fix\nx linear set FRM-1 --state Done"',
        ],
        [
            'a line inside a heredoc',
            'git commit -m "$(cat <<\'EOF\'\nx lane landed FRM-1 --apply\nEOF\n)"',
        ],
        ['a move as an argument', 'echo x linear link a b'],
    ])('%s', (_name, command) => {
        expect(isQueueMove(command)).toBe(false);
    });
});

describe('forgottenLines', () => {
    test('keeps a red line of a lane with a live or parked member, only', () => {
        const live = '🔴 mods — 1 FRM-2 unsigned · member live a — sign (clio)';
        const parked =
            '🔴 herdr — 1 none queued · member parked, handoff h — queue one (clio)';
        expect(
            forgottenLines([
                live,
                parked,
                '🔴 speak — 1 none queued · member none: summon at boot — queue one (clio)',
                '🔴 FRM-9 (none) — re-sign (clio), or a ✏️ changed line before dispatch',
                '🟢 cli — 1 FRM-1 sealed · member live b',
                '🟡 mods — not checked: x linear read FRM-9',
            ]),
        ).toEqual([live, parked]);
    });
});

describe('the entry', () => {
    const run = (event: unknown) => {
        const home = mkdtempSync(join(tmpdir(), 'queue-moved-'));
        const out = spawnSync(
            'node',
            [join(import.meta.dirname, 'queue-moved.ts')],
            {
                encoding: 'utf8',
                env: { ...process.env, HOME: home },
                input: JSON.stringify(event),
                timeout: 20_000,
            },
        );
        return {
            out,
            stamp: existsSync(join(home, '.local/state/clio/queue-moved')),
        };
    };

    test.each([
        ['a command that is no move', 'Bash', 'ls -la'],
        [
            'a move told by a tool that is no Bash',
            'Edit',
            'x lane landed FRM-1 --apply',
        ],
    ])(
        '%s exits 0, prints nothing and writes no state',
        (_name, tool, command) => {
            const { out, stamp } = run({
                tool_input: { command },
                tool_name: tool,
            });
            expect(out.status).toBe(0);
            expect(out.stdout).toBe('');
            expect(stamp).toBe(false);
        },
    );
});
