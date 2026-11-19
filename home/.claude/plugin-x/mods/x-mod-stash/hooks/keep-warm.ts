import type { EngineInterface } from 'claude-code';

import {
    PACE_KEYS,
    PACE_NEW_WINDOW,
    type PaceNumbers,
    type PaceRung,
    isPaceHeld,
    isPaceLineDue,
    isSameWindow,
    paceLine,
    paceRung,
} from './pace.ts';
import { isSeated, registry } from './roster.ts';
import { MAIN_ROLE, currentId, selfLive } from './session-identity.ts';
import { writeFleet } from './session-record.ts';
import { partsShown, readNumber } from './settings-store.ts';
import { AFK_KEY, HOT, WAKER_KEY, hotOf } from './store-keys.ts';
import { idleTurn, isTurnBusy, selfSubmit, turn } from './turn.ts';
import { paceMeterOf } from './usage.ts';

// the band's three switches as this process holds them: 💨 afk, ⏰ the waker, 🔥 keep-hot; read through `warm`
const state = {
    afk: false,
    // since: the turn end the next ping counts from; only dima's click turns it off, a 5h reset never does
    hot: undefined as { since: number } | undefined,
    // a turn start or a flip bumps it, so a ping armed before either never fires
    hotGen: 0,
    isWaker: false,
    // a poll during a press would read the store before its write lands and undo it, so load and followHot sit it out
    pressing: 0,
};
export const warm: Readonly<typeof state> = state;
// the module copy alone, no store write: a load's read, a press's flip before its write, and the flip's rollback
export const holdAfk = (on: boolean) => {
    state.afk = on;
};
export const holdWaker = (on: boolean) => {
    state.isWaker = on;
};
export const holdHot = (hot: { since: number } | undefined) => {
    state.hot = hot;
};
export const bumpHotGen = () => ++state.hotGen;
export const pressBegin = () => {
    state.pressing++;
};
export const pressEnd = () => {
    state.pressing--;
};

export async function saveHot($: EngineInterface) {
    const sid = await currentId($);
    if (!sid) return;
    await $.store.set(HOT + sid, state.hot ?? { off: true });
}

// 🔥 set, never flipped: on keeps a running hot's start, else counts from now mid-turn or from the last turn's end
export async function setHot($: EngineInterface, on: boolean) {
    const now = await $.clock.now();
    state.hot = on
        ? (state.hot ?? { since: turn.isBusy ? now : (turn.endedAt ?? now) })
        : undefined;
    await saveHot($);
}

// ⏰'s one writer: every write stamps its time, so the latest press wins whichever band it came from (FRM-568)
// `at`: the press's own time, so a later press read in the same poll still outranks it; a cc press stamps now
export async function writeWaker($: EngineInterface, on: boolean, at?: number) {
    await $.store.set(WAKER_KEY, { at: at ?? (await $.clock.now()), on });
    await writeFleet($).catch(() => undefined);
}

// ⏰ set, never flipped; a set during afk is what afk off puts back
export async function setWaker($: EngineInterface, on: boolean, at?: number) {
    state.isWaker = on;
    await writeWaker($, on, at);
    const away = (await $.store.get(AFK_KEY)) as
        | { at?: number; on?: boolean; wakerBefore?: boolean }
        | undefined;
    if (away?.on) await $.store.set(AFK_KEY, { ...away, wakerBefore: on });
}

// 💨 set, never flipped: afk on turns ⏰ on, afk off puts back what ⏰ was before it; a press on ⏰ meanwhile still counts
export async function setAfk($: EngineInterface, on: boolean, at?: number) {
    const was = (await $.store.get(AFK_KEY)) as
        | { at?: number; on?: boolean; wakerBefore?: boolean }
        | undefined;
    const wakerWas = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    state.afk = on;
    const stamp = at ?? (await $.clock.now());
    await $.store.set(AFK_KEY, {
        at: stamp,
        on,
        ...(on
            ? { wakerBefore: was?.on ? was.wakerBefore : wakerWas?.on === true }
            : {}),
    });
    if (on || was?.wakerBefore !== undefined) {
        state.isWaker = on || was?.wakerBefore === true;
        await writeWaker($, state.isWaker, stamp);
    }
    await writeFleet($).catch(() => undefined);
    return was;
}

// 💨 afk on keeps every remote-controlled session warm too, as if its 🔥 were on (o161): each session's own stash
// pings itself, counted from its last turn end
export async function isAfkWarm($: EngineInterface) {
    if (!state.afk || !(await partsShown($))('stash.afk')) return false;
    const sid = await currentId($);
    return (await registry($).catch(() => [])).some(
        (r) => r.base.sid === sid && r.isBridged,
    );
}

