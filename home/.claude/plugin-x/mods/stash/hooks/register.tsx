/* @jsx h */
import type { EngineInterface, Register, RenderElement } from 'claude-code';

import {
    type Door,
    FLEET_NAME,
    doorOf,
    parseAsks,
    parseWait,
    stateWord,
    ticketOf,
    writeTargets,
} from './parse.ts';

// stash: dima's command center above the prompt, one folded row with three features.
// asks: every live session's open ⏳ asks, mirrored from each last reply into $.store (one key per session).
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// holds: a session's first edit of a file holds it; another session's edit is refused
// keep-hot: while on and idle, one ping 50 min after the last turn ended keeps the prompt cache warm; the switch lives in $.store, so a reload keeps it
// The reply stays the source of truth for asks; this band only shows and copies them.

// label: the repo; name: the session's registry name, when it has one
type Entry = { label: string; name?: string; asks: string[]; at: number };

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
// the registry names a short-lived headless run `t-` + hex (`t-70`); the board leaves those out (dima, 2026-10-05)
const HEADLESS = /^t-[0-9a-f]+$/;
const STALE_MS = 24 * 60 * 60 * 1000;
// dima at the prompt, typing into a background job, on his phone or the web
const DIMA_ORIGINS = ['composer', 'sdk', 'bridge'] as const;
const HOT_MS = 50 * 60 * 1000;
const HOT = 'hot:';
const PING = 'stash keep-hot ping: answer with one character, nothing else.';
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
// a turn start or a flip bumps it, so a ping armed before either never fires
let hotGen = 0;

// a thread's asks show while it has any and they are under a day old
const isLive = (v: Entry | undefined, now: number): v is Entry =>
    !!v && Array.isArray(v.asks) && v.asks.length > 0 && now - v.at < STALE_MS;

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
        $.ui.log(`stash holds: git status failed on ${file}, hold released`);
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
    return `stash: ${file} is held by session ${short(sid)}, which took it ${mins} min ago. wait, or ask it to commit the file.`;
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

// fail-open: a store or git error lets the edit through, with a line in the transcript
// the tool input is the model's: a path that is not a string is not guarded
async function guard($: EngineInterface, file: unknown): Promise<Claim> {
    if (typeof file !== 'string') return {};
    try {
        return await claim($, file, proc);
    } catch (err) {
        $.ui.log(
            `stash holds: ${err instanceof Error ? err.message : String(err)}; the edit went through unguarded`,
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
            `stash holds: ${err instanceof Error ? err.message : String(err)}; the command went through unguarded`,
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
    if (fresh.some((f) => !known.has(f))) open = true;
    known = new Set(fresh);
    entries = next;
    const cool = await cooled($);
    const prevHolds = holds;
    // after a /clear the process goes on under a new id, and no session.start fires
    selfId = await $.session.id().catch(() => selfId);
    if (selfId) holds = await chip($, selfId, root);
    const holdsChanged =
        prevHolds.others !== holds.others || prevHolds.warned !== holds.warned;
    return afkChanged || holdsChanged || cool || before !== after;
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
        $.ui.log('stash keep-hot: pinged the idle session');
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
    offPattern: boolean;
};

const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// live sessions from the registry, each with what its own stash wrote; a registry file mid-write is skipped
async function members($: EngineInterface): Promise<Member[]> {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: {
        pid: number;
        bg: boolean;
        base: Pick<Member, 'sid' | 'name' | 'status' | 'statusSince' | 'door'>;
    }[] = [];
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
    const out: Member[] = [];
    const now = await $.clock.now();
    const shown = rows.filter(
        (r) => alive.has(r.pid) && !HEADLESS.test(r.base.name),
    );
    for (const { bg, base: r } of shown) {
        const reply = (await $.store.get(REPLY + r.sid)) as
            | { wait?: string }
            | undefined;
        const asks = (await $.store.get(PREFIX + r.sid)) as Entry | undefined;
        out.push({
            ...r,
            asks: isLive(asks, now) ? asks.asks.length : 0,
            context: (await $.store.get(CONTEXT + r.sid)) as number | undefined,
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
    const m = Math.floor(ms / 60000);
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
    if (r?.exitCode !== 0) $.ui.log(`stash board: could not open ${door.url}`);
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
                'stash holds: no pid for this session, a dead holder releases only by idle',
            );
            return undefined;
        });
        hot = (await $.store.get(HOT + selfId)) as typeof hot;
        await load($);
        await armHot($);
        await $.command
            .register({
                description:
                    'open the fleet board: every live session, busy or idle, its last message',
                name: 'board',
            })
            .catch(() => $.ui.log('stash: /board was not registered'));
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
                .set(REPLY + e.session_id, { wait: parseWait(reply) })
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
        return r;
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        busy = false;
        if (hot) {
            hot = { ...hot, since: await $.clock.now() };
            await saveHot($);
        }
        await armHot($);
        await settle($).catch(() =>
            $.ui.log("stash holds: could not settle this turn's holds"),
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
        const sid = selfId ?? (await $.session.id().catch(() => undefined));
        if (sid && e.context.percent !== undefined)
            await $.store
                .set(CONTEXT + sid, e.context.percent)
                .catch(() => undefined);
        return next(e);
    });

    on('command.run', { command: 'board' }, async ($) => {
        await openBoard($);
        $.ui.invalidate('ui.render');
        return { text: 'fleet board opened' };
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
        const row = (m: Member, i: number) => {
            const state = stateWord(m.status);
            const isBusy = state === 'busy';
            const ticket = ticketOf(m.name);
            const door = m.door;
            const name = m.sid === me ? `${m.name} (here)` : m.name;
            const line = m.wait && `🔭 ${m.wait}`;
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
                                    <Text dimColor>ctx {m.context}%</Text>
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
                    {line ? <Text wrap='truncate-end'>{line}</Text> : null}
                </Box>
            );
        };
        return <Box flexDirection='column'>{list.map(row)}</Box>;
    });

    on('session.end', async ($, e, next) => {
        await $.store.delete(PREFIX + e.sessionId);
        await $.store.delete(HOT + e.sessionId);
        await $.store.delete(REPLY + e.sessionId);
        await $.store.delete(CONTEXT + e.sessionId);
        await dropAll($, e.sessionId).catch(() => undefined);
        return next(e);
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
            $.ui.invalidate('ui.render');
        };
        const flipAfk = async () => {
            afk = !afk;
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
        if (!open || !total)
            return (
                <Box flexDirection='column'>
                    {head}
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
                <Text key={`a:${sid}:${i + 1}`}>
                    {i + 1}. {ask}
                </Text>
            )),
        ]);
        const room = Math.max(1, e.props.maxRows - 1);
        const shown = rows.slice(0, room);
        return (
            <Box flexDirection='column'>
                {head}
                {shown}
                {rows.length > shown.length ? (
                    <Text dimColor>+{rows.length - shown.length} more</Text>
                ) : null}
                {await next(e)}
            </Box>
        );
    });
};
