import type { EngineInterface } from 'claude-code';

import {
    type OverrideAsk,
    type OverrideGrants,
    untilAt,
} from './rules/operator-override.ts';

// twin operator-override-store — x/go/operator_override.go's reader: the system's user record, never HOME, and off when anything does not read
const RFC3339 = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/;
async function overrideStorePath($: EngineInterface) {
    const record = await $.process.run(['id', '-P']).catch(() => undefined);
    const home = record?.exitCode === 0 ? record.stdout.split(':')[8] : '';
    return home?.startsWith('/')
        ? `${home}/.local/state/x/operator-override.json`
        : undefined;
}

async function overrideGrantAt(
    $: EngineInterface,
    path: string,
    scope: string,
    session = '',
) {
    const raw = await $.fs.read(path).catch(() => undefined);
    if (raw === undefined) return undefined;
    try {
        const grants: unknown = JSON.parse(raw);
        if (typeof grants !== 'object' || Array.isArray(grants))
            return undefined;
        // go reads the whole map into one shape, so one bad scope reads every scope off
        for (const g of Object.values(grants ?? {}) as unknown[]) {
            if (g === null) continue;
            if (typeof g !== 'object' || Array.isArray(g)) return undefined;
            const { at, by, until } = g as Record<string, unknown>;
            for (const field of [at, by, until])
                if (field != null && typeof field !== 'string')
                    return undefined;
        }
        const grant = (
            grants as Record<
                string,
                { at?: string; by?: string; until?: string } | null
            > | null
        )?.[session ? `${scope}:${session}` : scope];
        if (!grant?.by) return undefined;
        if (grant.until) {
            if (!RFC3339.test(grant.until)) return undefined;
            if (!(Date.parse(grant.until) > (await $.clock.now())))
                return undefined;
        }
        return { at: grant.at ?? '', by: grant.by, scope };
    } catch {
        return undefined;
    }
}
// the store after an ask. a shift's start leaves his own word standing, so its end can't take it
function overrideAfter(
    grants: Record<string, { at: string; by: string; until?: string }>,
    ask: { by: string; scope: 'off' | 'prs' },
    at: string,
) {
    if (ask.scope === 'off') return {};
    if (ask.by === 'shift' && grants.prs) return grants;
    return { ...grants, prs: { at, by: ask.by } };
}
// twin end

// one line per pass, as x writes it; a line that can't land stops nothing
export async function overrideLogPass(
    $: EngineInterface,
    grant: { at: string; by: string; scope: string },
    what: string,
) {
    const path = await overrideStorePath($);
    if (!path) return;
    const log = path.replace(/\.json$/, '.log');
    const line = JSON.stringify({
        at: new Date(await $.clock.now()).toISOString(),
        by: grant.by,
        scope: grant.scope,
        since: grant.at,
        what,
    });
    // an append, never a read and a rewrite: a failed read or x's own line landing between must not cost the log
    await $.process.run([
        'sh',
        '-c',
        'printf "%s\\n" "$1" >> "$2"',
        'sh',
        line,
        log,
    ]);
}

// the off switch: his «operator-override all», bare or «until HH:MM», or the band's 🔓 press. on, the floor warns and
// runs, plain rm and the brake aside. his word ends at its until, or with the session that typed it; his press holds until
// he presses off («only i decide when override on and off, no timers», dima, 2026-11-23 15:12), or until the 2 h his band
// setting asks for
export async function masterOverride($: EngineInterface) {
    const path = await overrideStorePath($);
    if (!path) return undefined;
    const all = await overrideGrantAt($, path, 'all');
    if (all) {
        const grants = JSON.parse(await $.fs.read(path)) as OverrideGrants;
        const { pid, start, until } = grants.all ?? {};
        if (until || (pid && start && (await isRunning($, pid, start))))
            return all;
    }
    const press = await overrideGrantAt($, path, 'prs');
    return press?.by === 'band' ? press : undefined;
}
// a session is its process, never its id, which `/clear` changes: the pid, and its start time so a reused pid reads gone
async function startOf($: EngineInterface, pid: number) {
    const ps = await $.process
        .run(['ps', '-o', 'lstart=', '-p', String(pid)])
        .catch(() => undefined);
    const start = ps?.exitCode === 0 ? ps.stdout.trim() : '';
    return start || undefined;
}
async function isRunning($: EngineInterface, pid: number, start: string) {
    return (await startOf($, pid)) === start;
}

