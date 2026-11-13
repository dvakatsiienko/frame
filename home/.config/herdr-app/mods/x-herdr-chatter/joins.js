// the magic send (FRM-564): a click on send joins the thread's running turn instead of starting one. the chatter appends
// one `{id, text}` row to the thread's join file in the shelf, under the lock dir x-mod-stash takes too
// (`<sid>.jsonl.lock`, a mkdir); the stash hands the rows into the turn and lists each id in the thread's herdr state as
// `joins: {joined, waiting, push}`, `joined` only once the turn that took it completed (FRM-584's contract)

export const JOINS_DIR = '.claude/shelf/herdr-joins';
// how long a click waits for a lock the stash holds before it gives the text back
const LOCK_WAIT_MS = 2000;
const LOCK_RETRY_MS = 100;
// a lock dir this old was left by a crash, never by a live writer (both hold it for well under a second): broken and
// taken. x-mod-stash's hand-back reads the same age (`JOIN_LOCK_STALE_MS` in its register.tsx)
export const JOIN_LOCK_STALE_MS = 30 * 1000;
// a row the thread's state lists nowhere this long after the write was never taken: the stash is off or gone
export const JOIN_TAKE_MS = 60 * 1000;
// how long the button reads «joined»
export const JOINED_SHOWN_MS = 3000;

/** @typedef {{ joined?: string[], waiting?: string[], push?: string[] }} Joins */
/**
 * @typedef {{ lock: (path: string) => Promise<boolean>, unlock: (path: string) => Promise<void>,
 *   lockAge: (path: string) => Promise<number | null>,
 *   read: (path: string) => Promise<string | null>,
 *   write: (path: string, text: string, expected: string | null) => Promise<unknown>,
 *   sleep: (ms: number) => Promise<void>, now: () => number }} JoinIo
 */

/**
 * the join file rewritten under the lock dir: true once written; false when the lock stays held past ~2 s or the write
 * fails, nothing written then
 * @param {JoinIo} io @param {string} path @param {(was: string | null) => string} edit
 */
async function editJoins(io, path, edit) {
    const lock = `${path}.lock`;
    const until = io.now() + LOCK_WAIT_MS;
    while (!(await io.lock(lock))) {
        const age = await io.lockAge(lock);
        if (age !== null && age >= JOIN_LOCK_STALE_MS) {
            await io.unlock(lock).catch(() => {});
            continue;
        }
        if (io.now() >= until) return false;
        await io.sleep(LOCK_RETRY_MS);
    }
    try {
        // herdr writes only over the text it read, null for a new file
        const was = await io.read(path);
        await io.write(path, edit(was), was);
        return true;
    } catch {
        return false;
    } finally {
        await io.unlock(lock).catch(() => {});
    }
}

/** one join row appended @param {JoinIo} io @param {string} path @param {string} id @param {string} text */
export const appendJoin = (io, path, id, text) =>
    editJoins(io, path, (was) => {
        const head = was && !was.endsWith('\n') ? `${was}\n` : (was ?? '');
        return `${head}${JSON.stringify({ id, text })}\n`;
    });

/** a waiting join's words replaced, its id and place kept @param {JoinIo} io @param {string} path @param {string} id @param {string} text */
export const retextJoin = (io, path, id, text) =>
    editJoins(io, path, (was) =>
        (was ?? '')
            .split('\n')
            .map((line) => {
                try {
                    return JSON.parse(line)?.id === id
                        ? JSON.stringify({ id, text })
                        : line;
                } catch {
                    return line;
                }
            })
            .join('\n'),
    );

/** a waiting join taken back: its row leaves the file @param {JoinIo} io @param {string} path @param {string} id */
export const takeBackJoin = (io, path, id) =>
    editJoins(io, path, (was) => dropJoin(was ?? '', id));

// a hold on send, Enter or cmd-enter this long pushes instead of joining, its disc filling after a short delay so a
// tap never flashes it (dima, 20:03; 100 ms at 20:14); both are settings rows, these their defaults
export const HOLD_DELAY_MS = 100;
export const HOLD_PUSH_MS = 1000;

