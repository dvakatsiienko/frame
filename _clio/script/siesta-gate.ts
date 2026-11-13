// clio's siesta gate (FRM-491): the cadence lives in a hook, not in her memory, since under load she skips a nudge
// stop: one ordered list of checks, at most one line a turn · prompt: whose turn it is, and the close · compact: the W1651 marker
// the door clio:siesta writes through: open · card [high…] · high <n> fixed|parked [why]
import { spawnSync } from 'node:child_process';
import {
    appendFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';

// the siesta check blocks the epoch's first stop and again each hour it is ignored (dima's o78, after sixth sense's clean); false makes it a warn
export const gate = { isBlocking: true };
const MAIN: Thread = { dir: '', role: 'clio' };
const FILES_DUE = 15;
const MISSED_AFTER_MS = 30 * 60_000;
// an ignored nudge comes back, and a card nobody closed stops pausing the count
const RENUDGE_AFTER_MS = 60 * 60_000;
const OPEN_GRACE_MS = 30 * 60_000;
// a run of a pocket door, at the start of a command, after `&&`, `;` or `|`, or a loop's `do`; a read of the script (sed, rg) never counts
const POCKET_WRITE =
    /(^|[;&|]\s*|\b(do|then|else)\s+)(node\s+\S*pocket-(add|move)\.ts|(BACKLOG_CWD=\S+\s+)?backlog task (create|edit|archive)\b)/m;
// a turn whose prompt opens with one of these is the fleet's, never his; the app prepends reminders to his own prompts
const NOT_DIMA = [
    '<cross-session-message',
    '<side-sessions-event>',
    '<task-notification>',
    '[Cross-session idle notice]',
    '[SYSTEM NOTIFICATION',
    'x-mod-stash waker:',
];
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const PEER_PREFIX = /^Another Claude session sent a message:\s*/;
// a lane's done: `[done]`, or a line naming «final» beside a sha (`final main:<base> <head>`, `<pr> <sha> final`)
const MEMBER_DONE = /(^|\n)\s*\[done\]|^(?=.*\bfinal\b).*\b[0-9a-f]{7,40}\b/m;
// only a lane member's done ends a chunk; a sidecar's chore report (helga, clio side, crow) never does
const LANE_MEMBER = /from-name="[^"]*\b(codie|sixth sense|designer)\b/;
// a lane dima steers live batches its bare `[done]`s; clio lists such a lane by a piece of its name, one per line, in `live-lanes`
const FINAL_SHA = /^(?=.*\bfinal\b).*\b[0-9a-f]{7,40}\b/m;
const LIVE_PINGS_DUE = 3;
const LIVE_PINGS_WAIT_MS = 60 * 60_000;
// memory, rule and skill text weighs by count; a skill's code file is code, and counts only toward the 15 (FRM-491 re-sign, 11-11)
const MEMORY_TEXT = /(^|\/)(memory|rules|skills)\/.*\.md$/;
const MEMORY_TEXT_DUE = 3;
// a ticket closed or signed by clio is a batch of its own, read off her transcript; inside 30 min of the last siesta it rides the next one (dima's o28)
const LONE_TICKET_WAIT_MS = 30 * 60_000;
const TICKET_MOVE =
    /\bx linear set\b[^\n]*--state[ =]['"]?(Done|Canceled)\b|\bticket-sign\.ts\s+\S+\s+(signed|re-signed)\b|\bx lane landed\b[^\n]*--apply\b/;

export function stop(home: string, input: StopInput) {
    const thread = threadOf(home, input.session_id);
    if (!thread) return undefined;
    const state = readSiesta(home, thread);
    if (state.open && state.card_printed && isAfk(home) && isSettled(state))
        close(state);
    // an open siesta pauses the count only once its card printed: one opened and dropped is nudged by its next batch
    const isCardWaiting =
        state.open &&
        state.card_printed &&
        Date.now() - new Date(state.card_at ?? 0).getTime() < RENUDGE_AFTER_MS;
    // wishkeeper runs 5-7 min, and the freebie beside it must not read as the next batch
    const isReadInFlight =
        state.open &&
        !state.card_printed &&
        Date.now() - new Date(state.opened_at ?? 0).getTime() < OPEN_GRACE_MS;
    const reasons =
        isCardWaiting || isReadInFlight
            ? []
            : dueReasons(home, state, thread, input.transcript_path);
    const isDue = reasons.length > 0;
    if (isDue && !state.due) state.epoch++;
    state.due = isDue;
    // a Stop note wakes a turn of its own: each check speaks once, never inside a turn a hook woke
    if (input.stop_hook_active) {
        writeSiesta(home, state, thread);
        return undefined;
    }
    const checks: string[] = [];
    const isSiestaNudged =
        isDue &&
        (state.nudged_epoch !== state.epoch ||
            Date.now() - new Date(state.nudged_at ?? 0).getTime() >
                RENUDGE_AFTER_MS) &&
        !loadedSiesta(input.transcript_path);
    if (isSiestaNudged) {
        state.nudged_epoch = state.epoch;
        state.nudged_at = new Date().toISOString();
        checks.push(`🌤️ siesta due: ${reasons.join(', ')} — load clio:siesta`);
    }
    const ticks = deliveredTicks(home, input.session_id);
    const newTicks = (ticks ?? []).filter(
        (id) => !state.nudged_ticks.includes(id),
    );
    if (ticks) state.nudged_ticks = ticks;
    if (newTicks.length)
        checks.push(
            `🛎️ delivered tick(s) unresolved: ${newTicks.join(' ')} — orbit resolve`,
        );
    const resumes = unreadResumes(input.transcript_path).filter(
        (id) => !state.nudged_resumes.includes(id),
    );
    state.nudged_resumes = [...state.nudged_resumes, ...resumes].slice(-20);
    if (resumes.length)
        checks.push(
            '⏱️ a lane member got «resume» with no 5h window read this turn — read it before the next one',
        );
    // FRM-495: his `?` lines left unanswered · FRM-494: a member-woken turn that printed
    const isBlock = gate.isBlocking && isSiestaNudged;
    writeSiesta(home, state, thread);
    if (!checks.length) return undefined;
    const line = checks.join('; ');
    return isBlock
        ? ({ decision: 'block', reason: line } as const)
        : {
              hookSpecificOutput: {
                  additionalContext: line,
                  hookEventName: 'Stop' as const,
              },
          };
}

export function prompt(
    home: string,
    input: { prompt?: string; session_id?: string },
) {
    const thread = threadOf(home, input.session_id);
    if (!thread) return undefined;
    const text = (input.prompt ?? '')
        .replace(REMINDER, '')
        .trim()
        .replace(PEER_PREFIX, '');
    const isDima = text !== '' && !NOT_DIMA.some((m) => text.startsWith(m));
    const state = readSiesta(home, thread);
    const head = text.slice(0, text.indexOf('>') + 1);
    const body = text.slice(text.indexOf('>') + 1);
    if (
        text.startsWith('<cross-session-message') &&
        LANE_MEMBER.test(head) &&
        MEMBER_DONE.test(body)
    )
        (isLiveLane(home, head) && !FINAL_SHA.test(body)
            ? state.live_pings
            : state.pings
        ).push(new Date().toISOString());
    if (
        isDima &&
        state.open &&
        state.card_printed &&
        (!isAfk(home) || isSettled(state))
    )
        close(state);
    writeSiesta(home, state, thread);
    // between Stop blocks his own prompts carry it, and a prompt hook wakes no extra turn
    return isDima && state.due ? '🌤️ siesta due — load clio:siesta' : undefined;
}

// helga's chore classes, as her receipts write them (crew-helga); clio's «groom chore» is a prompt-groom
const CHORE_CLASSES = [
    'bulk-replace',
    'pocket-write',
    'gate-retry',
    'inbox-prep',
    'prompt-groom',
];
const CHORE_CLASS = new RegExp(
    `\\b(${CHORE_CLASSES.join('|')}|groom(?= chore))\\b`,
);

// clio's chore sends to helga, one line per chore, so the siesta card can name a receipt that never came
export function sent(home: string, input: SentInput) {
    const { message = '', to = '' } = input.tool_input ?? {};
    if (!/\bhelga\b/.test(to)) return;
    const numbered = [...message.matchAll(/^\d+\s+([a-z][a-z-]*)\b/gm)]
        .map((m) => m[1] ?? '')
        .filter((c) => CHORE_CLASSES.includes(c));
    const first = message.match(CHORE_CLASS)?.[1];
    const classes = numbered.length
        ? numbered
        : first
          ? [first === 'groom' ? 'prompt-groom' : first]
          : [];
    if (!classes.length) return;
    const head = (message.split('\n')[0] ?? '').slice(0, 80);
    const at = new Date().toISOString();
    mkdirSync(groomsDir(home), { recursive: true });
    appendFileSync(
        path.join(groomsDir(home), 'sent.log'),
        classes.map((c) => `${at}\t${c}\t${head}\n`).join(''),
    );
}

// the card's chore lines: pocket writes by hand today, each send no receipt answered within 30 min, receipt-woken turns
export function cardLines(home: string, transcriptPath?: string) {
    const since = siestaLast(
        home,
        threadOf(home, process.env.CLAUDE_CODE_SESSION_ID) ?? MAIN,
    ).getTime();
    const sends = tabbed(path.join(groomsDir(home), 'sent.log')).filter(
        ([at = '']) => new Date(at).getTime() > since,
    );
    const receipts = tabbed(path.join(groomsDir(home), 'receipts.log'));
    const missed = sends.filter(([at = '', cls = '']) => {
        const i = receipts.findIndex(
            ([rAt = '', rCls = '']) => rCls === cls && rAt >= at,
        );
        if (i >= 0) {
            receipts.splice(i, 1);
            return false;
        }
        return Date.now() - new Date(at).getTime() > MISSED_AFTER_MS;
    });
    const wakes = transcriptRows(transcriptPath).filter((r) => {
        const content = r.message?.content;
        return (
            r.type === 'user' &&
            typeof content === 'string' &&
            /^(Another Claude session sent a message:\n)?<cross-session-message[^>]*from-name="[^"]*helga[^>]*>\s*(?!\[done\])[^\n]*\breceipt\b/i.test(
                content,
            ) &&
            new Date(r.timestamp ?? 0).getTime() > since
        );
    }).length;
    return [
        `pocket writes by hand: ${handPocketWrites(transcriptPath)}`,
        ...missed.map(
            ([at = '', cls = '', head = '']) =>
                `missed receipt: ${cls} sent ${new Date(at).toLocaleTimeString('sv').slice(0, 5)} — ${head}`,
        ),
        `receipt wakes since the last siesta: ${wakes}`,
    ];
}

