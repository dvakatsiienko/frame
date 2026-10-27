import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';

const fixtures = mkdtempSync(join(tmpdir(), 'pocket-check-hook-'));
// a throwaway frame: the hook copy two dirs under a git root, so it never reads or commits the real one
const frame = join(fixtures, 'frame');
const hook = join(frame, 'cclio/.claude/hooks/pocket-check-on-write.sh');
mkdirSync(join(frame, 'cclio/.claude/hooks'), { recursive: true });
mkdirSync(join(frame, 'cclio/pocket/tasks'), { recursive: true });
copyFileSync(
    join(import.meta.dirname, '../.claude/hooks/pocket-check-on-write.sh'),
    hook,
);
// a commit gate runs this test inside a git hook, whose GIT_DIR would point every git call at the real repo
spawnSync('git', ['init', '-q'], { cwd: frame, env: gitEnv() });
const argvLog = join(fixtures, 'argv.txt');
const commitStub = join(fixtures, 'commit-stub.sh');
writeFileSync(
    commitStub,
    `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done > "${argvLog}.tmp"\nmv "${argvLog}.tmp" "${argvLog}"\n`,
    { mode: 0o755 },
);

function run(event: object, check: string) {
    rmSync(argvLog, { force: true });
    const out = spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: {
            ...gitEnv(),
            HOME: fixtures,
            POCKET_CHECK_CMD: check,
            POCKET_COMMIT_CMD: commitStub,
        },
        input: JSON.stringify(event),
    }).stdout.trim();
    return out
        ? (JSON.parse(out) as { decision: string; reason: string })
        : undefined;
}

// the commit runs detached, so the stub's record lands after the hook returned
function stubArgv(): string[] | undefined {
    const pause = new Int32Array(new SharedArrayBuffer(4));
    for (let wait = 0; wait < 40 && !existsSync(argvLog); wait += 1)
        Atomics.wait(pause, 0, 0, 50);
    return existsSync(argvLog)
        ? readFileSync(argvLog, 'utf8').trimEnd().split('\n')
        : undefined;
}

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
        'git clean -fd cclio/pocket/tasks',
        'find cclio/pocket/tasks -name "pk-9*" -delete',
        'git stash push -- cclio/pocket',
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

describe('the pocket hook commits every pocket write', () => {
    const task = 'cclio/pocket/tasks/pk-7 — a b.md';

    test('a pocket write calls the commit with the changed path as one argument', () => {
        writeFileSync(join(frame, task), 'x');
        run(bash('backlog task edit 7 -s done'), 'true');
        const argv = stubArgv();
        expect(argv?.slice(1)).toEqual(['--', task]);
        expect(readFileSync(argv?.[0] ?? '', 'utf8')).toContain(
            '📜 pocket: pk-7 (auto)',
        );
    });

    test('a red check still blocks and still commits', () => {
        writeFileSync(join(frame, task), 'x');
        expect(run(bash('backlog task edit 7 -s done'), redCmd)?.decision).toBe(
            'block',
        );
        expect(stubArgv()?.slice(1)).toEqual(['--', task]);
    });

    test('a read never calls the commit', () => {
        writeFileSync(join(frame, task), 'x');
        run(bash('grep -c x cclio/pocket/tasks/*.md'), redCmd);
        expect(stubArgv()).toBe(undefined);
    });
});
