// renders ~/.claude/shelf/comms-log.jsonl (the one source) into the readable story; never edit the md by hand
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const source = path.join(homedir(), '.claude/shelf/comms-log.jsonl');
const target = path.join(
    homedir(),
    'frame/docs/knowledge/fleet-stories/comms-log/story.md',
);
const contextKeys = ['how', 'why', 'when', 'where', 'who'] as const;

const cases: Case[] = readFileSync(source, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

const days = cases.map((c) => c.at.slice(0, 10)).sort();

const section = (c: Case) =>
    [
        `## ${c.id} · ${c.tag} · ${c.grade} · ${c.severity} · ${c.status}`,
        '',
        `- **what:** ${c.what}`,
        ...contextKeys.map((k) => `- **${k}:** ${c.context[k]}`),
        `- **his words:** ${c.his_words.map((w) => `«${w}»`).join(' · ')}`,
        `- **shape:** ${c.shape}`,
        `- **fix:** ${c.fix}`,
        `- **home:** ${c.fix_home}`,
        `- **source:** ${c.ref}`,
    ].join('\n');

const story = [
    '---',
    'status: open',
    `dates: ${days[0]} → ${days.at(-1)}`,
    'tickets: [FRM-630]',
    'tags: [comms, dima-graded]',
    'fed-by: incidents',
    '---',
    '',
    "# comms log — dima's graded comms cases",
    '',
    '- rendered from `~/.claude/shelf/comms-log.jsonl` by `node ~/frame/_clio/script/comms-log-render.ts`; the jsonl is the one source, queried with duckdb',
    '- a case: what happened, its context, his grade and words verbatim, the reply shape that hurt, severity (hot · siesta · halt, his word wins), the fix and its home',
    '- the rules (severity, the weekly retro) live in [comms-log.md](../../comms-log.md); the statistics of all talk in [fleet-operator-comms.md](../../fleet-operator-comms.md)',
    '',
    cases.map(section).join('\n\n'),
    '',
].join('\n');

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, story);
console.log(`comms-log: ${cases.length} cases → ${target}`);

/* Types */

interface Case {
    id: string;
    at: string;
    grade: string;
    severity: string;
    status: string;
    tag: string;
    what: string;
    context: Record<(typeof contextKeys)[number], string>;
    his_words: string[];
    shape: string;
    fix: string;
    fix_home: string;
    ref: string;
}