// clio's own pocket writes today, read from her transcript: her pocket hook commits helga's writes under clio's trailer too,
// so git cannot tell them apart
function handPocketWrites(transcriptPath?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transcriptRows(transcriptPath)
        .filter((r) => new Date(r.timestamp ?? 0).getTime() >= today.getTime())
        .flatMap((r) => toolUses([r]))
        .filter(
            (u) =>
                ((u.name === 'Write' || u.name === 'Edit') &&
                    (u.input?.file_path ?? '').includes('/_clio/pocket/')) ||
                (u.name === 'Bash' &&
                    POCKET_WRITE.test(u.input?.command ?? '')),
        ).length;
}

// each transcript row once: cc re-appends old rows, the same uuid at two lines
function transcriptRows(transcriptPath?: string) {
    const rows = readLines(transcriptPath).flatMap(
        (l) =>
            parsed<TranscriptRow & { timestamp?: string; uuid?: string }>(l) ??
            [],
    );
    return [...new Map(rows.map((r, i) => [r.uuid ?? `#${i}`, r])).values()];
}

function tabbed(file: string) {
    return readLines(file).map((l) => l.split('\t'));
}

function groomsDir(home: string) {
    return path.join(stateDir(home), 'grooms');
}

export function compact(
    home: string,
    input: { session_id?: string; trigger?: string },
) {
    mkdirSync(stateDir(home), { recursive: true });
    appendFileSync(
        path.join(stateDir(home), 'compactions.log'),
        `${new Date().toISOString()} ${input.trigger ?? '-'} ${input.session_id ?? '-'}\n`,
    );
}

