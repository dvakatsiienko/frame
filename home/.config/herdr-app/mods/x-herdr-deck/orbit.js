// orbit on the deck, as pure steps: what a session's state file holds, and the ticks file the deck
// alone writes for it (`~/.claude/shelf/orbit-ticks/<sid>.jsonl`, one press per line), which x-mod-stash reads at the
// session's next turn (FRM-552)

/** @typedef {{ id: string | null, text: string, pick: string | null, link: string | null, mark: string | null, isGated: boolean, isLocked: boolean }} Ask */
/** @typedef {ReturnType<typeof import('./press.js').pressState>} PressState */
/** @typedef {{ id: string, verdict: 'tick' | 'replay' | 'untick', steer?: string, text?: string, pick?: string, at: number }} Press */

/**
 * one press line for an ask: its text, and its pick when it has one, so the stash acts on the pick he ticked (FRM-661)
 * @param {Ask & { id: string }} ask @param {Press['verdict']} verdict @param {number} at @param {string} [steer]
 * @returns {Press}
 */
export const pressOf = (ask, verdict, at, steer) => ({
    at,
    id: ask.id,
    text: ask.text,
    verdict,
    ...(ask.pick ? { pick: ask.pick } : {}),
    ...(steer ? { steer } : {}),
});

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
                    link: typeof a.link === 'string' ? a.link : null,
                    mark: a.mark ?? null,
                    pick: a.pick ?? null,
                    text: a.text,
                }),
        )
        .sort(
            (/** @type {Ask} */ a, /** @type {Ask} */ b) =>
                pinRank(a.text) - pinRank(b.text),
        );
}

/**
 * look and 🧪 test cards first («look», «try», «test:»), then hazards, then the rest; a stable sort keeps the store's
 * order inside each group (FRM-620:W12, W16, W18)
 * @param {string} text
 */
const pinRank = (text) => {
    const head = text.trimStart();
    if (isPinnedCard(head)) return 0;
    // the bare ⚠ prefix matches ⚠️ too, the stash itself writes it bare
    return head.startsWith('⚠') ? 1 : 2;
};

/** a look card or a 🧪 test card: always pinned (FRM-620:W16) @param {string} text */
export const isPinnedCard = (text) =>
    /^(look\b|try\b|test:)/i.test(text.trimStart());

/** @typedef {'top' | 'bottom'} OrbitPin */
/** @template T @typedef {{ kind: 'pinned', cards: { ask: Ask, row: T }[] } | { kind: 'thread', row: T, asks: Ask[] }} OrbitSection */

/**
 * orbit's sections (FRM-620:W16, W17): look and 🧪 cards from every thread in one group, first or last by his setting,
 * then each thread's other asks in the agents list's order; a thread it does not show goes last by name, never by its
 * status, so an arriving ask moves no other row
 * @template {{ asks: Ask[], name: string, pid: number }} T
 * @param {T[]} rows @param {number[] | null | undefined} pids @param {OrbitPin} pin
 * @returns {OrbitSection<T>[]}
 */
export function orbitSections(rows, pids, pin) {
    const ordered = inListOrder(
        [...rows].sort((a, b) => byName(a.name, b.name)),
        pids,
    );
    const cards = ordered.flatMap((row) =>
        row.asks
            .filter((a) => isPinnedCard(a.text))
            .map((ask) => ({ ask, row })),
    );
    /** @type {OrbitSection<T>[]} */
    const threads = ordered.flatMap((row) => {
        const asks = row.asks.filter((a) => !isPinnedCard(a.text));
        return asks.length > 0 ? [{ asks, kind: 'thread', row }] : [];
    });
    if (cards.length === 0) return threads;
    /** @type {OrbitSection<T>} */
    const pinned = { cards, kind: 'pinned' };
    return pin === 'bottom' ? [...threads, pinned] : [pinned, ...threads];
}

// his «orbit › pinned cards» row in x-herdr-settings (x-herdr-chat settings-model.js)
export const ORBIT_PIN_ROW = 'orbit.pin';

/**
 * his pin setting from the settings file's text: anything but a stored «bottom» pins on top, as before the setting
 * @param {string | null} text @returns {OrbitPin}
 */
export function orbitPinIn(text) {
    try {
        return JSON.parse(text ?? '')?.rows?.[ORBIT_PIN_ROW] === 'bottom'
            ? 'bottom'
            : 'top';
    } catch {
        return 'top';
    }
}

