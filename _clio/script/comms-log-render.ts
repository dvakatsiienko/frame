// renders ~/.claude/shelf/comms-log.jsonl (the one source) into the readable story; never edit the md by hand
// --unnamed: every raw grade in herdr's grades file that no case names, red; the siesta runs it so no grade is lost
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const source = path.join(homedir(), '.claude/shelf/comms-log.jsonl');
const grades = path.join(homedir(), '.local/state/x/herdr-notes/grades.jsonl');
const target = path.join(
    homedir(),
    'frame/docs/knowledge/fleet-stories/comms-log/story.md',
);
const contextKeys = ['how', 'why', 'when', 'where', 'who'] as const;

process.exitCode = process.argv.includes('--unnamed') ? unnamed() : render();

function rows<T>(file: string): T[] {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
}

function unnamed() {
    const named = new Set(rows<Case>(source).flatMap((c) => c.raw ?? []));
    const loose = rows<RawGrade>(grades).filter((g) => !named.has(g.id));
    if (!loose.length) {
        console.log('🟢 every raw grade has its case');
        return 0;
    }
    for (const g of loose)
        console.log(
            `🔴 grade ${g.id.slice(0, 8)} ${g.grade} ${g.at.slice(0, 16)} (reply ${g.messageId.slice(0, 8)}): no case names it — write its case in comms-log.jsonl with "raw": ["${g.id}"]`,
        );
    return 1;
}

function render() {
    const cases = rows<Case>(source);
    const days = cases.map((c) => c.at.slice(0, 10)).sort();
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
        '- the rules (severity, who fills it) live in [comms-log.md](../../comms-log.md); the statistics of all talk in [fleet-operator-comms.md](../../fleet-operator-comms.md)',
        '',
        cases.map(section).join('\n\n'),
        '',
    ].join('\n');
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, story);
    console.log(`comms-log: ${cases.length} cases → ${target}`);
    return 0;
}

function section(c: Case) {
    return [
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
}

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
    raw?: string[];
}

interface RawGrade {
    id: string;
    at: string;
    messageId: string;
    grade: string;
}
