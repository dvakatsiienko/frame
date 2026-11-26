import type { EngineInterface } from 'claude-code';

import type {
    StashTurnRow,
    TurnModReason,
    TurnStarter,
    TurnTick,
    TurnWindBy,
} from '../types/stash.d.ts';
import { currentId, procNow } from './session-identity.ts';

// 📊 the turn log (FRM-639): one row per main-loop turn, written whole once at its end, the only code that counts a
// turn; `x fleet stats` folds the rows. turn.ts keeps owning the running turn: its marks reset when a prompt queues
// under a running turn, so nothing here reads them. the counters live in this module and are mirrored to `$.state` by
// turnId, so a hot reload mid-turn (which can run turn.complete before session.start) keeps the row whole

const ROW = { key: 'turnLog', plugin: 'x-mod-stash' } as const;
const SHELF_EVENTS = '.claude/shelf/events';
const OPEN_DIR = 'open';
const KEEP_DAYS = 30;
const DAY_MS = 86_400_000;
// the cards the fleet spawns by name; any other type counts as `other`
const CARDS = [
    'fork',
    'fresh-eyes',
    'general-purpose',
    'helper',
    'helper-lite',
    'messhunter',
    'researcher',
    'retro',
    'scout',
    'wishkeeper',
    'wisphunter',
    'workflow-subagent',
] as const;
const DIMA = ['composer', 'bridge'] as const;
const MEMBER = [
    'peer',
    'peer-send-message',
    'projects-relay',
    'coordinator',
    'channel',
    'slack-ping',
] as const;
const INGEST = /(^|:)handoff-ingest$/;

// prompts submitted and not yet a turn, oldest first: one queued under a running turn either joins it (its delivery)
// or starts the next one
let pending: Slot[] = [];
let open: StashTurnRow | undefined;
// what the next row carries: a wind's compact runs after the turn that asked it, and a card spawned between turns
let nextWind: StashTurnRow['wind'] = null;
const nextCards = new Map<string, number>();
// his prompt takes his ticks before its turn starts
let nextTicks: TurnTick[] = [];
// the 65 % ask the prompt path makes lands before its turn starts
let nextWindAsked = 0;
let lastEnd: number | undefined;
let isCompacted = false;

const isIn = (list: readonly string[], origin: string | undefined) =>
    list.includes(origin ?? '');
export function starterOf(
    origin: string | undefined,
    isDima: boolean,
): TurnStarter {
    // a `claude -p` summon reads as his own prompt to the rest of the mod, never here: it is no push of his
    if (origin === 'sdk') return 'summon';
    if (isDima || isIn(DIMA, origin)) return 'typed';
    if (isIn(MEMBER, origin)) return 'member';
    if (origin === 'task-notification') return 'task';
    if (origin === 'scheduled-trigger') return 'schedule';
    if (origin === 'plugin') return 'mod';
    return 'unknown';
}

// a prompt.submit the chain did not drop: dima's, a member's, a task's, a command a mod ran
export function notePrompt(
    origin: string | undefined,
    isDima: boolean,
    isUnderTurn: boolean,
    command?: string,
) {
    const starter = starterOf(origin, isDima);
    pending.push({
        isQueued: isUnderTurn,
        starter,
        ...(starter === 'mod'
            ? {
                  reason:
                      command && INGEST.test(command)
                          ? ('wind' as const)
                          : ('command' as const),
              }
            : {}),
    });
}
// the mod's own prompt: the engine runs no prompt.submit hook for it (probe 3, 26 Nov), so selfSubmit names it here
export function noteSelfSubmit(reason: TurnModReason) {
    pending.push({ isQueued: false, reason, starter: 'mod' });
}
// a submit the engine refused never became a turn
export function dropSelfSubmit(reason: TurnModReason) {
    const at = pending.findLastIndex((s) => s.reason === reason);
    if (at !== -1) pending.splice(at, 1);
}

async function eventsRoot($: EngineInterface) {
    if ((await $.env.get('X_MODS_TEST_CHILD')) === '1')
        return `${await $.env.get('CLAUDE_CODE_PLUGIN_CACHE_DIR')}/events`;
    return `${await $.env.get('HOME')}/${SHELF_EVENTS}`;
}
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

async function mirror($: EngineInterface) {
    await $.state.set(ROW, open ?? null).catch(() => undefined);
}

// the 🎛️ switch is read by the caller (`isOn`): settings-store sits above turn.ts, which names a self-submit here
export async function startRow(
    $: EngineInterface,
    turnId: string,
    isOn: boolean,
) {
    const slot = pending.shift() ?? { isQueued: false, starter: 'unknown' };
    const cards = Object.fromEntries(nextCards);
    const ticks = nextTicks;
    const wind = nextWind;
    const windAsked = nextWindAsked;
    nextCards.clear();
    nextTicks = [];
    nextWindAsked = 0;
    nextWind = null;
    isCompacted = false;
    if (!isOn) return;
    const sid = await currentId($);
    if (!sid) return;
    const start = await $.clock.now();
    const pid = (await procNow($))?.pid ?? 0;
    open = {
        answerLen: 0,
        asksOpened: 0,
        cards,
        ctx: null,
        end: 0,
        ended: 'answer',
        herdrJoins: 0,
        isQueued: slot.isQueued,
        pid,
        pingsJoined: 0,
        prevEnd: lastEnd ?? null,
        reason: slot.reason ?? null,
        sid,
        start,
        starter: slot.starter,
        ticks,
        tools: 0,
        turnId,
        typedJoined: 0,
        wind,
        windAsked,
    };
    await mirror($);
    await $.fs
        .write(
            `${await eventsRoot($)}/${OPEN_DIR}/${sid}.json`,
            JSON.stringify({ pid, start, starter: slot.starter, turnId }),
        )
        .catch(() => undefined);
}