// a ping at 100 % only comes back as the cap's error
export async function isWindowSpent($: EngineInterface) {
    const m = await paceMeterOf($).catch(() => undefined);
    return Boolean(m && m.resetsAt > m.now && m.used >= 100);
}

// the view's two doors a band timer reaches: the wiring builds them per call, so the band never imports the view
export type ViewDoors = {
    load: () => Promise<void>;
    publish: () => Promise<void>;
};

export const POLL_MS = 4000;
export const MINUTE_MS = 60_000;
// the prompt cache's own lifetime
const CACHE_MS = 60 * MINUTE_MS;
export const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
// a few seconds past the reset, so the window has turned before the resume goes out
export const WAKE_SLACK_MS = 5000;
// the window this process already sent its last ping in: a refused one never retries every poll
let lateWindow: number | undefined;

// the pace watch (FRM-500): `pace:<id>` not holding `{ off: true }` switches it on for that session, its own stash reads the meter on the idle poll
// and tells the session only when the 5h window changes its rung, no model between
export const PACE = 'pace:';
const PACE_RUNG = 'pace-rung:';
const PACE_CLAIM = 'pace-claim:';
const PACE_WAKER = 'pace-waker:';
const PACE_CLAIM_MS = 30_000;
const PACE_LATE_MS = 5 * 60 * MINUTE_MS;
const PACE_ME = `${Math.random()}`;
// off is a written value, so the coordinator's default arms only a key never written; `since` marks a shift's start, the one
// that also moves ⏰
export const isPaceOn = (key: unknown) =>
    Boolean(key) && (key as { off?: boolean }).off !== true;
// past a reset the waker's own resume fires first, so a shift's expiry never turns ⏰ off under it
const PACE_EXPIRY_MS = WAKE_SLACK_MS + POLL_MS;
// a line on its way: a submit may resolve only at its turn's end, and its rung moves after that
let isPaceSending = false;
type PaceKept = { resetsAt: number; rung: PaceRung };
let paceUnsaved: { stored: PaceKept | undefined } | undefined;

async function paceNumbers($: EngineInterface) {
    const out = {} as PaceNumbers;
    for (const k of PACE_KEYS) out[k] = await readNumber($, k);
    return out;
}

// the line went out: its rung stands, or the reset's line clears it
async function paceSent(
    $: EngineInterface,
    sid: string,
    stored: PaceKept | undefined,
) {
    try {
        if (stored) await $.store.set(PACE_RUNG + sid, stored);
        else await $.store.delete(PACE_RUNG + sid);
        paceUnsaved = undefined;
    } catch {
        // the line went out: a store that refuses the rung must not buy a turn per poll
        paceUnsaved = { stored };
    }
}

// the line this poll owes, none when the rung stands; the stored rung of another window counts as none
async function paceDue($: EngineInterface, sid: string) {
    if (!isPaceOn(await $.store.get(PACE + sid))) return undefined;
    if (!(await partsShown($))('stash.pace-watch')) return undefined;
    let kept = paceUnsaved
        ? paceUnsaved.stored
        : ((await $.store.get(PACE_RUNG + sid)) as PaceKept | undefined);
    // the clock says a window ended, never a meter write: a frozen file is what a stopped fleet leaves
    const clockNow = await $.clock.now();
    if (kept && clockNow >= kept.resetsAt) {
        // a watch off for a whole window has no reset to tell of
        if (isPaceHeld(kept.rung) && clockNow - kept.resetsAt < PACE_LATE_MS)
            return { line: PACE_NEW_WINDOW, stored: undefined };
        await $.store.delete(PACE_RUNG + sid);
        kept = undefined;
    }
    const meter = await paceMeterOf($);
    if (!meter) return undefined;
    const isSame = kept && isSameWindow(kept.resetsAt, meter.resetsAt);
    const numbers = await paceNumbers($);
    const rung = paceRung(meter, isSame ? kept?.rung : undefined, numbers);
    // a held rung waits for the clock's reset, whatever a meter a few seconds off says
    const isPastReset = meter.resetsAt <= meter.now;
    if (kept && (!isSame || (!rung && !(isPastReset && isPaceHeld(kept.rung)))))
        await $.store.delete(PACE_RUNG + sid);
    if (!rung || rung === 'between') return undefined;
    if (!isPaceLineDue(rung, isSame ? kept?.rung : undefined)) return undefined;
    return {
        line: paceLine(rung, meter, numbers),
        stored: { resetsAt: meter.resetsAt, rung: rung as PaceRung },
    };
}

