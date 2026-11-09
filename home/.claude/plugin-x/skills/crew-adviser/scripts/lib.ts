import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    closeSync,
    globSync,
    mkdirSync,
    openSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

export const SESSION_NAME = '🐦‍⬛ crow';
const OLD_SESSION_NAME = '🐦‍⬛ ccrow'; // read-both
// CROW_STATE_DIR moves every note, verdict and run off the real home, so a fixture never writes the live notes (FRM-339)
export const STATE_DIR =
    process.env.CROW_STATE_DIR || join(homedir(), '.local/state/crow');
const STORE_DIR = join(homedir(), '.claude/plugins/store');
const HOT = 'hot:';
export const NOTES_PATH = join(STATE_DIR, 'notes.jsonl');
export const VERDICTS_PATH = join(STATE_DIR, 'verdicts.jsonl');
export const USAGE_PATH = join(homedir(), '.claude/shelf/cc-usage-window.json');
export const WAKE_GAP_MS = 30 * 60_000;
export const MIN_STEPS = 10;
export const SILENT_DAYS = 0; // dima 2026-10-06: live from day 1 — the silent notes were worth reading live
const DELTA_MAX_CHARS = 60_000;
const SESSIONS_DIR = join(homedir(), '.claude/sessions');

export const changedList = ['file', 'reply', 'ask', 'ticket', 'none'] as const;
export const armList = ['opus', 'fable'] as const;
export const modeList = ['day', 'systematic', 'decision'] as const;

export const armModels = {
    fable: 'claude-fable-5-1',
    opus: 'claude-opus-5-5',
} as const satisfies Record<Arm, string>;