function isLiveLane(home: string, head: string) {
    const name = /from-name="([^"]*)"/.exec(head)?.[1] ?? '';
    return readLines(path.join(stateDir(home), 'live-lanes')).some(
        (piece) => piece.trim() !== '' && name.includes(piece.trim()),
    );
}

function dueReasons(
    home: string,
    state: Siesta,
    thread: Thread,
    transcriptPath?: string,
) {
    const since = siestaLast(home, thread);
    const after = (at: string | number) =>
        new Date(at).getTime() > since.getTime();
    // a card's own fixes land before its close, so they join that card; wishkeeper's next range still reads them
    const closedAt = new Date(state.closed_at ?? 0);
    const from = closedAt > since ? closedAt : since;
    const files = clioFiles(home, from, thread);
    const memoryText = files.filter((f) => MEMORY_TEXT.test(f)).length;
    const ticketMoves = transcriptRows(transcriptPath)
        .filter((r) => new Date(r.timestamp ?? 0).getTime() > from.getTime())
        .flatMap((r) => toolUses([r]))
        .filter(
            (u) =>
                u.name === 'Bash' && TICKET_MOVE.test(u.input?.command ?? ''),
        ).length;
    const live = state.live_pings.filter(after);
    const isLiveDue =
        live.length >= LIVE_PINGS_DUE ||
        live.some(
            (at) => Date.now() - new Date(at).getTime() >= LIVE_PINGS_WAIT_MS,
        );
    const pings = [...state.pings.filter(after), ...(isLiveDue ? live : [])];
    return [
        files.length >= FILES_DUE ? `${files.length} files of clio's` : '',
        memoryText >= MEMORY_TEXT_DUE
            ? `${memoryText} memory, rule or skill text files of clio's`
            : '',
        ticketMoves && Date.now() - since.getTime() >= LONE_TICKET_WAIT_MS
            ? `${ticketMoves} ticket close(s) or sign(s)`
            : '',
        pings.length ? `${pings.length} member done ping(s)` : '',
    ].filter(Boolean);
}