// a prompt or ping queued under the running turn and delivered into it
export async function noteDelivery($: EngineInterface, origin: string) {
    const at = pending.findIndex((s) => s.isQueued);
    if (at !== -1) pending.splice(at, 1);
    if (!open) return;
    const starter = starterOf(origin, false);
    if (starter === 'member') open.pingsJoined += 1;
    else if (starter === 'typed') open.typedJoined += 1;
    else return;
    await mirror($);
}

export async function noteTool($: EngineInterface) {
    if (!open) return;
    open.tools += 1;
    await mirror($);
}

// a card the engine spawned: a resumed one is no new card, and one spawned between main turns goes to the next row
export async function noteCard($: EngineInterface, type: string) {
    const kind = (CARDS as readonly string[]).includes(type) ? type : 'other';
    if (!open) {
        nextCards.set(kind, (nextCards.get(kind) ?? 0) + 1);
        return;
    }
    open.cards[kind] = (open.cards[kind] ?? 0) + 1;
    await mirror($);
}

export async function noteAsks($: EngineInterface, n: number) {
    if (!open || n <= 0) return;
    open.asksOpened += n;
    await mirror($);
}

export async function noteTicks($: EngineInterface, ticks: TurnTick[]) {
    if (!ticks.length) return;
    if (!open) {
        nextTicks.push(...ticks);
        return;
    }
    open.ticks.push(...ticks);
    await mirror($);
}

export async function noteHerdrJoins($: EngineInterface, n: number) {
    if (!open || n <= 0) return;
    open.herdrJoins += n;
    await mirror($);
}

// the 65 % ask fired this turn
export async function noteWindAsk($: EngineInterface) {
    if (!open) {
        nextWindAsked += 1;
        return;
    }
    open.windAsked += 1;
    await mirror($);
}

// a wind's own compact: the turn after it is the ingest, which carries who asked and at what fill
export function noteWind(by: TurnWindBy, ctx: number | undefined) {
    nextWind = { by, ctx: ctx ?? null };
}
export function noteCompact() {
    isCompacted = true;
}

// a reload gives the module its load values: the running turn's row comes back from `$.state`
export async function restoreRow($: EngineInterface) {
    const was = (await $.state.get(ROW).catch(() => undefined))?.value;
    if (was && !open) open = was;
}

// the turn ended: its row is written once, whole; a join or a tick an aborted or failed turn took is not counted
export async function endRow(
    $: EngineInterface,
    e: {
        answer: string;
        durationMs: number;
        reason: StashTurnRow['ended'];
        turnId: string;
    },
    isOn: boolean,
) {
    const end = await $.clock.now();
    // a reload can run turn.complete before session.start: the row comes back from `$.state` here too
    if (!open) await restoreRow($);
    const row = open?.turnId === e.turnId ? open : undefined;
    open = undefined;
    await mirror($);
    lastEnd = end;
    // a slot no turn took by its end is stale: only one queued under this turn may still start the next
    pending = pending.filter((s) => s.isQueued);
    if (!isOn) return;
    const sid = row?.sid ?? (await currentId($));
    if (!sid) return;
    const isLanded = e.reason === 'answer' || e.reason === 'refusal';
    const ctx = isCompacted
        ? null
        : await $.session
              .usage()
              .then((u) => u.context.percent ?? null)
              .catch(() => null);
    const whole: StashTurnRow = {
        answerLen: e.answer.length,
        asksOpened: row?.asksOpened ?? 0,
        cards: row?.cards ?? {},
        ctx,
        end,
        ended: e.reason,
        herdrJoins: isLanded ? (row?.herdrJoins ?? 0) : 0,
        isQueued: row?.isQueued ?? false,
        pid: row?.pid ?? (await procNow($))?.pid ?? 0,
        pingsJoined: isLanded ? (row?.pingsJoined ?? 0) : 0,
        prevEnd: row?.prevEnd ?? null,
        reason: row?.reason ?? null,
        sid,
        start: row?.start ?? end - e.durationMs,
        starter: row?.starter ?? 'unknown',
        ticks: isLanded ? (row?.ticks ?? []) : [],
        tools: row?.tools ?? 0,
        turnId: e.turnId,
        typedJoined: isLanded ? (row?.typedJoined ?? 0) : 0,
        wind: row?.wind ?? null,
        windAsked: row?.windAsked ?? 0,
    };
    await $.fs
        .write(
            `${await eventsRoot($)}/${dayOf(end)}/${sid}.${whole.start}.json`,
            JSON.stringify(whole),
        )
        .catch(() => undefined);
}

// day dirs past their 30 days go to the trash, at a session's start, never on the row path
export async function pruneTurnLog($: EngineInterface, isOn: boolean) {
    if (!isOn) return;
    const root = await eventsRoot($);
    const oldest = dayOf((await $.clock.now()) - KEEP_DAYS * DAY_MS);
    const old = (await $.fs.list(root).catch(() => []))
        .filter((f) => f.kind === 'dir' && /^\d{4}-\d\d-\d\d$/.test(f.name))
        .filter((f) => f.name < oldest)
        .map((f) => `${root}/${f.name}`);
    if (old.length) await $.process.run(['trash', ...old]);
}

export function resetTurnLog() {
    pending = [];
    open = undefined;
    nextWind = null;
    nextCards.clear();
    nextTicks = [];
    nextWindAsked = 0;
    lastEnd = undefined;
    isCompacted = false;
}

/* Types */

type Slot = { starter: TurnStarter; reason?: TurnModReason; isQueued: boolean };