// a typed word whose session process does not read ends this long after it
const UNREAD_SESSION_MS = 12 * 60 * 60 * 1000;
// the store after his typed ask, and the note the model reads; a write that fails is told, never silent. every flip is one
// log line naming where the words came from, so a seat's typing into a pane shows beside his own
export async function overrideFlip(
    $: EngineInterface,
    ask: OverrideAsk,
    session: { origin: string; pid?: number; sid: string },
) {
    const path = await overrideStorePath($);
    if (!path)
        return 'operator-override: the system user record did not read, so the switch did not move';
    const raw = await $.fs.read(path).catch(() => '{}');
    let grants: OverrideGrants = {};
    try {
        grants = JSON.parse(raw) as OverrideGrants;
    } catch {}
    const now = await $.clock.now();
    const at = new Date(now).toISOString();
    const start = session.pid ? await startOf($, session.pid) : undefined;
    // a session whose process does not read gets a clock instead, so the switch still ends
    const until =
        ask.scope === 'all'
            ? ask.until
                ? untilAt(now, ask.until)
                : start
                  ? undefined
                  : new Date(now + UNREAD_SESSION_MS).toISOString()
            : undefined;
    const after = JSON.stringify(
        ask.scope === 'all'
            ? {
                  ...grants,
                  all: {
                      at,
                      by: ask.by,
                      ...(until ? { until } : { pid: session.pid, start }),
                  },
              }
            : overrideAfter(grants, ask, at),
    );
    if (after !== raw) await $.fs.write(path, after);
    await overrideLogPass(
        $,
        { at, by: ask.by, scope: ask.scope },
        `flipped ${ask.scope} from ${session.origin} in session ${session.sid}`,
    ).catch(() => undefined);
    if (ask.scope === 'all')
        return `operator-override all is on, by ${ask.by}, ${until ? `until ${until}` : 'until this session ends'}: every floor refusal warns and runs, plain rm and the brake aside; «operator-override off» ends it`;
    return ask.scope === 'off'
        ? "operator-override is off, by dima's typed words"
        : `operator-override prs is on, by ${ask.by}: x lane merge-auto <pr> --apply lands every pr; under dima's own grant its brake is one warning line, a shift's grant still stops at it; a raw merge still stops at the brake`;
}

// x's --brake-check answers the brake, per repo the line may merge in; a failed read reads as braked
const BRAKE_UNREAD = 'the brake did not read, so it reads on';
export async function brakeOf($: EngineInterface) {
    const store = await overrideStorePath($);
    const home = store?.replace(/\/\.local\/state\/x\/[^/]*$/, '');
    // outside any tree, so the shim runs main's x and a stale worktree can't answer
    const read = await $.process
        .run(['x', 'lane', 'merge-auto', '--brake-check', '--json'], {
            cwd: home,
            timeoutMs: 20000,
        })
        .catch(() => undefined);
    try {
        const { data } = JSON.parse(read?.stdout ?? '') as {
            data?: { brake?: unknown };
        };
        if (typeof data?.brake !== 'string') return BRAKE_UNREAD;
        return data.brake ? `the brake is on: ${data.brake}` : undefined;
    } catch {
        return BRAKE_UNREAD;
    }
}

