import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    chmodSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = join(
    import.meta.dirname,
    '../../home/.claude/shelf/hooks/memory-load-rule-lazy.py',
);
const rules = join(import.meta.dirname, '../../home/.claude/rules-lazy');
const scripts = join(import.meta.dirname, '..');
const ruleHead = '# linear flow';

function session(hookPath = hook) {
    const dir = mkdtempSync(join(tmpdir(), 'memory-load-'));
    const id = randomUUID();
    const log = join(dir, 'log.tsv');

    function spawnHook(
        event: Record<string, unknown>,
        env: Record<string, string> = {},
    ) {
        return spawnSync('python3', [hookPath], {
            encoding: 'utf8',
            env: {
                ...surfaceFree(),
                MEMORY_LOAD_LOG: log,
                TMPDIR: dir,
                ...env,
            },
            input: JSON.stringify({ cwd: '/work', session_id: id, ...event }),
            timeout: 10_000,
        });
    }

    function run(
        event: Record<string, unknown>,
        env: Record<string, string> = {},
    ) {
        const result = spawnHook(event, env);
        const out: HookOutput = result.stdout
            ? JSON.parse(result.stdout).hookSpecificOutput
            : {};
        return out;
    }

    function transcript(entries: unknown[], name = 'session.jsonl') {
        const path = join(dir, name);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(
            path,
            entries
                .map((line) =>
                    typeof line === 'string' ? line : JSON.stringify(line),
                )
                .join('\n'),
        );
        return path;
    }

    function tool(
        toolName: string,
        toolInput: Record<string, unknown>,
        extra: Record<string, unknown> = {},
    ) {
        return run({
            hook_event_name: 'PreToolUse',
            tool_input: toolInput,
            tool_name: toolName,
            ...extra,
        });
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
        edit: (filePath: string, extra: Record<string, unknown> = {}) =>
            tool(
                'Edit',
                { file_path: filePath, new_string: 'b', old_string: 'a' },
                extra,
            ),
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
        spawnHook,
        stop: (content: object[], lastMessage?: string) =>
            run({
                hook_event_name: 'Stop',
                last_assistant_message: lastMessage,
                transcript_path: transcript([
                    { message: { content: 'ask', role: 'user' }, type: 'user' },
                    {
                        message: { content, role: 'assistant' },
                        type: 'assistant',
                    },
                ]),
            }),
        tool,
        transcript,
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
        'gh -R a/b pr create --title x',
        'x lane pr-open --title x',
    ])('refuses the first `%s` with the rule attached', (command) => {
        const out = session().bash(command);
        expect(out.permissionDecision).toBe('deny');
        expect(out.permissionDecisionReason).toContain(ruleHead);
    });

    it.each([
        'grep -rn linear docs',
        'git help commit',
        'git commit-tree abc',
        'cd ~/frame && git commit -F msg.txt -- a.ts',
        'x lane commit "msg" -- a.ts',
    ])('passes `%s`, which only names a trigger word', (command) => {
        expect(session().bash(command)).toEqual({});
    });

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
        const marks = join(s.dir, 'cc-memory-load-agents-md');
        mkdirSync(marks, { recursive: true });
        writeFileSync(join(marks, s.id), '/repo/AGENTS.md\n');
        s.compact();
        expect(readFileSync(join(marks, s.id), 'utf8')).toBe('');
    });

    it('loads linear-flow at the start of a clio session', () => {
        const out = session().run({
            cwd: '/Users/dima/frame/_clio',
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

describe('guide-load-before-edit', () => {
    const typescript = 'x:guide-typescript';

    it('refuses the first .ts edit once, naming the guide', () => {
        const out = session().edit('/w/a.ts');
        expect(out.permissionDecision).toBe('deny');
        expect(out.permissionDecisionReason).toContain(typescript);
    });

    it('passes the identical retry', () => {
        const s = session();
        s.edit('/w/a.ts');
        expect(s.edit('/w/a.ts')).toEqual({});
    });

    it('passes a second .ts edit after the retry', () => {
        const s = session();
        s.edit('/w/a.ts');
        s.edit('/w/a.ts');
        expect(s.edit('/w/b.ts')).toEqual({});
    });

    it('refuses a batched sibling before any retry', () => {
        const s = session();
        s.edit('/w/a.ts');
        expect(s.edit('/w/b.ts').permissionDecision).toBe('deny');
    });

    it('passes each batched call on its retry', () => {
        const s = session();
        s.edit('/w/a.ts');
        s.edit('/w/b.ts');
        expect(s.edit('/w/a.ts')).toEqual({});
        expect(s.edit('/w/b.ts')).toEqual({});
    });

    it('passes a sibling once the guide has loaded', () => {
        const s = session();
        s.edit('/w/a.ts');
        const out = s.edit('/w/b.ts', {
            transcript_path: s.transcript([skillCall(typescript)]),
        });
        expect(out).toEqual({});
    });

    it('stops refusing after five distinct calls', () => {
        const s = session();
        const denied = ['a', 'b', 'c', 'd', 'e', 'f'].map(
            (name) => s.edit(`/w/${name}.ts`).permissionDecision,
        );
        expect(denied.filter(Boolean)).toHaveLength(5);
        expect(denied[5]).toBeUndefined();
    });

    it('holds no sibling on a rule with no skill', () => {
        const s = session();
        s.bash('mo uninstall Foo');
        expect(s.bash('mo uninstall Bar')).toEqual({});
    });

    it('refuses again after a compaction', () => {
        const s = session();
        s.edit('/w/a.ts');
        s.compact();
        expect(s.edit('/w/b.ts').permissionDecision).toBe('deny');
    });

    it('injects no retry order at a compaction', () => {
        const s = session();
        s.edit('/w/a.ts');
        expect(s.compact()).toEqual({});
    });

    it('passes after a compaction when the guide loaded past it', () => {
        const s = session();
        s.edit('/w/a.ts');
        s.compact();
        const out = s.edit('/w/b.ts', {
            transcript_path: s.transcript([boundary, skillCall(typescript)]),
        });
        expect(out).toEqual({});
    });

    it.each([
        [
            'a Bash command',
            'Bash',
            { command: 'node a.ts b.tsx c.go d.py e.sh' },
        ],
        [
            'a Bash command with a .sh path',
            'Bash',
            { command: './script/run.sh' },
        ],
        [
            'a Write content',
            'Write',
            { content: 'see a.ts', file_path: '/w/a.md' },
        ],
        [
            'an Edit new_string',
            'Edit',
            { file_path: '/w/a.md', new_string: 'b.go', old_string: 'x' },
        ],
        [
            'an Edit old_string',
            'Edit',
            { file_path: '/w/a.md', new_string: 'x', old_string: 'b.py' },
        ],
        [
            'MultiEdit edits',
            'MultiEdit',
            { edits: [{ new_string: 'c.tsx' }], file_path: '/w/a.md' },
        ],
        ['a file with no extension', 'Edit', { file_path: '/w/Makefile' }],
        ['a dotted dir name', 'Edit', { file_path: '/w/pkg.ts/README' }],
        ['a longer extension', 'Edit', { file_path: '/w/a.ts.md' }],
    ])('fires no guide row on %s', (_name, tool, input) => {
        expect(session().tool(tool, input)).toEqual({});
    });

    it.each([
        ['.go', '/w/a.go', 'x:guide-go'],
        ['.py', '/w/a.py', 'x:guide-code'],
        ['.sh', '/w/a.sh', 'x:guide-code'],
    ])('refuses the first %s edit naming its guide', (_ext, path, guide) => {
        expect(session().edit(path).permissionDecisionReason).toContain(guide);
    });

    it('fires a Write to a new .ts file', () => {
        const out = session().tool('Write', {
            content: '',
            file_path: '/w/a.ts',
        });
        expect(out.permissionDecision).toBe('deny');
    });

    it('fires each guide once across a .ts then a .go edit', () => {
        const s = session();
        expect(s.edit('/w/a.ts').permissionDecision).toBe('deny');
        expect(s.edit('/w/a.ts')).toEqual({});
        expect(s.edit('/w/a.go').permissionDecision).toBe('deny');
        expect(s.edit('/w/a.go')).toEqual({});
        expect(s.edit('/w/b.ts')).toEqual({});
        expect(s.edit('/w/b.go')).toEqual({});
    });

    it('refuses a .tsx edit once, naming both guides', () => {
        const s = session();
        const reason = s.edit('/w/a.tsx').permissionDecisionReason;
        expect(reason).toContain(typescript);
        expect(reason).toContain('x:guide-react');
        expect(s.edit('/w/a.tsx')).toEqual({});
    });

    describe('the skip', () => {
        const edit = (s: ReturnType<typeof session>, entries: unknown[]) =>
            s.edit('/w/a.ts', { transcript_path: s.transcript(entries) });

        it('passes after a real Skill call', () => {
            const s = session();
            expect(edit(s, [skillCall(typescript)])).toEqual({});
        });

        it('passes a Skill call past the last boundary', () => {
            const s = session();
            expect(edit(s, [boundary, skillCall(typescript)])).toEqual({});
        });

        it('passes through garbled lines', () => {
            const s = session();
            expect(
                edit(s, ['{broken "Skill"', '"Skill"', skillCall(typescript)]),
            ).toEqual({});
        });

        it('passes when a tool result only quotes a boundary', () => {
            const s = session();
            expect(
                edit(s, [
                    skillCall(typescript),
                    {
                        message: {
                            content: 'subtype compact_boundary "Skill"',
                        },
                        subtype: 'compact_boundary',
                        type: 'user',
                    },
                ]),
            ).toEqual({});
        });

        it.each([
            [
                'text naming the guide',
                [
                    {
                        message: {
                            content: [reply(`load ${typescript} "Skill"`)],
                            role: 'assistant',
                        },
                        type: 'assistant',
                    },
                ],
            ],
            ['a call before the boundary', [skillCall(typescript), boundary]],
            ['another guide', [skillCall('x:guide-go')]],
            ['a longer name', [skillCall(`${typescript}-old`)]],
            ['a bare name', [skillCall('guide-typescript')]],
            [
                'a non-Skill tool',
                [toolCall('Read', { Skill: true, skill: typescript })],
            ],
            [
                'a user entry shaped like the call',
                [{ ...skillCall(typescript), type: 'user' }],
            ],
        ])('fires given only %s', (_name, entries) => {
            const s = session();
            expect(edit(s, entries).permissionDecision).toBe('deny');
        });

        it('fires for a subagent whose parent loaded the guide', () => {
            const s = session();
            const out = s.edit('/w/a.ts', {
                agent_id: 'sub',
                transcript_path: s.transcript([skillCall(typescript)]),
            });
            expect(out.permissionDecision).toBe('deny');
        });

        it('passes a subagent that loaded the guide itself', () => {
            const s = session();
            s.transcript(
                [skillCall(typescript)],
                'session/subagents/agent-sub.jsonl',
            );
            const out = s.edit('/w/a.ts', {
                agent_id: 'sub',
                transcript_path: join(s.dir, 'session.jsonl'),
            });
            expect(out).toEqual({});
        });

        it.each([
            [
                'a string message',
                { message: 'x', name: 'Skill', type: 'assistant' },
            ],
            ['no message', { name: 'Skill', type: 'assistant' }],
            [
                'a Skill input that is no object',
                toolCall('Skill', 'x:guide-typescript' as never),
            ],
        ])('fires past a malformed line with %s', (_name, line) => {
            const s = session();
            expect(edit(s, [line]).permissionDecision).toBe('deny');
        });

        it('fires on a transcript the hook cannot read', () => {
            const s = session();
            const out = s.edit('/w/a.ts', { transcript_path: s.dir });
            expect(out.permissionDecision).toBe('deny');
        });

        it('fires with no transcript_path at all', () => {
            expect(session().edit('/w/a.ts').permissionDecision).toBe('deny');
        });

        it('names only the guide still missing on a .tsx edit', () => {
            const s = session();
            const reason = s.edit('/w/a.tsx', {
                transcript_path: s.transcript([skillCall(typescript)]),
            }).permissionDecisionReason;
            expect(reason).toContain('x:guide-react');
            expect(reason).not.toContain('guide-load-before-edit-typescript');
        });
    });
});

describe('shelf and model-cards rows', () => {
    const edits = (text: string) =>
        [
            [
                'Edit',
                { file_path: '/w/a.md', new_string: text, old_string: 'x' },
            ],
            ['Write', { content: text, file_path: '/w/a.md' }],
            [
                'MultiEdit',
                { edits: [{ new_string: text }], file_path: '/w/a.md' },
            ],
        ] as const;

    it.each(edits('import "charm.land/lipgloss/v2"'))(
        'shelf-load-go-charm fires on charm.land in a %s',
        (tool, input) => {
            const reason = session().tool(tool, input).permissionDecisionReason;
            expect(reason).toContain('x knowledge read go-charm');
        },
    );

    it.each([
        'go get charm.land/bubbletea/v2',
        'cd x && go get -u charm.land/lipgloss/v2',
        'go mod init example.com/a',
    ])('shelf-load-go-charm fires on `%s`', (command) => {
        const reason = session().tool('Bash', {
            command,
        }).permissionDecisionReason;
        expect(reason).toContain('x knowledge read go-charm');
    });

    it.each([
        ['Bash', { command: 'rg charm.land' }],
        ['Bash', { command: 'go get golang.org/x/net; rg charm.land' }],
        ['Bash', { command: 'git commit -m "go mod init"' }],
        ['Edit', { file_path: '/w/charm.land/a.md', new_string: 'x' }],
        [
            'Edit',
            { file_path: '/w/a.md', new_string: 'x', old_string: 'charm.land' },
        ],
    ])('shelf-load-go-charm stays out of %s %j', (tool, input) => {
        expect(session().tool(tool, input)).toEqual({});
    });

    it.each([
        'brew install --cask iterm2',
        'brew uninstall --zap --cask iterm2',
        'cd /tmp && mo uninstall Foo',
    ])('shelf-load-macos-apps fires on `%s`', (command) => {
        const reason = session().tool('Bash', {
            command,
        }).permissionDecisionReason;
        expect(reason).toContain('x knowledge read macos-apps');
    });

    it.each([
        'brew install ripgrep',
        'brew list; echo --cask',
        'brew list --cask',
        'brew info --cask iterm2',
        'mo status',
        'grep "mo uninstall" a.md',
    ])('shelf-load-macos-apps stays out of `%s`', (command) => {
        expect(session().tool('Bash', { command })).toEqual({});
    });

    it.each([
        'how much does a 1m cache write cost',
        'How many tokens does this boot eat?',
        'what is the prompt cache ttl',
        'how long does the prompt cache last?',
        'does the cache expire?',
        'is opus pricing higher than sonnet?',
    ])('model-cards-load-on-cost-question loads on «%s»', (prompt) => {
        expect(session().prompt(prompt).additionalContext).toContain(
            'model-cards.md',
        );
    });

    it.each([
        'fix the cost column in the table',
        'the cache is stale, clear it',
        'rotate the github token',
        'can you rotate the github token',
        'closing note.\n  why: the cost of this row is small',
        'held the same way: who asked for it, what it costs.',
        'const tokens = usage?.context.breakdown;',
        'the size of that cost is my inference «?»',
    ])('model-cards-load-on-cost-question stays out of «%s»', (prompt) => {
        expect(session().prompt(prompt)).toEqual({});
    });
});

describe('surface leaves', () => {
    const herdrLeaf = 'surface-herdr-desktop.md';
    const desktopLeaf = 'surface-claude-desktop.md';
    const clio = '/Users/dima/frame/_clio';

    function fixtureHome() {
        const home = mkdtempSync(join(tmpdir(), 'memory-load-home-'));
        const memory = join(home, 'frame/_clio/memory');
        mkdirSync(memory, { recursive: true });
        writeFileSync(join(memory, herdrLeaf), '# herdr leaf\n');
        writeFileSync(join(memory, desktopLeaf), '# desktop leaf\n');
        return home;
    }

    function start(
        env: Record<string, string>,
        { cwd = clio, source = 'startup', s = session() } = {},
    ) {
        const out = s.run(
            { cwd, hook_event_name: 'SessionStart', source },
            { HOME: fixtureHome(), ...env },
        );
        return out.additionalContext ?? '';
    }

    const herdr = { CLAUDE_CODE_ENTRYPOINT: 'cli', HC_TERMINAL_ID: 't9' };
    const desktop = { CLAUDE_CODE_ENTRYPOINT: 'claude-desktop' };

    it('loads the herdr leaf in a herdr clio thread', () => {
        const text = start(herdr);
        expect(text).toContain(herdrLeaf);
        expect(text).not.toContain(desktopLeaf);
    });

    it('loads the desktop leaf in a desktop clio thread', () => {
        const text = start(desktop);
        expect(text).toContain(desktopLeaf);
        expect(text).not.toContain(herdrLeaf);
    });

    it('loads neither leaf in a plain terminal', () => {
        const text = start({ CLAUDE_CODE_ENTRYPOINT: 'cli' });
        expect(text).not.toContain(herdrLeaf);
        expect(text).not.toContain(desktopLeaf);
    });

    it.each(['compact', 'resume'])(
        'loads the herdr leaf again on a %s',
        (source) => {
            const s = session();
            start(herdr, { s });
            const text = start(herdr, { s, source });
            expect(text).toContain(herdrLeaf);
            expect(text.split(herdrLeaf).length).toBe(2);
        },
    );

    it('loads neither leaf outside the clio dir', () => {
        const text = start(herdr, { cwd: '/Users/dima/frame' });
        expect(text).not.toContain(herdrLeaf);
        expect(text).not.toContain(desktopLeaf);
    });

    it.each([
        { ...herdr, CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' },
        { ...herdr, CLAUDE_CODE_ENTRYPOINT: 'sdk-ts' },
        { ...herdr, CLAUDE_CODE_BG: '1' },
    ])('loads neither leaf in a headless session %j', (env) => {
        const text = start(env);
        expect(text).not.toContain(herdrLeaf);
        expect(text).not.toContain(desktopLeaf);
    });

    it('keeps the other loads when a leaf is not written yet', () => {
        const home = mkdtempSync(join(tmpdir(), 'memory-load-home-'));
        const result = session().spawnHook(
            { cwd: clio, hook_event_name: 'SessionStart', source: 'startup' },
            { HOME: home, ...herdr },
        );
        expect(result.stdout).toContain(ruleHead);
        expect(result.stderr).toBe('');
    });

    it('keeps the other loads when a leaf cannot be read', () => {
        const home = fixtureHome();
        const leaf = join(home, 'frame/_clio/memory', herdrLeaf);
        chmodSync(leaf, 0o000);
        const result = session().spawnHook(
            { cwd: clio, hook_event_name: 'SessionStart', source: 'startup' },
            { HOME: home, ...herdr },
        );
        chmodSync(leaf, 0o644);
        expect(result.stdout).toContain(ruleHead);
    });

    it('logs the surface it saw and the leaf it loaded', () => {
        const s = session();
        start(herdr, { s });
        const lines = s
            .logLines()
            .filter((line) => !line.includes('linear-flow'));
        expect(lines).toEqual([
            'env herdr HC_TERMINAL_ID set, entrypoint cli',
            `load surface-herdr-desktop by env ~/frame/_clio/memory/${herdrLeaf}`,
        ]);
    });
});

describe('fails open', () => {
    function hookWithOnlyLinearFlow() {
        const root = mkdtempSync(join(tmpdir(), 'memory-load-copy-'));
        const hooks = join(root, 'shelf/hooks');
        const lazy = join(root, 'rules-lazy');
        mkdirSync(hooks, { recursive: true });
        mkdirSync(lazy);
        const copy = join(hooks, 'memory-load-rule-lazy.py');
        copyFileSync(hook, copy);
        copyFileSync(
            join(rules, 'linear-flow.md'),
            join(lazy, 'linear-flow.md'),
        );
        const row = JSON.parse(
            readFileSync(join(rules, 'triggers.json'), 'utf8'),
        );
        writeFileSync(
            join(lazy, 'triggers.json'),
            JSON.stringify({ 'linear-flow': row['linear-flow'] }),
        );
        return copy;
    }

    const everyEvent = [
        { cwd: '/w/_clio', hook_event_name: 'SessionStart', source: 'startup' },
        { hook_event_name: 'UserPromptSubmit', prompt: 'look at FRM-12' },
        { hook_event_name: 'SessionStart', source: 'compact' },
        {
            hook_event_name: 'PreToolUse',
            tool_input: { command: 'go mod init a' },
            tool_name: 'Bash',
        },
        {
            hook_event_name: 'PreToolUse',
            tool_input: { edits: 'not a list', file_path: 7 },
            tool_name: 'MultiEdit',
        },
        { hook_event_name: 'PreToolUse', tool_input: {}, tool_name: 'Edit' },
        { hook_event_name: 'Stop', last_assistant_message: 'FRM-12' },
    ];

    it('a row with no new key loads linear-flow cleanly', () => {
        const s = session(hookWithOnlyLinearFlow());
        const result = s.spawnHook({
            hook_event_name: 'UserPromptSubmit',
            prompt: 'look at FRM-12',
        });
        expect(result.stdout).toContain(ruleHead);
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
    });

    it('a row with no new key ignores a .ts edit', () => {
        expect(session(hookWithOnlyLinearFlow()).edit('/w/a.ts')).toEqual({});
    });

    it.each(everyEvent)('no row throws on %j', (event) => {
        const result = session().spawnHook(event);
        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
    });

    it('refuses nothing with a read-only state dir', () => {
        const s = session();
        const state = join(s.dir, 'cc-memory-load-rule-lazy');
        mkdirSync(state);
        chmodSync(state, 0o555);
        const event = {
            hook_event_name: 'PreToolUse',
            tool_input: { file_path: '/w/a.ts' },
            tool_name: 'Edit',
        };
        const result = s.spawnHook(event);
        chmodSync(state, 0o755);
        expect(result.stdout).toBe('');
        expect(result.status).toBe(0);
    });

    it('refuses nothing when the log cannot be written', () => {
        const s = session();
        writeFileSync(join(s.dir, 'log.tsv'), '');
        chmodSync(join(s.dir, 'log.tsv'), 0o444);
        expect(s.edit('/w/a.ts')).toEqual({});
        expect(s.edit('/w/a.ts')).toEqual({});
    });
});

describe('memory-load-replay', () => {
    function replay(entries: unknown[]) {
        const home = mkdtempSync(join(tmpdir(), 'memory-load-home-'));
        const dir = join(home, '.claude/projects/p');
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 's.jsonl'),
            entries.map((line) => JSON.stringify(line)).join('\n'),
        );
        return spawnSync(
            'python3',
            [join(scripts, 'memory-load-replay.py'), '--days', '1'],
            {
                encoding: 'utf8',
                env: { ...process.env, HOME: home },
                timeout: 10_000,
            },
        ).stdout;
    }

    it('prints a row fire with its hit', () => {
        const out = replay([toolCall('Edit', { file_path: '/w/a.ts' })]);
        expect(out).toContain('guide-load-before-edit-typescript: 1 fires');
        expect(out).toContain('1× Edit: .ts');
    });

    it('counts a refusal-only row again past a compaction', () => {
        const edit = toolCall('Edit', { file_path: '/w/a.ts' });
        expect(replay([edit, boundary, edit])).toContain(
            'guide-load-before-edit-typescript: 2 fires',
        );
    });

    it('keeps other rows firing after a Skill call with no name', () => {
        const out = replay([
            toolCall('Skill', {}),
            toolCall('Bash', { command: 'mo uninstall Foo' }),
        ]);
        expect(out).toContain('shelf-load-macos-apps: 1 fires');
    });

    it('prints a row with no fires', () => {
        const out = replay([toolCall('Edit', { file_path: '/w/a.md' })]);
        expect(out).toContain('shelf-load-macos-apps: 0 fires');
    });

    it('counts a fire once per transcript', () => {
        const edit = toolCall('Edit', { file_path: '/w/a.ts' });
        expect(replay([edit, edit])).toContain(
            'guide-load-before-edit-typescript: 1 fires',
        );
    });

    it('skips a guide loaded before the edit', () => {
        const out = replay([
            skillCall('x:guide-typescript'),
            toolCall('Edit', { file_path: '/w/a.ts' }),
        ]);
        expect(out).toContain('guide-load-before-edit-typescript: 0 fires');
    });

    it('fires again past a boundary that dropped an unmarked guide', () => {
        const out = replay([
            skillCall('x:guide-typescript'),
            boundary,
            toolCall('Edit', { file_path: '/w/a.ts' }),
        ]);
        expect(out).toContain('guide-load-before-edit-typescript: 1 fires');
    });
});

describe('memory-load-guide-share', () => {
    function share(entries: unknown[]) {
        const dir = mkdtempSync(join(tmpdir(), 'memory-load-share-'));
        const path = join(dir, 's.jsonl');
        writeFileSync(
            path,
            entries.map((line) => JSON.stringify(line)).join('\n'),
        );
        return spawnSync(
            'python3',
            [join(scripts, 'memory-load-guide-share.py'), '--transcript', path],
            { encoding: 'utf8', timeout: 10_000 },
        ).stdout;
    }
    const edit = (id: string) => toolCall('Edit', { file_path: '/w/a.ts' }, id);
    const refused = (id: string) => ({
        message: {
            content: [
                {
                    content: 'PreToolUse:Edit hook error: refused once',
                    is_error: true,
                    tool_use_id: id,
                    type: 'tool_result',
                },
            ],
            role: 'user',
        },
        type: 'user',
    });

    it('counts the guide as first across refuse, load, retry', () => {
        expect(
            share([
                edit('t1'),
                refused('t1'),
                skillCall('x:guide-typescript'),
                edit('t2'),
            ]),
        ).toContain('x:guide-typescript before the first ts edit: 1/1');
    });

    it('counts an errored Skill call as no load', () => {
        const skill = toolCall('Skill', { skill: 'x:guide-typescript' }, 's1');
        expect(share([skill, refused('s1'), edit('t2')])).toContain(
            'x:guide-typescript before the first ts edit: 0/1',
        );
    });

    it('counts a retry with no load as a miss', () => {
        expect(share([edit('t1'), refused('t1'), edit('t2')])).toContain(
            'x:guide-typescript before the first ts edit: 0/1',
        );
    });

    it('counts a plain edit with no load as a miss', () => {
        expect(share([edit('t1')])).toContain(
            'x:guide-typescript before the first ts edit: 0/1',
        );
    });

    it('counts no session when every edit was refused', () => {
        expect(share([edit('t1'), refused('t1')])).toContain(
            'x:guide-typescript before the first ts edit: 0/0',
        );
    });
});

// the suite runs inside herdr or the desktop app too; a surface var it inherits would load a leaf
function surfaceFree() {
    return Object.fromEntries(
        Object.entries(process.env).filter(
            ([key]) =>
                !key.startsWith('HC_') &&
                key !== 'CLAUDE_CODE_ENTRYPOINT' &&
                key !== 'CLAUDE_CODE_BG',
        ),
    );
}

const boundary = { subtype: 'compact_boundary', type: 'system' };

function reply(text: string) {
    return { text, type: 'text' };
}

function toolCall(name: string, input: object, id = 'toolu_1') {
    return {
        message: {
            content: [{ id, input, name, type: 'tool_use' }],
            role: 'assistant',
        },
        type: 'assistant',
    };
}

function skillCall(skill: string) {
    return toolCall('Skill', { skill });
}

/* Types */
interface HookOutput {
    additionalContext?: string;
    permissionDecision?: string;
    permissionDecisionReason?: string;
}
