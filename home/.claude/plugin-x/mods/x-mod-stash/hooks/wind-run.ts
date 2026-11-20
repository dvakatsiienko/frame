// 🐦‍🔥 second wind's run (FRM-505, FRM-662): the state machine above held — the fill notices and asks, the handoff
// named, the compact at a turn's end and the ingest after it — and the one writer of second-wind.json

import type { Args, EngineInterface, Next } from 'claude-code';

import type { StashWind } from '../types/stash.d.ts';
import {
    WIND_DELAY_MS,
    armRelease,
    releaseHeldSteers,
    steersOnCompact,
} from './held.ts';
import {
    AUTO_WIND,
    type AutoWind,
    MINUTE_MS,
    type ViewDoors,
    isAutoWind,
} from './keep-warm.ts';
import { ORBIT_TOOL } from './orbit.ts';
import {
    MAIN_ROLE,
    currentId,
    identity,
    selfRecord,
    sessionName,
    threadRecords,
} from './session-identity.ts';
import { keepShelf } from './session-record.ts';
import { partsShown, readNumber, windEditsOf } from './settings-store.ts';
import { REPLY, type Reply } from './store-keys.ts';
import { forgetTold } from './turn-notes.ts';
import { CONTEXT, drawFill, drawFillAfterCompact } from './usage.ts';
import { errorText, writeWhole } from './util.ts';
import { COMPACTING, WIND, WIND_HOW, WIND_WORDS, windOf } from './wind.ts';
import {
    WIND_STORE_FILE,
    WIND_TEXT_CAP,
    WIND_TEXT_EDITS,
    type WindRow,
    isWindRow,
    windFileOf,
    windFileWith,
    windPidsOf,
    windRawTextOf,
    windTextOf,
} from './wind-store.ts';

// the button's emoji per state; idle draws the bird
export const WIND_EMOJI = {
    asked: '🥚',
    cancelled: '↩️',
    idle: '🐦‍🔥',
    refreshing: '🌀',
    refused: '🛑',
    stopped: '⚠️',
    writing: '✍️',
} as const;
const WIND_SAY = {
    asked: 'asked, waits for its next turn',
    cancelled: 'cancelled, tells it at its next turn',
    refreshing: 'compacting onto its handoff',
    refused: 'refused, work started after pending: none',
    stopped: 'stopped, its handoff is still in the store',
    writing: 'finishing its step, then its handoff',
} as const;
export const windSay = (w: StashWind) =>
    w.isGone ? 'stopped, its handoff left the store' : WIND_SAY[w.state];
const WIND_NOTE = `🐦‍🔥 second wind: dima asked you to refresh your context at a good stop. ${WIND_WORDS} finish the step you are on, nothing interrupts it; a member mid-round (sixth sense's loop, a designer's take) stops after that round or take. then ${WIND_HOW}`;
// clio's good stop is todo 16's nine steps (dima, 10-13)
const WIND_NOTE_OWNER = `🐦‍🔥 second wind: dima asked you to checkpoint once the topic you are on is done — no rush, no deadline. ${WIND_WORDS} finish that topic whole first: every lane and agent it started lands, its findings fold, the distill, the print, the log and the commit; a topic is never split across a compact. take nothing new after it. then run clio:checkpoint, tell the fleet, and put your «right after the pickup I'd do X» ask into orbit. then ${WIND_HOW}`;
const windRefused = (what: string) =>
    `🐦‍🔥 second wind refused: ${what} still runs after you said pending: none, so nothing compacted. stop it with TaskStop or name it in pending, then call ${ORBIT_TOOL} op second-wind again.`;
