// 🤫 quiet comms' books (FRM-662): the day's quiet log, the ledger of each member's sends against it, the alarms, a
// ledger gap's note to clio, and a lane member gone silent; the gate holds and releases, these record and count

import type { EngineInterface } from 'claude-code';

import type { QuietGap, QuietLogLine, QuietPing } from '../types/stash.d.ts';
import {
    PACE,
    type ViewDoors,
    armHot,
    isShiftOn,
    prepareTurn,
} from './keep-warm.ts';
import { readLanes } from './lanes.ts';
import { LEDGER_SENDS } from './parse.ts';
import { QUIET_NOTICE, clioAddress } from './quiet.ts';
import { memberOf, registry } from './roster.ts';
import { currentId, procNow, successorOf } from './session-identity.ts';
import { QUIET_KINDS, readNumber } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { idleTurn, isTurnBusy, selfSubmit } from './turn.ts';
import { memberKey, text } from './util.ts';

const QUIET_LOG = 'quiet-log:';
const QUIET_LOG_MAX = 500;
// the safety net (brief 6): the ledger's gaps, the delivery test's test ping, how long a held ping may wait past the idle wait
export const QUIET_GAP = 'quiet-gap';
// a send younger than the grace may still be on its way, so the ledger counts it next minute
const LEDGER_GRACE_MS = 2 * 60_000;
export const LEDGER_EVERY_MS = 60_000;
// the alarms already raised, so each gap and each stuck hold notifies once, across reloads too
export const QUIET_ALARMED = 'quiet-alarmed';
const QUIET_ALARMED_MAX = 50;
// a member alarms past this many 🎛️ waits; one wait read 24 alarm keys on 7 members in a day
const QUIET_SILENT_WAITS = 3;
// when clio last sent each member a line, by session id: past its [done], that re-arms its silent alarm
export const QUIET_SENT = 'quiet-sent';
const QUIET_TAGGED = 'quiet-tagged';
export const QUIET_PARK_MS = 7 * 24 * 60 * 60_000;
// a transcript's last write in epoch seconds, by its session id under any project folder
// a ping's reply ends a moment before its last transcript write
const PING_WRITE_MS = 60_000;
const LAST_WRITE =
    'stat -f %m "$1"/.claude/projects/*/"$2".jsonl 2>/dev/null | sort -n | tail -n 1';
const QUIET_ALARM_TITLE = '🚨 quiet comms';
// osascript's own argv, so no text is ever spliced into the script
const NOTIFY_SCRIPT =
    'on run argv\ndisplay notification (item 1 of argv) with title (item 2 of argv)\nend run';
export const quietLogKey = (at: number) =>
    QUIET_LOG + new Date(at).toISOString().slice(0, 10);
// true once the lines, all of one moment, are in the day's log
export async function quietLogAll($: EngineInterface, lines: QuietLogLine[]) {
    await quietKeepTagged($, lines).catch(() => undefined);
    const key = quietLogKey(lines[0]?.at ?? 0);
    const was = ((await $.store.get(key).catch(() => undefined)) ??
        []) as QuietLogLine[];
    return $.store
        .set(key, [...was, ...lines].slice(-QUIET_LOG_MAX))
        .then(() => true)
        .catch(() => false);
}
// a member's newest tagged line, per sid: the day's log keeps only its last lines, and a parked member's [done] outlives them
async function quietKeepTagged($: EngineInterface, lines: QuietLogLine[]) {
    const tagged = lines.filter(
        (l) => l.sid && QUIET_KINDS.some((k) => k.kind === l.tag),
    );
    const now = tagged[0]?.at;
    if (now === undefined) return;
    const was = ((await $.store.get(QUIET_TAGGED)) ?? {}) as Record<
        string,
        { at: number; tag: string }
    >;
    await $.store.set(QUIET_TAGGED, {
        ...Object.fromEntries(
            Object.entries(was).filter(([, l]) => now - l.at < QUIET_PARK_MS),
        ),
        ...Object.fromEntries(
            tagged.map((l) => [l.sid, { at: l.at, tag: l.tag }]),
        ),
    });
}
// past an import the validator follows `$` only into a function declaration
export function quietLog($: EngineInterface, line: QuietLogLine) {
    return quietLogAll($, [line]);
}

