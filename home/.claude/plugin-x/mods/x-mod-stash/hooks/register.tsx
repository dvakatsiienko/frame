/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import {
    type Door,
    FLEET_NAME,
    doorOf,
    nestedAsks,
    parseAsks,
    parseWait,
    stateWord,
    ticketOf,
    writeTargets,
} from './parse.ts';

// x-mod-stash: dima's command center above the prompt, one folded row with three features.
// asks: every live session's open ⏳ asks, mirrored from each last reply into $.store (one key per session).
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// holds: a session's first edit of a file holds it; another session's edit is refused
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it
// The reply stays the source of truth for asks; this band only shows and copies them.

// label: the repo; name: the session's registry name, when it has one
type Entry = { label: string; name?: string; asks: string[]; at: number };
// a session's last reply: when it ended, its 🔭 wait; `ended` once the session itself exited
type Reply = { at: number; name?: string; wait?: string; ended?: number };

const PREFIX = 'asks:';
const AFK_KEY = 'afk';
const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, park every ask for his return, send no ⏳ block and no ping.';
const BACK_NOTE =
    'dima is back from afk: asks and the ⏳ block reach him again.';
const POLL_MS = 4000;
// the fleet board: cc's registry gives each session's state; each session's stash adds its 🔭 wait and context fill
const BOARD = 'fleet-board';
const REPLY = 'reply:';
const CONTEXT = 'context:';
// the model and effort of a session's main loop, as its last model request named them
const MODEL = 'model:';
// the board's colour MVP: one fleet-wide switch, `/board colour`, off by default (FRM-329)
const COLOUR = 'board-colour';
// the registry names a short-lived headless run `t-` + hex (`t-70`); the board leaves those out (dima, 2026-10-05)
const HEADLESS = /^t-[0-9a-f]+$/;
// a session younger than this, counted from the registry's `startedAt`, is a probe: it gets no row until it outlives it
const SHORT_MS = 60_000;
const STALE_MS = 24 * 60 * 60 * 1000;
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
const HOT_MS = 50 * 60 * 1000;
const HOT = 'hot:';
// a reload keeps `$.state` and resets the module: what must outlive a mod save lives here (FRM-320)
const OPEN = { key: 'open', plugin: 'x-mod-stash' } as const;
const FIVE_HOUR = { key: 'fiveHour', plugin: 'x-mod-stash' } as const;
const PING =
    'x-mod-stash keep-hot ping: answer with one character, nothing else.';
const ACCENT = '#d97757';

let selfId: string | undefined;
let label = 'session';
let entries: Record<string, Entry> = {};
let known = new Set<string>();
let open = false;
let userTurn = false;
let pinged = false;
let polling = false;
let afk = false;
let turnAfk: boolean | undefined;
let proc: Proc | undefined;
let root = '';
let holds = { others: 0, warned: false };
// since: the turn end the next ping counts from; until: the 5h reset that turns it off
let hot: { since: number; until?: number } | undefined;
let fiveHour: { resetsAt?: number } | undefined;
let busy = false;
// the model label last written for this session, so a step writes the store only when it changes
let modelSeen: string | undefined;
// a turn start or a flip bumps it, so a ping armed before either never fires
let hotGen = 0;

// x-mod-guard's refusals and escapes: each plugin's $.store is its own file, so the band reads x-mod-guard's file directly
type GuardLine = {
    key: string;
    sid: string;
    name?: string;
    command: string;
    kind: 'refused' | 'escaped';
    door: string;
    target: string;
    at: number;
    // why it was refused; an event kept before x-mod-guard wrote it has none, and shows its door
    why?: string;
};
// the mod was `guard` before it was x-mod-guard: its old store file is read beside the new one
const GUARD_FILE = /^(x-mod-)?guard_.*\.json$/;
const GUARD_EVENT = 'event:';
// the counter row ages out after this long with no new event
const GUARD_AGE_MS = 30 * 60_000;
let guards: GuardLine[] = [];
let guardsOpen = false;

// what the fleet did while dima was afk, shown in the band where he turned 💨 off until his next prompt
type Digest = {
    needs: { sid: string; name: string; asks: number }[];
    done: { sid: string; name: string }[];
};
let digest: Digest | undefined;

// a thread's asks show while it has any and they are under a day old
const isLive = (v: Entry | undefined, now: number): v is Entry =>
    !!v && Array.isArray(v.asks) && v.asks.length > 0 && now - v.at < STALE_MS;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

const fp = (sid: string, ask: string) => `${sid}\u0000${ask}`;
const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

// holds: a session's first edit of a file holds it; another session's edit of it is refused.
// $.store has no compare-and-set, so each session writes only its own keys and the earliest claim wins.

// file is the real path in its own case, for git; landed once the edit went through
type Hold = { at: number; file: string; top: string; landed?: boolean };
type Claim = { deny?: string; key?: string };
type Holder = { pid?: number; start?: string; idleSince: number | null };
type Refusal = { at: number; by: string; path: string };
type Proc = { pid: number; start: string };

const HOLD = 'hold:';
const HOLDER = 'holder:';
const REFUSED = 'refused:';
const IDLE_MS = 30 * 60 * 1000;

const holdKey = (sid: string, path: string) => `${HOLD}${sid}:${path}`;
const short = (sid: string) => sid.slice(0, 8);
const dirname = (file: string) => file.slice(0, file.lastIndexOf('/')) || '/';

// a session id carries no ':', so the first one after the prefix ends it
function parseHoldKey(key: string) {
    if (!key.startsWith(HOLD)) return null;
    const cut = key.indexOf(':', HOLD.length);
    return cut < 0
        ? null
        : { path: key.slice(cut + 1), sid: key.slice(HOLD.length, cut) };
}

// the key is lowercased on every platform: APFS is case-insensitive and the mod cannot ask which os it runs on
async function realPath($: EngineInterface, file: string) {
    const resolve = (p: string) =>
        $.fs.stat(p, { resolve: true }).then(
            (s) => s.realPath,
            () => undefined,
        );
    const direct = await resolve(file);
    if (direct) return { file: direct, key: direct.toLowerCase() };
    // a new file has no real path yet; its nearest existing folder does
    let dir = dirname(file);
    let real = await resolve(dir);
    while (!real && dir !== '/') {
        dir = dirname(dir);
        real = await resolve(dir);
    }
    const full = `${real ?? dir}${file.slice(dir.length)}`;
    return { file: full, key: full.toLowerCase() };
}

// the name ListAgents shows lives in the session registry, keyed by the claude process id
async function sessionName($: EngineInterface) {
    if (!proc) return undefined;
    const home = await $.env.get('HOME');
    const raw = await $.fs
        .read(`${home}/.claude/sessions/${proc.pid}.json`)
        .catch(() => undefined);
    if (!raw) return undefined;
    try {
        const { name } = JSON.parse(raw) as { name?: unknown };
        return typeof name === 'string' && name ? name : undefined;
    } catch {
        return undefined;
    }
}

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

