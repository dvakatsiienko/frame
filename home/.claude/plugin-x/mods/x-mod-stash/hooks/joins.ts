import type { EngineInterface } from 'claude-code';

import { joinRows } from './orbit.ts';
import { currentId, identity } from './session-identity.ts';
import { partsShown } from './settings-store.ts';
import { writeWhole } from './util.ts';

// dima's rows herdr writes into a thread's turn: the one reader of `herdr-joins/`, taken into a turn, stamped at its end,
// handed back when the thread ends

// the join queue (FRM-584): `join-taken:<sid>` the ids handed into the running turn, `join-done:<sid>` the ids a
// completed turn took, which herdr reads as `joined`, kept whole while the thread lives, since its rows stay in the file
const JOIN_TAKEN = 'join-taken:';
const JOIN_DONE = 'join-done:';
const JOINS_DIR = 'herdr-joins';
const joinsFile = (home: string, sid: string) =>
    `${home}/.claude/shelf/${JOINS_DIR}/${sid}.jsonl`;
const idsOf = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export async function joinsOf($: EngineInterface, home: string, sid: string) {
    const rows = joinRows(
        await $.fs.read(joinsFile(home, sid)).catch(() => ''),
    );
    const done = idsOf(
        await $.store.get(JOIN_DONE + sid).catch(() => undefined),
    );
    const taken = idsOf(
        await $.store.get(JOIN_TAKEN + sid).catch(() => undefined),
    );
    return { done, rows, taken };
}
// a take and a turn's settle both read and write the taken list across awaits: parallel tool calls wait their turn
let joinsTail: Promise<unknown> = Promise.resolve();
export function joinsLocked<T>(job: () => Promise<T>) {
    const run = joinsTail.then(job);
    joinsTail = run.catch(() => undefined);
    return run;
}
// the rows no turn took yet, handed into this one in order, and held as taken until it completes; a list that cannot
// be kept hands nothing in, so a row is never joined unstamped
export async function takeJoins($: EngineInterface) {
    const sid = await currentId($);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home || !(await partsShown($))('stash.joins')) return [];
    const { done, rows, taken } = await joinsOf($, home, sid);
    const fresh = rows.filter(
        (r) => !done.includes(r.id) && !taken.includes(r.id),
    );
    if (!fresh.length) return [];
    await $.store.set(JOIN_TAKEN + sid, [...taken, ...fresh.map((r) => r.id)]);
    return fresh;
}
// a completed turn stamps what it took; an interrupted or failed one hands it in again at the next turn
export async function settleJoins($: EngineInterface, isLanded: boolean) {
    const sid = await currentId($);
    if (!sid) return;
    const taken = idsOf(
        await $.store.get(JOIN_TAKEN + sid).catch(() => undefined),
    );
    if (!taken.length) return;
    if (isLanded) {
        const done = idsOf(
            await $.store.get(JOIN_DONE + sid).catch(() => undefined),
        );
        await $.store.set(JOIN_DONE + sid, [...done, ...taken]);
    }
    await $.store.delete(JOIN_TAKEN + sid);
}
// a thread that ends hands the rows it never joined back to herdr: they move to `herdr-joins/back/<sid>.jsonl` as
// herdr wrote them, under the lock dir both sides take (`<sid>.jsonl.lock`, no compare-and-swap exists: clio's call 7);
// a lock held elsewhere answers false, and the sweep tries again
async function forgetJoins($: EngineInterface, sid: string) {
    await $.store.delete(JOIN_TAKEN + sid).catch(() => undefined);
    await $.store.delete(JOIN_DONE + sid).catch(() => undefined);
}
// a lock dir this old was left by a crash, never by a live writer (both hold it for well under a second): broken and
// taken. herdr's chat reads the same age (`JOIN_LOCK_STALE_MS` in x-herdr-chat/joins.js:12)
const JOIN_LOCK_STALE_MS = 30 * 1000;
export async function takeJoinLock($: EngineInterface, lock: string) {
    if ((await $.process.run(['mkdir', lock])).exitCode === 0) return true;
    if (!(await isJoinLockStale($, lock))) return false;
    // one breaker at a time, the age read again under it: two waiters that both read the lock stale once both broke it,
    // the second removing the first's fresh lock (FRM-555 step 130); a breaker lock a crash left is stale the same way
    const breaker = `${lock}.break`;
    if ((await $.process.run(['mkdir', breaker])).exitCode !== 0) {
        if (!(await isJoinLockStale($, breaker))) return false;
        // moved aside under a name of its own: a second waiter's move then fails, never removing a fresh breaker
        const aside = `${breaker}.${identity.proc?.pid ?? 0}.${await $.clock.now()}`;
        if ((await $.process.run(['mv', breaker, aside])).exitCode === 0)
            await $.process.run(['rmdir', aside]);
        return false;
    }
    try {
        if (!(await isJoinLockStale($, lock))) return false;
        await $.process.run(['rmdir', lock]);
        return (await $.process.run(['mkdir', lock])).exitCode === 0;
    } finally {
        await $.process.run(['rmdir', breaker]);
    }
}
async function isJoinLockStale($: EngineInterface, lock: string) {
    const at = (await $.fs.stat(lock).catch(() => undefined))?.mtimeMs;
    return at !== undefined && (await $.clock.now()) - at >= JOIN_LOCK_STALE_MS;
}
export async function handBackJoins(
    $: EngineInterface,
    home: string,
    sid: string,
) {
    const file = joinsFile(home, sid);
    // no join folder, no joins; otherwise the file is read only under the lock, so a row herdr writes meanwhile goes too
    const hasDir = await $.fs
        .exists(`${home}/.claude/shelf/${JOINS_DIR}`)
        .catch(() => false);
    if (!hasDir) {
        await forgetJoins($, sid);
        return true;
    }
    const lock = `${file}.lock`;
    if (!(await takeJoinLock($, lock))) return false;
    if ((await $.fs.read(file).catch(() => undefined)) === undefined) {
        await $.process.run(['rmdir', lock]);
        await forgetJoins($, sid);
        return true;
    }
    try {
        // every line no turn joined goes back as herdr wrote it, a line this side could not read included
        const { done } = await joinsOf($, home, sid);
        const text = await $.fs.read(file).catch(() => '');
        const joined = new Set(
            joinRows(text)
                .filter((r) => done.includes(r.id))
                .map((r) => r.line),
        );
        const back = text
            .split('\n')
            .filter((line) => line.trim() && !joined.has(line));
        if (back.length) {
            const dir = `${home}/.claude/shelf/${JOINS_DIR}/back`;
            await $.process.run(['mkdir', '-p', dir]);
            const kept = await $.fs.read(`${dir}/${sid}.jsonl`).catch(() => '');
            await writeWhole(
                $,
                identity.proc?.pid ?? 0,
                `${dir}/${sid}.jsonl`,
                `${kept}${back.map((line) => `${line}\n`).join('')}`,
            );
        }
        await $.process.run(['rm', '-f', file]);
    } finally {
        await $.process.run(['rmdir', lock]);
    }
    await forgetJoins($, sid);
    return true;
}