// user settings on: cc 2.1.309 refuses a --bg bypass launch without them (probed 2026-11-02, dima's «bypass»), so user hooks run in crow too
export function claudeArgs(
    arm: Arm,
    pluginDirs = '',
    effort: Effort = 'medium',
) {
    return [
        '--model',
        armModels[arm],
        '--effort',
        effort,
        '--setting-sources',
        'user,project,local',
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

// crow runs without user plugins, so its contract arrives as the boot prompt, frontmatter cut
// a /clear drops the boot prompt, so every wake line names the charter a fresh session reads first
const CHARTER_PATH = join(import.meta.dirname, '../SKILL.md');
// crow's cwd sits outside frame, so her passport never autoloads: the charter carries it
const PASSPORT_PATH = join(
    import.meta.dirname,
    '../../../../../../_crow/AGENTS.md',
);

export function readCharter() {
    const skill = readFileSync(CHARTER_PATH, 'utf8').replace(
        /^---\n[\s\S]*?\n---\n+/,
        '',
    );
    return `${skill}\n\n---\n\n${readFileSync(PASSPORT_PATH, 'utf8')}`;
}

export function charterHash() {
    return createHash('sha256')
        .update(readFileSync(CHARTER_PATH))
        .update(readFileSync(PASSPORT_PATH))
        .digest('hex')
        .slice(0, 8);
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
    // several clio threads write it side by side, and a half-written file reads as «no offsets»: every transcript resent whole
    const temp = join(STATE_DIR, `state.json.${process.pid}`);
    writeFileSync(temp, `${JSON.stringify(state, null, 4)}\n`);
    renameSync(temp, join(STATE_DIR, 'state.json'));
}

// a wake's own keys over a fresh read: a peer thread's wake wrote state.json while this one packed, and its offset and clock stay
export function writeWakeState({
    firstWakeAt,
    packed,
    thread,
    transcriptPath,
    wakeAt,
}: {
    firstWakeAt?: number;
    packed: State;
    thread: string;
    transcriptPath: string;
    wakeAt?: number;
}) {
    const fresh = readState();
    writeState({
        ...fresh,
        charterHash: packed.charterHash,
        firstWakeAt: fresh.firstWakeAt ?? firstWakeAt,
        lastWakeAt:
            wakeAt === undefined
                ? fresh.lastWakeAt
                : { ...fresh.lastWakeAt, [thread]: wakeAt },
        leafHashes: packed.leafHashes,
        leavesFor: packed.leavesFor,
        offsets: {
            ...fresh.offsets,
            [transcriptPath]: packed.offsets[transcriptPath] ?? 0,
        },
    });
}

// the registry stores the name with its zero-width joiner turned into a space: «🐦 ⬛ crow»
const bareName = (name: string) => name.replaceAll(/[\s‍]/g, '');

// codie whose cwd is ~/frame/_clio fires clio's Stop hook too; only a clio's own thread wakes crow, main or any wing
export function clioThreadOf(
    transcriptPath: string,
    sessionsDir = SESSIONS_DIR,
    mainSeatFile = MAIN_SEAT_FILE,
): ClioThread | undefined {
    const sessionId = basename(transcriptPath, '.jsonl');
    for (const file of readdirSync(sessionsDir)) {
        if (!file.endsWith('.json')) continue;
        try {
            const entry: { name?: string; sessionId?: string } = JSON.parse(
                readFileSync(join(sessionsDir, file), 'utf8'),
            );
            if (entry.sessionId !== sessionId) continue;
            const bare = bareName(entry.name ?? '').replace(
                /^\p{Extended_Pictographic}+/u,
                '',
            );
            // read-both: a clio tab resumed under its old title
            if (!/^c?clio/.test(bare)) return undefined;
            const name = entry.name ?? '';
            const wing = /\bwing\s*(\d+)\b/.exec(name)?.[1];
            if (wing) return { id: `wing-${wing}`, name };
            // a fork carries main's name until it renames itself, so a nameless wing is main only in main's seat
            return isMainSeat(sessionId, mainSeatFile)
                ? { id: MAIN_THREAD, name }
                : undefined;
        } catch {}
    }
    return undefined;
}

// fork-guard's record of the main session; with no record yet, the clio-named session is main
function isMainSeat(sessionId: string, path: string) {
    try {
        const seated = /^session=(.*)$/m.exec(readFileSync(path, 'utf8'))?.[1];
        return !seated || seated === sessionId;
    } catch {
        return true;
    }
}

const MAIN_SEAT_FILE = join(
    process.env.FORK_GUARD_STATE || join(homedir(), '.local/state/clio'),
    'main-session',
);

export const MAIN_THREAD = 'main';

// a wing's wake id ends in its number, so two threads in one minute keep two packets, and a note's id names its thread
export const wakeSuffixOf = (threadId: string) =>
    threadId === MAIN_THREAD ? '' : `w${threadId.replace('wing-', '')}`;

export function threadOfNoteId(id: string) {
    const wing = /^\d+(?:d\d+)?w(\d+)(?:-|$)/.exec(id)?.[1];
    return wing ? `wing-${wing}` : MAIN_THREAD;
}

const threadLabel = (threadId: string) =>
    threadId === MAIN_THREAD
        ? 'clio main'
        : `clio ${threadId.replace('-', ' ')}`;

export function isAlive(pid: number) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

export function findSession(): LiveSession | undefined {
    return findSessions()[0];
}

// a tab and a --bg crow alive together make every name match a coin flip
export function oneCrow(): LiveSession | undefined {
    const live = findSessions();
    if (live.length > 1)
        fail(
            `two crows are live (pids ${live.map((s) => s.pid).join(', ')}): stop the --bg one (pnpm crow:stop) or /clear the tab`,
        );
    return live[0];
}

export function findSessions(): LiveSession[] {
    const found: LiveSession[] = [];
    for (const file of readdirSync(SESSIONS_DIR)) {
        if (!/^\d+\.json$/.test(file)) continue;
        try {
            const entry: Partial<LiveSession> = JSON.parse(
                readFileSync(join(SESSIONS_DIR, file), 'utf8'),
            );
            // by name: a desktop tab has no job id, and a stored one outlives its session
            const isOurs = [SESSION_NAME, OLD_SESSION_NAME].some(
                (name) => bareName(entry.name ?? '') === bareName(name),
            );
            if (
                isOurs &&
                entry.pid &&
                entry.cwd &&
                entry.sessionId &&
                entry.messagingSocketPath &&
                isAlive(entry.pid)
            ) {
                found.push({
                    cwd: entry.cwd,
                    entrypoint: entry.entrypoint,
                    jobId: entry.jobId,
                    messagingSocketPath: entry.messagingSocketPath,
                    name: entry.name,
                    pid: entry.pid,
                    sessionId: entry.sessionId,
                });
            }
        } catch {}
    }
    return found;
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

// a live crow in a plain interactive pane takes socket lines like a --bg one; a desktop tab does not
export function takesSocketLines(
    session?: Pick<LiveSession, 'entrypoint' | 'jobId'>,
) {
    return Boolean(session?.jobId) || session?.entrypoint === 'cli';
}

// a pane crow has no job id: its herdr terminal is found by cwd, as hc ls --json lists no pid
export function findPaneTerminal(cwd: string): string | undefined {
    const listed = spawnSync('hc', ['ls', '--json'], { encoding: 'utf8' });
    if (listed.status !== 0) return undefined;
    try {
        const { terminals }: { terminals: PaneTerminal[] } = JSON.parse(
            listed.stdout,
        );
        return terminals.find(
            (terminal) => terminal.agent === 'claude' && terminal.cwd === cwd,
        )?.address;
    } catch {}
}

export async function startCrow(arm: Arm, isPane = false) {
    mkdirSync(STATE_DIR, { recursive: true });
    copyRules();
    const stash = stashModOf(userPluginDirs());
    const claudeArgv = [
        '-n',
        SESSION_NAME,
        ...claudeArgs(arm, stash?.dir),
        '--remote-control',
        SESSION_NAME,
        readCharter(),
    ];
    const result = isPane
        ? spawnSync(
              'hc',
              [
                  'run',
                  '--bg',
                  '--no-parent',
                  '--no-notify',
                  '--name',
                  'crow',
                  '--cwd',
                  STATE_DIR,
                  '--label',
                  'seat=crow',
                  '--',
                  'claude',
                  ...claudeArgv,
              ],
              { encoding: 'utf8' },
          )
        : spawnSync('claude', ['--bg', ...claudeArgv], {
              cwd: STATE_DIR,
              encoding: 'utf8',
          });
    if (result.error) {
        fail(`cannot run ${isPane ? 'hc' : 'claude'}: ${result.error.message}`);
    }
    const jobId = isPane
        ? undefined
        : /backgrounded · (\S+)/.exec(
              stripVTControlCharacters(result.stdout),
          )?.[1];
    if (result.status !== 0 || (!isPane && !jobId)) {
        fail(
            `${isPane ? 'hc run' : 'claude --bg'} failed: ${(result.stderr || result.stdout).trim()}`,
        );
    }
    writeState({
        ...readState(),
        arm,
        charterHash: charterHash(),
        jobId,
        startedAt: Date.now(),
    });
    console.log(
        `crow started on ${arm} (${armModels[arm]}, effort medium), ${isPane ? 'in a herdr pane' : `job ${jobId}`}`,
    );

    // --bg ignores --session-id, so the id is known only once the registry lists crow
    let live = findSession();
    for (let i = 0; i < 30 && !live; i++) {
        await sleep(1000);
        live = findSession();
    }
    if (!live) {
        console.log('🔥 off: crow not in the registry after 30 s');
        return;
    }
    armHot(live.sessionId);
}

export function armHot(sessionId: string) {
    const stash = stashModOf(userPluginDirs());
    const store = stash && storeOf(stash.name);
    if (!store) {
        console.log('🔥 off: no stash mod or store file');
        return;
    }
    setHot(store, sessionId, Date.now());
    console.log(
        `🔥 key hot:${sessionId} written; stash re-reads it at crow's next turn end and pings 50 min after`,
    );
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// a /clear or a reopened desktop tab starts a new transcript in crow's project dir; the newest is the live one
export const RELAY_PATH = join(STATE_DIR, 'relay.json');

// a wake parked past the gap advises on a dead state: a 10-13 20:28 wake reached the next day's crow (PK-129)
export function dropStaleRelay(path = RELAY_PATH, now = Date.now()) {
    const parkedAt = statSync(path, { throwIfNoEntry: false })?.mtimeMs;
    if (parkedAt === undefined || now - parkedAt < WAKE_GAP_MS) return false;
    rmSync(path);
    return true;
}
export const HARVEST_DEADLINE_MS = 15 * 60_000;

export function spawnHarvest(wake: Wake) {
    spawnHarvester([wake.id, wake.mode, wake.phase]);
}

export function spawnHarvester(args: string[]) {
    spawn(
        process.execPath,
        [new URL('harvest.ts', import.meta.url).pathname, ...args],
        { detached: true, stdio: 'ignore' },
    ).unref();
}

export function newestTranscript() {
    const dir = join(
        homedir(),
        '.claude/projects',
        STATE_DIR.replaceAll(/[/.]/g, '-'),
    );
    try {
        return globSync('*.jsonl', { cwd: dir })
            .map((f) => join(dir, f))
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    } catch {}
}

// a terminal turn ends on turn_duration, a desktop tab's on stop_hook_summary (no turn_duration there)
export function readTurn(path: string, marker: string): Run | undefined {
    const entries = readLines(path).flatMap((line) => parseEntry(line) ?? []);
    const start = entries.findIndex(
        (entry) =>
            entry.type === 'user' &&
            JSON.stringify(entry.message?.content ?? '').includes(marker),
    );
    if (start === -1) return;
    const end = entries.findIndex(
        (entry, index) =>
            index > start &&
            entry.type === 'system' &&
            (entry.subtype === 'turn_duration' ||
                entry.subtype === 'stop_hook_summary'),
    );
    if (end === -1) return;
    const usageById = new Map<string, Usage>();
    let model: string | null = null;
    let note = '';
    for (const entry of entries.slice(start + 1, end)) {
        if (entry.type !== 'assistant' || !entry.message) continue;
        model = entry.message.model ?? model;
        usageById.set(entry.message.id ?? '', entry.message.usage ?? {});
        const content = entry.message.content;
        for (const block of typeof content === 'string'
            ? []
            : (content ?? [])) {
            if (block.type === 'text' && block.text?.trim())
                note = block.text.trim();
        }
    }
    const usages = [...usageById.values()];
    return {
        model,
        note: note || 'none',
        seconds: Math.round(
            (entries[end]?.durationMs ??
                Date.parse(entries[end]?.timestamp ?? '') -
                    Date.parse(entries[start]?.timestamp ?? '')) / 1000,
        ),
        tokensIn: usages.reduce((sum, usage) => sum + tokensIn(usage), 0),
        tokensOut: usages.reduce(
            (sum, usage) => sum + (usage.output_tokens ?? 0),
            0,
        ),
    };
}

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

const NOTIFICATION_MAX_CHARS = 2_000;

// a task-notification carries a subagent's whole report; crow needs its gist and where the rest lives
function capNotifications(text: string) {
    let capped = 0;
    const kept = text.replace(
        /<task-notification>[\s\S]*?<\/task-notification>/g,
        (block) => {
            if (block.length <= NOTIFICATION_MAX_CHARS) return block;
            capped++;
            const file = /<output-file>([^<]*)<\/output-file>/.exec(block)?.[1];
            return `${block.slice(0, NOTIFICATION_MAX_CHARS)} …[cut${file ? `; full: ${file}` : ''}]`;
        },
    );
    return { capped, text: kept };
}

// the cut drops whole blocks from the head, so a packet never opens on an orphan fragment
function lastBlocks(parts: string[]) {
    const kept: string[] = [];
    let size = 0;
    for (const part of parts.toReversed()) {
        if (size + part.length + 2 > DELTA_MAX_CHARS && kept.length > 0) break;
        kept.unshift(part);
        size += part.length + 2;
    }
    const text = kept.join('\n\n');
    const dropped =
        parts.length - kept.length + (text.length > DELTA_MAX_CHARS ? 1 : 0);
    return { dropped, text: text.slice(-DELTA_MAX_CHARS) };
}

// crow times its sends off each block; a block whose entry has no timestamp prints none
function headOf(who: string, timestamp?: string) {
    const at = timestamp ? new Date(timestamp) : undefined;
    return at && !Number.isNaN(at.getTime())
        ? `## ${who} · ${pad(at.getHours())}:${pad(at.getMinutes())}`
        : `## ${who}`;
}

// a compaction can re-append the old chain under its own uuids and stamps, so a line offset alone lets it back in
export function transcriptDelta(lines: string[], fromLine: number) {
    const stepIds = new Set<string>();
    const parts: string[] = [];
    const dimaParts: string[] = [];
    let outputs = 0;
    const seen = new Set(
        lines.slice(0, fromLine).map((line) => parseEntry(line)?.uuid),
    );
    for (const entry of lines.slice(fromLine).map(parseEntry)) {
        if (entry?.uuid) {
            if (seen.has(entry.uuid)) continue;
            seen.add(entry.uuid);
        }
        if (entry && isDimaEntry(entry))
            dimaParts.push(
                `${headOf('dima', entry.timestamp)}\n${dimaTextOf(entry)}`,
            );
        if (entry?.type === 'assistant') {
            if (entry.message?.id) stepIds.add(entry.message.id);
            const text = textOf(entry.message?.content).trim();
            if (text) parts.push(`${headOf('clio', entry.timestamp)}\n${text}`);
        }
        // a message dima types while clio is mid-turn lands as a queued_command attachment, never a user entry
        if (
            entry?.type === 'attachment' &&
            entry.attachment?.type === 'queued_command'
        ) {
            const text = queuedText(entry.attachment.prompt).trim();
            if (text && !text.includes('<cross-session-message'))
                parts.push(`${headOf('dima', entry.timestamp)}\n${text}`);
        }
        // dima's orbit ticks and notes reach clio only as hook context, never as a user entry
        if (
            entry?.type === 'attachment' &&
            entry.attachment?.type === 'hook_additional_context'
        ) {
            const content = entry.attachment.content;
            for (const line of typeof content === 'string'
                ? [content]
                : (content ?? [])) {
                if (line.startsWith('orbit: dima marked'))
                    parts.push(
                        `${headOf('dima', entry.timestamp)}\n${line.trim()}`,
                    );
            }
        }
        if (entry?.type === 'user') {
            const text = textOf(entry.message?.content).trim();
            if (!text) continue;
            const who = entry.origin?.kind === 'peer' ? 'peer' : 'dima';
            if (who === 'dima' && (entry.isMeta || entry.isCompactSummary))
                continue;
            const notified = capNotifications(text);
            outputs += notified.capped;
            parts.push(`${headOf(who, entry.timestamp)}\n${notified.text}`);
        }
    }
    const { dropped, text } = lastBlocks(parts);
    return {
        cut: { blocks: dropped, outputs },
        dimaText: lastBlocks(dimaParts).text,
        steps: stepIds.size,
        text,
    };
}

// what dima himself said in this entry: a typed or queued line, or an orbit tick; a peer, a subagent's notice, a hook's reminder is not him
function dimaTextOf(entry: TranscriptEntry) {
    if (entry.type === 'attachment') {
        if (entry.attachment?.type === 'queued_command') {
            const text = withoutHarness(queuedText(entry.attachment.prompt));
            return text.includes('<cross-session-message') ? '' : text;
        }
        if (entry.attachment?.type !== 'hook_additional_context') return '';
        const content = entry.attachment.content;
        return (typeof content === 'string' ? [content] : (content ?? []))
            .filter((line) => line.startsWith('orbit: dima marked'))
            .join('\n')
            .trim();
    }
    if (entry.type !== 'user' || entry.isMeta || entry.isCompactSummary)
        return '';
    const kind = entry.origin?.kind;
    if (kind && kind !== 'human') return '';
    return withoutHarness(textOf(entry.message?.content));
}

// the harness writes its reminders and notices as user entries, and dima's own words may sit beside them
function withoutHarness(text: string) {
    return text.replace(HARNESS_TEXT, '').trim();
}

function isDimaEntry(entry: TranscriptEntry) {
    return dimaTextOf(entry) !== '';
}

function toolCallsOf(entries: (TranscriptEntry | undefined)[]) {
    const calls = new Map<string, ToolCall>();
    for (const entry of entries) {
        const content = entry?.message?.content;
        // cc 2.1.31x also writes `api-request-blob` copies of these blocks
        if (entry?.type !== 'assistant' && entry?.type !== 'user') continue;
        if (!Array.isArray(content)) continue;
        for (const block of content) {
            if (block.type === 'tool_use' && block.id)
                calls.set(block.id, {
                    input: block.input ?? {},
                    name: block.name ?? '?',
                });
            const call = calls.get(block.tool_use_id ?? '');
            if (block.type === 'tool_result' && call) call.result = block;
        }
    }
    return [...calls.values()];
}

const oneLine = (text: string, max: number) =>
    text.replace(/\s+/g, ' ').trim().slice(0, max);

function resultText(result: ContentBlock | undefined) {
    const content = result?.content;
    return typeof content === 'string' ? content : textOf(content);
}

// a long gate ends `> file 2>&1; echo "exit $?"` (method-silent-failures), so a red one comes back with no error flag
function exitOf({ result }: ToolCall) {
    const text = resultText(result);
    if (result?.is_error) return /^Exit code (\d+)/.exec(text)?.[1] ?? '?';
    return [...text.matchAll(/^exit (\d+)\s*$/gm)].at(-1)?.[1] ?? '0';
}

// a command opens on its `cd … && S=<long path>` and a heredoc ends on the act, so both ends stay
function headAndTail(text: string) {
    return text.length <= COMMAND_MAX_CHARS
        ? text
        : `${text.slice(0, COMMAND_MAX_CHARS / 2)} … ${text.slice(-COMMAND_MAX_CHARS / 2)}`;
}

function receiptLine(call: ToolCall) {
    const { input, name, result } = call;
    const content = result?.content;
    const text = resultText(result);
    const hasImage =
        Array.isArray(content) && content.some((b) => b.type === 'image');
    const exit = result && name === 'Bash' ? exitOf(call) : undefined;
    const status = !result
        ? 'pending'
        : exit
          ? `exit ${exit}`
          : result.is_error
            ? 'error'
            : 'ok';
    const firstError =
        result?.is_error || (exit && exit !== '0')
            ? text
                  .split('\n')
                  .find((l) => l.trim() && !/^(Exit code|exit \d)/.test(l))
            : undefined;
    return [
        `- ${name} ${status}`,
        input.command
            ? headAndTail(oneLine(input.command, input.command.length))
            : oneLine(
                  input.file_path ??
                      input.url ??
                      input.description ??
                      JSON.stringify(input),
                  RECEIPT_MAX_CHARS,
              ),
        hasImage
            ? input.file_path
                ? `[image: ${input.file_path}]`
                : '[image]'
            : '',
        firstError ? oneLine(firstError, RECEIPT_MAX_CHARS) : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

// the receipts beside clio's claims: one line per tool call since dima last spoke; crow reads them and never re-runs one
export function receiptsOf(lines: string[]) {
    const entries = lines.map(parseEntry);
    const start = entries.findLastIndex(
        (entry) => entry !== undefined && isDimaEntry(entry),
    );
    const digest = toolCallsOf(entries.slice(start + 1)).map(receiptLine);
    const dropped = digest.length - RECEIPTS_MAX;
    return [
        ...(dropped > 0 ? [`(${dropped} older calls dropped)`] : []),
        ...digest.slice(-RECEIPTS_MAX),
    ].join('\n');
}

const HARNESS_TEXT =
    /<(system-reminder|task-notification|local-command-\w+)>[\s\S]*?<\/\1>|<task-notification>[\s\S]*$/g;
const RECEIPTS_MAX = 100;
const RECEIPT_MAX_CHARS = 160;
const COMMAND_MAX_CHARS = 300;

// a packet that lost blocks or tool output names the transcript, so crow reads its tail only then
export function cutLine(cut: Cut, transcriptPath: string) {
    if (cut.blocks === 0 && cut.outputs === 0) return '';
    return `cut: ${cut.blocks} older blocks dropped, ${cut.outputs} tool outputs capped · transcript ${transcriptPath}`;
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

// crow holds a leaf it read earlier in the same transcript; a /clear starts a new one and gets every leaf again
export function leavesToSend(
    paths: string[],
    state: State,
    crowTranscript: string | undefined,
) {
    const known =
        state.leavesFor === crowTranscript ? (state.leafHashes ?? {}) : {};
    const hashes: Record<string, string> = {};
    const changed: string[] = [];
    const unchanged: string[] = [];
    for (const path of paths) {
        hashes[path] = createHash('sha1')
            .update(readFileSync(path))
            .digest('hex');
        (known[path] === hashes[path] ? unchanged : changed).push(path);
    }
    return { changed, hashes, unchanged };
}

export function buildPacket({
    charter,
    cut = '',
    deltaText,
    dir,
    held = [],
    leaves,
    ledger,
    meter,
    missing,
    proposal,
    receipts,
    thread = MAIN_THREAD,
    unchanged = [],
}: PacketInput) {
    mkdirSync(dir, { recursive: true });
    const proposalBlock = proposal
        ? `## proposal · ${proposal}\n\n${readFileSync(proposal, 'utf8').trim()}`
        : '';
    const leafBlocks = leaves.map(
        (path) => `## leaf · ${path}\n\n${readFileSync(path, 'utf8').trim()}`,
    );
    const unchangedNote = unchanged.length
        ? `## leaves unchanged since your last read\n${unchanged.map((path) => `- ${path}`).join('\n')}`
        : '';
    const missingNote = missing.length
        ? `## leaves with no match\n${missing.map((line) => `- ${line}`).join('\n')}`
        : '';
    const body = [
        ...(ledger ? [ledger] : []),
        ...(meter ? [meter] : []),
        ...(charter ? [`## charter changed\n\n${charter}`] : []),
        ...(held.length
            ? [
                  `${HELD_HEAD} · a restart ended it; send each, or drop it with a reason\n\n${held.map((n) => `${n.id}, ${n.at}\n${n.note}`).join('\n\n')}`,
              ]
            : []),
        `# ${threadLabel(thread)} since the last wake\n\n${cut ? `${cut}\n\n` : ''}${deltaText || '(no text)'}`,
        ...(receipts === undefined
            ? []
            : [
                  `## receipts · clio's tool calls since dima's last line\n${receipts || '(none)'}`,
              ]),
        proposalBlock,
        ...leafBlocks,
        unchangedNote,
        missingNote,
    ].filter(Boolean);
    writeFileSync(join(dir, 'packet.md'), `${body.join('\n\n')}\n`);
    return ['packet.md'];
}

// the words of each command in a shell line, quotes honoured, so a merge quoted in a commit message is no merge
function shellCommands(line: string) {
    const commands: string[][] = [];
    let words: string[] = [];
    let word = '';
    let hasWord = false;
    let quote = '';
    const endWord = () => {
        if (hasWord) words.push(word);
        word = '';
        hasWord = false;
    };
    const endCommand = () => {
        endWord();
        if (words.length) commands.push(words);
        words = [];
    };
    for (let i = 0; i < line.length; i++) {
        const char = line[i] ?? '';
        if (quote) {
            if (char === quote) quote = '';
            else if (char === '\\' && quote === '"') word += line[++i] ?? '';
            else word += char;
        } else if (char === '"' || char === "'") {
            quote = char;
            hasWord = true;
        } else if (char === '\\') {
            word += line[++i] ?? '';
            hasWord = true;
        } else if (/[;|&\n()]/.test(char)) {
            endCommand();
        } else if (/\s/.test(char)) {
            endWord();
        } else {
            word += char;
            hasWord = true;
        }
    }
    endCommand();
    return commands;
}

// a script that sends to a paid api says so in its source, so no list of scripts drifts
function isPaidSource(path: string, cwd: string) {
    try {
        return PAID_SOURCE.test(
            readFileSync(
                resolve(cwd, path.replace(/^~(?=\/)/, homedir())),
                'utf8',
            ),
        );
    } catch {
        return false;
    }
}

function isPaidPnpmVerb(words: string[], cwd: string) {
    let dir = cwd;
    let verb: string | undefined;
    for (let i = 1; i < words.length && !verb; i++) {
        const word = words[i] ?? '';
        if (word === '-C' || word === '--dir')
            dir = resolve(
                cwd,
                (words[++i] ?? '').replace(/^~(?=\/)/, homedir()),
            );
        else if (!word.startsWith('-') && word !== 'run') verb = word;
    }
    try {
        const script: unknown = JSON.parse(
            readFileSync(join(dir, 'package.json'), 'utf8'),
        ).scripts?.[verb ?? ''];
        return typeof script === 'string'
            ? isPaidCall(script.split(/\s+/), dir, [])
            : false;
    } catch {
        return false;
    }
}

function isPaidCall(words: string[], cwd: string, bodies: string[]): boolean {
    const [head = ''] = words;
    if (NETWORK_TOOL.test(head)) return words.some((w) => PAID_URL.test(w));
    if (head === 'pnpm') return isPaidPnpmVerb(words, cwd);
    if (!SCRIPT_RUNNER.test(head)) return false;
    const args = words.slice(1);
    return (
        args.join(' ').match(PAID_VERB) !== null ||
        args.some((word) =>
            word.startsWith('<<')
                ? bodies.some((body) => PAID_SOURCE.test(body))
                : PAID_SOURCE.test(word) ||
                  (SCRIPT_FILE.test(word) && isPaidSource(word, cwd)),
        )
    );
}

// a heredoc's body is data unless its command reads it, so it never splits into commands of its own
function splitHeredocs(line: string) {
    const bodies: string[] = [];
    const kept: string[] = [];
    const lines = line.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const row = lines[i] ?? '';
        kept.push(row);
        const delimiter = /<<-?\s*['"]?(\w+)['"]?/.exec(row)?.[1];
        const end = delimiter
            ? lines.findIndex((l, at) => at > i && l.trim() === delimiter)
            : -1;
        if (end === -1) continue;
        bodies.push(lines.slice(i + 1, end).join('\n'));
        i = end;
    }
    return { bodies, script: kept.join('\n') };
}

// `op-run.sh`, `env` and `sh -c '…'` run the real command, so the real command is the one judged
function realCommands(script: string): string[][] {
    return shellCommands(script).flatMap((command) => {
        let words = command.slice(command.findIndex((w) => !/^\w+=/.test(w)));
        while (WRAPPER.test(words[0] ?? '')) {
            words = words.slice(1);
            words = words.slice(words.findIndex((w) => !/^\w+=/.test(w)));
        }
        return SHELL.test(words[0] ?? '') && words[1] === '-c'
            ? realCommands(words[2] ?? '')
            : [words];
    });
}

// a merge, a paid call and a console write wait for crow's note; a spawn, a post and a close wake it and run on
export function decisionOf(
    line: string,
    cwd = process.cwd(),
): Decision | undefined {
    const what = oneLine(line, RECEIPT_MAX_CHARS);
    const { bodies, script } = splitHeredocs(line);
    let dir = cwd;
    for (const words of realCommands(script)) {
        if (words[0] === 'cd' && words[1])
            dir = resolve(dir, words[1].replace(/^~(?=\/)/, homedir()));
        const [head, verb, act] = words;
        if (head === 'gh' && verb === 'pr' && act === 'merge')
            return { args: words.slice(3), kind: 'merge' };
        // a merge goes through x since FRM-427, often behind a `timeout N`; with no --apply it only plans
        const at = words[0] === 'timeout' ? 2 : 0;
        if (
            words[at] === 'x' &&
            words[at + 1] === 'lane' &&
            words[at + 2] === 'merge-auto' &&
            words.includes('--apply')
        )
            return { args: words.slice(at + 3), kind: 'merge' };
        if (head === 'claude' && words.includes('--bg'))
            return { kind: 'spawn' };
        if (isPaidCall(words, dir, bodies)) return { kind: 'paid', what };
        if (
            head === 'gh' &&
            (verb === 'pr' || verb === 'issue') &&
            (act === 'create' || act === 'comment')
        )
            return { kind: 'post', what: `gh ${verb} ${act}` };
        if (head === 'slk' && (verb === 'send' || verb === 's'))
            return { kind: 'post', what: 'slk send' };
        if (head === 'himalaya' && words.includes('send'))
            return { kind: 'post', what: 'himalaya send' };
        if (head === 'x' && verb === 'linear' && act === 'set') {
            const flag = words.findIndex((w) => /^--state(=|$)/.test(w));
            const state =
                words[flag]?.split('=')[1] ??
                (flag >= 0 ? words[flag + 1] : undefined);
            if (/^(done|canceled)$/i.test(state ?? ''))
                return { kind: 'close', what: words[3] ?? '?' };
        }
    }
}

// a click has no url of its own, so it counts on the page clio last navigated to
export function consoleOf(
    tool: string | undefined,
    input: { url?: string; action?: string } | undefined,
    lines: () => string[],
): Decision | undefined {
    if (!tool || !BROWSER_ACT.test(tool)) return;
    if (input?.action && BROWSER_READ.has(input.action)) return;
    const url =
        input?.url ??
        toolCallsOf(lines().map(parseEntry)).findLast(
            (call) => call.name.endsWith('__navigate') && call.input.url,
        )?.input.url;
    return url && CONSOLE_URL.test(url) ? { kind: 'console', url } : undefined;
}

const PAID_URL =
    /api\.(anthropic|openai)\.com|\/messages\/batches|\/v1\/batches/;
const PAID_SOURCE =
    /(?:from|import|require\()\s*['"]@anthropic-ai\/sdk|^\s*(?:import|from)\s+anthropic\b|['"`]https:\/\/api\.anthropic\.com\/v1\//m;
// the $54 batch of 2026-11-03: `script/op-run.sh python3 -I <scratch>/retro/batch.py submit`, its script gone with the scratch
const PAID_VERB = /\bbatch\.py\s+submit\b/;
const SCRIPT_RUNNER = /(^|\/)(node|python3?|bun|tsx|deno)$/;
const SCRIPT_FILE = /\.(c|m)?(js|ts)$|\.py$/;
const NETWORK_TOOL = /^(curl|wget|xh)$/;
const WRAPPER = /(^|\/)(op-run\.sh|env|time|exec|nohup)$/;
const SHELL = /(^|\/)(sh|bash|zsh)$/;
const BROWSER_ACT =
    /^mcp__(Claude_Browser|claude-in-chrome)__(navigate|computer|form_input)$/;
const BROWSER_READ = new Set(['screenshot', 'wait', 'scroll', 'zoom', 'hover']);
const CONSOLE_URL =
    /console\.anthropic\.com|platform\.claude\.com|\/billing(\/|\b)/i;

// a proposal clio writes for dima wakes crow before he ticks it; any other write is no decision
export function proposalOf(
    tool: string | undefined,
    path: string | undefined,
    command?: string,
): Decision | undefined {
    if ((tool === 'Write' || tool === 'Edit') && path && PROPOSAL.test(path))
        return { kind: 'proposal', path };
    // a heredoc or tee writes the proposal from Bash: its target follows the redirect
    if (tool === 'Bash' && command) {
        const target = [
            ...command.matchAll(
                /(?:>>?|\btee(?: -a)?)\s*["']?([^\s"';&|<>]+)/g,
            ),
        ]
            .map((match) => match[1] ?? '')
            .find((candidate) => PROPOSAL.test(candidate));
        if (target)
            return {
                kind: 'proposal',
                path: target.replace(/^~(?=\/)/, homedir()),
            };
    }
}

const PROPOSAL = /(^|\/)\.scratch\/(.+\/)?[^/]+-proposal\.md$/;

// a turn starts at a user entry with text (a prompt or a peer's message); a tool result carries none
export function turnStartOf(lines: string[]) {
    for (let i = lines.length - 1; i >= 0; i--) {
        const entry = parseEntry(lines[i] ?? '');
        if (
            entry?.type === 'user' &&
            !entry.isMeta &&
            withoutHarness(textOf(entry.message?.content))
        )
            return i;
    }
    return -1;
}

const MERGE_VALUE_FLAGS = new Set([
    '-A',
    '--author-email',
    '-b',
    '--body',
    '-F',
    '--body-file',
    '--match-head-commit',
    '-R',
    '--repo',
    '-t',
    '--subject',
]);

// `gh pr view` takes the same selector and repo the merge was given
export function prViewArgs(mergeArgs: string[]) {
    let selector: string | undefined;
    let repo: string | undefined;
    for (let i = 0; i < mergeArgs.length; i++) {
        const arg = mergeArgs[i] ?? '';
        const [flag = '', inline] = arg.split(/=(.*)/s);
        const value = inline ?? mergeArgs[i + 1];
        if (flag === '-R' || flag === '--repo') repo = value;
        if (MERGE_VALUE_FLAGS.has(flag) && inline === undefined) i++;
        else if (!arg.startsWith('-')) selector ??= arg;
    }
    return [
        'pr',
        'view',
        ...(selector ? [selector] : []),
        ...(repo ? ['--repo', repo] : []),
        '--json',
        'number,headRefOid,url',
    ];
}

const VERIFIED_PATH = join(homedir(), '.claude/shelf/pr-verified.json');

// written by sixth sense on clean (`watch-pr.sh --verified`), keyed `owner/repo#n`
export function verifiedHead(key: string) {
    try {
        const sha: unknown = JSON.parse(readFileSync(VERIFIED_PATH, 'utf8'))[
            key
        ];
        return typeof sha === 'string' && sha ? sha : undefined;
    } catch {}
}

// one packet for any wake: the delta since the last one, plus the leaves changed since crow last read them
export function packWake({
    delta,
    lines,
    now,
    proposal,
    state,
    thread = MAIN_THREAD,
    transcriptPath,
    wakeId,
}: PackInput) {
    let leafPatterns: string[] = [];
    try {
        leafPatterns = readFileSync(
            join(STATE_DIR, 'leaves.txt'),
            'utf8',
        ).split('\n');
    } catch {}
    const leaves = resolveLeaves(leafPatterns, localDay(now));
    const crowTranscript = newestTranscript();
    const toSend = leavesToSend(leaves.found, state, crowTranscript);
    const hash = charterHash();
    const charter =
        state.charterHash && state.charterHash !== hash
            ? readCharter()
            : undefined;
    const receipts = receiptsOf(lines);
    const files = buildPacket({
        charter,
        cut: cutLine(delta.cut, transcriptPath),
        deltaText: delta.text,
        dir: join(STATE_DIR, 'packets', wakeId),
        held: isHeldDue(state, crowTranscript, thread)
            ? heldUnsent(now, NOTES_PATH, thread)
            : [],
        leaves: toSend.changed,
        ledger: ledgerLine(now, NOTES_PATH, VERDICTS_PATH, thread),
        meter: meterLine(now),
        missing: leaves.missing,
        proposal,
        receipts,
        thread,
        unchanged: toSend.unchanged,
    });
    return {
        files,
        missing: leaves.missing,
        state: {
            ...state,
            charterHash: hash,
            leafHashes: toSend.hashes,
            leavesFor: crowTranscript,
            offsets: { ...state.offsets, [transcriptPath]: lines.length },
        } satisfies State,
    };
}

// the cadence's park line, `clio:shift` § the 5h ladder: with 55 min or less left the fleet burns, so nothing parks, and 97 % keeps its reserve
export function isParked(now: Date, usagePath = USAGE_PATH) {
    try {
        const fiveHour = (
            JSON.parse(readFileSync(usagePath, 'utf8')) as UsageFile
        ).rate_limits?.five_hour;
        if (!fiveHour) return false;
        const msLeft = fiveHour.resets_at * 1000 - now.getTime();
        if (msLeft <= 0) return false;
        if (fiveHour.used_percentage >= 97) return true;
        if (msLeft <= 55 * 60_000) return false;
        const pace = (1 - msLeft / FIVE_HOURS_MS) * 100;
        return (
            fiveHour.used_percentage - pace >= 5 ||
            fiveHour.used_percentage >= 90
        );
    } catch {
        return false;
    }
}

const FIVE_HOURS_MS = 5 * 3_600_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function localDay(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function wakeIdOf(date: Date) {
    return `${localDay(date).replaceAll('-', '')}${pad(date.getHours())}${pad(date.getMinutes())}`;
}

// the separator ends the id: main's 2240 is a prefix of a wing's 2240w3
export const wakeMarker = (wakeId: string) => `crow wake ${wakeId} ·`;

export function wakeLine(wake: Wake) {
    const thread = wake.thread
        ? ` · thread ${wake.thread.id} · reply to «${wake.thread.name}»`
        : '';
    return `crow wake ${wake.id} · mode ${wake.mode} · ${wake.phase} · packet ${join(STATE_DIR, 'packets', wake.id, 'packet.md')} · charter ${charterHash()} ${CHARTER_PATH}${thread}`;
}

export function dayOf(firstWakeAt: number, now: number) {
    return Math.floor((now - firstWakeAt) / 86_400_000) + 1;
}

// dima, 2026-10-13: opus 5.5 medium only, the day alternation is gone
export const liveArm: Arm = 'opus';

export function sendLine(socketPath: string, text: string) {
    const frame = JSON.stringify({
        from_name: 'crow:wake',
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

export function appendJsonl(path: string, value: Note | PlanNote | Verdict) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(value)}\n`, { flag: 'a' });
}

// two harvesters on one wake wrote the same note 2 ms apart (11-03, 11-04), past a read of the file, so a claim file decides
export function appendNoteOnce(path: string, value: Note) {
    if (jsonlOf<{ id?: string }>(path).some((row) => row.id === value.id))
        return;
    const claims = `${path}.ids`;
    mkdirSync(claims, { recursive: true });
    try {
        closeSync(openSync(join(claims, value.id), 'wx'));
    } catch {
        return;
    }
    appendJsonl(path, value);
}

// crow's day in one line: notes sent today, the last send's time, today's ok verdicts
// the budget hunt quotes this line; x-mod-stash writes the file on every session.measure
export function meterLine(now: Date, usagePath = USAGE_PATH) {
    try {
        const { rate_limits: limits, written_at: writtenAt } = JSON.parse(
            readFileSync(usagePath, 'utf8'),
        ) as UsageFile;
        const fiveHour = limits?.five_hour;
        const week = limits?.seven_day;
        if (!fiveHour || !week) return '';
        const hoursLeft = (at: number) =>
            Math.max(0, Math.round((at * 1000 - now.getTime()) / 36e5));
        const age = Math.round((now.getTime() - (writtenAt ?? 0) * 1000) / 6e4);
        return `⏱️ 5h ${fiveHour.used_percentage} %, resets in ${hoursLeft(fiveHour.resets_at)} h | weekly ${week.used_percentage} %, resets in ${hoursLeft(week.resets_at)} h | read ${age} min ago`;
    } catch {
        return '';
    }
}

// a held note opens with «🟡 held:» since 10-12; older ones end on «holdout»
const isHeld = (n: { note: string }) =>
    /^🟡 held:/m.test(n.note) || /holdout\s*$/.test(n.note);

// a restart loses what the last crow held: its notes of the last hour with nothing sent after them
const HELD_HEAD = '## held by the last crow';

export function packetCarriedHeld(wakeId: string) {
    try {
        return readFileSync(
            join(STATE_DIR, 'packets', wakeId, 'packet.md'),
            'utf8',
        ).includes(HELD_HEAD);
    } catch {
        return false;
    }
}

// heldFor was one transcript before the seats split, and only main had a thread then
export const heldMapOf = (state: State): Record<string, string> =>
    typeof state.heldFor === 'string'
        ? { [MAIN_THREAD]: state.heldFor }
        : (state.heldFor ?? {});

// no heldFor yet: the crow that read the leaves is the live one, so its own hold stays its own
export const isHeldDue = (
    state: State,
    crowTranscript?: string,
    thread = MAIN_THREAD,
) => (heldMapOf(state)[thread] ?? state.leavesFor) !== crowTranscript;

// moves only after crow took a turn: a parked or dropped relay keeps the note due, and a /clear
// relay that carried none leaves it due for the transcript the relay landed in
export function heldForAfterTurn(
    state: State,
    turnPath: string,
    packetCarriedHeld: boolean,
    thread = MAIN_THREAD,
) {
    return state.leavesFor === turnPath || packetCarriedHeld
        ? turnPath
        : (heldMapOf(state)[thread] ?? state.leavesFor);
}

// a thread's packet carries only the notes crow holds for that thread, and a note sent to another settles none of them
export function heldUnsent(
    now: Date,
    notesPath = NOTES_PATH,
    thread = MAIN_THREAD,
) {
    const since = now.getTime() - 3_600_000;
    const rows = jsonlOf<{
        at?: string;
        channel?: string;
        id?: string;
        note?: string;
    }>(notesPath)
        .filter((n) => n.channel === 'session' && typeof n.note === 'string')
        .map((n) => ({
            at: n.at ?? '',
            id: n.id ?? '',
            note: (n.note ?? '').trim(),
        }))
        .filter(
            (n) =>
                new Date(n.at).getTime() > since &&
                threadOfNoteId(n.id) === thread,
        );
    const lastSent = rows.findLastIndex(
        (n) => n.note && n.note !== 'none' && !isHeld(n),
    );
    return rows.slice(lastSent + 1).filter(isHeld);
}

export function ledgerLine(
    now: Date,
    notesPath = NOTES_PATH,
    verdictsPath = VERDICTS_PATH,
    thread = MAIN_THREAD,
) {
    const today = localDay(now);
    const notes = jsonlOf<{
        at?: string;
        channel?: string;
        id?: string;
        note?: string;
    }>(notesPath)
        .filter(
            (n) =>
                n.channel === 'session' &&
                typeof n.note === 'string' &&
                threadOfNoteId(n.id ?? '') === thread,
        )
        .map((n) => ({ at: new Date(n.at ?? 0), note: (n.note ?? '').trim() }));
    const wouldSend = notes.filter((n) => n.note !== 'none' && n.note !== '');
    const sent = wouldSend.filter((n) => !isHeld(n));
    const sentToday = sent.filter((n) => localDay(n.at) === today).length;
    const last = sent.at(-1)?.at;
    const hits = jsonlOf<{ at?: string; id?: string; value?: string }>(
        verdictsPath,
    ).filter(
        (v) =>
            v.value === 'ok' &&
            localDay(new Date(v.at ?? 0)) === today &&
            threadOfNoteId(v.id ?? '') === thread,
    ).length;
    return [
        `📒 ${sentToday} sent today`,
        `last ${last ? `${pad(last.getHours())}:${pad(last.getMinutes())}` : 'none'}`,
        `🎯 ${hits} ok today`,
    ].join(' | ');
}

function jsonlOf<T>(path: string): T[] {
    let text = '';
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return [];
    }
    return text.split('\n').flatMap((line) => {
        try {
            return line.trim() ? [JSON.parse(line) as T] : [];
        } catch {
            return [];
        }
    });
}

export function tokensIn(usage: Usage) {
    return (
        (usage.input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0)
    );
}

// a -p transcript has no turn_duration line; its assistant entries still name the model
export function oneShotModel(cwd: string, sessionId: string) {
    let model: string | null = null;
    for (const line of readLines(transcriptPathOf(cwd, sessionId))) {
        model = parseEntry(line)?.message?.model ?? model;
    }
    return model;
}

export const ONE_SHOT_DEADLINE_MS = 15 * 60_000;

export async function runOneShot(
    args: string[],
    prompt: string,
    cwd: string,
): Promise<{ result: OneShotResult } | { error: string }> {
    const child = spawn(
        'claude',
        ['-p', ...args, '--output-format', 'json', prompt],
        { cwd },
    );
    const timer = setTimeout(() => child.kill(), ONE_SHOT_DEADLINE_MS);
    let stdout = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk;
    });
    const exit = await new Promise<string>((resolve) => {
        child.on('error', (error) => resolve(error.message));
        child.on('close', (code, signal) => resolve(`exit ${code ?? signal}`));
    });
    clearTimeout(timer);
    let result: OneShotResult;
    try {
        result = JSON.parse(stdout);
    } catch {
        return { error: `no json (${exit}): ${stdout.slice(0, 200)}` };
    }
    if (result.is_error)
        return { error: `is_error: ${String(result.result).slice(0, 200)}` };
    return { result };
}

const blindHeading = /\b(want|constraints?|done test|not)\b/i;

// pass 1 sees only the sections that say what is wanted, never how
export function blindSections(plan: string) {
    const kept: string[] = [];
    let level = 0;
    let keep = false;
    let fenced = false;
    for (const line of plan.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
        const heading = fenced ? null : /^(#{1,6})\s+(.*)$/.exec(line);
        const depth = heading?.[1]?.length ?? 0;
        if (heading && (!keep || depth <= level)) {
            keep = blindHeading.test(heading[2] ?? '');
            level = depth;
        }
        if (keep) kept.push(line);
    }
    return kept.join('\n').trim();
}

export function blindPrompt(sections: string) {
    return `you are an outside adviser. someone wants the thing below built; no plan exists yet. you see the want, the constraints and the done test only.

give, in under 300 words:
- your top 3 approaches, one line each with its main tradeoff
- the 5 likeliest ways any approach to this fails

do not read files and do not ask questions; answer from the text.

${sections}`;
}

export const PLAN_FINDINGS_MAX = 5;

export function planPrompt(plan: string, blindTake: string) {
    const blind = blindTake
        ? `\n## your own take, written before you saw the plan\n\n${blindTake}\n`
        : '';
    return `you are an outside adviser arguing with a plan before anything is built. you were not in the room; the plan is all you get: do not read files and do not ask questions; answer from the text.

work through this template, in order:
1. predict the 3–5 likeliest problem areas before reading in detail
2. a pre-mortem: assume this plan was executed exactly as written and failed — 5 concrete failure scenarios
3. the strongest argument against each decision, and the alternative that was likely rejected
4. what is missing
5. the fragile assumptions, each rated high, medium or low
6. a self-audit per finding: could the author refute it with context you lack? if yes, it moves to the open questions instead
7. at most ${PLAN_FINDINGS_MAX} findings, each quoting the exact plan line it targets (copied verbatim, one line), with a cheap test that would confirm it
8. a verdict: proceed, revise, investigate or reject. «no material objection» is an allowed answer — then findings may be empty
${blind}
## the plan

${plan}`;
}

const strings = { items: { type: 'string' }, type: 'array' };
const rated = { enum: ['high', 'medium', 'low'] };
export const planSchema = {
    additionalProperties: false,
    properties: {
        againstDecisions: {
            items: {
                additionalProperties: false,
                properties: {
                    alternative: { type: 'string' },
                    argument: { type: 'string' },
                    decision: { type: 'string' },
                },
                required: ['decision', 'argument', 'alternative'],
                type: 'object',
            },
            type: 'array',
        },
        findings: {
            items: {
                additionalProperties: false,
                properties: {
                    problem: { type: 'string' },
                    quote: { type: 'string' },
                    severity: rated,
                    test: { type: 'string' },
                },
                required: ['quote', 'problem', 'severity', 'test'],
                type: 'object',
            },
            maxItems: PLAN_FINDINGS_MAX,
            type: 'array',
        },
        fragileAssumptions: {
            items: {
                additionalProperties: false,
                properties: {
                    assumption: { type: 'string' },
                    rating: rated,
                },
                required: ['assumption', 'rating'],
                type: 'object',
            },
            type: 'array',
        },
        missing: strings,
        noMaterialObjection: { type: 'boolean' },
        openQuestions: strings,
        preMortem: strings,
        problemAreas: strings,
        verdict: { enum: ['proceed', 'revise', 'investigate', 'reject'] },
    },
    required: [
        'problemAreas',
        'preMortem',
        'againstDecisions',
        'missing',
        'fragileAssumptions',
        'openQuestions',
        'findings',
        'verdict',
        'noMaterialObjection',
    ],
    type: 'object',
};

const squash = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

// a finding counts as located only when its quote is really in the plan
export function isLocated(plan: string, quote: string) {
    const needle = squash(quote.replace(/^[\s>*-]+/, ''));
    return needle.length > 0 && squash(plan).includes(needle);
}

export function planNotes(run: PlanRun, review: PlanReview): PlanNote[] {
    const { planText, ...base } = run;
    const shared = {
        ...base,
        channel: 'plan' as const,
        noMaterialObjection: review.noMaterialObjection,
        verdict: review.verdict,
    };
    // the schema caps findings, but the model's json is still untrusted input
    const findings = review.findings.slice(0, PLAN_FINDINGS_MAX);
    const { costUsd, ...perFinding } = shared;
    // the -0 row is the run: the cost sits there once, so summing the rows gives the run's cost
    return [
        { ...shared, finding: null, id: `plan-${run.runId}-0` },
        ...findings.map((finding, index) => ({
            ...perFinding,
            finding: {
                ...finding,
                located: isLocated(planText, finding.quote),
            },
            id: `plan-${run.runId}-${index + 1}`,
        })),
    ];
}

/* Types */

export type Arm = (typeof armList)[number];
export type Effort = 'medium' | 'high';
export type Mode = (typeof modeList)[number];
export type Phase = 'silent' | 'live';

export interface Wake {
    id: string;
    mode: Mode;
    phase: Phase;
    thread?: ClioThread;
}

export interface State {
    arm?: Arm;
    charterHash?: string;
    jobId?: string;
    startedAt?: number;
    firstWakeAt?: number;
    // per clio thread, each on its own 30 min clock; an older state's single number reads as no clock
    lastWakeAt?: Record<string, number>;
    offsets: Record<string, number>;
    // per thread; a string is the state before the seats split
    heldFor?: Record<string, string> | string;
    leafHashes?: Record<string, string>;
    leavesFor?: string;
}

export interface ClioThread {
    id: string;
    name: string;
}

export interface LiveSession {
    pid: number;
    name?: string;
    cwd: string;
    sessionId: string;
    jobId?: string;
    entrypoint?: string;
    messagingSocketPath: string;
}

// the fields of one `hc ls --json` terminal that the pane stop reads
interface PaneTerminal {
    address: string;
    agent?: string;
    cwd: string;
}

export interface Usage {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
}

type TranscriptContent = string | ContentBlock[];

interface ContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: ToolInput;
    tool_use_id?: string;
    is_error?: boolean;
    content?: TranscriptContent;
}

interface ToolInput {
    command?: string;
    description?: string;
    file_path?: string;
    url?: string;
}

interface ToolCall {
    input: ToolInput;
    name: string;
    result?: ContentBlock;
}

export interface Run {
    model: string | null;
    note: string;
    seconds: number;
    tokensIn: number;
    tokensOut: number;
}

export interface TranscriptEntry {
    type?: string;
    subtype?: string;
    durationMs?: number;
    timestamp?: string;
    uuid?: string;
    isMeta?: boolean;
    isCompactSummary?: boolean;
    origin?: { kind?: string };
    attachment?: {
        type?: string;
        prompt?: TranscriptContent;
        content?: string | string[];
    };
    message?: {
        id?: string;
        model?: string;
        usage?: Usage;
        content?: TranscriptContent;
    };
}

export type Decision =
    | { kind: 'merge'; args: string[] }
    | { kind: 'spawn' }
    | { kind: 'proposal'; path: string }
    | { kind: 'paid' | 'post' | 'close'; what: string }
    | { kind: 'console'; url: string };

interface PackInput {
    delta: ReturnType<typeof transcriptDelta>;
    lines: string[];
    now: Date;
    proposal?: string;
    state: State;
    thread?: string;
    transcriptPath: string;
    wakeId: string;
}

export interface Cut {
    blocks: number;
    outputs: number;
}

interface UsageFile {
    rate_limits?: Record<
        'five_hour' | 'seven_day',
        { used_percentage: number; resets_at: number } | undefined
    >;
    written_at?: number;
}

interface PacketInput {
    held?: { at: string; id: string; note: string }[];
    charter?: string;
    receipts?: string;
    cut?: string;
    dir: string;
    leaves: string[];
    unchanged?: string[];
    missing: string[];
    proposal?: string;
    ledger?: string;
    meter?: string;
    thread?: string;
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
    changed?: (typeof changedList)[number];
    ref?: string;
}

export interface OneShotResult {
    is_error?: boolean;
    result?: string;
    structured_output?: PlanReview;
    session_id?: string;
    duration_ms?: number;
    total_cost_usd?: number;
    usage?: Usage;
}

type Rating = 'high' | 'medium' | 'low';

export interface PlanFinding {
    quote: string;
    problem: string;
    severity: Rating;
    test: string;
}

export interface PlanReview {
    problemAreas: string[];
    preMortem: string[];
    againstDecisions: {
        decision: string;
        argument: string;
        alternative: string;
    }[];
    missing: string[];
    fragileAssumptions: { assumption: string; rating: Rating }[];
    openQuestions: string[];
    findings: PlanFinding[];
    verdict: 'proceed' | 'revise' | 'investigate' | 'reject';
    noMaterialObjection: boolean;
}

export interface PlanRun {
    runId: string;
    arm: Arm;
    model: string | null;
    effort: Effort;
    plan: string;
    planText: string;
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    seconds: number;
    at: string;
}

// one line per finding; accepted is a `crow:note-vet` verdict on its id, never a field here
export interface PlanNote extends Omit<PlanRun, 'planText' | 'costUsd'> {
    costUsd?: number;
    id: string;
    channel: 'plan';
    verdict: PlanReview['verdict'];
    noMaterialObjection: boolean;
    finding: (PlanFinding & { located: boolean }) | null;
}
