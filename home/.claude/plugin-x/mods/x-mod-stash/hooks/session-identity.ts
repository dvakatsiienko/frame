import type { EngineInterface } from 'claude-code';

import { basename } from './util.ts';

// who this session is: its id across a /clear, its project and label, its claude process, and its thread record as x
// wrote it; one owner, read through `identity`, changed only by the events below
type Proc = { pid: number; start: string };
type Identity = {
    // the id a /clear left, until the next load reads the new one and writes the successor
    clearedFrom?: string;
    // the id the last /clear left, kept past the succ write: a message held under it is still this thread's
    continuedFrom?: string;
    label: string;
    proc?: Proc;
    // the dir the session started in: its project, whose .claude settings the threshold input writes
    projectDir?: string;
    selfId?: string;
};
const state: Identity = { label: 'session' };
export const identity: Readonly<Identity> = state;

// the repo root, not the cwd: a cd in the shell must not rename the thread; a hot reload's start carries the shell's
// cwd, which follows a `cd`, so the root stays the project's
export async function startIdentity($: EngineInterface, cwd: string) {
    state.selfId = await $.session.id();
    state.projectDir = await $.session.root().catch(() => cwd);
    const top = (await $.session.repo())?.root ?? cwd;
    state.label = basename(top);
    state.proc = await procOf($).catch(() => {
        $.ui.log(
            'x-mod-stash: no pid for this session, so its row reads no registry name',
        );
        return undefined;
    });
}

// after a /clear the process goes on under a new id, and no session.start fires
export async function refreshSelfId($: EngineInterface) {
    state.selfId = await $.session.id().catch(() => state.selfId);
}

// the id a /clear left, once the next id is read: its successor is written, then continueFromCleared
export const clearedNow = () =>
    state.clearedFrom && state.selfId && state.selfId !== state.clearedFrom
        ? state.clearedFrom
        : undefined;

export function continueFromCleared() {
    state.continuedFrom = state.clearedFrom;
    state.clearedFrom = undefined;
}

// the process goes on under a new id with no session.start: the next read takes it fresh
export function endIdentity(sessionId: string) {
    state.selfId = undefined;
    state.clearedFrom = sessionId;
}

// this session's id as session.start read it, else asked now; undefined when the engine cannot say
export async function currentId($: EngineInterface) {
    return state.selfId ?? (await $.session.id().catch(() => undefined));
}

// main clio by her record, so a handoff's new clio keeps the lanes once summon records her, and no name grants them
export async function isLaneOwner($: EngineInterface) {
    return (await selfRecord($))?.role === MAIN_ROLE;
}

// the name ListAgents shows lives in the session registry, keyed by the claude process id
// this session's process, resolved at its first read: a hook can run before a reloaded module's session.start, where
// a module variable is still unset (clio's glide was refused after a /reload-plugins, 2026-10-12 20:05)
export async function procNow($: EngineInterface) {
    state.proc ??= await procOf($).catch(() => undefined);
    return state.proc;
}

// this session's own registry entry, `~/.claude/sessions/<pid>.json`
export async function selfEntry(
    $: EngineInterface,
): Promise<{ kind?: unknown; name?: unknown } | undefined> {
    const pid = (await procNow($))?.pid;
    if (!pid) return undefined;
    const home = await $.env.get('HOME');
    const raw = await $.fs
        .read(`${home}/.claude/sessions/${pid}.json`)
        .catch(() => undefined);
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export async function isBgSelf($: EngineInterface) {
    return (await selfEntry($))?.kind === 'bg';
}

export async function sessionName($: EngineInterface) {
    const name = (await selfEntry($))?.name;
    return typeof name === 'string' && name ? name : undefined;
}

// one rule, one reader (FRM-570 rules 8 and 9): x's thread records, `~/.claude/shelf/threads.json`, carry each thread's
// role, lane and ticket by session id, so no reader here parses a name; no file or no record reads as unknown, and a file
// that does not parse (a torn or hand-broken write) reads as the last list that did, so no role drops for one bad read
export type ThreadRecord = {
    sessionId: string;
    display?: string;
    roleName?: string;
    name?: string;
    pid?: number;
    role?: string;
    lane?: string;
    // the clio that dispatched a lane member, by x's owner label: clio-main or clio-wing-<n>
    coordinator?: string;
    wing?: number;
    at?: number;
    ticket?: string;
};
// the standing role ids x's roles.json names (FRM-579): one place here, so a rename of the fleet's roles is a table edit
export const MAIN_ROLE = 'coordinator';
// a wing owns its lanes by its role's display, which a rename (a title) leaves alone
export const runnerOf = (t: ThreadRecord) => t.roleName ?? t.display ?? '';
export const WING_ROLE = 'wing';
export const ADVISER_ROLE = 'adviser';

// a power read (a lane's owner, the glide door, a coordinator's message) reads the record x wrote, never a name; x alone
// writes the store and x-mod-guard refuses every session's write to it
export async function selfRecord($: EngineInterface) {
    const sid = await currentId($);
    return sid
        ? (await threadRecords($)).find((t) => t.sessionId === sid)
        : undefined;
}
const THREADS_KEPT = 'threads-kept';
export async function threadRecords(
    $: EngineInterface,
): Promise<ThreadRecord[]> {
    const raw = await $.fs
        .read(`${await $.env.get('HOME')}/.claude/shelf/threads.json`)
        .catch(() => undefined);
    if (raw === undefined) return [];
    try {
        const { threads } = JSON.parse(raw) as { threads?: unknown };
        if (!Array.isArray(threads)) throw new Error('no threads list');
        // a board render reads this often: the store is written only when the list moved
        if (
            JSON.stringify(await $.store.get(THREADS_KEPT)) !==
            JSON.stringify(threads)
        )
            await $.store.set(THREADS_KEPT, threads);
        return threads as ThreadRecord[];
    } catch {
        const kept = await $.store.get(THREADS_KEPT);
        return Array.isArray(kept) ? (kept as ThreadRecord[]) : [];
    }
}

// x rewrites the store from cc's registry; run from home so the shim runs main's x; a failed run keeps the last file
export async function refreshThreads($: EngineInterface) {
    await $.process
        .run(['x', 'thread', 'list', '--json'], {
            cwd: await $.env.get('HOME'),
            timeoutMs: 4000,
        })
        .catch(() => undefined);
}

// twin proc-of — a copy lives in x-mod-holds; the twins lint keeps them equal
async function procOf($: EngineInterface): Promise<Proc | undefined> {
    const r = await $.process.run([
        'sh',
        '-c',
        'echo $PPID; ps -o lstart= -p $PPID',
    ]);
    const [pid, start] = r.stdout.split('\n').map((s) => s.trim());
    return r.exitCode === 0 && pid && start
        ? { pid: Number(pid), start }
        : undefined;
}
// twin end

// `succ:<old id>` → the id a /clear continued under, so a lane linked by a session id follows it (todo 21: a clear left
// the l14 card on the codie's old id, its asks gone from the card); dropped a week after it was written
export const SUCC = 'succ:';

// the id a session continues under after its /clears, followed a few hops; the id itself when it never cleared
export async function successorOf($: EngineInterface, sid: string) {
    let id = sid;
    for (let hop = 0; hop < 5; hop++) {
        const next = (
            (await $.store.get(SUCC + id).catch(() => undefined)) as
                | { sid?: string }
                | undefined
        )?.sid;
        if (!next || next === id) break;
        id = next;
    }
    return id;
}