// one poller's line: a claim younger than PACE_CLAIM_MS is another process's, and a write it lost reads back as theirs
async function paceClaim($: EngineInterface, sid: string) {
    const now = await $.clock.now();
    const was = (await $.store.get(PACE_CLAIM + sid)) as
        | { at: number; by: string }
        | undefined;
    if (was && was.by !== PACE_ME && now - was.at < PACE_CLAIM_MS) return false;
    await $.store.set(PACE_CLAIM + sid, { at: now, by: PACE_ME });
    const held = (await $.store.get(PACE_CLAIM + sid)) as
        | { by: string }
        | undefined;
    return held?.by === PACE_ME;
}

// idle: the line is the turn; the rung moves only once it entered, so a refused one is sent again by the next poll
async function paceTick($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    if (!sid || isPaceSending || (await isTurnBusy($))) return;
    const due = await paceDue($, sid);
    if (!due || !(await paceClaim($, sid))) return;
    isPaceSending = true;
    try {
        const r = await selfSubmit($, due.line, false, () =>
            prepareTurn(view),
        ).catch(() => undefined);
        if (r && !r.drop) await paceSent($, sid, due.stored);
        else {
            await idleTurn($);
            await armHot($, view);
        }
        await $.store.delete(PACE_CLAIM + sid);
    } finally {
        isPaceSending = false;
    }
}

// busy: the line joins the running step
export async function paceStep($: EngineInterface) {
    const sid = await currentId($);
    const due = sid && !isPaceSending ? await paceDue($, sid) : undefined;
    if (!sid || !due || !(await paceClaim($, sid))) return undefined;
    await paceSent($, sid, due.stored);
    await $.store.delete(PACE_CLAIM + sid);
    return due.line;
}

// a hidden part is off whole, and its expiry runs only while shown, so a `since` it left behind means no shift
export async function isShiftOn(
    $: EngineInterface,
    key: { since?: number } | undefined,
) {
    return (
        key?.since !== undefined && (await partsShown($))('stash.pace-watch')
    );
}

// the ⏰ waker follows the key: on at the start with what it found kept, put back at the end or when the start's window
// reset; a state dima changed since is his
async function paceWaker($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    if (!sid) return;
    const key = (await $.store.get(PACE + sid)) as
        | { off?: boolean; since?: number; was?: unknown }
        | undefined;
    const isWatched = await isShiftOn($, key);
    const note = (await $.store.get(PACE_WAKER + sid)) as
        | { since?: number; until?: number; wasOn: boolean }
        | undefined;
    const waker = (await $.store.get(WAKER_KEY)) as
        | { on?: boolean }
        | undefined;
    const now = await $.clock.now();
    if (isWatched) {
        // the window a start expires with: only one still ahead, so an old file never ends a shift it just began
        const ahead = (await paceMeterOf($).catch(() => undefined))?.resetsAt;
        const until = note?.until ?? (ahead && ahead > now ? ahead : undefined);
        if (!note) {
            const wasOn = waker?.on === true;
            await $.store.set(PACE_WAKER + sid, {
                since: key?.since,
                wasOn,
                ...(until ? { until } : {}),
            });
            if (!wasOn) await writeWaker($, true);
            return;
        }
        // a second start means ⏰ on, he may have forgotten it (W1958); the end still restores what the first one found
        if (key?.since !== note.since) {
            await $.store.set(PACE_WAKER + sid, { ...note, since: key?.since });
            if (waker?.on !== true) await writeWaker($, true);
            // a held afk puts its copy back at its end
            const away = (await $.store.get(AFK_KEY)) as
                | { on?: boolean }
                | undefined;
            if (away?.on)
                await $.store.set(AFK_KEY, { ...away, wakerBefore: true });
            return;
        }
        if (until === undefined) return;
        if (note.until === undefined)
            await $.store.set(PACE_WAKER + sid, { ...note, until });
        if (now <= until + PACE_EXPIRY_MS) return;
        // a shift ends where it found the key; a seat's default fills a key it found empty
        if (key?.was) await $.store.set(PACE + sid, key.was);
        else await $.store.delete(PACE + sid);
        await seatDefaults($, view).catch(() => undefined);
    }
    if (!note) return;
    if (!note.wasOn) {
        // a held afk puts this back at its end, so its copy is the one to change
        const away = (await $.store.get(AFK_KEY)) as
            | { on?: boolean }
            | undefined;
        if (away?.on)
            await $.store.set(AFK_KEY, { ...away, wakerBefore: false });
        else await writeWaker($, false);
    }
    await $.store.delete(PACE_WAKER + sid);
}

