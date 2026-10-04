/* ── pm ────────────────────────────────────────────────────────────────────
 * cw has no rules/ layer and no slash commands, so the pm skill could only
 * ever reach it as a hand-uploaded zip carrying ONE file. This tool delivers
 * the whole stack in one call instead: the ticket rules a hook loads elsewhere and cw
 * never sees, the handbook, and the workspace recipes.
 */

/* Core */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { CLAUDE_HOME, text } from './shared.js';

const LINEAR_FLOW_PATH = join(CLAUDE_HOME, 'rules-lazy', 'linear-flow.md');
const PM_SKILL_PATH = join(CLAUDE_HOME, 'plugin-x', 'skills', 'pm', 'SKILL.md');
const PM_WORKSPACE_PATH = join(
    CLAUDE_HOME,
    'plugin-x',
    'skills',
    'pm',
    'references',
    'workspace.md',
);

export function registerPmTools(server: McpServer) {
    server.registerTool(
        'pm_guide',
        {
            description:
                "LINEAR TICKETS — READ THIS BEFORE TOUCHING ONE. Returns the operating handbook for Dima's Linear tracker (workspace x-com, teams DOT and BYT). " +
                'Call it BEFORE you create, update, close, comment on, triage, prioritise or label any ticket, and before answering a question about how the tracker works. ' +
                'Also call it the moment a FRM-N, BYT-N or old DOT-N id appears, or the user says "save this as a ticket" / "file that" / "what is the state of X". ' +
                'Call it ONCE per conversation, at the first ticket-shaped request, then follow what it returns for the rest of the conversation. ' +
                'It returns three things you do not otherwise have: the ticket lifecycle rules, the PM handbook (field contract, run stamps, ticket economy, output shape), and the live workspace recipes (projects, states, cli mechanics). ' +
                'Without it you WILL get it wrong in ways that look fine — labels replace instead of add, a create with no state lands in Triage, and an unstamped write cannot be undone. ' +
                'Read-only: it fetches guidance and changes nothing. Nothing to do with session handoffs, CSTs or YouTube.',
            inputSchema: {},
            title: 'PM handbook for Linear',
        },
        async () => text(loadPmGuide()),
    );
}

/* Helpers */
function loadPmGuide(): string {
    const parts: string[] = [];
    const missing: string[] = [];

    parts.push(
        '# PM guide — assembled for this surface\n\n' +
            'You ARE the PM for the duration of this request. Everything below is the same contract ' +
            'every other agent on this tracker follows.\n\n' +
            '📌 Two things the text below assumes and this surface does not have:\n' +
            '- there are **no slash commands here**. Where it says `/x:pm`, that is another surface; you already have the guide.\n' +
            '- `rules-lazy/linear-flow.md` is **loaded by a hook elsewhere and not here**, so it is inlined below rather than referenced.\n',
    );

    for (const [label, path] of [
        [
            'ticket lifecycle rules (rules-lazy/linear-flow.md)',
            LINEAR_FLOW_PATH,
        ],
        ['the PM handbook (plugin-x/skills/pm/SKILL.md)', PM_SKILL_PATH],
        ['workspace recipes (references/workspace.md)', PM_WORKSPACE_PATH],
    ] as const) {
        if (existsSync(path)) {
            parts.push(
                `\n\n---\n\n# ${label}\n\n${readFileSync(path, 'utf8')}`,
            );
            continue;
        }
        missing.push(`${label} — expected at ${path}`);
    }

    if (missing.length > 0) {
        // Degraded rather than silent: a moved file must never look like a
        // shorter handbook. Same guard as loadSpec().
        parts.push(
            `\n\n---\n\n!! ${missing.length} PART(S) OF THIS GUIDE WERE NOT FOUND:\n` +
                missing.map((m) => `- ${m}`).join('\n') +
                '\n\nThis guide is running degraded. Say so in your reply, work carefully from what ' +
                'did load, and tell the user the path needs fixing.',
        );
    }

    return parts.join('');
}
