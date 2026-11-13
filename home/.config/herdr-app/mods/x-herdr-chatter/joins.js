// the magic send (FRM-564): a click on send joins the thread's running turn instead of starting one. the chatter appends
// one `{id, text}` row to the thread's join file in the shelf, under the lock dir x-mod-stash takes too
// (`<sid>.jsonl.lock`, a mkdir); the stash hands the rows into the turn and lists each id in the thread's herdr state as
// `joins: {joined, waiting, push}`, `joined` only once the turn that took it completed (FRM-584's contract)

export const JOINS_DIR = '.claude/shelf/herdr-joins';
// how long a click waits for a lock the stash holds before it gives the text back
const LOCK_WAIT_MS = 2000;
const LOCK_RETRY_MS = 100;
// a row the thread's state lists nowhere this long after the write was never taken: the stash is off or gone
export const JOIN_TAKE_MS = 60 * 1000;
// how long the button reads «joined»
export const JOINED_SHOWN_MS = 3000;

/** @typedef {{ joined?: string[], waiting?: string[], push?: string[] }} Joins */
/**
 * @typedef {{ lock: (path: string) => Promise<boolean>, unlock: (path: string) => Promise<void>,
 *   read: (path: string) => Promise<string>, write: (path: string, text: string) => Promise<void>,
 *   sleep: (ms: number) => Promise<void>, now: () => number }} JoinIo
 */

/**
 * one join row appended under the lock dir: true once written; false when the lock stays held past ~2 s or the write
 * fails, nothing written then
 * @param {JoinIo} io @param {string} path @param {string} id @param {string} text
 */
export async function appendJoin(io, path, id, text) {
    const lock = `${path}.lock`;
    const until = io.now() + LOCK_WAIT_MS;
    while (!(await io.lock(lock))) {
        if (io.now() >= until) return false;
        await io.sleep(LOCK_RETRY_MS);
    }
    try {
        const was = await io.read(path);
        const head = was && !was.endsWith('\n') ? `${was}\n` : was;
        await io.write(path, `${head}${JSON.stringify({ id, text })}\n`);
        return true;
    } catch {
        return false;
    } finally {
        await io.unlock(lock).catch(() => {});
    }
}

/**
 * the joins a thread still waits on, read back from its join file: what a reload draws as the card. a row counts only
 * once the thread's state lists it as waiting, so a file with no state behind it draws nothing; an id's first row wins
 * @param {string} file @param {Joins | null | undefined} joins @returns {{ id: string, text: string }[]}
 */
export function pendingJoins(file, joins) {
    const waiting = new Set(joins?.waiting ?? []);
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
    return [...rows]
        .filter(([id]) => waiting.has(id))
        .map(([id, text]) => ({ id, text }));
}

/** these words already wait as a join: a second click writes no second row @param {{ text: string }[]} rows @param {string} text */
export const isJoinPending = (rows, text) =>
    rows.some((r) => r.text.trim() === text.trim());

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
