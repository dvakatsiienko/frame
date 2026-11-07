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
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { gitEnv } from '../../script/lib/git-fixture.ts';

const fixtures = mkdtempSync(join(tmpdir(), 'pocket-check-hook-'));
// a throwaway frame: the hook copy two dirs under a git root, so it never reads or commits the real one
const frame = join(fixtures, 'frame');
const hook = join(frame, '_clio/.claude/hooks/pocket-check-on-write.sh');
mkdirSync(join(frame, '_clio/.claude/hooks'), { recursive: true });
mkdirSync(join(frame, '_clio/pocket/tasks'), { recursive: true });
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
    `#!/bin/sh\ncp "$1" "${argvLog}.msg"\nfor a in "$@"; do printf '%s\\n' "$a"; done > "${argvLog}.tmp"\nmv "${argvLog}.tmp" "${argvLog}"\n`,
    { mode: 0o755 },
);

const refusingStub = join(fixtures, 'refusing-stub.sh');
writeFileSync(refusingStub, '#!/bin/sh\necho "gate red" >&2\nexit 1\n', {
    mode: 0o755,
});
const emptyStub = join(fixtures, 'empty-stub.sh');
writeFileSync(
    emptyStub,
    '#!/bin/sh\necho \'{"error":"nothing staged under those paths — empty diff, no commit","ok":false}\'\nexit 1\n',
    { mode: 0o755 },
);
const slowStub = join(fixtures, 'slow-stub.sh');
writeFileSync(slowStub, '#!/bin/sh\nsleep 3\n', { mode: 0o755 });
const lastCommit = join(fixtures, '.local/state/clio/pocket-commits/last');
const seenReds = join(fixtures, '.local/state/clio/pocket-reds-seen');