// a path counts once across this thread's commits since the stamp, its `Agent:` role naming the thread, so a wing's unlanded branch counts for it; another agent's and the pocket's auto commits stay out
function clioFiles(home: string, since: Date, thread: Thread) {
    const env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
    );
    const log = spawnSync(
        'git',
        [
            '-C',
            path.join(home, 'frame'),
            'log',
            '--branches',
            `--since=${since.toISOString()}`,
            '--name-only',
            '--format=%x00%s%x01%(trailers:key=Agent,valueonly,separator=%x2C)',
        ],
        { encoding: 'utf8', env },
    ).stdout;
    const files = new Set(
        (log ?? '')
            .split('\0')
            .map((c) => c.trim().split('\n'))
            .filter(([head = '']) => {
                const [subject = '', agent = ''] = head.split('\x01');
                return (
                    agent.split(' · ')[0]?.trim() === thread.role &&
                    !subject.endsWith('(auto)')
                );
            })
            .flatMap(([, ...paths]) => paths.filter(Boolean)),
    );
    return [...files];
}

// this turn: the rows after the last prompt that is neither a tool result nor a skill's own text
function thisTurn(transcriptPath?: string) {
    const rows = readLines(transcriptPath).flatMap(
        (l) => parsed<TranscriptRow>(l) ?? [],
    );
    const start = rows.findLastIndex(
        (r) =>
            r.type === 'user' &&
            !r.isMeta &&
            !(
                Array.isArray(r.message?.content) &&
                r.message.content.some((c) => c.type === 'tool_result')
            ),
    );
    return rows.slice(start);
}

