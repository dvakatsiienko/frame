import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../../home/.claude/shelf/hooks/memory-load-rule-lazy.py',
);
const ruleHead = '# Linear flow';

function session() {
    const dir = mkdtempSync(join(tmpdir(), 'memory-load-'));
    const id = randomUUID();
    const log = join(dir, 'log.tsv');

    function run(event: Record<string, unknown>) {
        const result = spawnSync('python3', [hook], {
            encoding: 'utf8',
            env: { ...process.env, MEMORY_LOAD_LOG: log },
            input: JSON.stringify({ cwd: '/work', session_id: id, ...event }),
        });
        const out: HookOutput = result.stdout
            ? JSON.parse(result.stdout).hookSpecificOutput
            : {};
        return out;
    }

    return {
        bash: (command: string) =>
            run({
                hook_event_name: 'PreToolUse',
                tool_input: { command },
                tool_name: 'Bash',
            }),
        compact: () =>
            run({ hook_event_name: 'SessionStart', source: 'compact' }),
        dir,
        id,
        logLines: () =>
            existsSync(log)
                ? readFileSync(log, 'utf8')
                      .split('\n')
                      .filter(Boolean)
                      .map((line) => line.split('\t').slice(3).join(' '))
                : [],
        prompt: (prompt: string) =>
            run({ hook_event_name: 'UserPromptSubmit', prompt }),
        run,
        stop: (content: object[], lastMessage?: string) => {
            const transcript = join(dir, 'session.jsonl');
            writeFileSync(
                transcript,
                [
                    { message: { content: 'ask', role: 'user' }, type: 'user' },
                    {
                        message: {
                            content,
                            role: 'assistant',
                        },
                        type: 'assistant',
                    },
                ]
                    .map((line) => JSON.stringify(line))
                    .join('\n'),
            );
            return run({
                hook_event_name: 'Stop',
                last_assistant_message: lastMessage,
                transcript_path: transcript,
            });
        },
    };
}

describe('memory-load-rule-lazy', () => {
    it('loads linear-flow when the prompt names a ticket', () => {
        const s = session();
        expect(s.prompt('look at FRM-12').additionalContext).toContain(
            ruleHead,
        );
        expect(s.logLines()).toEqual(['load linear-flow by prompt FRM-12']);
    });

    it('passes a prompt with no ticket', () => {
        expect(session().prompt('tidy the readme')).toEqual({});
    });

    it.each([
        'linear issue view FRM-12',
        'timeout 30 linear issue view FRM-12',
        'cd ~/frame && git commit -F msg.txt -- a.ts',
        'git -C ~/frame commit -F msg.txt',
        'gh -R a/b pr create --title x',
        'x lane commit "msg" -- a.ts',
    ])('refuses the first `%s` with the rule attached', (command) => {
        const out = session().bash(command);
        expect(out.permissionDecision).toBe('deny');
        expect(out.permissionDecisionReason).toContain(ruleHead);
    });

    it.each(['grep -rn linear docs', 'git help commit', 'git commit-tree abc'])(
        'passes `%s`, which only names a trigger word',
        (command) => {
            expect(session().bash(command)).toEqual({});
        },
    );

    it('passes an edit that removes a ticket line', () => {
        const out = session().run({
            hook_event_name: 'PreToolUse',
            tool_input: { new_string: '', old_string: '- ticket: FRM-12\n' },
            tool_name: 'Edit',
        });
        expect(out).toEqual({});
    });

    it('loads a subagent apart from its parent', () => {
        const s = session();
        s.run({
            agent_id: 'sub',
            hook_event_name: 'PreToolUse',
            tool_input: { command: 'linear issue view FRM-12' },
            tool_name: 'Bash',
        });
        expect(s.bash('linear issue view FRM-12').permissionDecision).toBe(
            'deny',
        );
    });

    it('refuses a write that carries a ticket line', () => {
        const out = session().run({
            hook_event_name: 'PreToolUse',
            tool_input: {
                content: 'step 1\n\n- ticket: FRM-12\n',
                file_path: '/x',
            },
            tool_name: 'Write',
        });
        expect(out.permissionDecision).toBe('deny');
    });

    it('passes the retry after a refusal', () => {
        const s = session();
        s.bash('linear issue view FRM-12');
        expect(s.bash('linear issue view FRM-12')).toEqual({});
    });

    it('loads once per session', () => {
        const s = session();
        s.prompt('look at FRM-12');
        expect(s.bash('linear issue view FRM-12')).toEqual({});
    });

    it('reloads at a compaction', () => {
        const s = session();
        s.prompt('look at FRM-12');
        expect(s.compact().additionalContext).toContain(ruleHead);
    });

    it('loads nothing at the compaction of a session that never loaded', () => {
        expect(session().compact()).toEqual({});
    });

    it('clears the path loader marks on a compaction', () => {
        const s = session();
        const marks = join(tmpdir(), 'cc-memory-load-agents-md');
        mkdirSync(marks, { recursive: true });
        writeFileSync(join(marks, s.id), '/repo/AGENTS.md\n');
        s.compact();
        expect(readFileSync(join(marks, s.id), 'utf8')).toBe('');
    });

    it('loads linear-flow at the start of a cclio session', () => {
        const out = session().run({
            cwd: '/Users/dima/frame/cclio',
            hook_event_name: 'SessionStart',
            source: 'startup',
        });
        expect(out.additionalContext).toContain(ruleHead);
    });

    it('loads nothing at the start of a session elsewhere', () => {
        const out = session().run({
            cwd: '/Users/dima/frame',
            hook_event_name: 'SessionStart',
            source: 'startup',
        });
        expect(out).toEqual({});
    });

    it('logs a miss when a reply names a ticket before any load', () => {
        const s = session();
        s.stop([reply('closed FRM-12 today')]);
        expect(s.logLines()).toEqual(['miss linear-flow FRM-12']);
    });

    it('logs a miss from the stop event when the transcript lags', () => {
        const s = session();
        s.stop([reply('working')], 'closed FRM-12 today');
        expect(s.logLines()).toEqual(['miss linear-flow FRM-12']);
    });

    it('logs a miss for a ticket line in a call the hook never sees', () => {
        const s = session();
        s.stop([
            {
                input: { prompt: 'step 1\n- ticket: FRM-12' },
                name: 'Agent',
                type: 'tool_use',
            },
        ]);
        expect(s.logLines()).toEqual(['miss linear-flow - ticket:']);
    });

    it('logs no miss after a load', () => {
        const s = session();
        s.prompt('look at FRM-12');
        s.stop([reply('closed FRM-12 today')]);
        expect(s.logLines()).toEqual(['load linear-flow by prompt FRM-12']);
    });
});

function reply(text: string) {
    return { text, type: 'text' };
}

/* Types */
interface HookOutput {
    additionalContext?: string;
    permissionDecision?: string;
    permissionDecisionReason?: string;
}
