// 🅿️ the parked-lane wake (PK-351, FRM-692): a lane's members read one by one, each with nothing to do wakes the clio
// running the lane, each reason once per silence; and crow's relay, the adviser's note that wakes clio's thread

import type { EngineInterface } from 'claude-code';

import type { LaneRole, StashLane } from '../types/stash.d.ts';
import {
    type ViewDoors,
    armHot,
    isWindowSpent,
    prepareTurn,
} from './keep-warm.ts';
import { readLanes } from './lanes.ts';
import { unbold } from './parse.ts';
import {
    LEDGER_EVERY_MS,
    laneSid,
    lastTurnAt,
    openSteps,
    quietBooksOf,
} from './quiet-books.ts';
import { type Registered, laneMemberRow, registry } from './roster.ts';
import {
    ADVISER_ROLE,
    MAIN_ROLE,
    type ThreadRecord,
    WING_ROLE,
    currentId,
    isLaneOwner,
    runnerOf,
    successorOf,
    threadRecords,
} from './session-identity.ts';
import { herdrRow, partsShown, readSwitch } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { idleTurn, isTurnBusy, selfSubmit } from './turn.ts';
import { bare } from './util.ts';
import { windOf } from './wind.ts';
import { peekHandoff } from './wind-run.ts';
import { xRead } from './x-cli.ts';

const PARKED_WAKE_MS = 10 * 60_000;
const PARKED_WOKE = 'parked-woke:';
const FINISHED = 'finished';
// crow's wake, parked by her wake script for a desktop tab: clio's thread sends the line itself, no tool call of
// hers (brief 8 item 2), then marks it sent so her prompt hook starts the harvester; a failed send stays parked for the
// next poll
export async function relayCrowWake($: EngineInterface) {
    if (!(await isLaneOwner($))) return;
    const path = `${await $.env.get('HOME')}/.local/state/crow/relay.json`;
    const raw = await $.fs.read(path).catch(() => undefined);
    if (!raw) return;
    let parked: Record<string, unknown> | null;
    try {
        parked = JSON.parse(raw) as Record<string, unknown> | null;
    } catch {
        return;
    }
    if (!parked || parked.isSent || typeof parked.line !== 'string') return;
    // crow by her record, so a session that only names itself crow never takes clio's wake line
    const crow = (await threadRecords($)).find(
        (t) => t.role === ADVISER_ROLE && t.pid !== undefined,
    );
    if (!crow) return;
    const r = await $.session
        .send({ text: parked.line, to: { sessionId: crow.sessionId } })
        .catch(() => undefined);
    if (!r?.isDelivered) return;
    // a newer wake parked while this one went out stays as it is
    if ((await $.fs.read(path).catch(() => undefined)) !== raw) return;
    await $.fs
        .write(path, JSON.stringify({ ...parked, isSent: true }))
        .catch(() => undefined);
}
// herdr's «lane idle alarm after» row, in minutes; empty or unreadable is the 10 min line (FRM-605 exit 4, dima's o125)
export function parkedWakeMs(row: unknown) {
    const minutes =
        typeof row === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(row)
            ? Number(row)
            : row;
    return typeof minutes === 'number' &&
        Number.isFinite(minutes) &&
        minutes > 0
        ? minutes * 60_000
        : PARKED_WAKE_MS;
}
let parkedReadAt = 0;
let isRegistryDown = false;
const parkedUnreadLogged = new Map<string, string>();
// a chunk this close to its end with nothing dispatched after it is a parked lane's question (FRM-602, FRM-692)
const PARKED_STEPS_LEFT = 2;
// a reviewer's wait, and how long a 🔭 wait on anyone but the runner is taken as one
const REVIEWER_WAKE_MS = 30 * 60_000;
const WIND_STUCK_MS = 3 * 60_000;
const PEEK_MS = 8000;
const TICKET_READ_MS = 10 * 60_000;
type NextChunk = 'dispatched' | 'signed' | 'unsigned' | 'unread';
const ticketReads = new Map<
    string,
    { at: number; chunk: NextChunk; fails: number }
