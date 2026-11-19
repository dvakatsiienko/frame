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
import { basename, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { keepThreadInTab } from '../../herdr/scripts/thread-tab.ts';
import { parseEntry, readLines, transcriptPathOf } from './transcript.ts';

export const SESSION_NAME = '🐦‍⬛ crow';
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
const SESSIONS_DIR = join(homedir(), '.claude/sessions');

export const changedList = ['file', 'reply', 'ask', 'ticket', 'none'] as const;
export const armList = ['opus', 'fable'] as const;
export const modeList = ['day', 'systematic', 'decision'] as const;

export const armModels = {
    fable: 'claude-fable-5-2',
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
            promptSuggestionEnabled: false,
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

// x's live threads, each with its record's role (FRM-579): run from home so the shim runs main's x; no answer reads as none
export type LiveThread = {
    display?: string;
    pid?: number;
    role?: string;
    sessionId?: string;
    wing?: number;
};
export function liveThreads(): LiveThread[] {
    const run = spawnSync('x', ['thread', 'list', '--json'], {
        cwd: homedir(),
        encoding: 'utf8',
        timeout: 4000,
    });
    try {
        return JSON.parse(run.stdout).data?.threads ?? [];
    } catch {
        return [];
    }
}

// a codie whose cwd is ~/frame/_clio fires clio's Stop hook too; only a clio's own thread wakes crow, main or any wing,
// read from its thread record: a fork carrying main's name holds none
export function clioThreadOf(
    transcriptPath: string,
    threads: LiveThread[] = liveThreads(),
): ClioThread | undefined {
    const sessionId = basename(transcriptPath, '.jsonl');
    const thread = threads.find((t) => t.sessionId === sessionId);
    const name = thread?.display ?? '';
    if (thread?.role === 'wing' && thread.wing)
        return { id: `wing-${thread.wing}`, name };
    return thread?.role === 'coordinator'
        ? { id: MAIN_THREAD, name }
        : undefined;
}

export const MAIN_THREAD = 'main';

// a wing's wake id ends in its number, so two threads in one minute keep two packets, and a note's id names its thread
export const wakeSuffixOf = (threadId: string) =>
    threadId === MAIN_THREAD ? '' : `w${threadId.replace('wing-', '')}`;

export function threadOfNoteId(id: string) {
    const wing = /^\d+(?:d\d+)?w(\d+)(?:-|$)/.exec(id)?.[1];
    return wing ? `wing-${wing}` : MAIN_THREAD;
}

export const threadLabel = (threadId: string) =>
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
    const crows = new Set(
        liveThreads()
            .filter((t) => t.role === 'adviser')
            .map((t) => t.sessionId),
    );
    for (const file of readdirSync(SESSIONS_DIR)) {
        if (!/^\d+\.json$/.test(file)) continue;
        try {
            const entry: Partial<LiveSession> = JSON.parse(
                readFileSync(join(SESSIONS_DIR, file), 'utf8'),
            );
            // by its record: a desktop tab has no job id, a stored one outlives its session, and a name grants nothing
            const isOurs = crows.has(entry.sessionId ?? '');
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
            // herdr names the agent «claude-code» since 0.1.16, «claude» before
            (terminal) =>
                terminal.agent?.startsWith('claude') && terminal.cwd === cwd,
        )?.address;
    } catch {}
}

// crow's record goes through x brief summon's caller gate (FRM-579): a pane start takes the session id x mints up front,
// a --bg start, whose --session-id cc ignores, is recorded by the session id the registry holds for its job
export function summonAdviser(args: string[]): {
    display: string;
    sessionId: string;
} {
    const run = spawnSync(
        'x',
        ['brief', 'summon', '--role', 'adviser', ...args, '--apply', '--json'],
        { cwd: STATE_DIR, encoding: 'utf8' },
    );
    try {
        const envelope = JSON.parse(run.stdout);
        if (envelope.ok) return envelope.data;
        fail(`x brief summon refused crow's record: ${envelope.error}`);
    } catch {
        fail(`x brief summon answered no envelope: ${run.stderr.trim()}`);
    }
}

export function sessionOfJob(
    jobId: string,
    dir = SESSIONS_DIR,
): string | undefined {
    for (const file of readdirSync(dir)) {
        if (!/^\d+\.json$/.test(file)) continue;
        try {
            const entry: Partial<LiveSession> = JSON.parse(
                readFileSync(join(dir, file), 'utf8'),
            );
            if (entry.jobId === jobId && entry.sessionId)
                return entry.sessionId;
        } catch {}
    }
}

export async function startCrow(arm: Arm, isPane = false) {
    mkdirSync(STATE_DIR, { recursive: true });
    copyRules();
    const stash = stashModOf(userPluginDirs());
    const minted = isPane
        ? summonAdviser([
              `cd ${STATE_DIR} && claude -n '${SESSION_NAME}' 'start'`,
          ])
        : undefined;
    const claudeArgv = [
        ...(minted ? ['--session-id', minted.sessionId] : []),
        '-n',
        minted?.display ?? SESSION_NAME,
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
    // a --no-parent thread starts paneless: herdr's agents list shows it only once it has a tab
    if (isPane) keepThreadInTab(JSON.parse(result.stdout).address, 'crow');
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

    // --bg ignores --session-id, so the id is known only once the registry lists crow's job, matched by its job id
    if (jobId) {
        let sid = sessionOfJob(jobId);
        for (let i = 0; i < 30 && !sid; i++) {
            await sleep(1000);
            sid = sessionOfJob(jobId);
        }
        if (!sid) {
            console.log(
                `🔥 off: job ${jobId} not in the registry after 30 s, so crow has no record`,
            );
            return;
        }
        summonAdviser(['--session', sid]);
    }
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

export function spawnHarvest(wake: Wake, proposal?: string) {
    spawnHarvester([
        wake.id,
        wake.mode,
        wake.phase,
        ...(proposal ? [proposal] : []),
    ]);
}

export function spawnHarvester(args: string[]) {
    spawn(
        process.execPath,
        [new URL('harvest.ts', import.meta.url).pathname, ...args],
        { detached: true, stdio: 'ignore' },
    ).unref();
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

export const pad = (n: number) => String(n).padStart(2, '0');

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

// clio holds a grill round for crow's note, or 3 min with none; a clean read is a `none` that only reached the notes log, so
// a proposal wake's none goes to its reply-to thread as one line, through that thread's own socket
export async function noneReceipt({
    note,
    proposal,
    sessionsDir = SESSIONS_DIR,
    thread,
    threads = liveThreads(),
}: {
    note: string;
    proposal?: string;
    sessionsDir?: string;
    thread: string;
    threads?: LiveThread[];
}) {
    if (!proposal || !/^none\.?$/i.test(note.trim())) return false;
    const target = threads.find((t) =>
        thread === MAIN_THREAD
            ? t.role === 'coordinator'
            : t.role === 'wing' && `wing-${t.wing}` === thread,
    );
    if (!target?.sessionId) return false;
    for (const file of readdirSync(sessionsDir)) {
        if (!/^\d+\.json$/.test(file)) continue;
        try {
            const entry: Partial<LiveSession> = JSON.parse(
                readFileSync(join(sessionsDir, file), 'utf8'),
            );
            if (
                entry.sessionId === target.sessionId &&
                entry.messagingSocketPath &&
                entry.pid &&
                isAlive(entry.pid)
            ) {
                await sendLine(
                    entry.messagingSocketPath,
                    `🐦‍⬛ crow: none on ${proposal}`,
                );
                return true;
            }
        } catch {}
    }
    return false;
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
export const HELD_HEAD = '## held by the last crow';

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

// heldFor was one transcript before the threads split, and only main had a thread then
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
    // per thread; a string is the state before the threads split
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

interface UsageFile {
    rate_limits?: Record<
        'five_hour' | 'seven_day',
        { used_percentage: number; resets_at: number } | undefined
    >;
    written_at?: number;
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
