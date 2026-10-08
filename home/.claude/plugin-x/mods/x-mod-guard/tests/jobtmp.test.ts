import type { On } from 'claude-code';
import { type Engine, expect, mock, test } from 'claude-code/testing';

const JOB = '/home/.claude/jobs/j1';

// files: the absolute paths on disk, every one a file
function world(on: On, files: string[]) {
    mock.clock(on, { now: 1_000_000 });
    mock.store(on);
    const ran: string[] = [];
    on('session.id', () => ({ value: 'a1a1a1a1-0000' }));
    on('session.cwd', () => ({ value: '/repo' }));
    on('env.get', (_$, e) => ({
        value: e.name === 'CLAUDE_JOB_DIR' ? JOB : '/home',
    }));
    on('fs.exists', (_$, e) => ({ value: files.includes(e.path) }));
    on('fs.stat', () => ({
        value: { isLink: false, kind: 'file', mtimeMs: 0, size: 1 },
    }));
    on('tool.call', (_$, e) => {
        ran.push('command' in e ? String(e.command) : '');
        return { result: {}, text: 'ran' };
    });
    return { ran };
}

const bash = ($: Engine, command: string) =>
    $.tool.call({ command, tool: 'Bash' });

// shape, command, the file on disk it writes over
const RUNS = [
    [
        'a heredoc over a script',
        'cat > "$CLAUDE_JOB_DIR/tmp/s.sh" <<\'EOF\'\necho hi\nEOF',
        `${JOB}/tmp/s.sh`,
    ],
    [
        'a script by path over its own log',
        'sh $CLAUDE_JOB_DIR/tmp/gate.sh > $CLAUDE_JOB_DIR/tmp/gate.log 2>&1',
        `${JOB}/tmp/gate.log`,
    ],
    [
        'a > after a cd into the tmp',
        `cd ${JOB}/tmp/v1 && jq . in.json > out.json`,
        `${JOB}/tmp/v1/out.json`,
    ],
    ['an mv onto a tmp file', `mv ${JOB}/tmp/a ${JOB}/tmp/b`, `${JOB}/tmp/b`],
] as const;

for (const [shape, command, file] of RUNS)
    test(`${shape} in the job's own tmp runs`, async ($, on) => {
        const w = world(on, [file, `${JOB}/tmp/a`]);
        const r = await bash($, command);
        expect(r.deny).toBeUndefined();
        expect(w.ran).toEqual([command]);
    });

const REFUSED = [
    ['a repo path', 'echo x > /repo/a.ts', '/repo/a.ts'],
    [
        'a climb out of the tmp',
        'echo x > $CLAUDE_JOB_DIR/tmp/../keep.txt',
        `${JOB}/keep.txt`,
    ],
    [
        "another job's tmp",
        'echo x > /home/.claude/jobs/j2/tmp/a.log',
        '/home/.claude/jobs/j2/tmp/a.log',
    ],
] as const;

for (const [shape, command, file] of REFUSED)
    test(`a > over ${shape} is still refused`, async ($, on) => {
        const w = world(on, [file]);
        expect((await bash($, command)).deny).toContain('>> to append');
        expect(w.ran).toEqual([]);
    });
