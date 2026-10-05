/* Core */
import { existsSync, readFileSync } from 'node:fs';

// the tail of the last reply carries what a verdict answers («➡️ yes», the numbered asks)
const CONTEXT_CHARS = 1500;
const routerLine = /skills \(jev router\): (.+)/;

/**
 * what the router reads off a session transcript: the skill listing the session was shown, the
 * agent's last reply, and every skill already in play — loaded, invoked by slash, or suggested
 */
export function sessionRead(path: string | undefined): Session {
    const empty: Session = {
        listing: new Map(),
        recentContext: '',
        seen: new Set(),
    };
    if (!path || !existsSync(path)) return empty;
    const lines = readFileSync(path, 'utf8').split('\n');
    const listing = new Map<string, string>();
    const seen = new Set<string>();
    let turn = '';
    let lastTurn = '';
    for (const line of lines) {
        // most lines are tool output; parse only the shapes read below
        if (
            !line.includes('"skill_listing"') &&
            !line.includes('"compact_boundary"') &&
            !line.includes('"type":"user"') &&
            !line.includes('"type":"assistant"') &&
            !line.includes('jev router')
        )
            continue;
        const entry = parse(line);
        if (!entry) continue;
        const at = entry.attachment;
        // a compaction drops every loaded skill body from context, so none counts as in play
        if (entry.type === 'system' && entry.subtype === 'compact_boundary')
            seen.clear();
        if (entry.type === 'attachment' && at?.type === 'skill_listing')
            for (const [name, description] of listingParse(
                at.content ?? '',
                at.names ?? [],
            ))
                listing.set(name, description);
        if (entry.type === 'attachment' && at?.type === 'hook_success') {
            const picks = routerLine.exec(at.stdout ?? '')?.[1];
            for (const pick of picks?.split(', ') ?? [])
                seen.add(pick.split(' ')[0] ?? '');
        }
        if (entry.type === 'user' && !entry.isMeta) {
            const text = textOf(entry.message?.content);
            const command = /<command-name>\/([^<\s]+)<\/command-name>/.exec(
                text,
            )?.[1];
            if (command) seen.add(command);
            if (isPrompt(entry.message?.content, text)) {
                if (turn.trim()) lastTurn = turn;
                turn = '';
            }
        }
        if (entry.type === 'assistant')
            for (const block of blocksOf(entry.message?.content)) {
                if (block.type === 'text') turn += `${block.text}\n`;
                if (
                    block.type === 'tool_use' &&
                    block.name === 'Skill' &&
                    block.input?.skill
                )
                    seen.add(block.input.skill);
            }
    }
    // the hook may fire before or after the current prompt lands in the file
    const recent = turn.trim() ? turn : lastTurn;
    return {
        listing,
        recentContext: recent.trim().slice(-CONTEXT_CHARS),
        seen,
    };
}

/**
 * `- name: description` per skill, in `names` order; a description may hold its own `- ` bullets,
 * so an entry ends only where the next listed name starts
 */
export function listingParse(content: string, names: readonly string[]) {
    const starts = names.flatMap((name) => {
        const at = `\n${content}`.indexOf(`\n- ${name}: `);
        return at < 0 ? [] : [{ at, name }];
    });
    starts.sort((a, b) => a.at - b.at);
    return starts.map(({ at, name }, i): [string, string] => [
        name,
        `\n${content}`
            .slice(at + name.length + 5, starts[i + 1]?.at)
            .replace(/\s+/g, ' ')
            .trim(),
    ]);
}

function parse(line: string): Entry | undefined {
    try {
        return JSON.parse(line) as Entry;
    } catch {
        return undefined;
    }
}

function blocksOf(content: unknown): Block[] {
    return Array.isArray(content) ? (content as Block[]) : [];
}

function textOf(content: unknown) {
    if (typeof content === 'string') return content;
    return blocksOf(content)
        .flatMap((b) => (b.type === 'text' && b.text ? [b.text] : []))
        .join('\n');
}

// a prompt dima typed: not a tool result, not the harness talking
function isPrompt(content: unknown, text: string) {
    if (blocksOf(content).some((b) => b.type === 'tool_result')) return false;
    const t = text.trim();
    return t.length > 0 && (!t.startsWith('<') || t.startsWith('<command-'));
}

/* Types */
type Block = {
    type: string;
    text?: string;
    name?: string;
    input?: { skill?: string };
};
type Entry = {
    type: string;
    subtype?: string;
    isMeta?: boolean;
    message?: { content?: unknown };
    attachment?: {
        type: string;
        content?: string;
        names?: string[];
        stdout?: string;
    };
};
export type Session = {
    listing: Map<string, string>;
    recentContext: string;
    seen: Set<string>;
};
