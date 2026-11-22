import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK = join(import.meta.dirname, 'permission-request-bypass-allow.py');
const zshJoin = 'arr=(alpha beta); echo "probe 684: ${(j:,:)arr}"';

// the hook's stdout and the log lines it wrote for one permission request
const ask = (command: string, over: Record<string, unknown> = {}, logPath?: string) => {
    const log = logPath ?? join(mkdtempSync(join(tmpdir(), 'pr-allow-')), 'allows.jsonl');
    const stdout = execFileSync('python3', [HOOK], {
        encoding: 'utf8',
        env: { ...process.env, PERMISSION_ALLOW_LOG: log },
        input: JSON.stringify({
            hook_event_name: 'PermissionRequest',
            permission_mode: 'bypassPermissions',
            session_id: 'pr-allow-test',
            tool_input: { command },
            tool_name: 'Bash',
            ...over,
        }),
        timeout: 10_000,
    });
    const logged = (() => {
        try {
            return readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
        } catch {
            return [];
        }
    })();

    return { logged, stdout };
};

describe('allows', () => {
    it('answers allow for a Bash call in bypass, in cc\'s decision shape', () => {
        expect(JSON.parse(ask(zshJoin).stdout)).toEqual({
            hookSpecificOutput: { decision: { behavior: 'allow' }, hookEventName: 'PermissionRequest' },
        });
    });

    it('logs the time, the session and the first 120 characters of each allow', () => {
        const { logged } = ask(`${zshJoin} # ${'x'.repeat(200)}`);

        expect(logged).toHaveLength(1);
        expect(logged[0]).toMatchObject({ session: 'pr-allow-test' });
        expect(logged[0].command).toBe(`${zshJoin} # ${'x'.repeat(200)}`.slice(0, 120));
        expect(Date.parse(logged[0].time)).not.toBeNaN();
    });

    it('still allows when the log cannot be written, since the log is a count and not a gate', () => {
        expect(ask(zshJoin, {}, '/dev/null/sub/allows.jsonl').stdout).not.toBe('');
    });

    it.each([
        ['an fd duplication', 'echo hi 2>&1'],
        ['a /dev/null target', 'echo hi >/dev/null 2>/dev/null'],
        ['an append', 'echo hi >> out.log'],
        ['a plain read', 'cat file | wc -l'],
        ['reset as the word of another command in the line', 'git status && echo reset'],
    ])('allows %s, which cannot truncate', (_name, command) => {
        expect(ask(command).stdout).not.toBe('');
    });
});

describe('stays silent, so the dialog stands', () => {
    it.each([
        ['default mode', zshJoin, { permission_mode: 'default' }],
        ['acceptEdits mode', zshJoin, { permission_mode: 'acceptEdits' }],
        ['a non-Bash tool', zshJoin, { tool_name: 'Write' }],
        ['an empty command', '', {}],
    ])('on %s', (_name, command, over) => {
        const { logged, stdout } = ask(command, over);

        expect(stdout).toBe('');
        expect(logged).toEqual([]);
    });

    it.each([
        ['rm', 'rm -rf build'],
        ['rm behind the zsh flag that asks', `${zshJoin}; rm out`],
        ['rm by absolute path', '/bin/rm file'],
        ['rmdir', 'rmdir dir'],
        ['unlink', 'unlink file'],
        ['shred', 'shred file'],
        ['truncate', 'truncate -s 0 file'],
        ['trash', 'trash file'],
        ['find -delete', 'find . -name "*.tmp" -delete'],
        ['find -delete on the next line', 'find .\n  -name x -delete'],
        ['kill', 'kill 123'],
        ['pkill', 'pkill node'],
        ['killall', 'killall node'],
        ['git reset', 'git reset --hard HEAD~1'],
        ['git reset behind a -C flag', 'git -C repo reset --hard'],
        ['git clean', 'git clean -fd'],
        ['a truncating redirect', 'echo hi > file'],
        ['a truncating redirect with no space', `${zshJoin} >file`],
        ['a stderr truncation', 'cmd 2> err.log'],
        ['a clobber redirect', 'echo hi >| file'],
        ['a target that only starts like /dev/null', 'echo hi >/dev/nullx'],
        ['a process substitution output', 'tee >(cat)'],
    ])('on %s', (_name, command) => {
        const { logged, stdout } = ask(command);

        expect(stdout).toBe('');
        expect(logged).toEqual([]);
    });
});