// FRM-505: past the 🎛️ `wind-notice` line a session hears its wind is coming, past `wind-at` the mod asks for it (W1,
// W2, W1947, W1948); a fill NOTICE_REARM under the notice re-arms it, a fill under the wind line the ask, so dima's ↩️
// holds until the fill drops; OVERRUN past the wind line the coordinator hears it (W1862)
const NOTICE_REARM = 10;
const OVERRUN = 5;
export const FILL = 'fill:';
// noticed, asked and proposed hold the turn they landed in; windAt the wind line the notice saw, so a lowered knob never
// asks a thread already past it; proposed is the 🍃-off coordinator's line, so afk turning on past it still asks
type FillMark = {
    noticed?: number;
    asked?: number;
    proposed?: number;
    windAt?: number;
    overrun?: true;
};
const FILL_NOTICE = `🐦‍🔥 context at {fill} %: a second wind is coming. {wind} % is the upper boundary, where the mod asks for it; nothing is urgent. do not compact now: plan your nearest steps so you finish the meaningful part you are in, commit it, solve its tails, write your handoff with x:handoff (or \`x handoff write\` where that skill is missing), then take the wind through ${ORBIT_TOOL} op second-wind. never mid-build or mid-step.`;
const FILL_PROPOSE =
    "🐦‍🔥 second wind due at {fill} %: past the {wind} % boundary, and this thread's 🍃 second wind auto is off: propose the wind to dima in orbit at your next good stop, never take it yourself.";
const WIND_NOTE_AUTO = `🐦‍🔥 second wind: the mod asks you for it, your context is past {wind} %: a must, never a rush. finish the step you are on and commit it, nothing interrupts it; never wind mid-build. then ${WIND_HOW}`;
const WIND_NOTE_AUTO_OWNER = `🐦‍🔥 second wind: the mod asks you to checkpoint, your context is past {wind} %: a must, never a rush. finish the topic you are on whole first: every lane and agent it started lands, its findings fold, the distill, the print, the log and the commit; a topic is never split across a compact. take nothing new after it. then run clio:checkpoint, tell the fleet, and put your «right after the pickup I'd do X» ask into orbit. then ${WIND_HOW}`;
// the five notes dima may rewrite, each a row of the second-wind store; an empty row is the default here (FRM-634).
// `{fill}` and `{wind}` take the thread's fill and the wind line
const WIND_DEFAULTS: Record<WindRow, string> = {
    'stash.wind.text.at': WIND_NOTE_AUTO,
    'stash.wind.text.at.coordinator': WIND_NOTE_AUTO_OWNER,
    'stash.wind.text.notice': FILL_NOTICE,
    'stash.wind.text.press': WIND_NOTE,
    'stash.wind.text.propose': FILL_PROPOSE,
};
const windStorePath = (home: string) =>
    `${home}/.claude/shelf/${WIND_STORE_FILE}`;
async function readWindFile($: EngineInterface) {
    const home = (await $.env.get('HOME').catch(() => undefined)) ?? '';
    return windFileOf(
        await $.fs.read(windStorePath(home)).catch(() => undefined),
    );
}
// a text over the cap is refused where it is read: the default stands, one log line per row and process
const overCapLogged = new Set<WindRow>();
// one text per row, fleet-wide: the first written row of `rows` wins, then `fallback`, then the first row's default; so
// his `at` or `press` text reaches the coordinator too, and her own default only where he wrote none
async function windText(
    $: EngineInterface,
    rows: readonly [WindRow, ...WindRow[]],
    n: { fill?: number; wind?: number },
    fallback?: string,
) {
    const file = await readWindFile($);
    let written: string | undefined;
    for (const row of rows) {
        const { isOverCap, text } = windTextOf(file, row);
        if (isOverCap && !overCapLogged.has(row)) {
            overCapLogged.add(row);
            $.ui.log(
                `x-mod-stash second wind: the text of ${row} is over ${WIND_TEXT_CAP} chars, so its default is read`,
            );
        }
        written ??= text;
    }
    return (written ?? fallback ?? WIND_DEFAULTS[rows[0]])
        .replaceAll('{fill}', String(n.fill ?? '{fill}'))
        .replaceAll('{wind}', String(n.wind ?? '{wind}'));
}
const WIND_CANCELLED =
    '🐦‍🔥 second wind cancelled: dima took the refresh back. carry on; no handoff needed for it.';
const ingestBy = (slug: string) =>
    `run \`x handoff ingest ${slug} --for <your own role token> --json\`, read the printed CST whole (never silence it), run its META first-acts, then go on from its S`;
