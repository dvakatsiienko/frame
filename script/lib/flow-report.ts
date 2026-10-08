import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const FLOW_TAGS = ['#dima-caught', '#brief'] as const;

/** a flawlog file belongs to the day its name starts with: `2026-10-05-<slug>.md` */
export const flawlogCounts = (dir: string, since: string) => {
    const lines = readdirSync(dir)
        .filter(
            (f) =>
                /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f) && f.slice(0, 10) >= since,
        )
        .flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n'))
        .filter((l) => l.trimStart().startsWith('- '));
    return FLOW_TAGS.map((tag) => {
        const re = new RegExp(`(?<![\\w#-])${tag}(?![\\w-])`);
        return { count: lines.filter((l) => re.test(l)).length, tag };
    });
};

const CREW_SKILLS = ['x:crew-coder', 'x:crew-verifier'];
const BARE_RUN = /\bclaude\b[^|;&\n]*--safe-mode/;

const KNOWLEDGE_PATH = /\/docs\/knowledge\/(.+)$/;

/** bare cc runs, crew-skill loads and Reads of each `knowledge` file (a path under `docs/knowledge/`) in `<dir>/*\/*.jsonl`, counting tool calls from `start` on */
export const transcriptCounts = (
    dir: string,
    start: Date,
    knowledge: readonly string[],
) => {
    const counts = { bareRuns: 0, bareSessions: 0, briefLed: 0, falseFires: 0 };
    const reads = new Map(knowledge.map((f) => [f, 0]));
    for (const project of readdirSync(dir, { withFileTypes: true })) {
        if (!project.isDirectory()) continue;
        const projectDir = join(dir, project.name);
        for (const name of readdirSync(projectDir)) {
            const file = join(projectDir, name);
            if (!name.endsWith('.jsonl') || statSync(file).mtime < start)
                continue;
            const text = readFileSync(file, 'utf8');
            if (
                !text.includes('--safe-mode') &&
                !text.includes('"Skill"') &&
                !text.includes('docs/knowledge/')
            )
                continue;
            const named = new Set<string>();
            let bare = 0;
            for (const raw of text.split('\n')) {
                const isCrew = CREW_SKILLS.some((s) => raw.includes(s));
                if (
                    !isCrew &&
                    !raw.includes('--safe-mode') &&
                    !raw.includes('docs/knowledge/')
                )
                    continue;
                const line = parseLine(raw);
                if (!line) continue;
                const content = line.message?.content;
                if (line.type === 'user') {
                    const said =
                        typeof content === 'string'
                            ? content
                            : (content ?? [])
                                  .map((b) => (b.type === 'text' ? b.text : ''))
                                  .join('\n');
                    for (const s of CREW_SKILLS)
                        if (said.includes(s)) named.add(s);
                    continue;
                }
                if (line.type !== 'assistant' || typeof content === 'string')
                    continue;
                if (!line.timestamp || new Date(line.timestamp) < start)
                    continue;
                for (const b of content ?? []) {
                    if (b.type !== 'tool_use') continue;
                    const read =
                        b.name === 'Read'
                            ? b.input.file_path?.match(KNOWLEDGE_PATH)?.[1]
                            : undefined;
                    if (read && reads.has(read))
                        reads.set(read, (reads.get(read) ?? 0) + 1);
                    if (
                        b.name === 'Bash' &&
                        BARE_RUN.test(b.input.command ?? '')
                    )
                        bare++;
                    const skill = b.input.skill;
                    if (
                        b.name === 'Skill' &&
                        skill &&
                        CREW_SKILLS.includes(skill)
                    ) {
                        if (named.has(skill)) counts.briefLed++;
                        else counts.falseFires++;
                    }
                }
            }
            counts.bareRuns += bare;
            if (bare) counts.bareSessions++;
        }
    }
    const knowledgeReads = [...reads]
        .map(([file, count]) => ({ count, file }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
    return { ...counts, knowledgeReads };
};

// a live session's last line can be half-written
function parseLine(raw: string): TranscriptLine | undefined {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

// x-mod-guard's store files under `~/.claude/plugins/store`, and the one it kept as `guard` before the rename
const GUARD_STORE = /^(x-mod-)?guard_.*\.json$/;

/** one day's refusals and escapes, summed from x-mod-guard's `day:<yyyy-mm-dd>:<session>` keys; a file mid-write is skipped */
export const guardDay = (dir: string, day: string) => {
    const prefix = `day:${day}:`;
    const sessions = new Set<string>();
    const counts = { escaped: 0, refused: 0 };
    const rules: Record<string, GuardDayCount> = {};
    for (const name of readdirSync(dir).filter((f) => GUARD_STORE.test(f))) {
        let store: Record<string, Partial<GuardDay>>;
        try {
            store = JSON.parse(readFileSync(join(dir, name), 'utf8'));
        } catch {
            continue;
        }
        for (const [key, count] of Object.entries(store)) {
            if (!key.startsWith(prefix)) continue;
            sessions.add(key.slice(prefix.length));
            counts.refused += count.refused ?? 0;
            counts.escaped += count.escaped ?? 0;
            for (const [rule, n] of Object.entries(count.rules ?? {})) {
                const was = rules[rule] ?? { escaped: 0, refused: 0 };
                rules[rule] = {
                    escaped: was.escaped + n.escaped,
                    refused: was.refused + n.refused,
                };
            }
        }
    }
    return { ...counts, rules, sessions: sessions.size };
};

export const medianMinutes = (prs: MergedPr[]) => {
    const mins = prs
        .map((p) => (Date.parse(p.mergedAt) - Date.parse(p.createdAt)) / 60_000)
        .sort((a, b) => a - b);
    if (!mins.length) return undefined;
    const mid = mins.length >> 1;
    return mins.length % 2
        ? mins[mid]
        : ((mins[mid - 1] ?? 0) + (mins[mid] ?? 0)) / 2;
};

/* Types */
export type MergedPr = { createdAt: string; mergedAt: string };
type GuardDayCount = { refused: number; escaped: number };
type GuardDay = GuardDayCount & { rules: Record<string, GuardDayCount> };
type ContentBlock =
    | { type: 'text'; text: string }
    | {
          type: 'tool_use';
          name: string;
          input: { command?: string; file_path?: string; skill?: string };
      }
    | { type: 'tool_result' };
type TranscriptLine = {
    type?: string;
    timestamp?: string;
    message?: { content?: string | ContentBlock[] };
};
