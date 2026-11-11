// orbit on herdr's board, as pure steps: what a session's state file holds, and the ticks file herdr's board
// alone writes for it (`~/.claude/shelf/orbit-ticks/<sid>.jsonl`, one press per line), which x-mod-stash reads at the
// session's next turn (FRM-552)

/** @typedef {{ id: string | null, text: string, pick: string | null, mark: string | null, isGated: boolean, isLocked: boolean }} Ask */
/** @typedef {{ id: string, verdict: 'tick' | 'replay' | 'untick', steer?: string, text?: string, at: number }} Press */

/**
 * the open asks in a session's state file (`~/.claude/shelf/herdr-state/<sid>.json`, which x-mod-stash writes); an
 * item without an id cannot be pressed and does not draw
 * @param {any} state
 * @returns {Ask[]}
 */
export function asksOf(state) {
    return (Array.isArray(state?.asks) ? state.asks : [])
        .filter(
            (/** @type {any} */ a) =>
                typeof a?.id === 'string' && typeof a.text === 'string',
        )
        .map(
            (/** @type {any} */ a) =>
                /** @type {Ask} */ ({
                    id: a.id,
                    isGated: a.isGated === true,
                    isLocked: a.isLocked === true,
                    mark: a.mark ?? null,
                    pick: a.pick ?? null,
                    text: a.text,
                }),
        );
}

/**
 * a session's state file, found by the pid its registry file is named for: after a `/clear` the old id's file can
 * linger a moment, so the newest wins
 * @param {any[]} states
 * @param {number} pid
 */
export function stateOfPid(states, pid) {
    let found = null;
    for (const state of states)
        if (state?.pid === pid && (!found || state.at > found.at))
            found = state;
    return found;
}

/**
 * the pids `ps -o pid= -p <pids>` printed, the ones still running
 * @param {string} stdout
 */
export const runningPids = (stdout) =>
    new Set(
        stdout
            .split('\n')
            .map((l) => Number(l.trim()))
            .filter((n) => n > 0),
    );

/**
 * markdown reads `<word>` as html and drops it; a backslash keeps it, outside code spans, where a backslash would show
 * @param {string} text
 */