// a session with no plugin x skills has no /x:handoff-ingest to queue (crow's pane, FRM-505)
const windIngest = (slug: string) =>
    `🐦‍🔥 second wind: this conversation was just compacted onto your handoff «${slug}». before anything else, ${ingestBy(slug)}.`;
const windGone = (slug: string) =>
    `🐦‍🔥 second wind stopped before its compact: your handoff «${slug}» left the store, so nothing was compacted and your context is whole. write the handoff again and call ${ORBIT_TOOL} op second-wind with its slug.`;
const windStopped = (slug: string) =>
    `🐦‍🔥 second wind stopped before its ingest, so your handoff «${slug}» is still in the store. ${ingestBy(slug)}.`;
// a band press: the session's own key, and an off takes back the mod's pending ask, never one dima pressed
export async function setAutoWind($: EngineInterface, isOn: boolean) {
    const sid = await currentId($);
    if (!sid) return;
    await $.store.set(AUTO_WIND + sid, {
        at: await $.clock.now(),
        on: isOn,
    } satisfies AutoWind);
    const wind = await windOf($, sid);
    if (!isOn && wind?.by === 'mod' && isWindOpen(wind))
        await $.store.delete(WIND + sid);
    await syncWindStore($).catch(() => undefined);
}
// the prompts this session has started, so the mod's ask lands a turn after its notice, never in the same one
let turnNo = 0;
// a main turn's start counts one more: the fill notices and asks key on it
export function nextTurnNo() {
    turnNo += 1;
}
// a hot reload restarts turnNo at 0 while the store keeps the marks: the count starts past them, so the turn after a
// reload is a later turn than any mark
export async function seedTurnNo($: EngineInterface, sid: string | undefined) {
    if (!sid) return;
    const m = (await $.store.get(FILL + sid)) as FillMark | undefined;
    turnNo = Math.max(turnNo, m?.noticed ?? 0, m?.asked ?? 0, m?.proposed ?? 0);
}
// the fill crossing the notice line returns its notice once; a later turn past the wind line writes the session's own
// ask, only where no wind key stands, so a press of dima's is never written over; a turn after the ask, past the wind
// line + OVERRUN, the coordinator hears one line
export async function takeFill($: EngineInterface, fill: number | undefined) {
    const sid = await currentId($);
    if (!sid || fill === undefined) return undefined;
    if (!(await partsShown($))('stash.second-wind-auto')) return undefined;
    const isAuto = await isAutoWind($);
    const isLead = (await selfRecord($))?.role === MAIN_ROLE;
    if (!isAuto && !isLead) return undefined;
    const noticeAt = await readNumber($, 'wind-notice');
    const was = ((await $.store.get(FILL + sid)) as FillMark | undefined) ?? {};
    const mark: FillMark = { ...was };
    const windAt = Math.max(await readNumber($, 'wind-at'), mark.windAt ?? 0);
    if (fill <= noticeAt - NOTICE_REARM) {
        delete mark.noticed;
        delete mark.windAt;
    }
    if (fill < windAt) {
        delete mark.asked;
        delete mark.proposed;
        delete mark.overrun;
    }
    let line: string | undefined;
    // the coordinator's 🍃 off at the keyboard: she proposes the wind to dima, never takes it (W5)
    if (!isAuto) {
        if (fill >= windAt && mark.proposed === undefined) {
            mark.proposed = turnNo;
            line = await windText($, ['stash.wind.text.propose'], {
                fill,
                wind: windAt,
            });
        }
    } else if (fill >= noticeAt && mark.noticed === undefined) {
        mark.noticed = turnNo;
        mark.windAt = windAt;
        line = await windText($, ['stash.wind.text.notice'], {
            fill,
            wind: windAt,
        });
    } else if (
        fill >= windAt &&
        mark.asked === undefined &&
        mark.noticed !== undefined &&
        mark.noticed !== turnNo
    ) {
        mark.asked = turnNo;
        if (!(await windOf($, sid)))
            await $.store.set(WIND + sid, {
                at: await $.clock.now(),
                by: 'mod',
                state: 'asked',
            } satisfies StashWind);
    } else if (
        fill >= windAt + OVERRUN &&
        mark.asked !== undefined &&
        mark.asked !== turnNo &&
        !mark.overrun &&
        isWindOpen(await windOf($, sid))
    ) {
        mark.overrun = true;
        await overrunTold($, sid, fill).catch(() => undefined);
    }
    if (JSON.stringify(mark) !== JSON.stringify(was))
        await $.store.set(FILL + sid, mark);
    return line;
}
// an ask still standing: dima's take-back deletes the key, a running or stopped wind needs no nudge
const isWindOpen = (w: StashWind | undefined) =>
    w?.state === 'asked' || w?.state === 'writing';
