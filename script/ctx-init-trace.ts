// every seat's starting context, traced over time (FRM-408): a session's init number is its first main-thread
// assistant entry's input + cache read + cache creation tokens; the history is already on disk, so the trace starts with its back data
import { execFileSync } from 'node:child_process';
import {
    appendFileSync,
    createReadStream,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

const STATE_DIR = path.join(homedir(), '.local/state/x/ctx-init');
const TRACE_FILE = path.join(STATE_DIR, 'trace.jsonl');
const BASELINE_FILE = path.join(STATE_DIR, 'baseline.json');
const PROJECTS_DIR = path.join(homedir(), '.claude/projects');
const DAY = 24 * 60 * 60 * 1000;
const FIRST_RUN_DAYS = 14;

// each project folder's rows reach `onRows` as soon as it is read, so a scan cut short by the boot's timeout keeps what it found
async function scanTranscripts({
    projects = PROJECTS_DIR,
    since,
    known = new Set<string>(),
    onRows,
}: {
    projects?: string;
    since: number;
    known?: Set<string>;
    onRows: (rows: TraceRow[]) => void;
}) {
    if (!existsSync(projects)) return;
    for (const dir of readdirSync(projects)) {
        const rows: TraceRow[] = [];
        const folder = path.join(projects, dir);
        if (!statSync(folder).isDirectory()) continue;
        for (const file of readdirSync(folder)) {
            if (!file.endsWith('.jsonl')) continue;
            const sid = file.slice(0, -'.jsonl'.length);
            const full = path.join(folder, file);
            if (known.has(sid) || statSync(full).mtimeMs < since) continue;
            const row = await initRowOf(full, sid, dir);
            if (row) rows.push(row);
        }
        onRows(rows);
    }
}

async function initRowOf(file: string, sid: string, dir: string) {
    let firstChars: number | undefined;
    let firstText = '';
    const input = createReadStream(file);
    const lines = createInterface({ input });
    try {
        for await (const line of lines) {
            const entry = parse(line);
            if (!entry || entry.isSidechain) continue;
            if (entry.type === 'user' && firstChars === undefined) {
                firstText = textOf(entry.message?.content);
                firstChars = firstText.length;
            }
            if (entry.type !== 'assistant') continue;
            const model = entry.message?.model;
            const usage = entry.message?.usage;
            if (!usage || !model || model === '<synthetic>') continue;
            // a fork's file opens with its parent's entries, which carry the parent's session id
            if (entry.sessionId !== sid) return undefined;
            const seat = seatOf(dir, firstText);
            return {
                at: entry.timestamp ?? '',
                chars: firstChars ?? 0,
                date: (entry.timestamp ?? '').slice(0, 10),
                init:
                    (usage.input_tokens ?? 0) +
                    (usage.cache_read_input_tokens ?? 0) +
                    (usage.cache_creation_input_tokens ?? 0),
                model,
                seat,
                sid,
                version: entry.version ?? '',
            } satisfies TraceRow;
        }
    } finally {
        lines.close();
        input.destroy();
    }
    return undefined;
}

export function seatOf(dir: string, firstMessage: string): Seat {
    if (/\/x:crew-(verifier|sixth-sense)\b/.test(firstMessage))
        return 'sixth-sense'; // read-both
    if (/crew-(coder|codie)\b/.test(firstMessage)) return 'codie'; // read-both
    const clioDir =
        /^-Users-dima(-projects-dotfiles-cclio|-frame-cclio|-frame--clio)$/; // read-both
    if (clioDir.test(dir)) return 'clio';
    if (/^-Users-dima--local-state-(ccrow|crow)/.test(dir)) return 'crow'; // read-both
    if (/^-Users-dima--local-state-(composer|helga)/.test(dir)) return 'helga'; // read-both
    if (dir === '-Users-dima-frame') return 'cc';
    return 'other';
}

// read-both: rows and baseline keys stored before the 10-29 rename carry the old seat names
const PAST_SEATS: Record<string, Seat> = {
    cclio: 'clio', // read-both
    ccrow: 'crow', // read-both
    coder: 'codie', // read-both
    composer: 'helga', // read-both
    verifier: 'sixth-sense', // read-both
};
const seatNow = (seat: string) => PAST_SEATS[seat] ?? (seat as Seat);

export function readTrace(file = TRACE_FILE) {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as TraceRow)
        .map((r) => ({ ...r, seat: seatNow(r.seat) }));
}