function toolUses(turn: TranscriptRow[]) {
    return turn.flatMap((r) =>
        Array.isArray(r.message?.content)
            ? r.message.content.filter((c) => c.type === 'tool_use')
            : [],
    );
}

// a «resume» to a lane member sent in a turn that never read the 5h window (crew-lead's pick-ups)
function unreadResumes(transcriptPath?: string) {
    const uses = toolUses(thisTurn(transcriptPath));
    const hasRead = uses.some(
        (u) =>
            u.name === 'mcp__ccd_session_mgmt__get_usage' ||
            (u.name === 'Bash' &&
                (u.input?.command ?? '').includes('cc-usage-window.json')) ||
            (u.name === 'Read' &&
                (u.input?.file_path ?? '').endsWith('cc-usage-window.json')),
    );
    if (hasRead) return [];
    return uses
        .filter(
            (u) =>
                u.name === 'SendMessage' &&
                /\b(codie|sixth sense|designer)\b|^(local_|uds:)/.test(
                    u.input?.to ?? '',
                ) &&
                /^\s*resume\b/i.test(u.input?.message ?? ''),
        )
        .map((u) => u.id ?? '?');
}

function loadedSiesta(transcriptPath?: string) {
    const turn = thisTurn(transcriptPath);
    const opener = turn[0]?.message?.content;
    return (
        (typeof opener === 'string' &&
            opener.includes('<command-name>/clio:siesta')) ||
        turn.some(
            (r) =>
                Array.isArray(r.message?.content) &&
                r.message.content.some(
                    (c) =>
                        c.type === 'tool_use' &&
                        c.name === 'Skill' &&
                        /(^|:)siesta$/.test(c.input?.skill ?? ''),
                ),
        )
    );
}

// x-mod-stash mirrors each session's open asks into its store; `isLocked` is a tick that joined a prompt
function deliveredTicks(home: string, sessionId?: string) {
    const store = stashStore(home);
    if (!store) return undefined;
    const asks = store[`asks:${sessionId}`] as
        | { items?: { id: string; isLocked?: boolean }[] }
        | undefined;
    return (asks?.items ?? []).filter((a) => a.isLocked).map((a) => a.id);
}

function isAfk(home: string) {
    return (stashStore(home)?.afk as { on?: boolean } | undefined)?.on === true;
}

// no store file reads empty; one that does not parse is unknown, so a caller keeps what it knew
function stashStore(home: string): Record<string, unknown> | undefined {
    const dir = path.join(home, '.claude/plugins/store');
    const file = existsSync(dir)
        ? readdirSync(dir).find((f) => /^x-mod-stash_inline-.*\.json$/.test(f))
        : undefined;
    if (!file) return {};
    const kept = parsed<Record<string, unknown>>(
        readFileSync(path.join(dir, file), 'utf8'),
    );
    return kept && typeof kept === 'object' ? kept : undefined;
}

function isSettled(state: Siesta) {
    return state.highs.every(
        (h) => h.state === 'fixed' || (h.state === 'parked' && Boolean(h.why)),
    );
}

function close(state: Siesta) {
    state.closed_at = new Date().toISOString();
    state.open = false;
    state.card_printed = false;
    state.highs = [];
}

function stateDir(home: string) {
    return path.join(home, '.local/state/clio');
}

