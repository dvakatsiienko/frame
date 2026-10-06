import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    globSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

export const SESSION_NAME = '🐦‍⬛ ccrow';
export const STATE_DIR = join(homedir(), '.local/state/ccrow');
const STORE_DIR = join(homedir(), '.claude/plugins/store');
const HOT = 'hot:';
export const NOTES_PATH = join(STATE_DIR, 'notes.jsonl');
export const VERDICTS_PATH = join(STATE_DIR, 'verdicts.jsonl');
export const WAKE_GAP_MS = 30 * 60_000;
export const MIN_STEPS = 10;
export const SILENT_DAYS = 0; // dima 2026-10-06: live from day 1 — the silent notes were worth reading live
const DELTA_MAX_CHARS = 60_000;
const SESSIONS_DIR = join(homedir(), '.claude/sessions');

export const armList = ['opus', 'fable'] as const;
export const modeList = ['day', 'systematic'] as const;

export const armModels = {
    fable: 'claude-fable-5-1',
    opus: 'claude-opus-5-5',
} as const satisfies Record<Arm, string>;

// no user settings source: no user hooks, plugins or mods; disableAllHooks would block the mods in `pluginDirs` too (probed 2026-10-06)
export function claudeArgs(arm: Arm, pluginDirs = '') {
    return [
        '--model',
        armModels[arm],
        '--effort',
        'medium',
        '--setting-sources',
        'project,local',
        '--settings',
        JSON.stringify({
            crossSessionInbound: 'accept',
            env: { CLAUDE_CODE_PLUGIN_DIRS: pluginDirs },
            permissions: {
                additionalDirectories: ['~'],
                defaultMode: 'bypassPermissions',
            },
            skipDangerousModePermissionPrompt: true,
        }),
    ];
}

// the stash mod is found by its plugin name, never its dir: the dir gets renamed
export function stashModOf(pluginDirs: string, home = homedir()) {
    for (const entry of pluginDirs.split(':')) {
        const dir = entry.replace(/^~(?=\/)/, home);
        try {
            const { name } = JSON.parse(
                readFileSync(join(dir, '.claude-plugin/plugin.json'), 'utf8'),
            );
            if (typeof name === 'string' && /(^|-)stash$/.test(name))
                return { dir, name };
        } catch {}
    }
}

export function userPluginDirs() {
    const settings = JSON.parse(
        readFileSync(join(homedir(), '.claude/settings.json'), 'utf8'),
    );
    return String(settings.env?.CLAUDE_CODE_PLUGIN_DIRS ?? '');
}

// $.store is one json file per plugin, shared by every session running it; the hash in its name is cc's
export function storeOf(pluginName: string, storeDir = STORE_DIR) {
    return globSync(`${pluginName}_inline-*.json`, { cwd: storeDir })
        .map((f) => join(storeDir, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

// stash's 🔥 keep-hot reads `hot:<sessionId>` at session.start; no `until`, so it never cools
export function setHot(storePath: string, sessionId: string, now: number) {
    const store = JSON.parse(readFileSync(storePath, 'utf8'));
    store[HOT + sessionId] = { since: now };
    writeFileSync(storePath, JSON.stringify(store));
}

export function clearHot(storePath: string, sessionId: string) {
    const store = JSON.parse(readFileSync(storePath, 'utf8'));
    delete store[HOT + sessionId];
    writeFileSync(storePath, JSON.stringify(store));
}

export function readCharter() {
    return readFileSync(new URL('charter.md', import.meta.url), 'utf8');
}

export function isArm(value: string | undefined): value is Arm {
    return armList.some((arm) => arm === value);
}

export function isMode(value: string | undefined): value is Mode {
    return modeList.some((mode) => mode === value);
}

export function fail(line: string): never {
    console.error(line);
    process.exit(2);
}

export function readState(): State {
    try {
        const raw: Partial<State> = JSON.parse(
            readFileSync(join(STATE_DIR, 'state.json'), 'utf8'),
        );
        return { ...raw, offsets: raw.offsets ?? {} };
    } catch {
        return { offsets: {} };
    }
}

export function writeState(state: State) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(
        join(STATE_DIR, 'state.json'),
        `${JSON.stringify(state, null, 4)}\n`,
    );
}

// the registry stores the name with its zero-width joiner turned into a space: «🐦 ⬛ ccrow»
const bareName = (name: string) => name.replaceAll(/[\s‍]/g, '');

export function isAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function findSession(): LiveSession | undefined {
    const { jobId } = readState();
    for (const file of readdirSync(SESSIONS_DIR)) {
        if (!/^\d+\.json$/.test(file)) continue;
        try {
            const entry: Partial<LiveSession> = JSON.parse(
                readFileSync(join(SESSIONS_DIR, file), 'utf8'),
            );
            const isOurs =
                (jobId !== undefined && entry.jobId === jobId) ||
                bareName(entry.name ?? '') === bareName(SESSION_NAME);
            if (
                isOurs &&
                entry.pid &&
                entry.cwd &&
                entry.sessionId &&
                entry.messagingSocketPath &&
                isAlive(entry.pid)
            ) {
                return {
                    cwd: entry.cwd,
                    jobId: entry.jobId,
                    messagingSocketPath: entry.messagingSocketPath,
                    pid: entry.pid,
                    sessionId: entry.sessionId,
                };
            }
        } catch {}
    }
}

// with the user settings source off, the global rules/ dir is not read; a project rules dir is, but
// only real files (a symlinked dir or file and an @-import outside the project load nothing, probed 2026-10-06)
function copyRules() {
    const from = join(homedir(), '.claude/rules');
    const to = join(STATE_DIR, '.claude/rules');
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from).filter((f) => f.endsWith('.md'))) {
        writeFileSync(join(to, name), readFileSync(join(from, name)));
    }
}