/**
 * an ask's link as the card draws it: a web page by its host, an app link by its app (its scheme), a file by its name;
 * words that
 * are none of these draw nothing
 * @param {string | null} link
 * @returns {{ kind: 'web' | 'file', label: string } | null}
 */
export function linkOf(link) {
    const text = link?.trim() ?? '';
    if (/^(\/|~\/)/.test(text))
        return { kind: 'file', label: text.slice(text.lastIndexOf('/') + 1) };
    const url = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(text);
    if (!url) return null;
    const scheme = (url[1] ?? '').toLowerCase();
    return {
        kind: 'web',
        label: /^https?$/.test(scheme) && url[2] ? url[2] : scheme,
    };
}

/**
 * a glide card's running ticket as its linear page; a ticket in any other shape draws nothing (FRM-649:W39)
 * @param {unknown} ticket the card's `ticket`, which x-mod-stash derives from its title
 * @returns {string | null}
 */
export function ticketUrl(ticket) {
    return typeof ticket === 'string' && /^[A-Z]+-\d+$/.test(ticket)
        ? `https://linear.app/x-com/issue/${ticket}`
        : null;
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
 * threads sort by the words of their name: a leading badge (🦉, ⚡ 🔧) would otherwise order them by emoji code point
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
 * the presses in the ticks file the stash has not taken yet, by ask id: the deck draws them as pressed from the file
 * itself, so a press waiting on an idle thread's next turn stays ✅ however long it waits
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
 * the rows with their presses from the ticks files, read before any of them draws: a row drawn before its file was read
 * showed a ticked ask open, and a key on it ticked again (FRM-628); new rows, never a write into the ones it is handed,
 * which may be the rows the deck draws
 * @template {{ sid: string, asks: unknown[], taken: number, pending: Map<string, Press['verdict']> }} R
 * @param {R[]} rows
 * @param {(sid: string) => Promise<string | null>} readTicks
 * @returns {Promise<R[]>}
 */
export async function withPending(rows, readTicks) {
    /** @type {R[]} */
    const read = [];
    for (const row of rows)
        read.push(
            row.asks.length
                ? {
                      ...row,
                      pending: pendingPresses(
                          await readTicks(row.sid),
                          row.taken,
                      ),
                  }
                : row,
        );
    return read;
}

/** a read still running after this long has stalled: the chain lets it go and the next read starts */
export const READ_STALL_MS = 30 * 1000;

/**
 * @typedef {{ phase: 'idle', settledAt: number | null }
 *   | { phase: 'running', id: number, startedAt: number, settledAt: number | null }
 *   | { phase: 'stalled', settledAt: number | null }} ChainState
 * @typedef {{ type: 'started', id: number, at: number }
 *   | { type: 'settled' | 'failed' | 'stallTimedOut', id: number, at: number }} ChainEvent
 */

/**
 * the reload chain's one state: a run's answer or its stall timer moves it only while that run is the running one, so
 * a run let go as stalled changes nothing when it answers late
 * @param {ChainState} chain @param {ChainEvent} event @returns {ChainState}
 */
export function nextChain(chain, event) {
    if (event.type === 'started')
        return {
            id: event.id,
            phase: 'running',
            settledAt: chain.settledAt,
            startedAt: event.at,
        };
    if (chain.phase !== 'running' || chain.id !== event.id) return chain;
    if (event.type === 'settled') return { phase: 'idle', settledAt: event.at };
    if (event.type === 'failed')
        return { phase: 'idle', settledAt: chain.settledAt };
    return { phase: 'stalled', settledAt: chain.settledAt };
}

/**
 * one run at a time: a run asked for while one goes waits for it, and of those waiting only the newest runs, so two
 * reloads never overlap and the newest read always lands last (FRM-628: a slow `ps` let an older read put a gone ask back).
 * a run that never settles stalls the chain (FRM-648 step 113b, dima's empty deck at 14:41): past READ_STALL_MS it is
 * let go, its late answer told it is no longer current, and the deck says «no read since» its last settled read. a
 * mod restart may leave its stall timer dead (dima's empty orbit, 15:26), so the next run asked for past the stall lets
 * it go by the clock too
 * @param {() => number} now
 */
export function createSerial(now) {
    let tail = Promise.resolve();
    let newest = 0;
    /** @type {ChainState} */
    let chain = { phase: 'idle', settledAt: null };
    /** lets the running run go as stalled */
    let letGo = () => {};
    /**
     * @param {(isCurrent: () => boolean) => Promise<void>} run
     * @param {(ms: number, fire: () => void) => { cancel: () => unknown }} after the run's own timer, `cx.timer.after`
     */
    const serial = (run, after) => {
        const id = ++newest;
        if (
            chain.phase === 'running' &&
            now() - chain.startedAt >= READ_STALL_MS
        )
            letGo();
        const next = tail.then(() => {
            if (id !== newest) return;
            chain = nextChain(chain, { at: now(), id, type: 'started' });
            return new Promise((resolve, reject) => {
                // this run's own stall: its timer, firing after a later run started, never stalls that one
                const stall = () => {
                    chain = nextChain(chain, {
                        at: now(),
                        id,
                        type: 'stallTimedOut',
                    });
                    resolve(undefined);
                };
                letGo = stall;
                const timer = after(READ_STALL_MS, stall);
                run(() => chain.phase === 'running' && chain.id === id).then(
                    () => {
                        timer.cancel();
                        chain = nextChain(chain, {
                            at: now(),
                            id,
                            type: 'settled',
                        });
                        resolve(undefined);
                    },
                    (err) => {
                        timer.cancel();
                        chain = nextChain(chain, {
                            at: now(),
                            id,
                            type: 'failed',
                        });
                        reject(err);
                    },
                );
            });
        });
        tail = next.catch(() => {});
        return next;
    };
    return Object.assign(serial, { state: () => chain });
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

/**
 * the asks «tick all» takes (FRM-589): open and pressable, never gated, since a gated ask unlocks an action and stays
 * his own press, one each (mods AGENTS.md § never); never a look or 🧪 card either, drawn apart in the pinned group
 * @param {Ask[]} asks
 * @param {(id: string) => PressState} stateOf
 */
export const tickAllTakes = (asks, stateOf) =>
    asks.filter(
        (a) =>
            a.id !== null &&
            !a.isGated &&
            !isPinnedCard(a.text) &&
            stateOf(a.id) === 'open',
    );

/**
 * «tick all» on the one thread `sid` names: a tick line per ask it takes, the single tick's shape, in that thread's
 * ticks file alone, one write
 * @param {TicksIo} io
 * @param {string} dir the ticks folder
 * @param {{ sid: string, asks: Ask[], taken: number }[]} rows every thread on the deck
 * @param {string} sid
 * @param {(id: string) => PressState} stateOf
 * @param {(id: string) => string | undefined} steerOf a steer typed in an ask's box rides its tick, as with one tick
 * @param {number} at
 * @returns {Promise<Ask[]>} the asks it ticked
 */
export async function tickAll(io, dir, rows, sid, stateOf, steerOf, at) {
    const row = rows.find((r) => r.sid === sid);
    const takes = row ? tickAllTakes(row.asks, stateOf) : [];
    if (!row || takes.length === 0) return [];
    await rewrite(io, `${dir}/${sid}.jsonl`, (text) =>
        takes.reduce((was, a) => {
            const id = /** @type {string} */ (a.id);
            const press = pressOf(
                { ...a, id },
                'tick',
                at,
                steerOf(id)?.trim(),
            );
            return withPress(was, press, row.taken);
        }, text ?? ''),
    );
    return takes;
}

/** @typedef {{ context: number | null, wait: string | null, week: number | null }} ThreadFacts */
/** @typedef {{ at: number, threads: Record<string, ThreadFacts> }} DeckThreads */

// herdr's shared state, the one door the chat reads a thread's facts through (a mod imports nothing outside its folder)
export const THREADS_KEY = 'x-herdr-deck.threads';
// unchanged facts are published again this often, so a reader can tell a live deck from a stopped one
export const THREADS_BEAT_MS = 60 * 1000;

/**
 * the three facts each live thread shows where dima types, keyed by pid; the waiting-on line, already `waitOf`'s, is
 * drawn plain, so markdown's ** go
 * @param {{ pid: number, status: string, context: number | null, wait: string | null }[]} rows
 * @param {number | null} week
 * @returns {Record<string, ThreadFacts>}
 */
export function threadFacts(rows, week) {
    /** @type {Record<string, ThreadFacts>} */
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
 * the waiting-on line a thread shows, on the deck's row and in the chat's band alike: only an idle thread waits on
 * anything; one mid-turn, blocked on a prompt or in an unknown state carries its last reply's line, which is old
 * @param {string} status
 * @param {string | null | undefined} wait
 */
export const waitOf = (status, wait) =>
    status === 'idle' ? (wait ?? null) : null;

/**
 * the value to publish, or null when the facts are the ones already out and the last beat is recent: setShared
 * re-renders every mod, so an unchanged write is skipped
 * @param {DeckThreads | null | undefined} prev
 * @param {Record<string, ThreadFacts>} threads
 * @param {number} now
 * @returns {DeckThreads | null}
 */
export function nextThreads(prev, threads, now) {
    const same =
        prev != null &&
        JSON.stringify(prev.threads) === JSON.stringify(threads);
    if (same && now - prev.at < THREADS_BEAT_MS) return null;
    return { at: now, threads };
}

// the agents list publishes the pids it shows, in its order: his drag there orders the deck too, a thread it does not
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
 * his second click takes a tick or a replay back until a turn takes it (PK-386: a replay locked at once)
 * @param {PressState} state
 */
export const canTakeBack = (state) =>
    state === 'ticked' || state === 'replayed';

/**
 * the two buttons' emojis (dima's W63–W67, 21:03): both stay, the pressed one reading 🍕 queued, then 😋 once a turn
 * took it, by the stash's mark of what was taken
 * @param {PressState} state @param {Ask['mark']} [mark]
 */
export function pressLabel(state, mark) {
    const taken = mark === 'accepted' ? 'tick' : 'replay';
    return {
        replay:
            state === 'replayed'
                ? '🍕'
                : state === 'locked' && taken === 'replay'
                  ? '😋'
                  : '🔁',
        tick:
            state === 'ticked'
                ? '🍕'
                : state === 'locked' && taken === 'tick'
                  ? '😋'
                  : '🛎️',
    };
}

/**
 * an ask's id as the deck draws it: every thread numbers its asks on its own, so a wing's reads `w1·o8`, another
 * thread's `codie·o1`, and only main clio's stays bare
 * @param {string} thread the session's name
 * @param {string} id
 */
export function askLabel(thread, id) {
    const wing = /\bwing (\d+)/.exec(thread);
    if (wing) return `w${wing[1]}·${id}`;
    const word = /[a-z][\w-]*/i.exec(thread)?.[0];
    return !word || word === 'clio' ? id : `${word}·${id}`;
}

/**
 * the asks updated under their id since the last read (FRM-620 W1, W2, W13): a new text or pick on an id seen before.
 * herdr's state file carries no «changed» flag, so the deck tells by what it saw; an ask that left is forgotten
 * @param {Record<string, string>} seen `sid:id` → the text and pick it last had
 * @param {{ sid: string, asks: { id: string | null, text: string, pick?: string | null }[] }[]} rows
 * @returns {{ seen: Record<string, string>, updated: string[] }}
 */
export function askRounds(seen, rows) {
    /** @type {Record<string, string>} */
    const next = {};
    const updated = [];
    for (const s of rows)
        for (const ask of s.asks) {
            if (!ask.id) continue;
            const key = `${s.sid}:${ask.id}`;
            next[key] = `${ask.text}\n${ask.pick ?? ''}`;
            if (key in seen && seen[key] !== next[key]) updated.push(key);
        }
    return { seen: next, updated };
}

/**
 * a key in an ask's steer box: Enter is 🛎️, cmd-enter 🔁, each pressed a second time taking its press back (dima,
 * 20:34); a guarded ask's tick stays his click, as no key reaches an unlocking press
 * @param {PressState} state @param {boolean} isCmd @param {boolean} isGated
 * @returns {'tick' | 'replay' | 'untick' | null}
 */
export function steerKeyPress(state, isCmd, isGated) {
    if (state === 'locked') return null;
    if (isCmd) return state === 'replayed' ? 'untick' : 'replay';
    if (state === 'ticked') return 'untick';
    return isGated ? null : 'tick';
}

/**
 * what a key in a steer box does to its ask, read against his press as the one record has it: no shelf read between
 * two keys, so Enter then ⌘Enter takes the replay over the tick at once (FRM-628:W1)
 * @template {{ sid: string, asks: Ask[] }} R
 * @param {R[]} rows @param {string} key the box's `sid:id` @param {boolean} isCmd
 * @param {(s: R, id: string | null) => PressState} stateOf
 * @returns {{ s: R, ask: Ask, act: ReturnType<typeof steerKeyPress>, note: string | null } | null} null: its ask left
 */
export function steerKeyAct(rows, key, isCmd, stateOf) {
    for (const s of rows)
        for (const ask of s.asks) {
            if (`${s.sid}:${ask.id}` !== key) continue;
            const state = stateOf(s, ask.id);
            const isGated = Boolean(ask.isGated);
            return {
                act: steerKeyPress(state, isCmd, isGated),
                ask,
                note: steerKeyNote(state, isCmd, isGated),
                s,
            };
        }
    return null;
}

/**
 * the ticks files are written one at a time: two presses in flight would each read the file before the other's write,
 * and herdr refuses the second (it writes only over the text it read), so the press flipped back. one retry covers a
 * write the stash slipped in between; a failed write never stops the next
 */
export function createTurns() {
    /** @type {Promise<unknown>} */
    let writing = Promise.resolve();
    /** @template T @param {() => Promise<T>} write @returns {Promise<T>} */
    return (write) => {
        const run = writing
            .catch(() => {})
            .then(() => write().catch(() => write()));
        writing = run;
        return run;
    };
}

/**
 * the line under a steer box when its key did nothing: a guarded ask's tick is his click, never Enter
 * @param {PressState} state @param {boolean} isCmd @param {boolean} isGated
 * @returns {string | null}
 */
export function steerKeyNote(state, isCmd, isGated) {
    return state !== 'locked' && !steerKeyPress(state, isCmd, isGated)
        ? 'Ticks by click only'
        : null;
}

/**
 * the `env … ps` call `runningThreads` reads: its start times in utc and the c locale, the form x writes `procStart` in
 * @param {number[]} pids
 */
export const psStartArgs = (pids) => [
    'LC_ALL=C',
    'TZ=UTC',
    'ps',
    '-o',
    'pid=,lstart=',
    '-p',
    pids.join(','),
];

/**
 * the store's threads still running on their own process, by one `ps -o pid=,lstart= -p <pids>` answer read in utc and
 * the c locale, x's own form for `procStart`: the store keeps a thread until some session refreshes it, so a row whose
 * pid ended, or came back as another process, leaves here (FRM-601). no answer (null) is no answer: the deck keeps its
 * last rows, never every row the store still holds
 * @template {{ pid: number, procStart?: string }} T
 * @param {T[]} threads
 * @param {string | null} psOut
 * @returns {T[] | null}
 */
export function runningThreads(threads, psOut) {
    if (psOut === null) return null;
    const fold = (/** @type {string} */ text) =>
        text.trim().split(/\s+/).join(' ');
    /** @type {Map<number, string>} */
    const started = new Map();
    for (const line of psOut.split('\n')) {
        const [pid, ...start] = line.trim().split(/\s+/);
        if (Number(pid) > 0) started.set(Number(pid), start.join(' '));
    }
    return threads.filter(
        (t) =>
            started.has(t.pid) &&
            (!t.procStart || fold(t.procStart) === started.get(t.pid)),
    );
}

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
        pressed != null &&
        pressed.on !== isRead &&
        now - pressed.at < PENDING_MS;
    return {
        isOn: isPending && pressed ? pressed.on : isRead,
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

/**
 * the asker ⌘⇧K ticks: the one under the pointer, else the one he last clicked, else the thread the chat shows; one
 * whose asks all left is passed over (dima, 21:42: «tick all asks of an asker that the pointer currently hovers»)
 * @param {string[]} sids the askers with open asks
 * @param {{ hovered: string | null, picked: string | null, shown: string | null }} at
 * @returns {string | null}
 */
export function tickAllThread(sids, { hovered, picked, shown }) {
    return (
        [hovered, picked, shown].find((sid) => sid && sids.includes(sid)) ??
        null
    );
}

/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} KeptStore */

/** a value kept in the copy's store (herdr's localStorage, which outlives a reload); null when missing or refused @param {KeptStore} store @param {string} key */
export function kept(store, key) {
    try {
        return store.getItem(key);
    } catch {
        return null;
    }
}
/** @param {KeptStore} store @param {string} key @param {string} value an empty value removes it */
export function keep(store, key, value) {
    try {
        if (value) store.setItem(key, value);
        else store.removeItem(key);
    } catch {}
}

/**
 * askRounds against what the copy kept: the updated set carried and stored, the keys whose steer clears now (their
 * kept steer cleared here). null: the copy just started, so the stored set comes back
 * @param {KeptStore} store
 * @param {Set<string> | null} updated
 * @param {Parameters<typeof askRounds>[1]} rows
 */
export function roundsKept(store, updated, rows) {
    const was = updated ?? new Set(JSON.parse(kept(store, 'updated') ?? '[]'));
    const { seen, updated: cleared } = askRounds(
        JSON.parse(kept(store, 'seen') ?? '{}'),
        rows,
    );
    for (const key of cleared) keep(store, `steer:${key}`, '');
    const now = new Set([...was, ...cleared].filter((key) => key in seen));
    keep(store, 'seen', JSON.stringify(seen));
    keep(store, 'updated', JSON.stringify([...now]));
    return { cleared, updated: now };
}