export const literalAngles = (text) =>
    text
        .split(/(`[^`]*`)/)
        .map((part, i) => (i % 2 ? part : part.replaceAll('<', '\\<')))
        .join('');

/**
 * a one-line plain label shows markdown's ** as typed, so they go
 * @param {string} text
 */
export const unbold = (text) => text.replaceAll('**', '');

/**
 * seats sort by the words of their name: a leading badge (🦉, ⚡ 🔧) would otherwise order them by emoji code point
 * @param {string} a
 * @param {string} b
 */
export const byName = (a, b) => {
    /** @param {string} name */
    const words = (name) => name.replace(/^[^\p{L}\p{N}]+/u, '');
    return words(a).localeCompare(words(b));
};

/**
 * the session's phases, as its state file holds them
 * @param {any} state
 * @returns {string[]}
 */
export function phasesOf(state) {
    const lines = state?.plan?.lines;
    return Array.isArray(lines)
        ? lines.filter((l) => typeof l === 'string')
        : [];
}

/**
 * the ticks file after one more press: the lines the stash has not taken yet (`at` past its `herdr-read:<sid>`), then
 * the press, its `at` above every line in the file, since the stash reads only presses past the newest `at` it took;
 * JSON.stringify keeps a steer holding quotes or a newline on one line
 * @param {string | null} text
 * @param {Press} press
 * @param {number} taken
 */
export function withPress(text, press, taken) {
    let last = 0;
    const kept = (text ?? '').split('\n').filter((line) => {
        try {
            const { at, id } = JSON.parse(line);
            if (typeof at === 'number') last = Math.max(last, at);
            return typeof at === 'number' && at > taken && Boolean(id);
        } catch {
            return false;
        }
    });
    const stamped = { ...press, at: Math.max(press.at, last + 1) };
    return [...kept, JSON.stringify(stamped)]
        .map((line) => `${line}\n`)
        .join('');
}

/**
 * the presses in the ticks file the stash has not taken yet, by ask id: the board draws them as pressed from the file
 * itself, so a press waiting on an idle seat's next turn stays ✅ however long it waits
 * @param {string | null} text
 * @param {number} taken
 * @returns {Map<string, Press['verdict']>}
 */
export function pendingPresses(text, taken) {
    /** @type {Map<string, Press['verdict']>} */
    const pending = new Map();
    for (const line of (text ?? '').split('\n')) {
        try {
            const { at, id, verdict } = JSON.parse(line);
            if (typeof at === 'number' && at > taken && id)
                pending.set(id, verdict);
        } catch {}
    }
    return pending;
}

/**
 * the ticks file with an untaken press of the ask taken back: his second click on a ticked plain ask, before the stash
 * read it; lines the stash took are pruned as `withPress` prunes them
 * @param {string | null} text
 * @param {string} id
 * @param {number} taken
 */
export function withoutPress(text, id, taken) {
    return (text ?? '')
        .split('\n')
        .filter((line) => {
            try {
                const press = JSON.parse(line);
                return (
                    typeof press.at === 'number' &&
                    press.at > taken &&
                    Boolean(press.id) &&
                    press.id !== id
                );
            } catch {
                return false;
            }
        })
        .map((line) => `${line}\n`)
        .join('');
}

/** @typedef {{ read: (path: string) => Promise<string | null>, write: (path: string, text: string, expected: string | null) => Promise<unknown> }} TicksIo */

/**
 * rewrites the ticks file with herdr's compare-and-swap write: a file changed since the read is refused, read again and
 * rewritten from its fresh text, so no other press is lost; a second refusal is thrown
 * @param {TicksIo} io
 * @param {string} path
 * @param {(text: string | null) => string} edit
 */
async function rewrite(io, path, edit) {
    for (let tries = 2; ; tries--) {
        const text = await io.read(path);
        try {
            return await io.write(path, edit(text), text);
        } catch (err) {
            if (tries <= 1) throw err;
        }
    }
}

/** @param {TicksIo} io @param {string} path @param {Press} press @param {number} taken */
export const savePress = (io, path, press, taken) =>
    rewrite(io, path, (text) => withPress(text, press, taken));

/** @param {TicksIo} io @param {string} path @param {string} id @param {number} taken */
export const dropPress = (io, path, id, taken) =>
    rewrite(io, path, (text) => withoutPress(text, id, taken));

/** @typedef {{ context: number | null, wait: string | null, week: number | null }} SeatFacts */
/** @typedef {{ at: number, seats: Record<string, SeatFacts> }} DeckSeats */

// herdr's shared state, the one door the chat reads a seat's facts through (a mod imports nothing outside its folder)
export const SEATS_KEY = 'x-herdr-deck.seats';
// unchanged facts are published again this often, so a reader can tell a live deck from a stopped one
export const SEATS_BEAT_MS = 60 * 1000;

/**
 * the three facts each live seat shows where dima types, keyed by pid; the waiting-on line, already `waitOf`'s, is
 * drawn plain, so markdown's ** go
 * @param {{ pid: number, status: string, context: number | null, wait: string | null }[]} rows
 * @param {number | null} week
 * @returns {Record<string, SeatFacts>}
 */
export function seatFacts(rows, week) {
    /** @type {Record<string, SeatFacts>} */
    const facts = {};
    for (const row of [...rows].sort((a, b) => a.pid - b.pid))
        facts[String(row.pid)] = {
            context: typeof row.context === 'number' ? row.context : null,
            wait: row.wait ? unbold(row.wait) : null,
            week,
        };
    return facts;
}

/**
 * the waiting-on line a seat shows, on the deck's row and in the chat's band alike: only an idle seat waits on
 * anything; one mid-turn, blocked on a prompt or in an unknown state carries its last reply's line, which is old
 * @param {string} status
 * @param {string | null | undefined} wait
 */
export const waitOf = (status, wait) =>
    status === 'idle' ? (wait ?? null) : null;

/**
 * the value to publish, or null when the facts are the ones already out and the last beat is recent: setShared
 * re-renders every mod, so an unchanged write is skipped
 * @param {DeckSeats | null | undefined} prev
 * @param {Record<string, SeatFacts>} seats
 * @param {number} now
 * @returns {DeckSeats | null}
 */
export function nextSeats(prev, seats, now) {
    const same =
        prev != null && JSON.stringify(prev.seats) === JSON.stringify(seats);
    if (same && now - prev.at < SEATS_BEAT_MS) return null;
    return { at: now, seats };
}

// the agents list publishes the pids it shows, in its order: his drag there orders the deck too, a seat it does not
// show going last; one rule, read from shared state, since a mod imports nothing outside its folder
export const ORDER_KEY = 'x-herdr-agents.order';

/**
 * @template {{ pid: number }} T
 * @param {T[]} rows
 * @param {number[] | null | undefined} pids
 * @returns {T[]}
 */
export function inListOrder(rows, pids) {
    if (!Array.isArray(pids)) return rows;
    const at = new Map(pids.map((pid, i) => [pid, i]));
    return [...rows].sort(
        (a, b) =>
            (at.get(a.pid) ?? pids.length) - (at.get(b.pid) ?? pids.length),
    );
}

/**
 * what an ask's tick shows: 🔒 only once the published ask is locked, which a turn does, never the stash's 4 s read of
 * the press; until then a tick is ✅ and his second click takes it back, gated asks too (dima: «ticked and able to
 * untick until you actually receive them»); an untick on its way draws open, so he can tick again at once
 * @param {Ask} ask
 * @param {Press['verdict'] | null | undefined} sent his press still in the ticks file, or just sent
 * @returns {'open' | 'ticked' | 'locked' | 'replayed'}
 */
export function tickState(ask, sent) {
    if (ask.isLocked) return 'locked';
    if (sent === 'untick') return 'open';
    if (ask.mark === 'accepted' || sent === 'tick') return 'ticked';
    if (ask.mark || sent === 'replay') return 'replayed';
    return 'open';
}

/**
 * the steer he sent with a press, shown under the ask until the turn takes it (dima, 22:54: «when i tick my steer text
 * is hidden. do not hide it. instead, hide it when it slipstreamed»); an open ask has its box instead
 * @param {ReturnType<typeof tickState>} state
 * @param {string} text
 */
export const sentSteer = (state, text) =>
    state !== 'open' && state !== 'locked' && text.trim() ? text.trim() : null;

/**
 * how his second click takes a tick back: a press the stash has not read leaves the ticks file, so neither the stash
 * nor the guard ever sees it; a press it has read gets an untick line, which the stash answers by dropping the mark
 * @param {Press['verdict'] | null | undefined} pending his press still in the ticks file
 * @param {Ask['mark']} [mark] the stash's mark: set once it read the press
 * @returns {'drop' | 'untick'}
 */
export const untickDoor = (pending, mark) =>
    pending === 'tick' && !mark ? 'drop' : 'untick';

/**
 * an ask's id as the board draws it: every seat numbers its asks on its own, so a wing's reads `w1·o8`, another
 * seat's `codie·o1`, and only main clio's stays bare
 * @param {string} seat the session's name
 * @param {string} id
 */
export function askLabel(seat, id) {
    const wing = /\bwing (\d+)/.exec(seat);
    if (wing) return `w${wing[1]}·${id}`;
    const word = /[a-z][\w-]*/i.exec(seat)?.[0];
    return !word || word === 'clio' ? id : `${word}·${id}`;
}

/**
 * an ask takes a steer while it draws open: never marked, or unticked though the stash still holds its tick mark
 * @param {Ask} ask
 * @param {Press['verdict'] | null | undefined} pending his press still in the ticks file, or just sent
 */
export const hasSteerBox = (ask, pending) =>
    !ask.isLocked && (!ask.mark || pending === 'untick');

// twin band-press: x-herdr-chatter's band.js writes the same file (a mod imports nothing outside its folder); the stash
// reads a hot press for the thread its sid names, whichever band wrote it (FRM-568)
export const PRESS_DIR = '.claude/shelf/band-presses';
export const PRESS_FILE = `${PRESS_DIR}/band.jsonl`;
const DAY_MS = 24 * 60 * 60 * 1000;
// a press the stash has not answered by then gives the button its state back: a hot press reaches the thread's state
// file at the stash's third 4 s poll, about 16 s at worst
export const PENDING_MS = 20 * 1000;

/** @typedef {{ at: number, button: 'hot', on: boolean, sid: string }} HotPress */

/** @param {string} sid @param {boolean} on @param {number} now @returns {HotPress} */
export const hotPressLine = (sid, on, now) => ({
    at: now,
    button: 'hot',
    on,
    sid,
});

/**
 * the band file after one more press: lines older than a day go, a broken line too
 * @param {string | null} text
 * @param {HotPress} line
 * @param {number} now
 */
export function withBandPress(text, line, now) {
    const kept = (text ?? '').split('\n').filter((l) => {
        try {
            return JSON.parse(l).at > now - DAY_MS;
        } catch {
            return false;
        }
    });
    return [...kept, JSON.stringify(line)].map((l) => `${l}\n`).join('');
}
// twin end

/** @param {number} ms */
const clock = (ms) => new Date(ms).toTimeString().slice(0, 5);

/**
 * a row's 🔥: on from its state file; a press the stash has not answered yet shows the state it asked for, for at most
 * PENDING_MS; the tooltip is its name, with the time it went on (dima, 23:08)
 * @param {{ since: number } | null | undefined} hot
 * @param {{ at: number, on: boolean } | null | undefined} pressed
 * @param {number} now
 */
export function hotOf(hot, pressed, now) {
    const isRead = Boolean(hot);
    const isPending =
        Boolean(pressed) &&
        pressed.on !== isRead &&
        now - pressed.at < PENDING_MS;
    return {
        isOn: isPending ? pressed.on : isRead,
        isPending,
        tip:
            hot && typeof hot.since === 'number'
                ? `keep hot: on since ${clock(hot.since)}`
                : 'keep hot',
    };
}

/**
 * each thread's newest hot press in the band file, from whichever band or row wrote it, so the row draws a press made
 * on the band above the chat too
 * @param {string | null} text
 * @returns {Map<string, { at: number, on: boolean }>}
 */
export function hotPresses(text) {
    /** @type {Map<string, { at: number, on: boolean }>} */
    const presses = new Map();
    for (const line of (text ?? '').split('\n')) {
        let p;
        try {
            p = JSON.parse(line);
        } catch {
            continue;
        }
        if (
            p?.button !== 'hot' ||
            typeof p.sid !== 'string' ||
            typeof p.at !== 'number'
        )
            continue;
        const was = presses.get(p.sid);
        if (!was || p.at > was.at)
            presses.set(p.sid, { at: p.at, on: p.on === true });
    }
    return presses;
}