// a coordinator seat that wrote no pace key while the all-sessions part was off: the poll arms it once the part is back
let isPaceSeatHeld = false;
// every 4 s in every session, so one with no watch stops at two reads
export async function pacePoll($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    if (sid && isPaceSeatHeld && (await partsShown($))('stash.pace-watch')) {
        isPaceSeatHeld = false;
        if ((await $.store.get(PACE + sid)) === undefined)
            await $.store.set(PACE + sid, { on: true });
    }
    if (
        !sid ||
        !(
            (await $.store.get(PACE + sid)) ||
            (await $.store.get(PACE_WAKER + sid))
        )
    )
        return;
    await paceWaker($, view);
    await paceTick($, view);
}

// a seat starts on: 🔋 the coordinator's, 🔥 every seated member's; a written key, off included, stands
export async function seatDefaults($: EngineInterface, view: ViewDoors) {
    const sid = await currentId($);
    if (!sid) return;
    const now = await $.clock.now();
    const role = (await selfLive($))?.role;
    if (role === MAIN_ROLE && (await $.store.get(PACE + sid)) === undefined) {
        if ((await partsShown($))('stash.pace-watch'))
            await $.store.set(PACE + sid, { on: true });
        else isPaceSeatHeld = true;
    }
    if (isSeated(role) && (await $.store.get(HOT + sid)) === undefined) {
        await $.store.set(HOT + sid, { since: now });
        await followHot($, view);
    }
}

// the wiring's share of every turn start: a ping armed before it never fires, the poll's state is read fresh, and the
// turn keeps whether dima is afk
export async function prepareTurn(view: ViewDoors) {
    ++state.hotGen;
    await view.load();
    return state.afk;
}

export async function armHot($: EngineInterface, view: ViewDoors) {
    const mine = ++state.hotGen;
    if (turn.isBusy) return;
    const now = await $.clock.now();
    const since =
        state.hot?.since ??
        ((await isAfkWarm($)) ? (turn.endedAt ?? now) : undefined);
    if (since === undefined) return;
    const everyMs = (await readNumber($, 'hot-minutes')) * MINUTE_MS;
    $.clock.after(Math.max(0, since + everyMs - now), async () => {
        // a chip may have deleted the key since the last poll: a change re-arms, so this timer goes stale
        await followHot($, view).catch(() => undefined);
        if (turn.isBusy || mine !== state.hotGen) return;
        if (!state.hot && !(await isAfkWarm($))) return;
        if (!(await partsShown($))('stash.hot')) return;
        if (await isWindowSpent($)) return;
        $.ui.log('x-mod-stash keep-hot: pinged the idle session');
        await selfSubmit($, PING, true, () => prepareTurn(view));
    });
}

// a cache that would die before the reset gets one last ping; that ping's own turn puts it past the reset, so it fires once
export async function hotLate($: EngineInterface, view: ViewDoors) {
    if (!state.hot || turn.isBusy || turn.endedAt === undefined) return;
    if (!(await partsShown($))('stash.hot')) return;
    const m = await paceMeterOf($);
    if (!m || m.resetsAt <= m.now || m.used >= 100) return;
    const lateMs = (await readNumber($, 'hot-late')) * MINUTE_MS;
    if (m.resetsAt - m.now > lateMs) return;
    if (turn.endedAt + CACHE_MS >= m.resetsAt) return;
    if (lateWindow === m.resetsAt) return;
    lateWindow = m.resetsAt;
    $.ui.log('x-mod-stash keep-hot: the last ping before the reset');
    const r = await selfSubmit($, PING, true, () => prepareTurn(view)).catch(
        () => undefined,
    );
    if (r && !r.drop) return;
    await idleTurn($);
    await armHot($, view);
}

// 🔥 follows its store key idle or not: a 🌌 sessions row's chip writes it from another session, so the poll takes the
// change and arms or cancels the ping with no turn (FRM-499); it only reads, since a write back could undo a press
// made between its read and its write
export async function followHot($: EngineInterface, view: ViewDoors) {
    if (state.pressing) return;
    const sid = await currentId($);
    if (!sid) return;
    const stored = hotOf(await $.store.get(HOT + sid));
    if (Boolean(stored) === Boolean(state.hot)) return;
    const now = await $.clock.now();
    state.hot = stored && { since: turn.isBusy ? now : (turn.endedAt ?? now) };
    await armHot($, view);
    await view.publish();
}

// a row's 🔥 chip: writes or deletes that session's key; its own stash arms the ping at its next poll
export async function pressHot(
    $: EngineInterface,
    sid: string,
    view: ViewDoors,
) {
    await $.store.set(
        HOT + sid,
        hotOf(await $.store.get(HOT + sid))
            ? { off: true }
            : { since: await $.clock.now() },
    );
    if (sid === (await currentId($))) await followHot($, view);
    await view.load();
}