function run(
    event: object,
    check: string,
    commit = commitStub,
    home = fixtures,
    isFirstRed = true,
) {
    rmSync(argvLog, { force: true });
    // each id blocks once, so a test starts from an empty seen file unless it is the repeat
    if (isFirstRed) rmSync(seenReds, { force: true });
    const out = spawnSync('bash', [hook], {
        encoding: 'utf8',
        env: {
            ...gitEnv(),
            HOME: home,
            POCKET_CHECK_CMD: check,
            POCKET_COMMIT_CMD: commit,
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
    for (let wait = 0; wait < 400 && !existsSync(argvLog); wait += 1)
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
            tool_input: { file_path: '/x/_clio/pocket/tasks/pk-1 - a.md' },
            tool_name: 'Edit',
        };
        expect(run(edit, redCmd)?.decision).toBe('block');
    });

    test('a slow commit leaves the hook its stdout, so a red block reaches cc at once', () => {
        const task = join(frame, '_clio/pocket/tasks/pk-2 - slow.md');
        writeFileSync(task, 'x\n');
        const start = Date.now();
        // its own home: the commit outlives the test and writes its state file, which the other tests read
        const out = run(
            bash('backlog task edit 2'),
            redCmd,
            slowStub,
            join(fixtures, 'slow-home'),
        );
        const took = Date.now() - start;
        rmSync(task);
        expect(out?.decision).toBe('block');
        expect(took).toBeLessThan(1500);
    });

    test('a green pocket passes', () => {
        expect(run(bash('backlog task create "x"'), 'true')).toBe(undefined);
    });

    test.each([
        'backlog task archive PK-1',
        'mv _clio/pocket/tasks/a.md _clio/pocket/archive/tasks/',
        'trash _clio/pocket/tasks/a.md',
        "sed -i '' s/a/b/ _clio/pocket/tasks/a.md",
        'git restore _clio/pocket/tasks/a.md',
        "perl -pi -e 's/a/b/' _clio/pocket/tasks/a.md",
        'git clean -fd _clio/pocket/tasks',
        'find _clio/pocket/tasks -name "pk-9*" -delete',
        'git stash push -- _clio/pocket',
    ])('the write verb «%s» blocks on a red pocket', (command) => {
        expect(run(bash(command), redCmd)?.decision).toBe('block');
    });

    test('an Edit of a pocket archive file blocks', () => {
        const edit = {
            tool_input: {
                file_path: '/x/_clio/pocket/archive/tasks/pk-1 - a.md',
            },
            tool_name: 'Edit',
        };
        expect(run(edit, redCmd)?.decision).toBe('block');
    });

    test.each([
        'grep -c x _clio/pocket/tasks/a.md',
        'cat _clio/pocket/tasks/a.md',
        "awk '$1 > 3' _clio/pocket/tasks/a.md",
        'ls _clio/pocket/tasks 2>&1',
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

describe('a pocket red blocks its owner, once per id', () => {
    const item = join(frame, '_clio/pocket/tasks/pk-1 - owned.md');
    const itemWith = (label: string) =>
        writeFileSync(item, `---\nid: PK-1\nlabels:\n  - s\n${label}---\n`);
    const redWith = (text: string) => {
        const cmd = join(fixtures, `red-${text}.sh`);
        writeFileSync(
            cmd,
            `#!/bin/sh\nprintf '🔴 PK-1: ${text}\\n🔴 PK-3: loose\\n'\nexit 1\n`,
            { mode: 0o755 },
        );
        return cmd;
    };
    const write = bash('backlog task edit 3 -s done');

    test("a red on a wing's item does not block the main, an unlabelled item's red still does", () => {
        itemWith('  - clio-wing-2\n');
        const out = run(write, redWith('a'));
        rmSync(item);
        expect(out?.reason).toContain('PK-3');
        expect(out?.reason).not.toContain('PK-1');
    });

    test('a red on the main-labelled item blocks the main', () => {
        itemWith('  - clio-main\n');
        const out = run(write, redWith('a'));
        rmSync(item);
        expect(out?.reason).toContain('PK-1: a');
    });

    describe('in a wing', () => {
        const sessions = join(fixtures, '.claude/sessions');
        const seat = (name: string, kind = 'interactive') => {
            mkdirSync(sessions, { recursive: true });
            writeFileSync(
                join(sessions, 'seat.json'),
                JSON.stringify({ kind, name, sessionId: 'sid-seat' }),
            );
        };
        const asSeat = { ...write, session_id: 'sid-seat' };

        test('its own item blocks it, once', () => {
            seat('🦉🪽 clio: wing 2');
            itemWith('  - clio-wing-2\n');
            const out = run(asSeat, redWith('a'));
            const repeat = run(
                asSeat,
                redWith('a'),
                commitStub,
                fixtures,
                false,
            );
            rmSync(item);
            rmSync(sessions, { recursive: true });
            expect(out?.reason).toContain('PK-1: a');
            expect(repeat?.reason ?? '').not.toContain('PK-1');
        });

        test("another wing's item leaves it alone", () => {
            seat('🦉🪽 clio: wing 2');
            itemWith('  - clio-wing-1\n');
            const out = run(asSeat, redWith('a'));
            rmSync(item);
            rmSync(sessions, { recursive: true });
            expect(out?.reason ?? '').not.toContain('PK-1');
        });

        test("an unlabelled item is main's, not a wing's", () => {
            seat('🦉🪽 clio: wing 2');
            itemWith('');
            const out = run(asSeat, redWith('a'));
            rmSync(item);
            rmSync(sessions, { recursive: true });
            expect(out?.reason ?? '').not.toContain('PK-1');
        });

        test('a parked sidecar is never blocked', () => {
            seat('🎀 helga', 'bg');
            itemWith('');
            const out = run(asSeat, redWith('a'));
            rmSync(item);
            rmSync(sessions, { recursive: true });
            expect(out).toBe(undefined);
        });
    });

    test('a red blocks once, and again when its text changes', () => {
        itemWith('  - clio-main\n');
        expect(run(write, redWith('a'))?.reason).toContain('PK-1: a');
        const repeat = run(write, redWith('a'), commitStub, fixtures, false);
        const changed = run(write, redWith('b'), commitStub, fixtures, false);
        rmSync(item);
        expect(repeat).toBe(undefined);
        expect(changed?.reason).toContain('PK-1: b');
        expect(changed?.reason).not.toContain('PK-3');
    });
});

describe('the pocket hook commits every pocket write', () => {
    const task = '_clio/pocket/tasks/pk-7 — a b.md';

    test('a pocket write calls the commit with the changed path as one argument', () => {
        writeFileSync(join(frame, task), 'x');
        run(bash('backlog task edit 7 -s done'), 'true');
        const argv = stubArgv();
        expect(argv?.slice(1)).toEqual(['--', task]);
        expect(readFileSync(`${argvLog}.msg`, 'utf8')).toContain(
            '📜 pocket: pk-7 (auto)',
        );
    });

    test('the commit message file is gone once the commit ran', () => {
        writeFileSync(join(frame, task), 'x');
        run(bash('backlog task edit 7 -s done'), 'true');
        const message = stubArgv()?.[0] ?? '';
        const pause = new Int32Array(new SharedArrayBuffer(4));
        for (let wait = 0; wait < 400 && existsSync(message); wait += 1)
            Atomics.wait(pause, 0, 0, 50);
        expect(existsSync(message)).toBe(false);
    });

    test('a red check still blocks and still commits', () => {
        writeFileSync(join(frame, task), 'x');
        expect(run(bash('backlog task edit 7 -s done'), redCmd)?.decision).toBe(
            'block',
        );
        expect(stubArgv()?.slice(1)).toEqual(['--', task]);
    });

    test.each([
        'node script/pocket-add.ts "a wish" -d x --size s',
        'node script/pocket-move.ts PK-7 now',
    ])('the pocket door «%s» calls the commit', (command) => {
        writeFileSync(join(frame, task), 'x');
        run(bash(command), 'true');
        expect(stubArgv()?.slice(1)).toEqual(['--', task]);
    });

    test('a refused commit reds the next pocket write on a green pocket', () => {
        writeFileSync(join(frame, task), 'x');
        rmSync(lastCommit, { force: true });
        run(bash('backlog task edit 7 -s done'), 'true', refusingStub);
        const pause = new Int32Array(new SharedArrayBuffer(4));
        for (let wait = 0; wait < 400 && !existsSync(lastCommit); wait += 1)
            Atomics.wait(pause, 0, 0, 50);
        const out = run(bash('backlog task edit 7 -s done'), 'true');
        expect(out?.reason).toContain('auto-commit was refused');
        rmSync(lastCommit, { force: true });
    });

    test('an empty diff another writer already committed stays green', () => {
        writeFileSync(join(frame, task), 'x');
        rmSync(lastCommit, { force: true });
        run(bash('backlog task edit 7 -s done'), 'true', emptyStub);
        const pause = new Int32Array(new SharedArrayBuffer(4));
        for (let wait = 0; wait < 400 && !existsSync(lastCommit); wait += 1)
            Atomics.wait(pause, 0, 0, 50);
        expect(readFileSync(lastCommit, 'utf8').trim()).toBe('ok');
        rmSync(lastCommit, { force: true });
    });

    test('a read never calls the commit', () => {
        writeFileSync(join(frame, task), 'x');
        const state = dirname(lastCommit);
        rmSync(state, { force: true, recursive: true });
        // a red check blocks before the commit step, so no block means the hook left before both
        expect(run(bash('grep -c x _clio/pocket/tasks/*.md'), redCmd)).toBe(
            undefined,
        );
        // the commit step makes this dir before it detaches, so its absence is proof with no wait
        expect(existsSync(state)).toBe(false);
    });
});