function appendRows(rows: TraceRow[], file = TRACE_FILE) {
    if (!rows.length) return;
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
}

export async function scan(file = TRACE_FILE, projects = PROJECTS_DIR) {
    let added = 0;
    await scanTranscripts({
        known: new Set(readTrace(file).map((r) => r.sid)),
        onRows: (rows) => {
            appendRows(rows, file);
            added += rows.length;
        },
        projects,
        since: Date.now() - FIRST_RUN_DAYS * DAY,
    });
    return added;
}

const net = (r: TraceRow) => r.init - Math.round(r.chars / 4);

function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? (sorted[mid] ?? 0)
        : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const keyOf = (r: TraceRow) => `${r.seat}|${r.model}`;
const GROWTH_WEEK = 0.1;
const GROWTH_CREEP = 0.2;
const CEILING_MARGIN = 0.15;
const MIN_SESSIONS = 3;

// the baseline and the ceilings are written once per seat+model, from the back data the first run finds
export function baselineOf(rows: TraceRow[], kept: Baseline = {}) {
    const next: Baseline = { ...kept };
    const groups = Map.groupBy(
        rows.filter((r) => r.seat !== 'other'),
        keyOf,
    );
    for (const [key, group] of groups) {
        if (next[key]) continue;
        const m = median(group.map(net));
        next[key] = {
            ceiling: Math.round(m * (1 + CEILING_MARGIN)),
            median: m,
        };
    }
    return next;
}

export function alarmsOf(rows: TraceRow[], baseline: Baseline, now: number) {
    const week = 7 * DAY;
    const alarms: Alarm[] = [];
    const groups = Map.groupBy(
        rows.filter((r) => r.seat !== 'other'),
        keyOf,
    );
    for (const [key, group] of groups) {
        const [seat, model] = key.split('|') as [Seat, string];
        const at = (r: TraceRow) => Date.parse(r.at);
        const last = group.filter((r) => now - at(r) < week).map(net);
        const before = group
            .filter((r) => now - at(r) >= week && now - at(r) < 2 * week)
            .map(net);
        if (last.length < MIN_SESSIONS) continue;
        const nowMedian = median(last);
        if (
            before.length >= MIN_SESSIONS &&
            nowMedian >= median(before) * (1 + GROWTH_WEEK)
        )
            alarms.push({
                kind: 'week',
                model,
                now: nowMedian,
                ref: median(before),
                seat,
            });
        const kept = baseline[key];
        if (!kept) continue;
        if (nowMedian >= kept.median * (1 + GROWTH_CREEP))
            alarms.push({
                kind: 'creep',
                model,
                now: nowMedian,
                ref: kept.median,
                seat,
            });
        if (nowMedian > kept.ceiling)
            alarms.push({
                kind: 'ceiling',
                model,
                now: nowMedian,
                ref: kept.ceiling,
                seat,
            });
    }
    return alarms;
}

// the memory a seat loads at boot: the files whose growth explains a rising starting context
const MEMORY_PATHS = [
    'home/.claude/rules',
    'home/.claude/CLAUDE.md',
    '_clio/memory',
    '_clio/AGENTS.md',
    'home/.claude/plugin-x/skills',
    '_clio/plugin-clio/skills',
    'AGENTS.md',
    'home/.claude/settings.json',
];