// the working tree a path sits in, lowercased; '' outside git
async function topOf($: EngineInterface, cwd: string) {
    const r = await $.process
        .run(['git', 'rev-parse', '--show-toplevel'], { cwd })
        .catch(() => null);
    return r?.exitCode === 0 ? r.stdout.trim().toLowerCase() : '';
}

async function isClean($: EngineInterface, file: string) {
    const r = await $.process
        .run(['git', 'status', '--porcelain', '--', file], {
            cwd: dirname(file),
        })
        .catch(() => null);
    // the folder is gone, and the file with it
    if (!r) return true;
    if (r.exitCode === 0) return r.stdout.trim() === '';
    // outside a repo nothing can be committed, so nothing is held
    if (!/not a git repository/i.test(r.stderr))
        $.ui.log(
            `x-mod-stash holds: git status failed on ${file}, hold released`,
        );
    return true;
}

// a holder that ended, went idle or died holds nothing
async function isGone(
    $: EngineInterface,
    holder: Holder | undefined,
    now: number,
) {
    if (!holder) return true;
    if (holder.idleSince !== null && now - holder.idleSince >= IDLE_MS)
        return true;
    if (holder.pid && holder.start) {
        const ps = await $.process.run([
            'ps',
            '-o',
            'lstart=',
            '-p',
            String(holder.pid),
        ]);
        // a reused pid starts at another time
        if (ps.stdout.trim() !== holder.start) return true;
    }
    return false;
}

async function isReleased(
    $: EngineInterface,
    sid: string,
    hold: Hold,
    now: number,
) {
    const holder = (await $.store.get(HOLDER + sid)) as Holder | undefined;
    if (await isGone($, holder, now)) return true;
    // a hold whose edit has not landed yet (a permission prompt open) is clean and still held
    return hold.landed === true && isClean($, hold.file);
}

// a holder that crashed or went idle never settles its own keys
async function sweep($: EngineInterface, self: string) {
    const now = await $.clock.now();
    for (const key of await $.store.keys()) {
        if (!key.startsWith(HOLDER) || key === HOLDER + self) continue;
        const holder = (await $.store.get(key)) as Holder | undefined;
        if (await isGone($, holder, now))
            await dropAll($, key.slice(HOLDER.length));
    }
}

async function claimsOn($: EngineInterface, path: string) {
    const claims: { sid: string; key: string; hold: Hold }[] = [];
    for (const key of await $.store.keys()) {
        const parsed = parseHoldKey(key);
        if (parsed?.path !== path) continue;
        const hold = (await $.store.get(key)) as Hold | undefined;
        if (hold) claims.push({ hold, key, sid: parsed.sid });
    }
    return claims;
}

function refusal(file: string, sid: string, hold: Hold, now: number) {
    const mins = Math.round((now - hold.at) / 60000);
    return `x-mod-stash: ${file} is held by session ${short(sid)}, which took it ${mins} min ago. wait, or ask it to commit the file.`;
}

// the refusal when another live session holds the path; a released hold is cleared on the way
async function heldBy(
    $: EngineInterface,
    sid: string,
    file: string,
    path: string,
    now: number,
) {
    for (const c of await claimsOn($, path)) {
        if (c.sid === sid) continue;
        if (await isReleased($, c.sid, c.hold, now)) {
            await $.store.delete(c.key);
            continue;
        }
        await $.store.set(REFUSED + c.sid, { at: now, by: sid, path });
        return refusal(file, c.sid, c.hold, now);
    }
    return undefined;
}

// a deny when another session holds the file; the key when this call took a new hold
async function claim(
    $: EngineInterface,
    file: string,
    proc: Proc | undefined,
): Promise<Claim> {
    const sid = await $.session.id();
    const { key: path, file: real } = await realPath($, file);
    const now = await $.clock.now();
    const deny = await heldBy($, sid, file, path, now);
    if (deny) return { deny };
    const mine = holdKey(sid, path);
    const held = (await $.store.get(mine)) as Hold | undefined;
    // a first edit that failed left the hold unlanded; the next one that goes through lands it
    if (held) return held.landed ? {} : { key: mine };
    // the holder first: a rival reading the hold without it would take it for released
    if (!(await $.store.get(HOLDER + sid)))
        await $.store.set(HOLDER + sid, { ...proc, idleSince: null });
    await $.store.set(mine, {
        at: now,
        file: real,
        top: await topOf($, dirname(real)),
    });
    // no compare-and-set: a rival that wrote meanwhile refuses this claim; a true tie refuses both, the next try settles it
    const rival = (await claimsOn($, path)).find((c) => c.sid !== sid);
    if (!rival) return { key: mine };
    await $.store.delete(mine);
    return { deny: refusal(file, rival.sid, rival.hold, now) };
}

async function land($: EngineInterface, key: string) {
    const hold = (await $.store.get(key)) as Hold | undefined;
    if (hold) await $.store.set(key, { ...hold, landed: true });
}

async function markBusy($: EngineInterface) {
    const sid = await $.session.id();
    const holder = (await $.store.get(HOLDER + sid)) as Holder | undefined;
    if (holder?.idleSince != null)
        await $.store.set(HOLDER + sid, { ...holder, idleSince: null });
}

// a turn ended: start the idle clock and drop the holds whose files are clean again
async function settle($: EngineInterface) {
    const sid = await $.session.id();
    await sweep($, sid);
    const holder = (await $.store.get(HOLDER + sid)) as Holder | undefined;
    if (!holder) return;
    let left = 0;
    for (const key of await $.store.keys()) {
        if (parseHoldKey(key)?.sid !== sid) continue;
        const hold = (await $.store.get(key)) as Hold | undefined;
        if (!hold || (await isClean($, hold.file))) await $.store.delete(key);
        else left++;
    }
    if (left) {
        await $.store.set(HOLDER + sid, {
            ...holder,
            idleSince: await $.clock.now(),
        });
        return;
    }
    await $.store.delete(HOLDER + sid);
    await $.store.delete(REFUSED + sid);
}

async function dropAll($: EngineInterface, sid: string) {
    for (const key of await $.store.keys())
        if (parseHoldKey(key)?.sid === sid) await $.store.delete(key);
    await $.store.delete(HOLDER + sid);
    await $.store.delete(REFUSED + sid);
}

// everything this mod keeps for one conversation
async function forget($: EngineInterface, sid: string) {
    await $.store.delete(PREFIX + sid);
    await $.store.delete(HOT + sid);
    await $.store.delete(REPLY + sid);
    await $.store.delete(CONTEXT + sid);
    await $.store.delete(MODEL + sid);
    await dropAll($, sid).catch(() => undefined);
}

// a session that exited keeps only its last reply, marked ended, so an away digest still counts it as done
async function retire($: EngineInterface, sid: string) {
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    await forget($, sid);
    if (reply)
        await $.store.set(REPLY + sid, {
            ...reply,
            ended: await $.clock.now(),
        } satisfies Reply);
}