>();
const DISPATCHED = /^[\s>*-]*🚀 dispatched /u;
const TAKEN_BACK = /^[\s>*-]*↩️/u;
// a 🚀 line of the sign block, the last `## signed` heading's, stands until a later ↩️ one takes it back, x's own rule; it
// outranks the label, which a dispatch takes off; a quick ticket has no block, its 🚀 line closes the body
function chunkOf(ticket: { description?: unknown; labels?: unknown }) {
    if (!Array.isArray(ticket.labels)) return 'unread';
    const body = String(ticket.description ?? '').split('\n');
    const from = body.findLastIndex((l) => /^## signed\s*$/u.test(l)) + 1;
    const block = body.slice(from);
    const end = from ? block.findIndex((l) => l.startsWith('## ')) : -1;
    const lines = end < 0 ? block : block.slice(0, end);
    const at = lines.findLastIndex((l) => DISPATCHED.test(l));
    if (at >= 0 && !lines.slice(at).some((l) => TAKEN_BACK.test(l)))
        return 'dispatched';
    return ticket.labels.includes('signed') ? 'signed' : 'unsigned';
}
// a ticket's state through x: a dispatched one is read once in 10 min, any other no older than a poll before it is said, and
// a failed read is tried again at the next poll, «unread» only at the second in a row, 10 min apart at most
async function nextChunk(
    $: EngineInterface,
    ticket: string,
    now: number,
    isSaid: (chunk: NextChunk) => boolean,
): Promise<NextChunk | undefined> {
    const kept = ticketReads.get(ticket);
    const isKept =
        kept &&
        kept.chunk !== 'unread' &&
        now - kept.at < TICKET_READ_MS &&
        (kept.chunk === 'dispatched' || isSaid(kept.chunk));
    if (isKept) return kept.chunk;
    const read = await xRead($, ['linear', 'read', ticket], 8000);
    const first = (read?.data as { tickets?: object[] } | undefined)
        ?.tickets?.[0];
    const chunk = first ? chunkOf(first) : 'unread';
    const wasFailing = kept && now - kept.at < TICKET_READ_MS ? kept.fails : 0;
    const fails = chunk === 'unread' ? wasFailing + 1 : 0;
    ticketReads.set(ticket, { at: now, chunk, fails });
    if (fails === 1)
        await $.ui.log(
            `x-mod-stash: x linear read ${ticket} failed; tried again at the next poll`,
        );
    return fails === 1 ? undefined : chunk;
}
const CHUNK_SAYS = {
    signed: 'is signed, not dispatched',
    unread: 'could not be read from linear',
    unsigned: 'is unsigned',
} as const satisfies Record<Exclude<NextChunk, 'dispatched'>, string>;

type Parked = {
    at: number;
    isIdle: boolean;
    name: string;
    role: LaneRole;
    sid: string;
};
// what a rule says of one member or of the lane: `reason` keys «said already», `about` the members whose word re-arms it,
// `also` the ones it is counted as said of too, a member still at work on a finished card
type Hold = {
    about: Parked[];
    also?: Parked[];
    reason: string;
    text: string;
};
// what the runner was told of a member's silence: every reason, until a word of its own
type Woke = { at: number; reasons: string[] };
// one key a member: a ping said on its card is not said again when the card ends; a card's own reasons carry its id
const wokeKey = (sid: string) => `${PARKED_WOKE}${sid}`;
const minutesOf = (ms: number) => Math.round(ms / 60_000);
const wingsIn = (text: string) =>
    [...text.matchAll(/wing (\d+)/giu)].map((m) => m[1]);
// a 🔭 wait on the clio running the lane: «clio» or «coordinator» with no wing named is any runner, a wing its number; `runners` are her own
// display and the card's, a dead wing's whose lane fell to her
function namesRunner(wait: string, runners: string[]) {
    const said = unbold(wait);
    const wings = runners.flatMap(wingsIn);
    return (
        wingsIn(said).some((n) => wings.includes(n)) ||
        /(?<![\w-])(?:clio|coordinator)(?![\w-])/iu.test(
            said.replace(/clio: wing \d+/giu, ''),
        )
    );
}

const goneWinds = new Set<string>();
// (3) a second wind that never fired, its handoff still in the store (23 Nov, case 4)
async function stuckWind(
    $: EngineInterface,
    m: Parked,
    now: number,
): Promise<Hold | undefined> {
    const wind = await windOf($, m.sid);
    if (!wind?.slug) return undefined;
    if (wind.state !== 'refreshing' && wind.state !== 'refused')
        return undefined;
    // a refused wind is stamped at its turn's end, so a word this far past it is a turn since; a refreshing one, at the call
    if (wind.state === 'refused' && m.at - wind.at > WIND_STUCK_MS)
        return undefined;
    if (now - Math.max(wind.at, m.at) < WIND_STUCK_MS) return undefined;
    // a handoff taken never comes back under the same wind, so it is looked for no more
    const key = `${m.sid}|${wind.slug}|${wind.at}`;
    if (goneWinds.has(key)) return undefined;
    const handoff = await peekHandoff($, wind.slug, PEEK_MS);
    if (handoff === 'gone') goneWinds.add(key);
    if (handoff !== 'here') return undefined;
    const by = wind.blocked ?? 'nothing it named';
    return {
        about: [m],
        reason: `wind:${wind.slug}`,
        text: `${m.name} said second wind «${wind.slug}» ${minutesOf(now - wind.at)} min ago, it never fired: held by ${by}; its handoff is still in the store`,
    };
}

type Ping = { at: number; tag: string };
const openPing = (m: Parked, ping: Ping, now: number) =>
    `${m.name} sent its [${ping.tag}] ${minutesOf(now - ping.at)} min ago, unanswered`;

// the member's 🔭 wait on anyone but the runner, which an open [ask] to the runner outranks; a wait drawn from a live task
// is none
async function waitOf(
    $: EngineInterface,
    m: Parked,
    runners: string[],
    isAsking: boolean,
) {
    const reply = (await $.store.get(REPLY + m.sid)) as Reply | undefined;
    const said = reply?.tasks ? undefined : reply?.wait;
    const isOnOther = said && !isAsking && !namesRunner(said, runners);
    return { onOther: isOnOther ? said : undefined, said };
}

// the member's own rules, the first that holds (FRM-692's order); `left` is the card's open steps; herdr's row is a builder's
// alone, a reviewer's 30 min and a wait's stand whatever it says
function memberHold(
    m: Parked,
    now: number,
    wakeAfter: number,
    left: number,
    tag: Ping | undefined,
    wait: Awaited<ReturnType<typeof waitOf>>,
    isAsking: boolean,
    isSettled: boolean,
    laneId: string,
): Hold | undefined {
    const idle = now - m.at;
    // a reviewer's [done] is its clean, acted on and never answered; a turn of its own past the row after it: the member went on,
    // its [done] was no parking
    if (
        tag?.tag === 'done' &&
        m.role !== 'sixth-sense' &&
        m.at - tag.at < wakeAfter &&
        now - Math.max(tag.at, m.at) >= wakeAfter
    )
        return {
            about: [m],
            reason: 'done',
            text: openPing(m, tag, now),
        };
    if (!left || (isSettled && !isAsking)) return undefined;
    const sat = `${m.name} idle ${minutesOf(idle)} min`;
    if (wait.onOther)
        return idle >= REVIEWER_WAKE_MS
            ? {
                  about: [m],
                  reason: `${laneId}:wait`,
                  text: `${sat}, ${wait.onOther}`,
              }
            : undefined;
    const ask = isAsking ? ', its [ask] unanswered' : '';
    const on = ask || (wait.said ? `, ${wait.said}` : '');
    if (m.role === 'codie')
        return idle >= wakeAfter
            ? {
                  about: [m],
                  reason: `${laneId}:builder`,
                  text: `${sat} with ${left} step${left === 1 ? '' : 's'} left${on}`,
              }
            : undefined;
    return idle >= REVIEWER_WAKE_MS
        ? { about: [m], reason: `${laneId}:reviewer`, text: `${sat}${on}` }
        : undefined;
}

// (2) and (6), the lane's own line: a finished card with a member still idle on it, or a chunk near its end with nothing
// dispatched after it and no member working or waiting
async function laneHold(
    $: EngineInterface,
    lane: StashLane,
    members: Parked[],
    now: number,
    wakeAfter: number,
    isParked: boolean,
    isSaid: (reason: string) => boolean,
    // a settled codie its finished card named already: a word of its own re-arms nothing
    isOver: (m: Parked) => boolean,
): Promise<Hold | undefined> {
    const open = openSteps(lane);
    if (!open.length) {
        if (!lane.items.length) return undefined;
        const idle = members.filter(
            (m) => m.isIdle && now - m.at >= wakeAfter && !isOver(m),
        );
        return idle.length
            ? {
                  about: idle,
                  also: members,
                  reason: `${lane.id}:${FINISHED}`,
                  text: `«${lane.title}» (${lane.id}) finished, nothing queued for ${idle.map((m) => m.name).join(', ')}, idle ${minutesOf(now - Math.max(...idle.map((m) => m.at)))} min`,
              }
            : undefined;
    }
    if (!isParked) return undefined;
    const chunk = open[0]?.ticket;
    // a hand-made card names no ticket: it has no chunk to end, so its idle time is the wake
    if (!chunk)
        return {
            about: members,
            reason: `${lane.id}:open`,
            text: `«${lane.title}» has open steps`,
        };
    // the chunk is the run of open steps from the pointer that share its ticket; the next ticket's steps end it
    const after = open.findIndex((x) => x.ticket !== chunk);
    const left = after < 0 ? open.length : after;
    if (left > PARKED_STEPS_LEFT) return undefined;
    const head = `«${lane.title}» (${lane.id}): ${left} step${left === 1 ? '' : 's'} left in ${chunk}`;
    const next = open.find((x) => x.ticket && x.ticket !== chunk)?.ticket;
    if (!next)
        return {
            about: members,
            reason: `${lane.id}:nothing`,
            text: `${head}, nothing queued, sign the next`,
        };
    const state = await nextChunk($, next, now, (c) =>
        isSaid(`${lane.id}:${next}:${c}`),
    );
    return state && state !== 'dispatched'
        ? {
              about: members,
              reason: `${lane.id}:${next}:${state}`,
              text: `${head}; next chunk ${next} ${CHUNK_SAYS[state]}`,
          }
        : undefined;
}

async function wokeOf($: EngineInterface, members: Parked[]) {
    const woke = new Map<string, Woke | undefined>();
    for (const m of members)
        woke.set(
            m.sid,
            (await $.store.get(wokeKey(m.sid))) as Woke | undefined,
        );
    return woke;
}
// a ping moves `at` back to the reply before it, so only a newer word re-arms
const isSaidOf = (was: Woke | undefined, m: Parked, reason: string) =>
    !!was && was.at >= m.at && was.reasons?.includes(reason) === true;
async function parkedOf(
    $: EngineInterface,
    row: Pick<Registered, 'base' | 'startedAt'>,
    role: LaneRole,
    home: string,
    now: number,
): Promise<Parked> {
    const { name, sid, status } = row.base;
    // a member whose transcript does not read is at work, as far as the wake knows
    const at = await lastTurnAt($, home, sid, row.startedAt);
    return {
        at: at ?? now,
        // cc reads «shell» for an idle session with a watch or a background command up, and a live task is no wait
        isIdle: (status === 'idle' || status === 'shell') && at !== undefined,
        name,
        role,
        sid,
    };
}
// one turn of the runner; false is a refused one, so nothing it named counts as said
async function sayLine(
    $: EngineInterface,
    said: Pick<Hold, 'text'>[],
    view: ViewDoors,
) {
    const r = await selfSubmit(
        $,
        `🅿️ parked lane: ${said.map((h) => h.text).join('; ')}.`,
        false,
        () => prepareTurn(view),
    ).catch(() => undefined);
    if (r && !r.drop) return true;
    await idleTurn($);
    await armHot($, view);
    return false;
}
// one turn of the runner naming every fresh hold, then what it named kept per member; a refused turn keeps nothing
async function sayParked(
    $: EngineInterface,
    fresh: Hold[],
    members: Parked[],
    woke: Map<string, Woke | undefined>,
    view: ViewDoors,
    keepsReasons: (m: Parked) => boolean,
) {
    if (!(await sayLine($, fresh, view))) return;
    for (const m of members) {
        const said = fresh
            .filter((h) => (h.also ?? h.about).includes(m))
            .map((h) => h.reason);
        if (!said.length) continue;
        const was = woke.get(m.sid);
        const kept =
            was && (was.at >= m.at || keepsReasons(m)) ? was : undefined;
        await $.store.set(wokeKey(m.sid), {
            at: Math.max(kept?.at ?? m.at, m.at),
            reasons: [...(kept?.reasons ?? []), ...said],
        } satisfies Woke);
    }
}

// a member on a dialog (FRM-698, dima's o8): cc's registry says whether, herdr says what it asks. one unbroken stretch of the
// read is one dialog, kept in the store, so a reload says it no second time
const DIALOG = 'parked-dialog:';
const DIALOG_WAKE_MS = 3 * 60_000;
const DIALOGS = {
    'input needed': 'question',
    'permission prompt': 'permission',
} as const;
type Dialog = { isSaid: boolean; since: number };
type DialogRead = (typeof DIALOGS)[keyof typeof DIALOGS] | 'none' | 'unknown';
const isDialog = (word: string): word is keyof typeof DIALOGS =>
    Object.hasOwn(DIALOGS, word);
function dialogOf({ base, waitingFor = '' }: Registered): DialogRead {
    if (['busy', 'idle', 'shell'].includes(base.status ?? '')) return 'none';
    if (base.status !== 'waiting') return 'unknown';
    // a screen somebody opened by hand, a picker
    if (waitingFor === 'dialog open') return 'none';
    return isDialog(waitingFor) ? DIALOGS[waitingFor] : 'unknown';
}
const HERDR_MS = 4000;
const DIALOG_WORDS = 200;
async function herdrJson($: EngineInterface, args: string[]) {
    const run = await $.process
        .run(['hc', ...args, '--json'], { timeoutMs: HERDR_MS })
        .catch(() => undefined);
    if (run?.exitCode !== 0) return undefined;
    try {
        return JSON.parse(run.stdout) as Record<string, unknown> | null;
    } catch {
        return undefined;
    }
}
type Terminal = {
    foreground?: { pid?: unknown } | null;
    pid?: unknown;
    status?: { msg?: unknown } | null;
};
// what the dialog asks, as herdr's own json prints it; a member outside herdr has no words, a herdr that does not answer
// costs the words and one log line
async function dialogWords($: EngineInterface, name: string, pid: number) {
    const ls = await herdrJson($, ['ls']);
    const terminals = Array.isArray(ls?.terminals)
        ? (ls.terminals as { address?: unknown; status?: unknown }[])
        : undefined;
    let isRead = terminals !== undefined;
    for (const { address, status } of terminals ?? []) {
        if (status !== 'blocked' || typeof address !== 'string') continue;
        const got = (await herdrJson($, ['get', address])) as
            | Terminal
            | undefined;
        if (!got) isRead = false;
        if (got?.pid !== pid && got?.foreground?.pid !== pid) continue;
        const msg = got.status?.msg;
        if (typeof msg === 'string' && msg.trim())
            return msg.replace(/\s+/gu, ' ').trim().slice(0, DIALOG_WORDS);
        isRead = false;
    }
    if (!isRead)
        await $.ui.log(`x-mod-stash: herdr did not say what ${name} is asked`);
    return undefined;
}
// a member, by its word's log line, until the word reads again
const unknownDialogs = new Map<string, string>();
async function logUnknown(
    $: EngineInterface,
    name: string,
    sid: string,
    word: string,
) {
    if (unknownDialogs.get(sid) === word) return;
    unknownDialogs.set(sid, word);
    await $.ui.log(
        `x-mod-stash: ${name} reads «${word}», a status the dialog wake does not know`,
    );
}
const DIALOG_ROLES = ['codie', 'sixth-sense', 'designer', WING_ROLE] as const;
// every live record of a summoned member or a wing, card or no card, and the clio a dialog of its wakes: a wing's is main, and
// a member's whose wing stands on one too
async function wakeForDialogs(
    $: EngineInterface,
    {
        now,
        rows,
        self,
        threads,
    }: Pick<RecordRead, 'now' | 'rows' | 'self' | 'threads'>,
    view: ViewDoors,
) {
    const reads = threads
        .filter((t) => DIALOG_ROLES.some((role) => role === t.role))
        .flatMap((t) => {
            const row = rows.find(
                (r) => r.isAlive && r.base.sid === t.sessionId,
            );
            return row ? [{ dialog: dialogOf(row), row, t }] : [];
        });
    const runners = new Set(
        reads
            .filter((r) => r.t.role === WING_ROLE)
            .filter((r) => r.dialog === 'none' || r.dialog === 'unknown')
            .map((r) => ownerOf(r.t)),
    );
    const due: { kept: Dialog; key: string; text: string }[] = [];
    for (const { dialog, row, t } of reads) {
        const { name, sid, status, statusSince } = row.base;
        const runner =
            t.role !== WING_ROLE && t.coordinator && runners.has(t.coordinator)
                ? t.coordinator
                : MAIN_OWNER;
        if (runner !== ownerOf(self)) continue;
        if (dialog === 'unknown') {
            const word = [status ?? 'no status', row.waitingFor];
            await logUnknown($, name, sid, word.filter(Boolean).join(' · '));
            continue;
        }
        unknownDialogs.delete(sid);
        const key = DIALOG + sid;
        const was = (await $.store.get(key)) as Dialog | undefined;
        if (dialog === 'none') {
            if (was) await $.store.delete(key);
            continue;
        }
        const kept = was ?? { isSaid: false, since: statusSince ?? now };
        if (!was) await $.store.set(key, kept);
        if (kept.isSaid || now - kept.since < DIALOG_WAKE_MS) continue;
        if (await isTurnBusy($)) continue;
        const words = await dialogWords($, name, row.pid);
        due.push({
            kept,
            key,
            text: `${name} stands on a ${dialog} dialog ${minutesOf(now - kept.since)} min${words ? `: «${words}»` : ''}`,
        });
    }
    if (!due.length || !(await sayLine($, due, view))) return;
    for (const { kept, key } of due)
        await $.store.set(key, { ...kept, isSaid: true } satisfies Dialog);
}

type RecordRead = {
    now: number;
    onCard: Set<string>;
    rows: Registered[];
    self: ThreadRecord;
    tagOf: (sid: string) => Ping | undefined;
    threads: ThreadRecord[];
    wakeAfter: number;
};
// a member x summoned that no open card names (a stray, a lane between two cards): its record alone shows it, and only its
// open [done] or [ask] says anything, since idle between batches is its normal state (FRM-698, dima's o6)
async function wakeForUncarded(
    $: EngineInterface,
    { now, onCard, rows, self, tagOf, threads, wakeAfter }: RecordRead,
    view: ViewDoors,
    home: string,
) {
    const mine = ownerOf(self);
    const owners = new Set(
        threads.filter((t) => t.pid !== undefined).map(ownerOf),
    );
    const members: Parked[] = [];
    const holds: Hold[] = [];
    for (const t of threads) {
        if (t.role !== 'codie' && t.role !== 'sixth-sense') continue;
        const row = rows.find((r) => r.isAlive && r.base.sid === t.sessionId);
        if (!row || onCard.has(t.sessionId)) continue;
        // a dead wing's member falls to main, as its card does
        const runner =
            t.coordinator && owners.has(t.coordinator)
                ? t.coordinator
                : MAIN_OWNER;
        const ping = tagOf(t.sessionId);
        if (runner !== mine || !ping) continue;
        if (ping.tag === 'done' && t.role === 'sixth-sense') continue;
        const m = await parkedOf($, row, t.role, home, now);
        const isOpen =
            ping.tag === 'ask' ||
            (ping.tag === 'done' && m.at - ping.at < wakeAfter);
        const quietFor = now - Math.max(ping.at, m.at);
        if (!m.isIdle || !isOpen || quietFor < wakeAfter) continue;
        members.push(m);
        holds.push({
            about: [m],
            reason: ping.tag,
            text: openPing(m, ping, now),
        });
    }
    if (!holds.length || (await isTurnBusy($))) return;
    const woke = await wokeOf($, members);
    const fresh = holds.filter((h) =>
        h.about.some((m) => !isSaidOf(woke.get(m.sid), m, h.reason)),
    );
    if (fresh.length)
        await sayParked($, fresh, members, woke, view, () => false);
}
const MAIN_OWNER = 'clio-main';
// a clio by the label x writes on a record it dispatched or summoned
const ownerOf = (t: ThreadRecord) =>
    t.role === MAIN_ROLE
        ? MAIN_OWNER
        : t.role === WING_ROLE
          ? `clio-wing-${t.wing}`
          : '';

// the one idle alarm of a lane (PK-351:W44, FRM-692): its members are read one by one, and one turn of the clio running it
// names every rule that holds, each once per silence, shift or not; a busy turn or a refused wake asks again at the next read
export async function wakeForParkedLanes($: EngineInterface, view: ViewDoors) {
    const now = await $.clock.now();
    if (now - parkedReadAt < LEDGER_EVERY_MS) return;
    parkedReadAt = now;
    const threads = await threadRecords($);
    const myId = await currentId($);
    const self = threads.find((t) => t.sessionId === myId);
    const isMain = self?.role === MAIN_ROLE;
    if (!self || (!isMain && self.role !== WING_ROLE)) return;
    const shown = await partsShown($);
    if (!shown('stash.glide') || (await isWindowSpent($))) return;
    const home = (await $.env.get('HOME')) ?? '';
    const rows = (await registry($).catch(() => [])).filter((r) => r.isAlive);
    // this session is one of them, so a read that finds none failed
    if (!rows.length) {
        if (!isRegistryDown)
            await $.ui.log(
                'x-mod-stash: the session registry did not read; the idle alarm asks again at the next poll',
            );
        isRegistryDown = true;
        return;
    }
    isRegistryDown = false;
    const wakeAfter = parkedWakeMs(await herdrRow($, home, 'stash.park.after'));
    // with quiet comms off no send of a clio's is booked, so no ping reads as open
    const isBooked = await readSwitch($, 'quiet');
    const lanes = (await readLanes($)).filter((lane) => !lane.endedAt);
    const books = await quietBooksOf($, now, lanes);
    const tagOf = isBooked ? books.open : () => undefined;
    await wakeForDialogs($, { now, rows, self, threads }, view);
    const onCard = new Set<string>();
    // a member reused before its old card is ended is idle on the card with steps left, never on the finished one
    const onOpenCard = new Set(
        lanes
            .filter((lane) => openSteps(lane).length)
            .flatMap((lane) => [
                ...Object.values(lane.members),
                ...Object.values(lane.linkedIds ?? {}),
            ]),
    );
    for (const lane of lanes)
        for (const role of ['codie', 'sixth-sense'] as const) {
            const sid = await laneSid($, rows, lane, role);
            if (sid) onCard.add(sid);
        }
    await wakeForUncarded(
        $,
        { now, onCard, rows, self, tagOf, threads, wakeAfter },
        view,
        home,
    );
    for (const lane of lanes) {
        // a dead wing's lane falls to main; a runner is the wing's display, drawn from its record
        const isRunnerLive = threads.some(
            (t) =>
                t.pid !== undefined &&
                bare(runnerOf(t)) === bare(lane.runner ?? ''),
        );
        const isMine =
            lane.runner && (isRunnerLive || !isMain)
                ? bare(lane.runner) === bare(runnerOf(self))
                : isMain;
        if (!isMine) continue;
        const left = openSteps(lane).length;
        const isFinished = !left;
        const members: Parked[] = [];
        const unread: string[] = [];
        for (const [role, name] of Object.entries(lane.members)) {
            if (!name) continue;
            const id = lane.linkedIds?.[role as LaneRole];
            if (isFinished && [name, id].some((x) => x && onOpenCard.has(x)))
                continue;
            const row = laneMemberRow(
                rows,
                await successorOf($, name),
                id && (await successorOf($, id)),
            );
            if (!row) {
                unread.push(`${role} «${name}»`);
                continue;
            }
            if (row.base.sid === myId) continue;
            members.push(await parkedOf($, row, role as LaneRole, home, now));
        }
        if (!members.length) continue;
        // a member with no live session counts as gone; said once per silence, since `at` moves only on a new word
        const silence = `${Math.max(...members.map((m) => m.at))}|${unread.join()}`;
        if (
            unread.length &&
            members.every((m) => m.isIdle) &&
            parkedUnreadLogged.get(lane.id) !== silence
        ) {
            parkedUnreadLogged.set(lane.id, silence);
            await $.ui.log(
                `x-mod-stash: lane ${lane.id} reads no live session for ${unread.join(', ')}; counted as gone`,
            );
        }
        if (await isTurnBusy($)) continue;
        const woke = await wokeOf($, members);
        const isSaid = (m: Parked, reason: string) =>
            isSaidOf(woke.get(m.sid), m, reason);
        const reviewer = members.find((m) => m.role === 'sixth-sense')?.sid;
        const isSettled = (m: Parked) =>
            m.role === 'codie' &&
            isBooked &&
            books.isSettled(lane, m.sid, reviewer);
        const holds: Hold[] = [];
        let isParked = true;
        for (const m of members) {
            if (!m.isIdle) {
                isParked = false;
                continue;
            }
            const tag = tagOf(m.sid);
            const isAsking = tag?.tag === 'ask' && now - tag.at >= wakeAfter;
            const wait = await waitOf(
                $,
                m,
                [runnerOf(self), lane.runner ?? ''],
                isAsking,
            );
            const idle = now - m.at;
            if (idle < wakeAfter || (wait.onOther && idle < REVIEWER_WAKE_MS))
                isParked = false;
            const hold =
                (shown('stash.second-wind')
                    ? await stuckWind($, m, now)
                    : undefined) ??
                memberHold(
                    m,
                    now,
                    wakeAfter,
                    left,
                    tag,
                    wait,
                    isAsking,
                    isSettled(m),
                    lane.id,
                );
            if (hold) holds.push(hold);
        }
        const ofLane = await laneHold(
            $,
            lane,
            members,
            now,
            wakeAfter,
            isParked,
            (reason) => members.every((m) => isSaid(m, reason)),
            (m) =>
                isSettled(m) &&
                woke.get(m.sid)?.reasons?.includes(`${lane.id}:${FINISHED}`) ===
                    true,
        );
        if (ofLane) holds.unshift(ofLane);
        const fresh = holds.filter((h) =>
            h.about.some((m) => !isSaid(m, h.reason)),
        );
        if (!fresh.length) continue;
        await sayParked($, fresh, members, woke, view, isSettled);
    }
}

export function resetParkedWake() {
    parkedReadAt = 0;
    isRegistryDown = false;
    unknownDialogs.clear();
    parkedUnreadLogged.clear();
    ticketReads.clear();
    goneWinds.clear();
}
