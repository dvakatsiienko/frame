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