// `git log --numstat --format=` output: lines added minus deleted per file, growing ones first
export function growthOf(numstat: string) {
    const grown = new Map<string, number>();
    for (const line of numstat.split('\n')) {
        const [added, deleted, file] = line.split('\t');
        if (!file || added === '-' || deleted === '-') continue;
        grown.set(
            file,
            (grown.get(file) ?? 0) + Number(added) - Number(deleted),
        );
    }
    return [...grown.entries()]
        .filter(([, lines]) => lines > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([file, lines]) => ({ file, lines }));
}

// one verb per file: over its budget it is trimmed, a rule or an AGENTS.md moves to an on-demand skill, a file inside
// 10 % of its budget has the budget raised; a file with no budget line is trimmed
export function verbFor(file: string, bytes: number, budget?: number) {
    if (budget && bytes > budget) return 'trim it';
    if (budget && bytes >= budget * 0.9) return 'raise its budget';
    if (/(^|\/)(rules\/|AGENTS\.md$|CLAUDE\.md$)/.test(file))
        return 'move it to an on-demand skill';
    return 'trim it';
}

// a cc version change inside the window is the cause when one falls there, else the memory files that grew most
export function causeOf(
    alarm: Alarm,
    rows: TraceRow[],
    now: number,
    files: GrownFile[],
): Cause {
    const week = 7 * DAY;
    const own = rows
        .filter((r) => r.seat === alarm.seat && r.model === alarm.model)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const recent = own.filter((r) => now - Date.parse(r.at) < week);
    const older = own.filter(
        (r) =>
            now - Date.parse(r.at) >= week &&
            (alarm.kind !== 'week' || now - Date.parse(r.at) < 2 * week),
    );
    const to = recent.at(-1)?.version;
    const from = older.at(-1)?.version;
    if (to && from && to !== from && !older.some((r) => r.version === to))
        return { from, kind: 'version', to };
    return { files: files.slice(0, 3), kind: 'files' };
}

const kilo = (n: number) => `${Math.round(n / 1000)}k`;

export function lineOf(alarm: Alarm, cause: Cause) {
    const growth = Math.round((alarm.now / alarm.ref - 1) * 100);
    const head = `${alarm.seat} (${alarm.model}): starting ctx ${kilo(alarm.now)}`;
    const against = {
        ceiling: `over its ceiling of ${kilo(alarm.ref)}`,
        creep: `${growth} % over its baseline of ${kilo(alarm.ref)}`,
        week: `${growth} % over ${kilo(alarm.ref)} the week before`,
    }[alarm.kind];
    const why =
        cause.kind === 'version'
            ? `cc ${cause.from} → ${cause.to} landed in that window: nothing to trim, re-baseline?`
            : cause.files.length
              ? `grew most: ${cause.files
                    .map(
                        (f) =>
                            `${f.file} (+${f.lines} lines) → ${verbFor(f.file, f.bytes, f.budget)}`,
                    )
                    .join('; ')}`
              : 'no memory file grew in that window: check the plugin and mcp configs';
    return `⚠ ${head}, ${against} — ${why}`;
}

const SEAT_ORDER: Seat[] = [
    'clio',
    'crow',
    'helga',
    'codie',
    'sixth-sense',
    'cc',
];
const DIGEST_DAYS = 14;
const DIGEST_SESSIONS = 5;

// each seat+model's starting number (the median of its newest sessions) on one line, then an alarm line apiece
export function digestOf(
    rows: TraceRow[],
    baseline: Baseline,
    now: number,
    grown: () => GrownFile[],
) {
    const recent = rows.filter(
        (r) =>
            SEAT_ORDER.includes(r.seat) &&
            now - Date.parse(r.at) < DIGEST_DAYS * DAY,
    );
    const groups = Map.groupBy(recent, keyOf);
    const medians = [...groups.entries()]
        .map(([key, group]) => {
            const [seat, model = ''] = key.split('|') as [Seat, string];
            const newest = [...group]
                .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                .slice(0, DIGEST_SESSIONS);
            return { model, seat, value: median(newest.map(net)) };
        })
        .sort(
            (a, b) => SEAT_ORDER.indexOf(a.seat) - SEAT_ORDER.indexOf(b.seat),
        );
    const alarms = alarmsOf(rows, baseline, now);
    const files = alarms.length ? grown() : [];
    return [
        medians.length
            ? `starting ctx (net, newest ${DIGEST_SESSIONS} sessions): ${medians
                  .map(
                      (m) =>
                          `${m.seat} ${kilo(m.value)} ${m.model.replace('claude-', '')}`,
                  )
                  .concat(
                      SEAT_ORDER.filter(
                          (seat) => !medians.some((m) => m.seat === seat),
                      ).map(
                          (seat) => `${seat} no session in ${DIGEST_DAYS} days`,
                      ),
                  )
                  .join(' · ')}`
            : 'starting ctx: no sessions traced in the last 14 days',
        ...alarms.map((a) => lineOf(a, causeOf(a, rows, now, files))),
    ];
}

