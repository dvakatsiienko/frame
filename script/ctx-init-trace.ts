// every seat's starting context, traced over time (FRM-408): a session's init number is its first main-thread
// assistant entry's input + cache read + cache creation tokens; the history is already on disk, so the trace starts with its back data
import {
    appendFileSync,
    createReadStream,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

const STATE_DIR = path.join(homedir(), '.local/state/x/ctx-init');
const TRACE_FILE = path.join(STATE_DIR, 'trace.jsonl');
const PROJECTS_DIR = path.join(homedir(), '.claude/projects');
const DAY = 24 * 60 * 60 * 1000;
const FIRST_RUN_DAYS = 14;

export async function scanTranscripts({
    projects = PROJECTS_DIR,
    since,
    known = new Set<string>(),
}: {
    projects?: string;
    since: number;
    known?: Set<string>;
}) {
    const rows: TraceRow[] = [];
    for (const dir of readdirSync(projects)) {
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
    }
    return rows;
}

async function initRowOf(file: string, sid: string, dir: string) {
    let firstChars: number | undefined;
    let firstText = '';
    const lines = createInterface({ input: createReadStream(file) });
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
    }
    return undefined;
}

export function seatOf(dir: string, firstMessage: string): Seat {
    if (firstMessage.includes('/x:crew-verifier')) return 'verifier';
    if (firstMessage.includes('crew-coder')) return 'coder';
    if (/^-Users-dima(-projects-dotfiles|-frame)-cclio$/.test(dir))
        return 'cclio';
    if (dir.startsWith('-Users-dima--local-state-ccrow')) return 'ccrow';
    if (dir.startsWith('-Users-dima--local-state-composer')) return 'composer';
    if (dir === '-Users-dima-frame') return 'cc';
    return 'other';
}

export function readTrace(file = TRACE_FILE) {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as TraceRow);
}

export function appendRows(rows: TraceRow[], file = TRACE_FILE) {
    if (!rows.length) return;
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
}

export async function scan(file = TRACE_FILE, projects = PROJECTS_DIR) {
    const trace = readTrace(file);
    const newest = Math.max(0, ...trace.map((r) => Date.parse(r.at) || 0));
    const since = newest ? newest - DAY : Date.now() - FIRST_RUN_DAYS * DAY;
    const rows = await scanTranscripts({
        known: new Set(trace.map((r) => r.sid)),
        projects,
        since,
    });
    appendRows(rows, file);
    return rows.length;
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
    console.log(`ctx-init:trace: ${added} new sessions in ${TRACE_FILE}`);
}

/* Types */

export type Seat =
    | 'cclio'
    | 'ccrow'
    | 'cc'
    | 'coder'
    | 'composer'
    | 'other'
    | 'verifier';

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