// each held ping that reached clio's thread gets a `flushed` line, so a deliveryTest sees held → delivered
export async function quietFlushed($: EngineInterface, held: QuietPing[]) {
    const at = await $.clock.now();
    for (const p of held)
        await quietLog($, {
            arm: 'on',
            at,
            from: p.from,
            startedTurn: false,
            tag: p.tag ?? 'none',
            verdict: 'flushed',
            ...(p.deliveryTest ? { deliveryTest: p.deliveryTest } : {}),
        });
}
// the ledger: each live member's sends to clio, counted from its own transcript, against her quiet log's lines from
// it; a member that sent more than the log holds lost a ping between the two. the window opens at the day's first log
// line (before it quiet comms logged nothing) and at the member's start
export async function quietLedger($: EngineInterface, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    const judged = (
        ((await $.store.get(QUIET_LOG + day).catch(() => undefined)) ??
            []) as QuietLogLine[]
    ).filter((l) => l.verdict !== 'flushed' && l.tag !== QUIET_NOTICE);
    const opened = judged.length
        ? Math.min(...judged.map((l) => l.at))
        : Date.parse(`${day}T00:00:00Z`);
    const home = await $.env.get('HOME');
    const me = await currentId($);
    const pid = (await procNow($))?.pid;
    const mine = (await $.fs
        .read(`${home}/.claude/sessions/${pid}.json`)
        .then((raw) => JSON.parse(raw) as Record<string, unknown>)
        .catch(() => ({}))) as Record<string, unknown>;
    const to = clioAddress({
        pid,
        sids: [me, text(mine.hostSessionId)].filter(
            (x): x is string => typeof x === 'string',
        ),
    });
    const gaps: QuietGap[] = [];
    const members = (await registry($)).filter(
        (r) => r.isAlive && r.base.sid !== me,
    );
    // a log line is the member's by its session id, which a rename mid-day keeps, or, logged with none, by its name
    for (const r of members) {
        const since = Math.max(opened, r.startedAt ?? 0);
        // the transcript by its session id, never the cwd: the registry's cwd follows a Bash `cd`
        const out = await $.process
            .run(['sh', '-c', LEDGER_SENDS, 'sh', home ?? '', r.base.sid, to])
            .catch(() => undefined);
        if (!out) continue;
        const sent = out.stdout
            .split('\n')
            .map((t) => Date.parse(t))
            .filter((t) => t >= since && t <= now - LEDGER_GRACE_MS).length;
        // the envelope names crow as the registry stores her («🐦 ⬛», the joiner a space), the board as rejoined: bare both
        // a member keeps its identity when its mode emoji changes (☕️ → 🌗 on a rename), so the lines match without it
        const isOurs = (l: QuietLogLine) =>
            l.sid
                ? l.sid === r.base.sid
                : memberKey(l.from) === memberKey(r.base.name);
        const logged = judged.filter((l) => isOurs(l) && l.at >= since).length;
        if (sent > logged) gaps.push({ from: r.base.name, logged, sent });
    }
    return gaps;
}
// one native notification per alarm key: `$.ui.notify` writes only through a terminal (the desktop answers no-surface),
// so a not-sent one goes out through osascript; both failing leaves a log line, never a throw
export async function quietAlarm(
    $: EngineInterface,
    key: string,
    text: string,
) {
    const raised =
        ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ?? [];
    if (raised.includes(key)) return;
    await $.store.set(
        QUIET_ALARMED,
        [...raised, key].slice(-QUIET_ALARMED_MAX),
    );
    // a test child's store is its own and its log empty, so its alarms are false; its mac is still dima's
    if ((await $.env.get('X_MODS_TEST_CHILD')) === '1') {
        await $.ui.log(`x-mod-stash: quiet alarm in a test child: ${text}`);
        return;
    }
    const sent = await $.ui
        .notify(text, { title: QUIET_ALARM_TITLE })
        .catch((err: unknown) => ({
            isSent: false as const,
            reason: String(err),
        }));
    if (sent.isSent) return;
    const r = await $.process
        .run(['osascript', '-e', NOTIFY_SCRIPT, text, QUIET_ALARM_TITLE])
        .catch(() => undefined);
    if (r?.exitCode === 0) return;
    await $.ui.log(
        `x-mod-stash: quiet alarm not raised (notify: ${sent.reason}; osascript: ${r ? `exit ${r.exitCode}` : 'did not run'}): ${text}`,
    );
}
// a ledger gap rides clio's next prompt once, model-only: the board draws no card for it, so this note is how
// a skipped hold reaches her turn; a gap that changes (more sends, more lines) is told again
const QUIET_GAP_TOLD = 'quiet-gap-told';
// told per member by the size of its gap (sent - logged): a standing gap that only moves with new sends is not told
// again, a bigger one is, and a gap that closes is forgotten so its next opening is told
export async function takeGapNotes($: EngineInterface) {
    const gaps =
        (
            (await $.store.get(QUIET_GAP).catch(() => undefined)) as
                | { gaps?: QuietGap[] }
                | undefined
        )?.gaps ?? [];
    const told =
        ((await $.store.get(QUIET_GAP_TOLD).catch(() => undefined)) as
            | Record<string, number>
            | undefined) ?? {};
    const size = (g: QuietGap) => g.sent - g.logged;
    const fresh = gaps.filter((g) => size(g) > (told[g.from] ?? 0));
    const next = Object.fromEntries(
        gaps.map((g) => [g.from, Math.max(size(g), told[g.from] ?? 0)]),
    );
    if (JSON.stringify(next) !== JSON.stringify(told))
        await $.store.set(QUIET_GAP_TOLD, next);
    return fresh.map(
        (g) =>
            `🤫 quiet-comms ledger: ${g.from} sent you ${g.sent} pings and your quiet log holds ${g.logged}: ${size(g)} skipped the hold, check its log line.`,
    );
}
// a keep-hot ping's reply is no word of the member's: a last write no later than its end reads as the reply before it,
// in whole seconds as a write's time is; a write past that is real work
export async function lastSpokeAt(
    $: EngineInterface,
    home: string,
    sid: string,
) {
    const out = await $.process
        .run(['sh', '-c', LAST_WRITE, 'sh', home, sid])
        .catch(() => undefined);
    const seconds = Number(out?.stdout.trim());
    if (!(seconds > 0)) return undefined;
    const wrote = seconds * 1000;
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    const isPingLast =
        !!reply?.pingedAt &&
        reply.pingedAt > reply.at &&
        wrote <= reply.pingedAt + PING_WRITE_MS;
    return isPingLast ? Math.floor(reply.at / 1000) * 1000 : wrote;
}
// when a member's newest tagged line to clio is its [done]: an untagged receipt or a turn-end note after it changes nothing,
// a later [ask] or [escalate] does; a week back at most, past that it reads as no [done]
async function quietDoneAt($: EngineInterface, sid: string, now: number) {
    const last = (
        (await $.store.get(QUIET_TAGGED).catch(() => undefined)) as
            | Record<string, { at: number; tag: string }>
            | undefined
    )?.[sid];
    return last?.tag === 'done' && now - last.at <= QUIET_PARK_MS
        ? last.at
        : undefined;
}
// a hung member sends nothing, so an open lane's member past three waits raises one alarm per silence, under a shift also one
// turn of clio's; a refused or a busy turn asks again at the next poll; a member whose last word was its [done] is parked
// until clio sends it a line, any line, since the mod can't tell work from a chat, and counts from that send
export async function quietSilentMembers(
    $: EngineInterface,
    now: number,
    view: ViewDoors,
) {
    const waitMs =
        (await readNumber($, 'quietWait')) * 60_000 * QUIET_SILENT_WAITS;
    const home = (await $.env.get('HOME')) ?? '';
    const rows = await registry($);
    const sends = ((await $.store.get(QUIET_SENT).catch(() => undefined)) ??
        {}) as Record<string, number>;
    const me = await currentId($);
    const pace = me
        ? ((await $.store.get(PACE + me)) as { since?: number } | undefined)
        : undefined;
    const isShift = await isShiftOn($, pace);
    for (const lane of await readLanes($)) {
        // a finished card stays on the board until the siesta's end, its members parked
        if (lane.endedAt || lane.current >= lane.items.length) continue;
        for (const name of Object.values(lane.members)) {
            if (!name) continue;
            const row = memberOf(rows, await successorOf($, name));
            if (!row || row.base.sid === me) continue;
            const spokeAt = await lastSpokeAt($, home, row.base.sid);
            if (spokeAt === undefined || now - spokeAt < waitMs) continue;
            const doneAt = await quietDoneAt($, row.base.sid, now);
            const sentAt = sends[row.base.sid] ?? 0;
            if (doneAt !== undefined && sentAt <= doneAt) continue;
            const at =
                doneAt === undefined ? spokeAt : Math.max(spokeAt, sentAt);
            if (now - at < waitMs) continue;
            const words = `${row.base.name} silent ${Math.round((now - at) / 60_000)} min on «${lane.title}»`;
            // one silence, one key: a ping moves `at` back to the reply before it, past the time the alarm keyed on
            const prefix = `silent:${row.base.sid}:`;
            const known = (
                ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ??
                []
            )
                .filter((k) => k.startsWith(prefix))
                .map((k) => Number(k.slice(prefix.length)));
            const key = `${prefix}${Math.max(...known, 0) >= at ? Math.max(...known) : at}`;
            await quietAlarm($, key, words);
            if (!isShift || (await isTurnBusy($))) continue;
            const raised =
                ((await $.store.get(QUIET_ALARMED)) as string[] | undefined) ??
                [];
            if (raised.includes(`wake:${key}`)) continue;
            const r = await selfSubmit(
                $,
                `🚨 quiet comms: ${words}; check it, and break the hang if it is one.`,
                false,
                () => prepareTurn(view),
            ).catch(() => undefined);
            if (!r || r.drop) {
                await idleTurn($);
                await armHot($, view);
                continue;
            }
            await $.store.set(
                QUIET_ALARMED,
                [...raised, `wake:${key}`].slice(-QUIET_ALARMED_MAX),
            );
        }
    }
}