function readBaseline() {
    if (!existsSync(BASELINE_FILE)) return {};
    const stored = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
    return Object.fromEntries(
        Object.entries(stored).map(([key, value]) => {
            const [seat, model] = key.split('|');
            return [`${seatNow(seat ?? '')}|${model}`, value];
        }),
    ) as Baseline;
}

function writeBaseline(baseline: Baseline) {
    if (JSON.stringify(baseline) === JSON.stringify(readBaseline())) return;
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
}

// the memory files that grew in the last two weeks, with their size and their budget line
function growthFiles() {
    const root = path.resolve(import.meta.dirname, '..');
    const log = execFileSync(
        'git',
        [
            '-C',
            root,
            'log',
            '--numstat',
            '--format=',
            `--since=${DIGEST_DAYS} days ago`,
            '--',
            ...MEMORY_PATHS,
        ],
        { encoding: 'utf8' },
    );
    const budgets = new Map(
        readFileSync(
            path.join(
                root,
                'recipes/nurture-memory/scripts/memory-budgets.tsv',
            ),
            'utf8',
        )
            .split('\n')
            .filter((l) => l && !l.startsWith('#'))
            .map((l) => l.split('\t') as [string, string]),
    );
    return growthOf(log).map(({ file, lines }) => {
        const full = path.join(root, file);
        const budget = Number(budgets.get(file)) || undefined;
        return {
            budget,
            bytes: existsSync(full) ? statSync(full).size : 0,
            file,
            lines,
        };
    });
}

function parse(line: string) {
    try {
        return JSON.parse(line) as Entry;
    } catch {
        return undefined;
    }
}

function textOf(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .map((c) => (c && typeof c.text === 'string' ? c.text : ''))
        .join('');
}

if (import.meta.main) {
    const added = await scan();
    if (process.argv[2] === 'digest') {
        const rows = readTrace();
        const baseline = baselineOf(rows, readBaseline());
        writeBaseline(baseline);
        for (const line of digestOf(rows, baseline, Date.now(), growthFiles))
            console.log(line);
    } else {
        console.log(`ctx-init:trace: ${added} new sessions in ${TRACE_FILE}`);
    }
}

/* Types */

export type GrownFile = {
    bytes: number;
    budget?: number;
    file: string;
    lines: number;
};

export type Cause =
    | { files: GrownFile[]; kind: 'files' }
    | { from: string; kind: 'version'; to: string };

export type Seat =
    | 'clio'
    | 'crow'
    | 'cc'
    | 'codie'
    | 'helga'
    | 'other'
    | 'sixth-sense';

export type Baseline = Record<string, { ceiling: number; median: number }>;

export type Alarm = {
    kind: 'ceiling' | 'creep' | 'week';
    model: string;
    now: number;
    ref: number;
    seat: Seat;
};

export type TraceRow = {
    at: string;
    chars: number;
    date: string;
    init: number;
    model: string;
    seat: Seat;
    sid: string;
    version: string;
};

type Entry = {
    isSidechain?: boolean;
    message?: {
        content?: unknown;
        model?: string;
        usage?: {
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
            input_tokens?: number;
        };
    };
    sessionId?: string;
    timestamp?: string;
    type?: string;
    version?: string;
};
