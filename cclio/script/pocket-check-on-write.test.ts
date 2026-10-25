import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../.claude/hooks/pocket-check-on-write.sh',
);

function run(event: object, check: string) {
    const out = spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: { ...process.env, POCKET_CHECK_CMD: check },
        input: JSON.stringify(event),
    }).stdout.trim();
    return out
        ? (JSON.parse(out) as { decision: string; reason: string })
        : undefined;
}

const fixtures = mkdtempSync(join(tmpdir(), 'pocket-check-hook-'));
const redCmd = join(fixtures, 'red.sh');
writeFileSync(
    redCmd,
    "#!/bin/sh\nprintf '🔴 PK-1: waiting without a first line\\n'\nexit 1\n",
    { mode: 0o755 },
);
const bash = (command: string) => ({
    tool_input: { command },
    tool_name: 'Bash',
});

describe('pocket-check on a pocket write', () => {
    test('a backlog create with a red pocket blocks with the red line', () => {
        const out = run(bash('backlog task create "x" -s waiting'), redCmd);
        expect(out?.decision).toBe('block');
        expect(out?.reason).toContain('🔴 PK-1');
    });

    test('a backlog edit and an Edit of a task file both fire', () => {
        expect(
            run(bash('backlog task edit 74 -s done'), redCmd)?.decision,
        ).toBe('block');
        const edit = {
            tool_input: { file_path: '/x/cclio/pocket/tasks/pk-1 - a.md' },
            tool_name: 'Edit',
        };
        expect(run(edit, redCmd)?.decision).toBe('block');
    });

    test('a green pocket passes', () => {
        expect(run(bash('backlog task create "x"'), 'true')).toBe(undefined);
    });

    test.each([
        'backlog task archive PK-1',
        'mv cclio/pocket/tasks/a.md cclio/pocket/archive/tasks/',
        'trash cclio/pocket/tasks/a.md',
        "sed -i '' s/a/b/ cclio/pocket/tasks/a.md",
        'git restore cclio/pocket/tasks/a.md',
        "perl -pi -e 's/a/b/' cclio/pocket/tasks/a.md",
    ])('the write verb «%s» blocks on a red pocket', (command) => {
        expect(run(bash(command), redCmd)?.decision).toBe('block');
    });

    test('an Edit of a pocket archive file blocks', () => {
        const edit = {
            tool_input: {
                file_path: '/x/cclio/pocket/archive/tasks/pk-1 - a.md',
            },
            tool_name: 'Edit',
        };
        expect(run(edit, redCmd)?.decision).toBe('block');
    });

    test.each([
        'grep -c x cclio/pocket/tasks/a.md',
        'cat cclio/pocket/tasks/a.md',
        "awk '$1 > 3' cclio/pocket/tasks/a.md",
        'ls cclio/pocket/tasks 2>&1',
    ])('the read «%s» stays silent on a red pocket', (command) => {
        expect(run(bash(command), redCmd)).toBe(undefined);
    });

    test('a green check never blocks a write verb', () => {
        expect(run(bash('backlog task archive PK-1'), 'true')).toBe(undefined);
    });

    test('a write outside the pocket never runs the check', () => {
        expect(run(bash('backlog task list --plain'), redCmd)).toBe(undefined);
        expect(
            run(
                {
                    tool_input: { file_path: '/x/notes.md' },
                    tool_name: 'Write',
                },
                redCmd,
            ),
        ).toBe(undefined);
    });
});
