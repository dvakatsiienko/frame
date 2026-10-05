/* Core */
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

/* Instruments */
import type { RouterSkill } from './jev-questions.ts';
import type { RouteInput } from './skill-router.ts';

const run = promisify(execFile);

// the baseline arm (FRM-305, dima): is jev the right tool at all? one haiku call through the
// `claude` cli with a schema. hooks, thinking and every CLAUDE.md are off — measured: with
// CLAUDE.md the call read our fleet rules (~17k tokens), with thinking on it took 8 s, not 2 s
const settings = JSON.stringify({
    alwaysThinkingEnabled: false,
    claudeMdExcludes: ['**/*'],
    disableAllHooks: true,
});
const system =
    'You route a user prompt to the agent skills it needs loaded now. Answer only through the schema.';

/** one prompt → the skills haiku would load, with the call's wall time and cost */
export async function haikuRoute(
    input: RouteInput,
    roster: readonly RouterSkill[],
): Promise<HaikuRaw> {
    const names = roster.map((s) => s.name);
    const schema = {
        additionalProperties: false,
        properties: {
            skills: { items: { enum: names, type: 'string' }, type: 'array' },
        },
        required: ['skills'],
        type: 'object',
    };
    const ask = [
        'Which of these skills, if any, must be loaded to carry out what PROMPT asks to be done now?',
        'Load none for a question, an opinion, an acknowledgement, a relay to another session, or work set for later.',
        'RECENT_CONTEXT is the agent reply PROMPT answers: read a short verdict through it, but route only on work PROMPT asks for.',
        '',
        `PROMPT: ${input.prompt}`,
        `RECENT_CONTEXT: ${input.recentContext || '-'}`,
        '',
        'SKILLS:',
        ...roster.map((s) => `- ${s.name}: ${s.description}`),
    ].join('\n');
    const started = performance.now();
    const { stdout } = await run(
        'claude',
        [
            '-p',
            ask,
            '--model',
            'haiku',
            '--output-format',
            'json',
            '--json-schema',
            JSON.stringify(schema),
            '--system-prompt',
            system,
            '--tools',
            '',
            '--strict-mcp-config',
            '--no-session-persistence',
            '--settings',
            settings,
        ],
        // a neutral cwd: no project CLAUDE.md or settings to find
        { cwd: tmpdir(), maxBuffer: 4 * 1024 * 1024 },
    );
    const ms = Math.round(performance.now() - started);
    const out = JSON.parse(stdout) as CliResult;
    return {
        cost: out.total_cost_usd ?? 0,
        loads: (out.structured_output?.skills ?? []).filter(
            (s) => !input.seen.has(s),
        ),
        ms,
    };
}

/* Types */
type CliResult = {
    structured_output?: { skills?: string[] };
    total_cost_usd?: number;
};
/** a seen skill is dropped from the loads, as in the jev memory arms */
export type HaikuRaw = { loads: string[]; ms: number; cost: number };