// an ended session's reply is dropped a day after it ended
async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    for (const key of await $.store.keys()) {
        if (!key.startsWith(REPLY)) continue;
        const v = (await $.store.get(key)) as Reply | undefined;
        if (v?.ended !== undefined && now - v.ended >= STALE_MS)
            await $.store.delete(key);
    }
}

// what the row shows: other live sessions' holds in this working tree, and whether this session's hold was wanted
async function chip($: EngineInterface, sid: string, root: string) {
    const keys = await $.store.keys();
    const now = await $.clock.now();
    let others = 0;
    for (const key of keys) {
        const h = parseHoldKey(key);
        if (!h || h.sid === sid) continue;
        const hold = (await $.store.get(key)) as Hold | undefined;
        const holder = (await $.store.get(HOLDER + h.sid)) as
            | Holder
            | undefined;
        const idle =
            holder?.idleSince != null && now - holder.idleSince >= IDLE_MS;
        if (hold?.top === root && holder && !idle) others++;
    }
    const refused = (await $.store.get(REFUSED + sid)) as Refusal | undefined;
    const warned = !!refused && keys.includes(holdKey(sid, refused.path));
    return { others, warned };
}

// the current run of guard events, newest first: each one under GUARD_AGE_MS after the next, the newest under it
// before now. a file mid-write is skipped until the next poll
async function guardLines($: EngineInterface): Promise<GuardLine[]> {
    const dir = `${await $.env.get('HOME')}/.claude/plugins/store`;
    const all: GuardLine[] = [];
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!GUARD_FILE.test(f.name)) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
                string,
                Omit<GuardLine, 'key'>
            >;
            for (const [key, event] of Object.entries(v))
                if (key.startsWith(GUARD_EVENT)) all.push({ ...event, key });
        } catch {}
    }
    all.sort((a, b) => b.at - a.at);
    let since = await $.clock.now();
    const run: GuardLine[] = [];
    for (const g of all) {
        if (since - g.at >= GUARD_AGE_MS) break;
        run.push(g);
        since = g.at;
    }
    return run;
}

// the mod was `stash` before it was x-mod-stash, and $.store is one file per plugin name: a start copies every
// key of the old file over, and marks the store with the old file's mtime. the old file is the truth until the
// cutover, so one written after the mark (an early probe under the new name) is copied again
const OLD_STORE = /^stash_.*\.json$/;
const ADOPTED = 'adopted:stash';
async function adoptOldStore($: EngineInterface) {
    const dir = `${await $.env.get('HOME')}/.claude/plugins/store`;
    const olds = (await $.fs.list(dir)).filter((f) => OLD_STORE.test(f.name));
    if (!olds.length) return;
    const newest = Math.max(...olds.map((f) => f.mtimeMs));
    const mark = await $.store.get(ADOPTED);
    if (typeof mark === 'number' && mark >= newest) return;
    for (const f of olds) {
        const old = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
            string,
            unknown
        >;
        for (const [key, value] of Object.entries(old))
            await $.store.set(key, value);
    }
    await $.store.set(ADOPTED, newest);
}

// what a reload finds in `$.state`. it is keyed by plugin name too: a value never written under the new name
// takes the old one's, once. returned, never re-read: every get of one dispatch reads the moment it began
const OLD_OPEN = { key: 'open', plugin: 'stash' } as const;
const OLD_FIVE_HOUR = { key: 'fiveHour', plugin: 'stash' } as const;
async function keptState($: EngineInterface) {
    const was = {
        fiveHour: await $.state.get(FIVE_HOUR),
        open: await $.state.get(OPEN),
    };
    const kept = { fiveHour: was.fiveHour.value, open: was.open.value };
    if (was.open.version === 0) {
        kept.open = (await $.state.get(OLD_OPEN)).value;
        if (kept.open !== undefined) await $.state.set(OPEN, kept.open);
    }
    if (was.fiveHour.version === 0) {
        kept.fiveHour = (await $.state.get(OLD_FIVE_HOUR)).value;
        if (kept.fiveHour !== undefined)
            await $.state.set(FIVE_HOUR, kept.fiveHour);
    }
    return kept;
}

// fail-open: a store or git error lets the edit through, with a line in the transcript
// the tool input is the model's: a path that is not a string is not guarded
async function guard($: EngineInterface, file: unknown): Promise<Claim> {
    if (typeof file !== 'string') return {};
    try {
        return await claim($, file, proc);
    } catch (err) {
        $.ui.log(
            `x-mod-stash holds: ${err instanceof Error ? err.message : String(err)}; the edit went through unguarded`,
        );
        return {};
    }
}

// a Bash write is refused on a held file and takes no hold; an unread command, or an error, goes through
async function bashGuard($: EngineInterface, command: unknown) {
    if (typeof command !== 'string') return undefined;
    try {
        const targets = writeTargets(command);
        if (!targets.length) return undefined;
        const lead = command.match(/^\s*cd\s+([^\s;&|]+)\s*&&/)?.[1];
        const cwd = await $.session.cwd();
        const home = (await $.env.get('HOME')) ?? '';
        const absolute = (p: string, from: string) =>
            p.startsWith('/')
                ? p
                : p.startsWith('~/')
                  ? `${home}${p.slice(1)}`
                  : `${from}/${p}`;
        const dir = lead ? absolute(lead, cwd) : cwd;
        const sid = await $.session.id();
        const now = await $.clock.now();
        for (const target of targets) {
            const file = absolute(target, dir);
            const { key } = await realPath($, file);
            const deny = await heldBy($, sid, file, key, now);
            if (deny) return deny;
        }
    } catch (err) {
        $.ui.log(
            `x-mod-stash holds: ${err instanceof Error ? err.message : String(err)}; the command went through unguarded`,
        );
    }
    return undefined;
}

async function load($: EngineInterface): Promise<boolean> {
    const now = await $.clock.now();
    const flag = (await $.store.get(AFK_KEY)) as { on?: boolean } | undefined;
    const afkChanged = (flag?.on === true) !== afk;
    afk = flag?.on === true;
    const next: Record<string, Entry> = {};
    for (const key of await $.store.keys()) {
        if (!key.startsWith(PREFIX)) continue;
        const v = (await $.store.get(key)) as Entry | undefined;
        if (isLive(v, now)) next[key.slice(PREFIX.length)] = v;
    }
    const fresh = Object.entries(next).flatMap(([sid, v]) =>
        v.asks.map((a) => fp(sid, a)),
    );
    const before = JSON.stringify(
        Object.entries(entries).map(([k, v]) => [k, v.asks]),
    );
    const after = JSON.stringify(
        Object.entries(next).map(([k, v]) => [k, v.asks]),
    );
    if (fresh.some((f) => !known.has(f))) {
        open = true;
        await $.state.set(OPEN, true).catch(() => undefined);
    }
    known = new Set(fresh);
    entries = next;
    const cool = await cooled($);
    const prevHolds = holds;
    // after a /clear the process goes on under a new id, and no session.start fires
    selfId = await $.session.id().catch(() => selfId);
    if (selfId) holds = await chip($, selfId, root);
    const holdsChanged =
        prevHolds.others !== holds.others || prevHolds.warned !== holds.warned;
    const prevGuards = guards.map((g) => g.key).join();
    guards = await guardLines($).catch(() => guards);
    const guardsChanged = prevGuards !== guards.map((g) => g.key).join();
    return (
        afkChanged || holdsChanged || guardsChanged || cool || before !== after
    );
}