export async function startCcrow(arm: Arm) {
    mkdirSync(STATE_DIR, { recursive: true });
    copyRules();
    const stash = stashModOf(userPluginDirs());
    const result = spawnSync(
        'claude',
        [
            '--bg',
            '-n',
            SESSION_NAME,
            ...claudeArgs(arm, stash?.dir),
            '--remote-control',
            SESSION_NAME,
            readCharter(),
        ],
        { cwd: STATE_DIR, encoding: 'utf8' },
    );
    if (result.error) fail(`cannot run claude: ${result.error.message}`);
    const jobId = /backgrounded · (\S+)/.exec(
        stripVTControlCharacters(result.stdout),
    )?.[1];
    if (result.status !== 0 || !jobId) {
        fail(`claude --bg failed: ${(result.stderr || result.stdout).trim()}`);
    }
    writeState({ ...readState(), arm, jobId, startedAt: Date.now() });
    console.log(
        `ccrow started on ${arm} (${armModels[arm]}, effort medium), job ${jobId}`,
    );

    const store = stash && storeOf(stash.name);
    if (!stash || !store) {
        console.log('🔥 off: no stash mod or store file');
        return;
    }
    // --bg ignores --session-id, so the id is known only once the registry lists ccrow
    let live = findSession();
    for (let i = 0; i < 30 && !live; i++) {
        await sleep(1000);
        live = findSession();
    }
    if (!live) {
        console.log('🔥 off: ccrow not in the registry after 30 s');
        return;
    }
    setHot(store, live.sessionId, Date.now());
    console.log(
        `🔥 key hot:${live.sessionId} written; stash reads it at session.start only, so ccrow's 🔥 waits on a stash change`,
    );
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export function transcriptPathOf(cwd: string, sessionId: string) {
    return join(
        homedir(),
        '.claude/projects',
        cwd.replaceAll(/[/.]/g, '-'),
        `${sessionId}.jsonl`,
    );
}

// a line still being written has no trailing newline yet; leave it for the next read
export function readLines(path: string) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.pop();
    return lines.filter((line) => line.trim() !== '');
}

export function parseEntry(line: string): TranscriptEntry | undefined {
    try {
        return JSON.parse(line);
    } catch {}
}