// a member that ignores its ask: one line to the coordinator, never from the coordinator's own thread
async function overrunTold($: EngineInterface, sid: string, fill: number) {
    const lead = (await threadRecords($)).find(
        (t) =>
            t.role === MAIN_ROLE && t.pid !== undefined && t.sessionId !== sid,
    );
    if (!lead?.sessionId) return;
    await $.session.send({
        text: `🐦‍🔥 second wind overrun: ${(await sessionName($)) ?? sid} reads ${fill} %, past its ask; nudge it to wind at its next good stop`,
        to: { sessionId: lead.sessionId },
    });
}
// at a turn's start: the ask joins once and becomes writing; a cancel joins once and leaves
export async function takeWind($: EngineInterface, isOwner: boolean) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || !was) return undefined;
    if (was.state === 'asked') {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            ...(was.by ? { by: was.by } : {}),
            state: 'writing',
        } satisfies StashWind);
        const fill = await $.store.get(CONTEXT + sid).catch(() => undefined);
        const n = {
            fill: typeof fill === 'number' ? fill : undefined,
            wind: await readNumber($, 'wind-at'),
        };
        if (was.by !== 'mod')
            return windText(
                $,
                ['stash.wind.text.press'],
                n,
                isOwner ? WIND_NOTE_OWNER : undefined,
            );
        return windText(
            $,
            isOwner
                ? ['stash.wind.text.at.coordinator', 'stash.wind.text.at']
                : ['stash.wind.text.at'],
            n,
        );
    }
    if (was.state === 'refused') {
        await $.store.delete(WIND + sid);
        return windRefused(was.blocked ?? 'work');
    }
    if (was.state === 'stopped' && was.slug) {
        await $.store.delete(WIND + sid);
        return was.isGone ? windGone(was.slug) : windStopped(was.slug);
    }
    if (was.state !== 'cancelled') return undefined;
    await $.store.delete(WIND + sid);
    return WIND_CANCELLED;
}
// the op second-wind: the session names the handoff it wrote; the compact waits for this turn's end
export async function windReady(
    $: EngineInterface,
    input: Record<string, unknown>,
): Promise<{ deny: string } | { result: string }> {
    const pending =
        typeof input.pending === 'string' ? input.pending.trim() : '';
    if (!pending)
        return {
            deny: 'orbit second-wind: pending is required: «none», or the work still pending (a subagent, a watch, a task not parked; a background command is no pending)',
        };
    if (pending.toLowerCase() !== 'none')
        return {
            deny: `orbit second-wind: not yet, pending: ${pending}. the compact waits, the work does not: do every step that run doesn't need, then call again with pending: none once it resolves`,
        };
    const name = typeof input.slug === 'string' ? input.slug.trim() : '';
    if (!/^[\w][\w.-]*$/.test(name))
        return {
            deny: 'orbit second-wind: name the handoff you just wrote, slug: "<lane or topic>-<n>"',
        };
    if (!(await hasHandoff($, name)))
        return {
            deny: `orbit second-wind: no handoff «${name}» in the store; write it with x:handoff first`,
        };
    const sid = await currentId($);
    if (!sid) return { deny: 'orbit second-wind: this session has no id yet' };
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        slug: name,
        state: 'refreshing',
    } satisfies StashWind);
    return {
        result: `second wind: at this turn's end the mod compacts, then ingests ${name}. end your turn now, with no «waiting on» line: the refresh runs on its own.`,
    };
}
// a compact the wind did not run (the threshold, a typed /compact) already refreshed the session: an ask or a handoff
// still being written dies with it, or the board keeps «finishing its step» forever (clio's 10-14 auto-compact, o96)
// a compact's fill, read once the engine has swapped in the compacted messages: its own measure inside the compact,
// and a breakdown read inside this hook, still count the messages from before it (probed on 2.1.322, FRM-505)
export const COMPACT_SETTLE_MS = 1000;
export async function windOnCompact($: EngineInterface) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    // a refreshing with no slug is this compact's own: its ingest may queue for a long while, and a reload loses runWind's await
    const isOurs = was?.state === 'refreshing' && !was.slug;
    if (!sid || (was?.state !== 'asked' && was?.state !== 'writing' && !isOurs))
        return;
    await $.store.delete(WIND + sid);
}
// work a session starts after it said pending: none and before the compact fires: an agent, a watch or a background
// session; a background command survives the compact, its notice landing in the fresh context (clio's pick, 11-12)
const BG_SESSION = /\bclaude\b[^\n|;&]*\s--bg\b/;
function windBlocker(tool: string, input: Record<string, unknown>) {
    if (tool === 'Agent') return 'an agent';
    if (tool === 'Monitor') return 'a watch';
    if (tool !== 'Bash') return undefined;
    return typeof input.command === 'string' && BG_SESSION.test(input.command)
        ? 'a background session'
        : undefined;
}
export async function windBlock(
    $: EngineInterface,
    e: Record<string, unknown>,
) {
    const what = windBlocker(String(e.tool), e);
    const sid = what ? await currentId($) : undefined;
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || !what || was?.state !== 'refreshing' || was.blocked) return;
    await $.store.set(WIND + sid, {
        ...was,
        blocked: what,
    } satisfies StashWind);
}
// at a main turn's end: a session that named its handoff compacts onto it, then ingests it, once
export async function windAfterTurn($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    const was = sid ? await windOf($, sid) : undefined;
    if (!sid || was?.state !== 'refreshing') return;
    if (!was.slug) {
        // a compact that never reported back leaves no row behind
        if ((await $.clock.now()) - was.at > WIND_STALE_MS)
            await $.store.delete(WIND + sid);
        return;
    }
    if (!(await partsShown($))('stash.second-wind')) return;
    // the turn's own Stop lists what still runs: a watch started before the op holds the wind too
    const watch = (
        (await $.store.get(REPLY + sid)) as Reply | undefined
    )?.tasks?.find((t) => t.type === 'monitor' && !t.state);
    const blocked =
        was.blocked ??
        (watch && `a watch («${watch.name ?? watch.description}»)`);
    if (blocked) {
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            blocked,
            state: 'refused',
        } satisfies StashWind);
        return;
    }
    const slug = was.slug;
    armWind($, sid, slug, view);
}
// the run waits a beat past the turn end; a hot reload in that beat ends the timer with the old copy, so a start runs
// windAfterTurn again, and the run reads the store once more, so two timers never run one wind twice
function armWind(
    $: EngineInterface,
    sid: string,
    slug: string,
    view: ViewDoors,
) {
    $.clock.after(WIND_DELAY_MS, async () => {
        const now = await windOf($, sid);
        if (now?.state === 'refreshing' && now.slug === slug)
            await runWind($, sid, slug, view);
    });
}
async function hasHandoff($: EngineInterface, slug: string) {
    const home = await $.env.get('HOME');
    const peek = await $.process
        .run([`${home}/.local/bin/x`, 'handoff', 'peek', slug])
        .catch(() => undefined);
    return peek?.exitCode === 0;
}
async function runWind(
    $: EngineInterface,
    sid: string,
    slug: string,
    view: ViewDoors,
) {
    try {
        // the slug goes first, so a turn end during the compact finds nothing to run; the board keeps 🌀
        await $.store.set(WIND + sid, {
            at: await $.clock.now(),
            state: 'refreshing',
        } satisfies StashWind);
        // the handoff can leave the store after the op's peek (another ingest, a delete): the compact never runs on nothing
        if (!(await hasHandoff($, slug))) {
            await windGoneFor($, sid, slug);
            return;
        }
        // a failed list keeps the command, the door every session had before
        const hasIngestCommand =
            (await $.command.list().catch(() => undefined))?.some(
                (c) => c.name === 'x:handoff-ingest',
            ) ?? true;
        // both queue at once: an awaited compact let a prompt dima typed during it queue ahead of the ingest (clio's
        // 19:17 press: compact 19:17, his prompt 19:19, the ingest 19:20)
        const [compacted, ingested] = await Promise.allSettled([
            $.command.run({
                args: `keep nothing past the handoff ${slug}; it carries the state`,
                command: 'compact',
            }),
            hasIngestCommand
                ? $.command.run({ args: slug, command: 'x:handoff-ingest' })
                : $.prompt.submit({ text: windIngest(slug) }),
        ]);
        if (ingested.status === 'rejected') throw ingested.reason;
        await $.store.delete(WIND + sid);
        await releaseHeldSteers($, view).catch(() => undefined);
        // the ingest still ran: the handoff left the store, only the context stayed full
        if (compacted.status === 'rejected')
            await compactFailedFor($, sid, slug, errorText(compacted.reason));
    } catch (err) {
        await windStoppedFor($, sid, slug, errorText(err)).catch(
            () => undefined,
        );
    }
}
async function compactFailedFor(
    $: EngineInterface,
    sid: string,
    slug: string,
    why: string,
) {
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind's compact failed for ${(await sessionName($)) ?? sid}: ${why}; its handoff ${slug} was ingested on the full context`,
    );
}
// a toast reaches no one in a pane nobody watches: the board shows the stop, the coordinator hears it, and the
// session's next turn says how to ingest by hand
async function windStoppedFor(
    $: EngineInterface,
    sid: string,
    slug: string,
    why: string,
) {
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        slug,
        state: 'stopped',
    } satisfies StashWind);
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind stopped for ${(await sessionName($)) ?? sid}: ${why}; its handoff ${slug} is still in the store`,
    );
}
async function windGoneFor($: EngineInterface, sid: string, slug: string) {
    await $.store.set(WIND + sid, {
        at: await $.clock.now(),
        isGone: true,
        slug,
        state: 'stopped',
    } satisfies StashWind);
    await toldLead(
        $,
        sid,
        `🐦‍🔥 second wind stopped for ${(await sessionName($)) ?? sid}: its handoff ${slug} left the store before the compact; nothing was compacted`,
    );
}
async function toldLead($: EngineInterface, sid: string, line: string) {
    $.ui.toast(line);
    const lead = (await threadRecords($)).find(
        (t) =>
            t.role === MAIN_ROLE && t.pid !== undefined && t.sessionId !== sid,
    );
    if (lead?.sessionId)
        await $.session.send({ text: line, to: { sessionId: lead.sessionId } });
}
const WIND_STALE_MS = 30 * MINUTE_MS;
// the pids ps no longer prints; ps exits 1 when none is alive, so only its output is read
async function deadPids($: EngineInterface, pids: number[]) {
    const ps = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')]);
    // a ps that failed to run says nothing: only a quiet exit with no pid printed means none is alive
    if (ps.exitCode !== 0 && ps.stderr.trim()) return new Set<number>();
    const alive = new Set(ps.stdout.split('\n').map((s) => Number(s.trim())));
    return new Set(pids.filter((pid) => !alive.has(pid)));
}
// a session that died fires no end: its 🍃 entry goes at the first pass and then every WIND_PRUNE_POLLS-th, one ps
const WIND_PRUNE_POLLS = 5;
let windPolls = 0;
// the second-wind store is written here alone, whole, at a start, at each poll and at a 🍃 press, only when it
// differs: the defaults of this code, the edits the door and herdr left in `wind-text-edits`, the applied switches and
// lines, this session's 🍃 with its pid (FRM-634, FRM-625:W15); every row and field it does not know stays as found
export async function syncWindStore($: EngineInterface) {
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!home) return;
    const path = windStorePath(home);
    const raw = await $.fs.read(path).catch(() => undefined);
    const file = windFileOf(raw);
    const edits = windEditsOf(
        await $.store.get(WIND_TEXT_EDITS).catch(() => undefined),
    );
    const isOn = await partsShown($);
    const sid = await currentId($);
    const others = windPidsOf(file).filter((pid) => pid !== identity.proc?.pid);
    const gone =
        others.length && !(windPolls++ % WIND_PRUNE_POLLS)
            ? await deadPids($, others).catch(() => undefined)
            : undefined;
    const text = `${JSON.stringify(
        windFileWith(file, {
            applied: {
                'second-wind': isOn('stash.second-wind'),
                'second-wind-auto': isOn('stash.second-wind-auto'),
                'wind-at': await readNumber($, 'wind-at'),
                'wind-notice': await readNumber($, 'wind-notice'),
            },
            defaults: WIND_DEFAULTS,
            edits,
            gone,
            self:
                sid && identity.proc
                    ? { auto: await isAutoWind($), pid: identity.proc.pid, sid }
                    : undefined,
        }),
        null,
        2,
    )}\n`;
    if (text !== raw) await writeWhole($, identity.proc?.pid ?? 0, path, text);
    if (!Object.keys(edits).length) return;
    // an edit leaves the key only once a pass reads it back from the file: a session that wrote an older file over it
    // loses nothing, the next pass folds it again. one no row takes (an unknown row, a text over the cap) leaves at
    // once, the over-cap one with a log line, since herdr's row has no door to refuse it
    const isTaken = (row: string, edit: unknown) =>
        isWindRow(row) &&
        typeof edit === 'string' &&
        edit.length <= WIND_TEXT_CAP;
    for (const [row, edit] of Object.entries(edits))
        if (isWindRow(row) && typeof edit === 'string' && !isTaken(row, edit))
            $.ui.log(
                `x-mod-stash second wind: an edit of ${row} is over ${WIND_TEXT_CAP} chars and was not taken`,
            );
    const left = Object.entries(
        windEditsOf(await $.store.get(WIND_TEXT_EDITS).catch(() => undefined)),
    ).filter(
        ([row, edit]) =>
            edits[row] !== edit ||
            (isTaken(row, edit) && windRawTextOf(file, row) !== edit),
    );
    if (left.length)
        await $.store.set(WIND_TEXT_EDITS, Object.fromEntries(left));
    else await $.store.delete(WIND_TEXT_EDITS);
}

// a compact: the session marked compacting while it runs; after it, the told notes go, a wind's ingest is left to run,
// the held list waits to settle, and the fill from before is cleared off the band
export async function compactSession(
    $: EngineInterface,
    e: Args<'session.compact'>,
    next: Next<'session.compact'>,
    view: ViewDoors,
) {
    const isOwn = !e.agentId && e.trigger !== 'precompute';
    const compacting = isOwn
        ? await currentId($).catch(() => undefined)
        : undefined;
    if (compacting)
        await $.store
            .set(COMPACTING + compacting, await $.clock.now())
            .catch(() => undefined);
    const r = await next(e).finally(() =>
        compacting
            ? $.store.delete(COMPACTING + compacting).catch(() => undefined)
            : undefined,
    );
    // cc sends the whole skill list again after a compact (2.1.304), so none is reloaded here; a compact another hook
    // skipped changed nothing
    if (!e.agentId && e.trigger !== 'precompute' && !('skip' in r)) {
        // a wind's own compact: its ingest is queued behind it, and runWind hands the held messages over after it
        const wind = compacting ? await windOf($, compacting) : undefined;
        const isWinds = wind?.state === 'refreshing' && !wind.slug;
        forgetTold();
        await windOnCompact($).catch(() => undefined);
        await steersOnCompact($).catch(() => undefined);
        if (!isWinds) armRelease($, view, COMPACT_SETTLE_MS);
        // the next measure comes only at this turn's end, and a wind's ingest is one long turn: until then the
        // fill from before the compact would stand on the band and every board
        await drawFill($, undefined).catch(() => undefined);
        const compacted = await currentId($);
        if (compacted)
            await $.store.delete(FILL + compacted).catch(() => undefined);
        $.clock.after(COMPACT_SETTLE_MS, () =>
            drawFillAfterCompact($).catch(() => undefined),
        );
        await keepShelf($);
        await view.load();
    }
    return r;
}

export async function forgetFill($: EngineInterface, sid: string) {
    await $.store.delete(FILL + sid);
}