// his tick on a seat switch, carried to x: one file a grant, `seat-grants/<session>.<tick>.<time>.json` beside the override
// store, for this session and this one command, alive SEAT_GRANT_MS. x refuses the switch; the guard only says a tick stood behind it
// (dima's 15:12, 2026-11-23). x takes a grant by renaming it `.taken`, the guard drops one by unlinking it, so one of the two
// wins; the tick counts as spent while its grant is alive or taken, and comes back when neither holds. never the override
// store itself: a write there swallows a 🔓 press of his (x-mod-stash reads the file's mtime). a plain file, named, not proven
export const SEAT_GRANT_MS = 60_000;
const TAKEN = '.taken';
// past a tick's own 2 h a grant says nothing any more
const SEAT_KEEP_MS = 2 * 60 * 60 * 1000;
type SeatGrant = {
    at: string;
    by: string;
    role: string;
    spends: string[];
    thread: string;
};

async function seatDir($: EngineInterface) {
    const store = await overrideStorePath($);
    if (!store) throw new Error('the system user record did not read');
    return store.replace(/[^/]*$/, 'seat-grants');
}

function parsedGrant(body: string) {
    try {
        const grant = JSON.parse(body) as Partial<SeatGrant> | null;
        return typeof grant?.at === 'string' && Array.isArray(grant.spends)
            ? { at: grant.at, spends: grant.spends }
            : undefined;
    } catch {
        return undefined;
    }
}

// true when this call removed it
async function unlinked($: EngineInterface, path: string) {
    const gone = await $.process
        .run(['unlink', path])
        .catch(() => ({ exitCode: 1 }));
    return gone.exitCode === 0;
}

// the spent keys this session's grants hold; a grant no tick can stand behind any more is swept on the way. one x takes
// mid-read throws, and no grant is written: a spend must never read as free
export async function seatSpends($: EngineInterface, sid: string) {
    const dir = await seatDir($);
    const now = await $.clock.now();
    const keys: string[] = [];
    if (!(await $.fs.exists(dir))) return keys;
    for (const f of await $.fs.list(dir)) {
        const path = `${dir}/${f.name}`;
        const isMine = f.name.startsWith(`${sid}.`);
        const body = await $.fs.read(path).catch((err: unknown) => {
            if (isMine) throw err;
            return '';
        });
        const grant = parsedGrant(body);
        if (!grant) continue;
        const age = now - Date.parse(grant.at);
        const isTaken = f.name.endsWith(TAKEN);
        const isOver = age > (isTaken ? SEAT_KEEP_MS : SEAT_GRANT_MS);
        if (isOver && (await unlinked($, path))) continue;
        if (isOver && isMine) throw new Error(`${f.name} moved mid-read`);
        if (isMine) keys.push(...grant.spends);
    }
    return keys;
}

// writes the grant and answers its file
export async function writeSeatGrant(
    $: EngineInterface,
    seat: {
        command: string;
        role: string;
        sid: string;
        spends: string[];
        thread: string;
        tick: { at: number; id: string };
    },
) {
    const now = await $.clock.now();
    const tick = `${seat.tick.id}-${seat.tick.at}`.replace(/\W/g, '-');
    // the time and the move keep every grant its own file, so an old timer never drops a retry's
    const move = `${now}-${seat.thread}-${seat.role}`.replace(/\W/g, '-');
    const path = `${await seatDir($)}/${seat.sid}.${tick}.${move}.json`;
    const grant: SeatGrant = {
        at: new Date(now).toISOString(),
        by: `tick ${seat.tick.id}`,
        role: seat.role,
        spends: seat.spends,
        thread: seat.thread,
    };
    await $.fs.write(path, JSON.stringify(grant));
    await overrideLogPass(
        $,
        { at: grant.at, by: grant.by, scope: 'seat' },
        `granted for session ${seat.sid}: ${seat.command}`,
    ).catch(() => undefined);
    return path;
}

// a grant x did not take goes, and the tick with it comes back
export async function dropSeatGrant($: EngineInterface, path: string) {
    await unlinked($, path);
}