/**
 * a press on send, step by step: a release before HOLD_DELAY_MS joins, one after it does nothing, a hold that reaches it pushes once, and a hold
 * cut short (focus loss, a blur, the pointer gone) does nothing; `fill` is the bar, 0 to 1
 * @param {{ at: number } | null} hold @param {'press' | 'tick' | 'release' | 'cancel'} event @param {number} now
 * @param {{ delay: number, push: number }} [timing] his settings, the defaults above when unset
 * @returns {{ hold: { at: number } | null, act: 'join' | 'push' | null, fill: number }}
 */
export function holdSend(
    hold,
    event,
    now,
    timing = { delay: HOLD_DELAY_MS, push: HOLD_PUSH_MS },
) {
    if (event === 'press') return { act: null, fill: 0, hold: { at: now } };
    if (!hold || event === 'cancel') return { act: null, fill: 0, hold: null };
    // a tap joins; a hold he lets go once its disc started is changed mind, nothing sent or marked (dima, 20:05)
    if (event === 'release')
        return {
            act: now - hold.at > timing.delay ? null : 'join',
            fill: 0,
            hold: null,
        };
    const fill = Math.min(
        1,
        Math.max(0, now - hold.at - timing.delay) / timing.push,
    );
    return fill < 1
        ? { act: null, fill, hold }
        : { act: 'push', fill: 1, hold: null };
}

/**
 * the rows an ended thread handed back that the quill has not taken yet, in send order; an id's first row wins
 * @param {string} file the `back/<sid>.jsonl` file @param {string[]} taken ids already brought back
 * @returns {{ ids: string[], texts: string[] }}
 */
export function backTexts(file, taken) {
    /** @type {Map<string, string>} */
    const rows = new Map();
    for (const line of file.split('\n')) {
        let row;
        try {
            row = JSON.parse(line);
        } catch {
            continue;
        }
        const { id, text } = row ?? {};
        if (typeof id !== 'string' || !id || rows.has(id)) continue;
        if (typeof text === 'string' && text.trim()) rows.set(id, text);
    }
    const kept = [...rows].filter(([id]) => !taken.includes(id));
    return { ids: kept.map(([id]) => id), texts: kept.map(([, t]) => t) };
}

/**
 * where a join stands: «joined», still «waiting» on the thread, «pending» until its state lists it, or «not taken» once
 * it is listed nowhere a minute after the write
 * @param {Joins | null | undefined} joins @param {string} id @param {number} writtenAt @param {number} now
 * @returns {'joined' | 'waiting' | 'pending' | 'not taken'}
 */
export function joinStatus(joins, id, writtenAt, now) {
    if (joins?.joined?.includes(id)) return 'joined';
    if (joins?.waiting?.includes(id) || joins?.push?.includes(id))
        return 'waiting';
    return now - writtenAt >= JOIN_TAKE_MS ? 'not taken' : 'pending';
}

/**
 * why a send pushes instead of joining, in the button's few words; null when it joins
 * @param {string} text @param {Joins | null | undefined} joins
 */
export function pushReason(text, joins) {
    if (text.startsWith('/')) return 'Sent: a slash command starts a turn';
    if (!joins) return 'Sent: joins are off for this thread';
    return null;
}

/** the join file without one id's rows, every other line as written @param {string} file @param {string} id */
export function dropJoin(file, id) {
    return file
        .split('\n')
        .filter((line) => {
            try {
                return JSON.parse(line)?.id !== id;
            } catch {
                return true;
            }
        })
        .join('\n');
}

// x-mod-stash hands joins into a turn as one model-only context line (orbit.ts `joinRowsText`)
const JOINED_HEAD =
    /^💨 dima wrote (?:this|these \d+, in order,) in herdr while you worked; it joins this turn as his own words:\n/;

/**
 * the joins a transcript record carries, in order: the chat draws each as his own message
 * @param {any} entry @returns {string[]}
 */
export function joinedTexts(entry) {
    if (
        entry?.type !== 'attachment' ||
        entry.attachment?.type !== 'hook_additional_context'
    )
        return [];
    const line = (entry.attachment.content ?? []).find(
        (/** @type {unknown} */ l) =>
            typeof l === 'string' && JOINED_HEAD.test(l),
    );
    if (!line) return [];
    const body = line
        .replace(JOINED_HEAD, '')
        .replace(/^«/, '')
        .replace(/»$/, '');
    return body.split('»\n«');
}