async function saveHot($: EngineInterface) {
    const sid = selfId ?? (await $.session.id().catch(() => undefined));
    if (!sid) return;
    if (hot) await $.store.set(HOT + sid, hot);
    else await $.store.delete(HOT + sid);
}

// past the 5h reset 🔥 has nothing left to keep warm
async function cooled($: EngineInterface) {
    if (!hot?.until || (await $.clock.now()) < hot.until) return false;
    hot = undefined;
    hotGen++;
    await saveHot($);
    return true;
}

async function armHot($: EngineInterface) {
    const mine = ++hotGen;
    if (!hot || busy) return;
    const wait = hot.since + HOT_MS - (await $.clock.now());
    $.clock.after(Math.max(0, wait), async () => {
        if (!hot || busy || mine !== hotGen) return;
        if (await cooled($)) {
            $.ui.invalidate('ui.render');
            return;
        }
        $.ui.log('x-mod-stash keep-hot: pinged the idle session');
        await $.prompt.submit({ text: PING });
    });
}

type Member = {
    sid: string;
    name: string;
    status?: string;
    statusSince?: number;
    door?: Door;
    wait?: string;
    asks: number;
    context?: number;
    model?: string;
    offPattern: boolean;
};

// `claude-opus-5-5` + `medium` reads «opus 5.5 · medium»; a dated or `[1m]` id drops its tail, an id off the pattern shows as written
function modelLabel(model: string, effort?: string | number) {
    const m = model.match(
        /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?=$|-\d{8}|\[)/,
    );
    const name = m ? `${m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : model;
    return effort === undefined ? name : `${name} · ${effort}`;
}

// the colour MVP's tints, each beside a word or glyph that already says the same, never alone
const TINT = {
    amber: '#e0b45c',
    green: '#8fbf7f',
    grey: '#8a8f98',
    red: '#e06c6c',
} as const;
const FAMILY: Record<string, string> = {
    fable: '#d98fb0',
    haiku: TINT.green,
    opus: '#b495d6',
    sonnet: '#79a8d6',
};
const stateTint = (state: string) =>
    state === 'busy'
        ? ACCENT
        : state === 'idle'
          ? TINT.grey
          : state === 'blocked'
            ? TINT.red
            : TINT.amber;
const contextTint = (percent: number) =>
    percent >= 80 ? TINT.red : percent >= 50 ? TINT.amber : TINT.green;

const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// every session whose reply ended since `since`: those that left asks first, then those that finished —
// a session the registry still shows busy has not finished; one that exited meanwhile has
async function awayDigest($: EngineInterface, since: number): Promise<Digest> {
    const needs: Digest['needs'] = [];
    const done: Digest['done'] = [];
    const keys = await $.store.keys();
    const running = new Set(
        (await registry($).catch(() => []))
            .filter((r) => r.isAlive && stateWord(r.base.status) === 'busy')
            .map((r) => r.base.sid),
    );
    for (const key of keys) {
        if (!key.startsWith(PREFIX)) continue;
        const v = (await $.store.get(key)) as Entry | undefined;
        if (!v || v.at < since || !v.asks.length) continue;
        const sid = key.slice(PREFIX.length);
        needs.push({ asks: v.asks.length, name: v.name ?? short(sid), sid });
    }
    for (const key of keys) {
        if (!key.startsWith(REPLY)) continue;
        const sid = key.slice(REPLY.length);
        const v = (await $.store.get(key)) as Partial<Reply> | undefined;
        if (
            v?.at === undefined ||
            v.at < since ||
            running.has(sid) ||
            needs.some((n) => n.sid === sid)
        )
            continue;
        done.push({ name: v.name ?? short(sid), sid });
    }
    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name);
    return { done: done.sort(byName), needs: needs.sort(byName) };
}

type Registered = {
    pid: number;
    bg: boolean;
    isAlive: boolean;
    startedAt?: number;
    base: Pick<Member, 'sid' | 'name' | 'status' | 'statusSince' | 'door'>;
};

// every session in cc's registry and whether its process still runs; a registry file mid-write is skipped
async function registry($: EngineInterface): Promise<Registered[]> {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: Omit<Registered, 'isAlive'>[] = [];
    for (const f of await $.fs.list(dir)) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as Record<
                string,
                unknown
            >;
            if (typeof v.pid !== 'number' || typeof v.sessionId !== 'string')
                continue;
            const bg = v.kind === 'bg';
            rows.push({
                base: {
                    door: doorOf({
                        bg,
                        bridgeSessionId: text(v.bridgeSessionId),
                        hostSessionId: text(v.hostSessionId),
                        jobId: text(v.jobId),
                    }),
                    name: text(v.name) ?? short(v.sessionId),
                    sid: v.sessionId,
                    status: text(v.status),
                    statusSince:
                        typeof v.statusUpdatedAt === 'number'
                            ? v.statusUpdatedAt
                            : undefined,
                },
                bg,
                pid: v.pid,
                startedAt:
                    typeof v.startedAt === 'number' ? v.startedAt : undefined,
            });
        } catch {}
    }
    if (!rows.length) return [];
    // ps prints the pids still alive and skips the rest
    const ps = await $.process.run([
        'ps',
        '-o',
        'pid=',
        '-p',
        rows.map((r) => r.pid).join(','),
    ]);
    const alive = new Set(
        ps.stdout
            .split('\n')
            .map((s) => Number(s.trim()))
            .filter(Boolean),
    );
    return rows.map((r) => ({ ...r, isAlive: alive.has(r.pid) }));
}

// live sessions from the registry, each with what its own stash wrote
async function members($: EngineInterface): Promise<Member[]> {
    const out: Member[] = [];
    const now = await $.clock.now();
    const shown = (await registry($)).filter(
        (r) =>
            r.isAlive &&
            !HEADLESS.test(r.base.name) &&
            !(r.startedAt !== undefined && now - r.startedAt < SHORT_MS),
    );
    for (const { bg, base: r } of shown) {
        const reply = (await $.store.get(REPLY + r.sid)) as
            | Partial<Reply>
            | undefined;
        const asks = (await $.store.get(PREFIX + r.sid)) as Entry | undefined;
        out.push({
            ...r,
            asks: isLive(asks, now) ? asks.asks.length : 0,
            context: (await $.store.get(CONTEXT + r.sid)) as number | undefined,
            model: text(await $.store.get(MODEL + r.sid)),
            offPattern: bg && !FLEET_NAME.test(r.name),
            wait: reply?.wait,
        });
    }
    // the coordinator first, the rest by name
    return out.sort(
        (a, b) =>
            Number(isCoordinator(b.name)) - Number(isCoordinator(a.name)) ||
            a.name.localeCompare(b.name),
    );
}

const span = (ms: number) => {
    // a status stamped a moment ahead of this clock reads 0m, never -1m
    const m = Math.max(0, Math.floor(ms / 60000));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

// each fact column's width in cells, sized to its usual reading — `⏳ 12`, `FRM-306`, `ctx 54%`, `idle 12m` — so little slack shows between columns; a longer one is cut at its end
const COLUMNS = {
    asks: 4,
    context: 7,
    state: 9,
    ticket: 9,
} as const;

// the fleet's coordinator, pinned to the board's top in bold (dima, 2026-10-05)
const isCoordinator = (name: string) => /\bcclio\b/.test(name);
const doorGlyph = (door: Door) => (door.kind === 'open' ? '↗' : '📋');

async function isBoardOpen($: EngineInterface) {
    const panes = await $.ui.panes().catch(() => []);
    return panes.some((p) => p.id === BOARD);
}

async function openBoard($: EngineInterface) {
    await $.ui.open({ closeOnEscape: true, id: BOARD, title: 'fleet board' });
}

async function pressDoor(
    $: EngineInterface,
    door: Door,
    surface: Parameters<EngineInterface['ui']['copy']>[0]['surface'],
) {
    if (door.kind === 'copy') {
        await $.ui.copy({ surface, text: door.text });
        return;
    }
    const r = await $.process.run(['open', door.url]).catch(() => null);
    if (r?.exitCode !== 0)
        $.ui.log(`x-mod-stash board: could not open ${door.url}`);
}

// every control names itself on hover; the card stays on the control's row, since a one-row site clips the rest
function hoverTip(
    ui: ReturnType<EngineInterface['ui']['resolve']>,
    key: string,
    words: string,
    control: RenderElement,
    place: { left: number } | { right: number },
    press?: { hotkey: string; onPress: () => void },
) {
    const { Box, Text, Button } = ui;
    return (
        <Box key={`tip:${key}`}>
            {control}
            <Box
                display='none'
                hover={{ display: 'flex' }}
                position='absolute'
                top={0}
                {...place}>
                {/* the key rides the card, not the icon: the surface draws its own key badge beside a Button with a hotkey */}
                {press ? (
                    <Button
                        dimColor
                        hotkey={press.hotkey}
                        key={`key:${key}`}
                        onPress={press.onPress}
                        plain>
                        {words}
                    </Button>
                ) : (
                    <Text dimColor>{words}</Text>
                )}
            </Box>
        </Box>
    );
}

export const register: Register = (on) => {
    // session.start fires at startup and again on every hot reload; the classic event only at startup
    on('session.start', async ($, e, next) => {
        // the repo root, not the cwd: a cd in the shell must not rename the thread
        selfId = await $.session.id();
        const top = (await $.session.repo())?.root ?? e.cwd;
        label = basename(top);
        // the working tree, not the repo: a worktree's holds never collide with the main checkout's
        root = (await topOf($, e.cwd)) || top.toLowerCase();
        proc = await procOf($).catch(() => {
            $.ui.log(
                'x-mod-stash holds: no pid for this session, a dead holder releases only by idle',
            );
            return undefined;
        });
        await adoptOldStore($).catch((err) =>
            $.ui.log(
                `x-mod-stash: the old stash store was not adopted: ${errorText(err)}`,
            ),
        );
        const kept = await keptState($).catch((err) => {
            $.ui.log(
                `x-mod-stash: the kept state was not read: ${errorText(err)}`,
            );
            return { fiveHour: undefined, open: undefined };
        });
        await pruneEnded($).catch(() => undefined);
        hot = (await $.store.get(HOT + selfId)) as typeof hot;
        fiveHour = kept.fiveHour;
        await load($);
        // after the first load: a reload sees every ask as new, which would unfold what dima folded
        if (kept.open !== undefined) open = kept.open;
        await armHot($);
        await $.command
            .register({
                description:
                    'open the fleet board: every live session, busy or idle, its last message; `/board colour` flips its colour',
                name: 'board',
            })
            .catch(() => $.ui.log('x-mod-stash: /board was not registered'));
        if (!polling) {
            polling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    // an open board redraws each tick: its «ago» times move on their own
                    if ((await load($)) || (await isBoardOpen($)))
                        $.ui.invalidate('ui.render');
                    tick();
                });
            tick();
        }
        return next(e);
    });

    // only dima's own hands make his turn; a reply to any other origin may drop the block
    on('prompt.submit', async ($, e, next) => {
        userTurn =
            e.text.trim().length > 0 &&
            (DIMA_ORIGINS as readonly string[]).includes(e.origin?.kind ?? '');
        pinged = e.text === PING;
        // dima read the away digest once he types again
        if (userTurn && digest) {
            digest = undefined;
            $.ui.invalidate('ui.render');
        }
        busy = true;
        hotGen++;
        await load($);
        turnAfk = afk;
        await markBusy($).catch(() => undefined);
        if (!afk) return next(e);
        return next({ ...e, context: [...(e.context ?? []), AWAY_NOTE] });
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        const reply = e.last_assistant_message ?? '';
        // a keep-hot ping's one-character reply never clears what the session waits on
        if (!pinged)
            await $.store
                .set(REPLY + e.session_id, {
                    at: await $.clock.now(),
                    name: await sessionName($),
                    wait: parseWait(reply),
                } satisfies Reply)
                .catch(() => undefined);
        const asks = parseAsks(reply);
        // a reply to dima with no block means nothing is open; a reply woken by a peer keeps the old list
        if (asks !== null || userTurn) {
            const key = PREFIX + e.session_id;
            if (asks?.length)
                await $.store.set(key, {
                    asks,
                    at: await $.clock.now(),
                    label,
                    name: await sessionName($),
                });
            else await $.store.delete(key);
            if (await load($)) $.ui.invalidate('ui.render');
        }
        userTurn = false;
        // warn, never block: the note reaches the model with the event
        const nested = nestedAsks(reply);
        if (!nested.length) return r;
        const items = nested.map((n) => `item ${n}`).join(', ');
        return {
            ...r,
            additionalContext: [
                ...(r.additionalContext ?? []),
                `x-mod-stash: the ⏳ block's ${items} carries nested lines — one line per item (rules/fleet-output-format.md, ⏳ open asks), so «c» copies it whole; fold the detail into the line or move it above the block`,
            ],
        };
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        busy = false;
        // the store is 🔥's truth: ccrow writes its key after session.start, and a deleted key turns it off
        const wasHot = Boolean(hot);
        const sid = selfId ?? (await $.session.id().catch(() => undefined));
        if (sid)
            hot = (await $.store.get(HOT + sid).catch(() => hot)) as typeof hot;
        if (hot) {
            hot = { ...hot, since: await $.clock.now() };
            await saveHot($);
        }
        await armHot($);
        if (wasHot !== Boolean(hot)) $.ui.invalidate('ui.render');
        await settle($).catch(() =>
            $.ui.log("x-mod-stash holds: could not settle this turn's holds"),
        );
        if (await load($)) $.ui.invalidate('ui.render');
        return r;
    });

    // the 5h reset 🔥 turns itself off at; the context fill the board shows
    on('session.measure', async ($, e, next) => {
        const w = e.rateLimits.find((r) => r.kind === 'five_hour');
        fiveHour = w && {
            resetsAt: w.resetsAt ? Date.parse(w.resetsAt) : undefined,
        };
        if (fiveHour)
            await $.state.set(FIVE_HOUR, fiveHour).catch(() => undefined);
        const sid = selfId ?? (await $.session.id().catch(() => undefined));
        if (sid && e.context.percent !== undefined)
            await $.store
                .set(CONTEXT + sid, e.context.percent)
                .catch(() => undefined);
        return next(e);
    });

    // the board shows each session's model and effort as its main loop's last request named them; a subagent's step never counts
    on('turn.step', async function* ($, e, next) {
        if (!e.agentId) {
            const sid = selfId ?? (await $.session.id().catch(() => undefined));
            const said = modelLabel(e.model, e.effort);
            if (sid && modelSeen !== `${sid}\u0000${said}`) {
                modelSeen = `${sid}\u0000${said}`;
                await $.store.set(MODEL + sid, said).catch(() => undefined);
            }
        }
        return yield* next(e);
    });

    // `/board colour` flips the colour MVP for every session's board, and opens it to look
    on('command.run', { command: 'board' }, async ($, e) => {
        const colour = /^colou?r$/.test(e.args.trim());
        if (colour) await $.store.set(COLOUR, !(await $.store.get(COLOUR)));
        await openBoard($);
        $.ui.invalidate('ui.render');
        if (!colour) return { text: 'fleet board opened' };
        return {
            text: `fleet board colour ${(await $.store.get(COLOUR)) ? 'on' : 'off'}`,
        };
    });

    // the row's 🚦 shows whether the board is open
    on('ui.close', async ($, e, next) => {
        const r = await next(e);
        if (e.id === BOARD) $.ui.invalidate('ui.render');
        return r;
    });

    on('ui.render', { component: 'Pane', requestId: BOARD }, async ($, e) => {
        const ui = $.ui.resolve(e);
        const { Box, Text, Button, Link } = ui;
        const now = await $.clock.now();
        const me = await $.session.id().catch(() => selfId);
        const list = await members($).catch(() => null);
        if (!list)
            return <Text dimColor>the session registry is unreadable</Text>;
        if (!list.length) return <Text dimColor>no live sessions</Text>;
        const colour = (await $.store.get(COLOUR).catch(() => false)) === true;
        const row = (m: Member, i: number) => {
            const state = stateWord(m.status);
            const isBusy = state === 'busy';
            const ticket = ticketOf(m.name);
            const door = m.door;
            const name = m.sid === me ? `${m.name} (here)` : m.name;
            const line = m.wait && `🔭 ${m.wait}`;
            const family = m.model?.split(' ')[0] ?? '';
            return (
                <Box
                    flexDirection='column'
                    key={`m:${m.sid}`}
                    marginTop={i > 0 ? 1 : 0}>
                    <Box
                        flexDirection='row'
                        gap={1}
                        justifyContent='space-between'>
                        {/* the name side gives way, clipped, so a long name never pushes the fact columns out of line */}
                        <Box
                            flexDirection='row'
                            flexGrow={1}
                            flexShrink={1}
                            gap={1}
                            minWidth={0}
                            overflow='hidden'>
                            {/* the state dot leads the row, the reference's cue; tinted only with colour on, the state word says the same */}
                            <Box flexShrink={0}>
                                <Text
                                    color={
                                        colour ? stateTint(state) : undefined
                                    }
                                    dimColor={!colour}>
                                    ●
                                </Text>
                            </Box>
                            {/* the whole name is the control; the coordinator's name stays bold text, since a Button label takes no weight */}
                            {door && !isCoordinator(m.name) ? (
                                <Button
                                    key={`door:${m.sid}`}
                                    onPress={(p) =>
                                        void pressDoor($, door, p.surface)
                                    }
                                    plain>
                                    {`${name} ${doorGlyph(door)}`}
                                </Button>
                            ) : (
                                <Text
                                    bold={isCoordinator(m.name)}
                                    wrap='truncate-end'>
                                    {name}
                                </Text>
                            )}
                            {door && isCoordinator(m.name) ? (
                                <Button
                                    key={`door:${m.sid}`}
                                    onPress={(p) =>
                                        void pressDoor($, door, p.surface)
                                    }
                                    plain>
                                    {doorGlyph(door)}
                                </Button>
                            ) : null}
                            {m.offPattern ? (
                                <Text color={ACCENT}>⚠</Text>
                            ) : null}
                        </Box>
                        {/* one fixed-width, right-aligned cell per fact, drawn empty when it has no reading, so the columns line up across rows (dima, 2026-10-05) */}
                        <Box
                            flexDirection='row'
                            flexShrink={0}
                            gap={e.surface === 'desktop' ? 0.5 : 1}>
                            {/* no hover card in the pane: an absolute card in a narrow row wraps and clips (dima, 2026-10-05) */}
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.ticket}>
                                {ticket ? (
                                    // never wraps: `FRM-306` broke at its hyphen in the desktop font
                                    <Text dimColor wrap='truncate-end'>
                                        <Link
                                            href={`https://linear.app/x-com/issue/${ticket}`}>
                                            {ticket}
                                        </Link>
                                    </Text>
                                ) : null}
                            </Box>
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.context}>
                                {m.context === undefined ? null : (
                                    <Text
                                        color={
                                            colour
                                                ? contextTint(m.context)
                                                : undefined
                                        }
                                        dimColor={!colour}>
                                        ctx {m.context}%
                                    </Text>
                                )}
                            </Box>
                            <Box
                                justifyContent='flex-end'
                                width={COLUMNS.state}>
                                <Text
                                    bold={isBusy}
                                    color={isBusy ? ACCENT : undefined}
                                    dimColor={state === 'idle'}
                                    wrap='truncate-end'>
                                    {m.statusSince
                                        ? `${state} ${span(now - m.statusSince)}`
                                        : state}
                                </Text>
                            </Box>
                            {/* the asks close the row, always drawn: `⏳ 0` dimmed when none (dima, 2026-10-05) */}
                            <Box justifyContent='flex-end' width={COLUMNS.asks}>
                                <Text
                                    color={m.asks ? ACCENT : undefined}
                                    dimColor={!m.asks}>
                                    ⏳ {m.asks}
                                </Text>
                            </Box>
                        </Box>
                    </Box>
                    {/* the second line sits under the name, past the dot, dim — the reference's: the model first, kept whole and tinted by family with colour on, then the wait, cut at its end */}
                    {m.model || line ? (
                        <Box flexDirection='row' gap={2} paddingLeft={2}>
                            {m.model ? (
                                <Box flexShrink={0}>
                                    <Text
                                        color={
                                            colour ? FAMILY[family] : undefined
                                        }
                                        dimColor={!(colour && FAMILY[family])}>
                                        {m.model}
                                    </Text>
                                </Box>
                            ) : null}
                            {line ? (
                                <Box flexShrink={1} minWidth={0}>
                                    <Text dimColor wrap='truncate-end'>
                                        {line}
                                    </Text>
                                </Box>
                            ) : null}
                        </Box>
                    ) : null}
                </Box>
            );
        };
        const busyCount = list.filter(
            (m) => stateWord(m.status) === 'busy',
        ).length;
        return (
            <Box flexDirection='column'>
                {/* the head: what the pane holds on the left, how many work right now on the right */}
                <Box
                    flexDirection='row'
                    justifyContent='space-between'
                    marginBottom={1}>
                    <Box flexDirection='row' gap={1}>
                        <Text color={ACCENT}>◆</Text>
                        <Text bold>sessions</Text>
                        <Text dimColor>on this mac · {list.length}</Text>
                    </Box>
                    <Text
                        color={busyCount ? ACCENT : undefined}
                        dimColor={!busyCount}>
                        {busyCount} busy
                    </Text>
                </Box>
                {list.map(row)}
                <Box marginTop={1}>
                    <Text dimColor wrap='truncate-end'>
                        a name opens its session · /board colour flips colour
                    </Text>
                </Box>
            </Box>
        );
    });

    // a /clear or a resume leaves the conversation behind; an exit leaves its last reply for the away digest
    on('session.end', async ($, e, next) => {
        if (e.reason === 'clear' || e.reason === 'resume')
            await forget($, e.sessionId);
        else await retire($, e.sessionId);
        return next(e);
    });

    // `/clear` and `/resume` leave the conversation: its asks and holds go now, not at the next poll
    on('command.run', async ($, e, next) => {
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = selfId ?? (await $.session.id().catch(() => undefined));
        const r = await next(e);
        if (left) await forget($, left).catch(() => undefined);
        if (await load($)) $.ui.invalidate('ui.render');
        return r;
    });

    on(
        'tool.call',
        { tool: /^(Edit|Write|NotebookEdit)$/ },
        async ($, e, next) => {
            const g = await guard(
                $,
                'notebook_path' in e
                    ? e.notebook_path
                    : 'file_path' in e
                      ? e.file_path
                      : undefined,
            );
            if (g.deny) return { deny: g.deny };
            const r = await next(e);
            if (g.key && r.deny === undefined && !r.isError)
                await land($, g.key).catch(() => undefined);
            return r;
        },
    );

    on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
        const deny = await bashGuard($, 'command' in e ? e.command : undefined);
        return deny ? { deny } : next(e);
    });

    // afk flipped mid-turn: the next tool result carries the new state once
    on('tool.call', async (_$, e, next) => {
        const r = await next(e);
        if (turnAfk === undefined || turnAfk === afk || r.deny !== undefined)
            return r;
        turnAfk = afk;
        return {
            ...r,
            context: [...(r.context ?? []), afk ? AWAY_NOTE : BACK_NOTE],
        };
    });

    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e);
        const groups = Object.entries(entries).sort(([a], [b]) =>
            a === selfId ? -1 : b === selfId ? 1 : 0,
        );
        const total = groups.reduce((n, [, v]) => n + v.asks.length, 0);
        const ui = $.ui.resolve(e);
        const { Box, Text, Button } = ui;
        const surface = e.surface;
        // a thread reads its session name; the repo joins only when two sessions share one
        const title = (v: Entry) => {
            const base = v.name ?? v.label;
            const shared = groups.filter(
                ([, o]) => (o.name ?? o.label) === base,
            ).length;
            return shared > 1 && v.name ? `${base} · ${v.label}` : base;
        };
        // the head stays short; the per-session breakdown lives in its hover card
        const here = entries[selfId ?? '']?.asks.length ?? 0;
        const counts = `here ${here}, parallel ${total - here}`;
        const breakdown = groups
            .map(
                ([sid, v]) =>
                    `${sid === selfId ? `${title(v)} (here)` : title(v)} ${v.asks.length}`,
            )
            .join(', ');
        const toggle = () => {
            open = !open;
            void $.state.set(OPEN, open).catch(() => undefined);
            $.ui.invalidate('ui.render');
        };
        const flipAfk = async () => {
            const was = (await $.store.get(AFK_KEY)) as
                | { at?: number; on?: boolean }
                | undefined;
            afk = !afk;
            digest =
                !afk && was?.on && was.at !== undefined
                    ? await awayDigest($, was.at)
                    : undefined;
            await $.store.set(AFK_KEY, { at: await $.clock.now(), on: afk });
            $.ui.invalidate('ui.render');
        };
        const flipHot = async () => {
            const now = await $.clock.now();
            const reset = fiveHour?.resetsAt;
            hot = hot
                ? undefined
                : {
                      since: now,
                      until: reset && reset > now ? reset : undefined,
                  };
            await saveHot($);
            await armHot($);
            $.ui.invalidate('ui.render');
        };
        const tip = (
            key: string,
            words: string,
            control: RenderElement,
            place: { left: number } | { right: number },
            press?: { hotkey: string; onPress: () => void },
        ) => hoverTip(ui, key, words, control, place, press);
        const boardOpen = await isBoardOpen($);
        const flipBoard = async () => {
            if (await isBoardOpen($)) await $.ui.close({ id: BOARD });
            else await openBoard($);
            $.ui.invalidate('ui.render');
        };
        // a terminal draws a chromed Button as `[ label ]`
        const leftOf = (label: string, chrome: boolean) => ({
            right: [...label].length + (chrome ? 4 : 0) + 1,
        });
        // only the head's copy takes `c`: two Buttons on one key clash, and the later wins
        const copyButton = (sid: string, asks: string[], hotkey?: string) => {
            const copy = () =>
                void $.ui.copy({
                    surface,
                    text: [
                        'lane',
                        ...asks.map((a, i) => `${i + 1}. ${a}`),
                    ].join('\n'),
                });
            return tip(
                `copy:${sid}`,
                "copy this thread's asks",
                <Button key={`copy:${sid}`} onPress={copy} variant='secondary'>
                    📋
                </Button>,
                leftOf('📋', true),
                hotkey ? { hotkey, onPress: copy } : undefined,
            );
        };
        const [first] = groups;
        const many = groups.length > 1;
        // other sessions' holds in this repo; ⚠ when a session was refused one of this session's files
        const chipText = [
            holds.warned ? '⚠' : '',
            holds.others ? `🔒 ${holds.others}` : '',
        ]
            .filter(Boolean)
            .join(' ');
        const chipName = [
            holds.warned
                ? 'a session was refused a file this session holds'
                : '',
            holds.others
                ? `${holds.others} ${holds.others === 1 ? 'file' : 'files'} held by other sessions`
                : '',
        ]
            .filter(Boolean)
            .join('; ');
        const holdsChip = chipText
            ? tip(
                  'holds',
                  chipName,
                  <Text color={holds.warned ? ACCENT : undefined}>
                      {chipText}
                  </Text>,
                  { left: [...chipText].length + 1 },
              )
            : null;
        // icons only; each card says what a press does (dima)
        const hotLabel = '🔥';
        // one icon; the accent background says afk is on (dima)
        const afkLabel = '💨';
        const foldLabel = open ? '📂' : '📁';

        // ~4px under the head on desktop when the asks show; a terminal cell is a whole line, so none there
        const head = (
            <Box
                flexDirection='row'
                justifyContent='space-between'
                marginBottom={
                    open && total && surface === 'desktop' ? 0.25 : 0
                }>
                {first ? (
                    <Box flexDirection='row' gap={1}>
                        <Text bold color={ACCENT}>
                            ⏳ {total} open
                        </Text>
                        {many
                            ? tip(
                                  'counts',
                                  breakdown,
                                  <Text dimColor>{counts}</Text>,
                                  { left: counts.length + 1 },
                              )
                            : null}
                        {holdsChip}
                    </Box>
                ) : (
                    <Box flexDirection='row' gap={1}>
                        <Text dimColor>no open asks</Text>
                        {holdsChip}
                    </Box>
                )}
                <Box flexDirection='row' gap={1}>
                    {first ? copyButton(first[0], first[1].asks, 'c') : null}
                    {tip(
                        'hot',
                        hot
                            ? "stop keeping this session's cache hot"
                            : "keep this session's cache hot: ping every 50 min",
                        <Button
                            key='hot'
                            onPress={() => void flipHot()}
                            {...(hot
                                ? { variant: 'secondary' as const }
                                : { plain: true as const })}>
                            {hotLabel}
                        </Button>,
                        leftOf(hotLabel, !!hot),
                    )}
                    {tip(
                        'afk',
                        afk
                            ? 'back: tell fleet that dima is here'
                            : 'afk: tell fleet that dima is away',
                        <Button
                            key='afk'
                            onPress={() => void flipAfk()}
                            {...(afk
                                ? { variant: 'secondary' as const }
                                : { plain: true as const })}>
                            {afkLabel}
                        </Button>,
                        leftOf(afkLabel, afk),
                    )}
                    {tip(
                        'board',
                        boardOpen ? 'fold fleet board' : 'unfold fleet board',
                        <Button
                            key='board'
                            onPress={() => void flipBoard()}
                            {...(boardOpen
                                ? { variant: 'secondary' as const }
                                : { plain: true as const })}>
                            🚦
                        </Button>,
                        leftOf('🚦', boardOpen),
                        { hotkey: 'b', onPress: () => void flipBoard() },
                    )}
                    {first
                        ? tip(
                              'asks-toggle',
                              open ? 'fold' : 'unfold',
                              <Button key='asks-toggle' onPress={toggle} plain>
                                  {foldLabel}
                              </Button>,
                              leftOf(foldLabel, false),
                              { hotkey: 'f', onPress: toggle },
                          )
                        : null}
                </Box>
            </Box>
        );
        // guard's run folds into one counter row, shown folded or not, gone once guard has been quiet a while
        const plural = (n: number, word: string) =>
            `${n} ${word}${n === 1 ? '' : 's'}`;
        const refused = guards.filter((g) => g.kind === 'refused').length;
        const escaped = guards.length - refused;
        const counter = [
            ...(refused ? [plural(refused, 'refusal')] : []),
            ...(escaped ? [plural(escaped, 'escape')] : []),
            plural(new Set(guards.map((g) => g.sid)).size, 'session'),
        ].join(' · ');
        const flipGuards = () => {
            guardsOpen = !guardsOpen;
            $.ui.invalidate('ui.render');
        };
        const guardLabel = guardsOpen ? '▾' : '▸';
        const shields = guards.length
            ? [
                  <Box flexDirection='row' gap={1} key='guard'>
                      <Text>🛡️ {counter}</Text>
                      {tip(
                          'guard-toggle',
                          guardsOpen
                              ? 'fold guard refusals'
                              : 'unfold guard refusals',
                          <Button key='guard-toggle' onPress={flipGuards} plain>
                              {guardLabel}
                          </Button>,
                          leftOf(guardLabel, false),
                      )}
                  </Box>,
                  ...(guardsOpen
                      ? guards.map((g) => (
                            <Text
                                dimColor
                                key={`guard:${g.key}`}
                                wrap='truncate-end'>
                                {`${g.name ?? short(g.sid)} — ${g.command} → ${g.kind === 'escaped' ? `ran on dima-ok: ${g.target}` : (g.why ?? g.door)}`}
                            </Text>
                        ))
                      : []),
              ]
            : [];
        const away =
            digest && (digest.needs.length || digest.done.length)
                ? [
                      <Text dimColor key='away'>
                          while you were away
                      </Text>,
                      ...digest.needs.map((n) => (
                          <Text key={`away:n:${n.sid}`} wrap='truncate-end'>
                              {`needs you · ${n.name} · ⏳ ${n.asks}`}
                          </Text>
                      )),
                      ...digest.done.map((d) => (
                          <Text
                              dimColor
                              key={`away:d:${d.sid}`}
                              wrap='truncate-end'>
                              {`done · ${d.name}`}
                          </Text>
                      )),
                  ]
                : [];
        if (!open || !total)
            return (
                <Box flexDirection='column'>
                    {head}
                    {shields}
                    {away}
                    {await next(e)}
                </Box>
            );

        // one thread needs no name; with several, the head copies the first and each other one copies beside its name
        const rows = groups.flatMap(([sid, v], g) => [
            ...(many
                ? [
                      <Box
                          flexDirection='row'
                          gap={1}
                          justifyContent='space-between'
                          key={`g:${sid}`}
                          marginTop={g > 0 && surface === 'desktop' ? 0.5 : 0}>
                          <Text bold>
                              {sid === selfId ? `${title(v)} (here)` : title(v)}
                          </Text>
                          {g > 0 ? copyButton(sid, v.asks) : null}
                      </Box>,
                  ]
                : []),
            ...v.asks.map((ask, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an ask's number is its identity in the numbered ⏳ list
                <Text key={`a:${sid}:${i + 1}`}>
                    {i + 1}. {ask}
                </Text>
            )),
        ]);
        const room = Math.max(
            1,
            e.props.maxRows - 1 - shields.length - away.length,
        );
        const shown = rows.slice(0, room);
        return (
            <Box flexDirection='column'>
                {head}
                {shields}
                {away}
                {shown}
                {rows.length > shown.length ? (
                    <Text dimColor>+{rows.length - shown.length} more</Text>
                ) : null}
                {await next(e)}
            </Box>
        );
    });
};
