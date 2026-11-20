// a thread's name and his order, published for the tab bar and the deck: the Claude Code session name of the terminal's
// pid, from x's thread store, kept per address under NAMES_KEY; the order as pids under ORDER_KEY. x-herdr-agents keeps
// its own older reader until it leaves the tree

import { readdir } from 'fs/promises';
import { hc, home, readTextFile, setShared, shared } from 'herdr';

import { rejoin } from './joined.js';
import { orderPids } from './order.js';

// a live session's registry name never changes, so the pretty name x draws from its record wins (PK-378)
/** @param {{ name?: string, display?: string } | null} session */
export const threadName = (session) =>
    session?.display && session.display !== 'unknown'
        ? session.display
        : session?.name
          ? rejoin(session.name)
          : null;

// Our naming rule: an agent in herdr is called by its Claude Code session name (`claude -n`, or /rename), read from
// x's thread store (~/.claude/shelf/threads.json) by the pid herdr's core reports; a name changes on /rename, so it is read again every 30 s.
/** @type {Map<string, { at: number, isRead: boolean, name: string | null, pid: number | null }>} */
export const NAMES = new Map();
/** @param {string} address */
export function sessionName(address) {
    return NAMES.get(address)?.name ?? null;
}
// a `claude --bg` thread shows in herdr as `claude attach <job id>`: the terminal's pid is the attach client's, so its
// session is the registry file carrying that job id
/** @param {{ pid?: number, argv?: string[] }} term @returns {Promise<any>} */
async function sessionOf(term) {
    const dir = `${home()}/.claude/sessions`;
    /** @param {string} path */
    const read = async (path) => {
        try {
            return JSON.parse((await readTextFile(path)) ?? 'null');
        } catch {
            return null;
        }
    };
    // one rule, one reader (FRM-570 rule 8): a thread's name by its pid is x's thread store's; cc's registry stays the
    // door only for a bg thread's job id, which the store does not carry
    const store = term.pid
        ? await read(`${home()}/.claude/shelf/threads.json`)
        : null;
    const own = Array.isArray(store?.threads)
        ? store.threads.find((/** @type {any} */ t) => t?.pid === term.pid)
        : null;
    if (own) return own;
    const job = term.argv?.[1] === 'attach' ? term.argv[2] : null;
    if (!job) return null;
    for (const f of await readdir(dir).catch(
        () => /** @type {string[]} */ ([]),
    )) {
        const s = f.endsWith('.json') ? await read(`${dir}/${f}`) : null;
        if (s?.jobId === job) return s;
    }
    return null;
}

/** @param {{ address: string }[]} list */
export async function readNames(list) {
    for (const a of list) {
        const kept = NAMES.get(a.address);
        if (kept && Date.now() - kept.at < 30000) continue;
        NAMES.set(a.address, {
            at: Date.now(),
            isRead: kept?.isRead ?? false,
            name: kept?.name ?? null,
            pid: kept?.pid ?? null,
        });
        const got = await hc(['get', a.address, '--json']).catch(
            () => /** @type {null} */ (null),
        );
        const term = got?.code === 0 ? JSON.parse(got.stdout) : null;
        const session = term ? await sessionOf(term) : null;
        NAMES.set(a.address, {
            at: Date.now(),
            isRead: true,
            name: threadName(session),
            pid: session?.pid ?? null,
        });
    }
}

// the names go out through herdr's shared state, so the tab bar shows the same name and never reads them a second way;
// setShared re-renders every mod, so an unchanged map is not written
export const NAMES_KEY = 'x-herdr-agents.names';
export function publishNames() {
    /** @type {Record<string, string>} */
    const next = {};
    for (const [address, { name }] of [...NAMES].sort(([a], [b]) =>
        a.localeCompare(b),
    ))
        if (name) next[address] = name;
    if (JSON.stringify(shared(NAMES_KEY) ?? {}) !== JSON.stringify(next))
        setShared(NAMES_KEY, next);
    /** @type {Record<string, number>} */
    const pids = {};
    for (const [address, { pid }] of [...NAMES].sort(([a], [b]) =>
        a.localeCompare(b),
    ))
        if (pid) pids[address] = pid;
    if (JSON.stringify(shared(PIDS_KEY) ?? {}) !== JSON.stringify(pids))
        setShared(PIDS_KEY, pids);
}

// each thread's pid by its address: the top bar reads a thread's wait line from the deck's facts, keyed by pid
export const PIDS_KEY = 'x-herdr-antenna.pids';

// the pids in his order: the deck orders its sessions and orbit by it (dima, 20:20: «The order in the agents list is the
// true source for the order in Orbit for threads»); written only on a change
export const ORDER_KEY = 'x-herdr-agents.order';

/** his order as pids once every listed thread has its pid, written only on a change
 * @param {string[]} order @param {string[]} listed */
export function publishOrder(order, listed) {
    const pids = orderPids(order, listed, (a) => {
        const kept = NAMES.get(a);
        return kept?.isRead ? kept.pid : undefined;
    });
    if (
        pids &&
        JSON.stringify(shared(ORDER_KEY) ?? []) !== JSON.stringify(pids)
    )
        setShared(ORDER_KEY, pids);
}