// each clio keeps its own stamp and card, so a wing's siesta never moves main's (PK-351:W78); a parked sidecar has none, and neither has a session that is not the recorded main
function threadOf(home: string, sessionId?: string): Thread | undefined {
    if (!sessionId) return MAIN;
    const dir = path.join(home, '.claude/sessions');
    for (const file of existsSync(dir) ? readdirSync(dir) : []) {
        const session = parsed<{
            kind?: string;
            name?: string;
            sessionId?: string;
        }>(readLines(path.join(dir, file)).join('\n'));
        if (session?.sessionId !== sessionId) continue;
        if (session.kind === 'bg') return undefined;
        const name = session.name ?? '';
        const wing = /wing (\d+)/.exec(name)?.[1];
        if (wing)
            return { dir: `threads/wing-${wing}`, role: `clio-wing-${wing}` };
        return /\((fork|side)/.test(name)
            ? {
                  dir: `threads/fork-${sessionId.slice(0, 8)}`,
                  role: 'clio-side',
              }
            : recordedMain(home, sessionId);
    }
    return recordedMain(home, sessionId);
}

// fork-guard records the thread at each start; no record yet leaves nobody to protect it from
function recordedMain(home: string, sessionId: string) {
    const recorded = readLines(path.join(stateDir(home), 'main-session'))
        .find((line) => line.startsWith('session='))
        ?.slice('session='.length);
    return !recorded || recorded === sessionId ? MAIN : undefined;
}

function threadDir(home: string, thread: Thread) {
    return path.join(stateDir(home), thread.dir);
}

function siestaLast(home: string, thread: Thread) {
    const file = path.join(threadDir(home, thread), 'siesta-last');
    const kept = existsSync(file)
        ? new Date(readFileSync(file, 'utf8').trim())
        : undefined;
    if (kept && !Number.isNaN(kept.getTime())) return kept;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

// a reader never throws: a half-written line or a store caught mid-write reads as missing, so the gate never fails open
function parsed<T>(text: string) {
    try {
        return JSON.parse(text) as T | null;
    } catch {
        return undefined;
    }
}

function readLines(file?: string) {
    return file && existsSync(file)
        ? readFileSync(file, 'utf8').split('\n').filter(Boolean)
        : [];
}

function readSiesta(home: string, thread: Thread): Siesta {
    const file = path.join(threadDir(home, thread), 'siesta.json');
    const kept = existsSync(file)
        ? (parsed<Partial<Siesta>>(readFileSync(file, 'utf8')) ?? {})
        : {};
    return {
        ...(kept.card_at ? { card_at: kept.card_at } : {}),
        card_printed: kept.card_printed ?? false,
        ...(kept.closed_at ? { closed_at: kept.closed_at } : {}),
        due: kept.due ?? false,
        epoch: kept.epoch ?? 0,
        highs: kept.highs ?? [],
        ...(kept.nudged_at ? { nudged_at: kept.nudged_at } : {}),
        nudged_epoch: kept.nudged_epoch ?? 0,
        nudged_resumes: kept.nudged_resumes ?? [],
        nudged_ticks: kept.nudged_ticks ?? [],
        open: kept.open ?? false,
        ...(kept.opened_at ? { opened_at: kept.opened_at } : {}),
        live_pings: kept.live_pings ?? [],
        pings: kept.pings ?? [],
        ...(kept.skip ? { skip: kept.skip } : {}),
    };
}

// the door runs from clio's own shell, so its session's transcript is found by the session id cc exports
function spawnedWishkeeper(home: string, since: Date) {
    const sid = process.env.CLAUDE_CODE_SESSION_ID;
    const projects = path.join(home, '.claude/projects');
    const file =
        sid && existsSync(projects)
            ? readdirSync(projects)
                  .map((d) => path.join(projects, d, `${sid}.jsonl`))
                  .find((f) => existsSync(f))
            : undefined;
    return transcriptRows(file)
        .filter((r) => new Date(r.timestamp ?? 0).getTime() >= since.getTime())
        .flatMap((r) => toolUses([r]))
        .some(
            (u) =>
                u.name === 'Agent' && u.input?.subagent_type === 'wishkeeper',
        );
}

function writeSiesta(home: string, state: Siesta, thread: Thread) {
    mkdirSync(threadDir(home, thread), { recursive: true });
    writeFileSync(
        path.join(threadDir(home, thread), 'siesta.json'),
        `${JSON.stringify(state, null, 2)}\n`,
    );
}

function door(home: string, [verb, ...args]: string[]) {
    const thread = threadOf(home, process.env.CLAUDE_CODE_SESSION_ID);
    if (!thread)
        throw new Error(
            'this session holds no clio thread, so it has no siesta',
        );
    const state = readSiesta(home, thread);
    switch (verb) {
        case 'open': {
            const now = new Date().toLocaleString('sv').replace(' ', 'T');
            const last = path.join(threadDir(home, thread), 'siesta-last');
            console.log(
                `last siesta: ${readLines(last)[0] ?? 'none, count from today'}`,
            );
            for (const high of state.highs) {
                if (high.state === 'open')
                    console.log(
                        `unsettled high of the last card: ${high.text}`,
                    );
            }
            mkdirSync(threadDir(home, thread), { recursive: true });
            writeFileSync(last, `${now}\n`);
            Object.assign(state, {
                card_printed: false,
                due: false,
                highs: [],
                open: true,
                opened_at: new Date().toISOString(),
            });
            delete state.skip;
            break;
        }
        // a siesta that runs no wishkeeper says why, once, in a log the remeasure reads
        case 'skip': {
            const why = args.join(' ').trim();
            if (!why)
                throw new Error('usage: skip <why wishkeeper is not run>');
            state.skip = why;
            mkdirSync(threadDir(home, thread), { recursive: true });
            appendFileSync(
                path.join(threadDir(home, thread), 'wishkeeper-skips.log'),
                `${new Date().toISOString()}\t${thread.role}\t${why}\n`,
            );
            break;
        }
        case 'card':
            if (
                !state.skip &&
                !spawnedWishkeeper(home, new Date(state.opened_at ?? 0))
            )
                throw new Error(
                    'no wishkeeper ran since this siesta opened: spawn it, or `skip <why>` first',
                );
            state.card_printed = true;
            state.card_at = new Date().toISOString();
            state.highs = args.map((text) => ({ state: 'open', text }));
            break;
        case 'high': {
            const [n = '', mark = '', ...why] = args;
            const high = state.highs[Number(n) - 1];
            if (!high || (mark !== 'fixed' && mark !== 'parked'))
                throw new Error('usage: high <n> fixed|parked [why]');
            high.state = mark;
            if (why.length) high.why = why.join(' ');
            break;
        }
        default:
            throw new Error(
                'usage: siesta-gate.ts stop|prompt|compact (hook json on stdin) | open | skip <why> | card [high…] | high <n> fixed|parked [why]',
            );
    }
    writeSiesta(home, state, thread);
}

if (import.meta.main) {
    const home = process.env.HOME ?? '';
    const [verb = '', ...args] = process.argv.slice(2);
    const hook = () =>
        parsed<StopInput & SentInput & { prompt?: string; trigger?: string }>(
            readFileSync(0, 'utf8'),
        ) ?? {};
    if (verb === 'stop') {
        const out = stop(home, hook());
        if (out) console.log(JSON.stringify(out));
    } else if (verb === 'prompt') {
        const line = prompt(home, hook());
        if (line) console.log(line);
    } else if (verb === 'compact') compact(home, hook());
    else if (verb === 'sent') sent(home, hook());
    else if (verb === 'card-lines')
        console.log(cardLines(home, args[0]).join('\n'));
    else door(home, [verb, ...args]);
}

/* Types */

type SentInput = { tool_input?: { message?: string; to?: string } };

type StopInput = {
    session_id?: string;
    stop_hook_active?: boolean;
    transcript_path?: string;
};

type Thread = { dir: string; role: string };

type High = { state: 'fixed' | 'open' | 'parked'; text: string; why?: string };

type Siesta = {
    card_at?: string;
    card_printed: boolean;
    closed_at?: string;
    due: boolean;
    epoch: number;
    highs: High[];
    nudged_at?: string;
    nudged_epoch: number;
    nudged_resumes: string[];
    nudged_ticks: string[];
    open: boolean;
    opened_at?: string;
    live_pings: string[];
    pings: string[];
    skip?: string;
};

type TranscriptRow = {
    isMeta?: boolean;
    message?: {
        content?:
            | string
            | {
                  id?: string;
                  input?: {
                      command?: string;
                      file_path?: string;
                      message?: string;
                      skill?: string;
                      subagent_type?: string;
                      to?: string;
                  };
                  name?: string;
                  type: string;
              }[];
    };
    type?: string;
};