function textOf(content: TranscriptContent | undefined) {
    if (typeof content === 'string') return content;
    return (content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');
}

function queuedText(prompt: TranscriptContent | undefined) {
    if (typeof prompt === 'string') return prompt;
    return (prompt ?? [])
        .map((block) =>
            block.type === 'image' ? '[image]' : (block.text ?? ''),
        )
        .filter(Boolean)
        .join('\n');
}

export function transcriptDelta(lines: string[], fromLine: number) {
    const stepIds = new Set<string>();
    const parts: string[] = [];
    for (const entry of lines.slice(fromLine).map(parseEntry)) {
        if (entry?.type === 'assistant') {
            if (entry.message?.id) stepIds.add(entry.message.id);
            const text = textOf(entry.message?.content).trim();
            if (text) parts.push(`## cclio\n${text}`);
        }
        // a message dima types while cclio is mid-turn lands as a queued_command attachment, never a user entry
        if (
            entry?.type === 'attachment' &&
            entry.attachment?.type === 'queued_command'
        ) {
            const text = queuedText(entry.attachment.prompt).trim();
            if (text && !text.includes('<cross-session-message'))
                parts.push(`## dima\n${text}`);
        }
        if (entry?.type === 'user') {
            const text = textOf(entry.message?.content).trim();
            if (!text) continue;
            const who = entry.origin?.kind === 'peer' ? 'peer' : 'dima';
            if (who === 'dima' && entry.isMeta) continue;
            parts.push(`## ${who}\n${text}`);
        }
    }
    const text = parts.join('\n\n');
    return {
        steps: stepIds.size,
        text:
            text.length > DELTA_MAX_CHARS
                ? `[delta cut to its last ${DELTA_MAX_CHARS} chars]\n${text.slice(-DELTA_MAX_CHARS)}`
                : text,
    };
}

export function resolveLeaves(patterns: string[], today: string) {
    const found: string[] = [];
    const missing: string[] = [];
    for (const raw of patterns) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const isLatest = line.startsWith('latest ');
        const pattern = (isLatest ? line.slice('latest '.length) : line)
            .replaceAll('{today}', today)
            .replace(/^~(?=\/)/, homedir());
        const matches = globSync(pattern).filter((path) =>
            statSync(path).isFile(),
        );
        if (matches.length === 0) {
            missing.push(line);
            continue;
        }
        if (isLatest) {
            const newest = matches.toSorted(
                (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
            )[0];
            if (newest) found.push(newest);
            continue;
        }
        found.push(...matches.toSorted());
    }
    return { found, missing };
}

export function buildPacket({ deltaText, dir, leaves, missing }: PacketInput) {
    mkdirSync(dir, { recursive: true });
    const names = new Set<string>();
    for (const path of leaves) {
        let name = basename(path);
        for (let n = 2; names.has(name); n++) name = `${n}-${basename(path)}`;
        names.add(name);
        copyFileSync(path, join(dir, name));
    }
    const missingNote = missing.length
        ? `\n\n## leaves with no match\n${missing.map((line) => `- ${line}`).join('\n')}`
        : '';
    writeFileSync(
        join(dir, 'delta.md'),
        `# cclio since the last wake\n\n${deltaText || '(no text)'}${missingNote}\n`,
    );
    return [...names, 'delta.md'];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDay(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function wakeIdOf(date: Date) {
    return `${localDay(date).replaceAll('-', '')}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function wakeLine(wake: Wake) {
    return `ccrow wake ${wake.id} · mode ${wake.mode} · ${wake.phase} · packet ${join(STATE_DIR, 'packets', wake.id)}`;
}

export function dayOf(firstWakeAt: number, now: number) {
    return Math.floor((now - firstWakeAt) / 86_400_000) + 1;
}

// live days alternate the arm: day 4 opus, day 5 fable, …
export function armOfDay(day: number): Arm {
    return armList[day % 2] ?? 'opus';
}

export function sendLine(socketPath: string, text: string) {
    const frame = JSON.stringify({
        from_name: 'ccrow:wake',
        message: { content: text },
        priority: 'next',
        type: 'user',
        uuid: crypto.randomUUID(),
    });
    return new Promise<void>((resolve, reject) => {
        const socket = connect({ path: socketPath });
        socket.on('error', reject);
        socket.on('connect', () => socket.end(`${frame}\n`, () => resolve()));
    });
}

export function appendJsonl(path: string, value: Note | Verdict) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(value)}\n`, { flag: 'a' });
}

/* Types */

export type Arm = (typeof armList)[number];
export type Mode = (typeof modeList)[number];
export type Phase = 'silent' | 'live';

export interface Wake {
    id: string;
    mode: Mode;
    phase: Phase;
}

export interface State {
    arm?: Arm;
    jobId?: string;
    startedAt?: number;
    firstWakeAt?: number;
    lastWakeAt?: number;
    offsets: Record<string, number>;
}

export interface LiveSession {
    pid: number;
    name?: string;
    cwd: string;
    sessionId: string;
    jobId?: string;
    messagingSocketPath: string;
}

export interface Usage {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
}

type TranscriptContent = string | { type: string; text?: string }[];

export interface TranscriptEntry {
    type?: string;
    subtype?: string;
    durationMs?: number;
    isMeta?: boolean;
    origin?: { kind?: string };
    attachment?: { type?: string; prompt?: TranscriptContent };
    message?: {
        id?: string;
        model?: string;
        usage?: Usage;
        content?: TranscriptContent;
    };
}

interface PacketInput {
    dir: string;
    leaves: string[];
    missing: string[];
    deltaText: string;
}

export interface Note {
    id: string;
    wakeId: string;
    arm: Arm;
    channel: 'session' | 'one-shot';
    model: string | null;
    effort: 'medium';
    tokensIn: number;
    tokensOut: number;
    seconds: number;
    mode: Mode;
    phase: Phase;
    note: string;
    at: string;
}

export interface Verdict {
    id: string;
    value: 'ok' | 'miss';
    why: string;
    at: string;
}
