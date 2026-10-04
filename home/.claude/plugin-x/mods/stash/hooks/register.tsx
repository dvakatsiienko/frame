/* @jsx h */
import type { EngineInterface, Register } from 'claude-code';

import { parseAsks } from './parse.ts';

// stash: dima's command center above the prompt, one folded row with three features.
// asks: every live session's open ⏳ asks, mirrored from each last reply into $.store (one key per session).
// afk: one switch every session polls; while it is on, every prompt carries an away note, and a flip reaches a running turn.
// holds: a session's first edit of a file holds it; another session's edit is refused
// The reply stays the source of truth for asks; this band only shows and copies them.

type Entry = { label: string; asks: string[]; at: number };

const PREFIX = 'asks:';
const AFK_KEY = 'afk';
const AWAY_NOTE =
    'dima is afk: nothing waits on him. take reversible steps and log them, park every ask for his return, send no ⏳ block and no ping.';
const BACK_NOTE =
    'dima is back from afk: asks and the ⏳ block reach him again.';
const POLL_MS = 4000;
const STALE_MS = 24 * 60 * 60 * 1000;
const MACHINE_ORIGINS = ['peer', 'task-notification', 'scheduled-trigger'];
const ACCENT = '#d97757';

let selfId: string | undefined;
let label = 'session';
let entries: Record<string, Entry> = {};
let known = new Set<string>();
let open = false;
let userTurn = false;
let polling = false;
let afk = false;
let turnAfk: boolean | undefined;
let proc: Proc | undefined;
let root = '';
let holds = { others: 0, warned: false };

const fp = (sid: string, ask: string) => `${sid}\u0000${ask}`;
const basename = (path: string) =>
    path.split('/').filter(Boolean).pop() ?? path;

// holds: a session's first edit of a file holds it; another session's edit of it is refused.
// $.store has no compare-and-set, so each session writes only its own keys and the earliest claim wins.

type Hold = { at: number; file: string; top: string };
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

// lowercased on every platform: APFS is case-insensitive and the mod cannot ask which os it runs on
async function realPath($: EngineInterface, file: string) {
    const resolve = (p: string) =>
        $.fs.stat(p, { resolve: true }).then(
            (s) => s.realPath,
            () => undefined,
        );
    const direct = await resolve(file);
    if (direct) return direct.toLowerCase();
    // a new file has no real path yet; its nearest existing folder does
    let dir = dirname(file);
    let real = await resolve(dir);
    while (!real && dir !== '/') {
        dir = dirname(dir);
        real = await resolve(dir);
    }
    return `${real ?? dir}${file.slice(dir.length)}`.toLowerCase();
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
    return (await isGone($, holder, now)) || isClean($, hold.file);
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

// the deny text when another session holds the file, else undefined after taking the hold
async function claim($: EngineInterface, file: string, proc: Proc | undefined) {
    const sid = await $.session.id();
    const path = await realPath($, file);
    const now = await $.clock.now();
    for (const c of await claimsOn($, path)) {
        if (c.sid === sid) continue;
        if (await isReleased($, c.sid, c.hold, now)) {
            await $.store.delete(c.key);
            continue;
        }
        await $.store.set(REFUSED + c.sid, { at: now, by: sid, path });
        return refusal(file, c.sid, c.hold, now);
    }
    const mine = holdKey(sid, path);
    if (await $.store.get(mine)) return undefined;
    // the holder first: a rival reading the hold without it would take it for released
    if (!(await $.store.get(HOLDER + sid)))
        await $.store.set(HOLDER + sid, { ...proc, idleSince: null });
    await $.store.set(mine, {
        at: now,
        file,
        top: await topOf($, dirname(file)),
    });
    // a rival who wrote between the read and the write: earliest at wins, ties by sid
    const [first] = (await claimsOn($, path)).sort(
        (a, b) => a.hold.at - b.hold.at || a.sid.localeCompare(b.sid),
    );
    if (!first || first.sid === sid) return undefined;
    await $.store.delete(mine);
    return refusal(file, first.sid, first.hold, now);
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
async function guard($: EngineInterface, file: unknown) {
    if (typeof file !== 'string') return undefined;
    try {
        return await claim($, file, proc);
    } catch (err) {
        $.ui.log(
            `stash holds: ${err instanceof Error ? err.message : String(err)}; the edit went through unguarded`,
        );
        return undefined;
    }
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
        if (
            v &&
            Array.isArray(v.asks) &&
            v.asks.length &&
            now - v.at < STALE_MS
        )
            next[key.slice(PREFIX.length)] = v;
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
    const prevHolds = holds;
    // after a /clear the process goes on under a new id, and no session.start fires
    selfId = await $.session.id().catch(() => selfId);
    if (selfId) holds = await chip($, selfId, root);
    const holdsChanged =
        prevHolds.others !== holds.others || prevHolds.warned !== holds.warned;
    return afkChanged || holdsChanged || before !== after;
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
        await load($);
        if (!polling) {
            polling = true;
            const tick = () =>
                $.clock.after(POLL_MS, async () => {
                    if (await load($)) $.ui.invalidate('ui.render');
                    tick();
                });
            tick();
        }
        return next(e);
    });

    // a turn a peer, a task or a trigger woke is not dima's: its reply may drop the block
    on('prompt.submit', async ($, e, next) => {
        userTurn =
            e.text.trim().length > 0 &&
            !MACHINE_ORIGINS.includes(e.origin?.kind);
        await load($);
        turnAfk = afk;
        await markBusy($).catch(() => undefined);
        if (!afk) return next(e);
        return next({ ...e, context: [...(e.context ?? []), AWAY_NOTE] });
    });

    on('classic.Stop', async ($, e, next) => {
        const r = await next(e);
        const asks = parseAsks(e.last_assistant_message ?? '');
        // a reply to dima with no block means nothing is open; a reply woken by a peer keeps the old list
        if (asks !== null || userTurn) {
            const key = PREFIX + e.session_id;
            if (asks?.length)
                await $.store.set(key, {
                    asks,
                    at: await $.clock.now(),
                    label,
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
        await settle($).catch(() =>
            $.ui.log("stash holds: could not settle this turn's holds"),
        );
        if (await load($)) $.ui.invalidate('ui.render');
        return r;
    });

    on('session.end', async ($, e, next) => {
        await $.store.delete(PREFIX + e.sessionId);
        await dropAll($, e.sessionId).catch(() => undefined);
        return next(e);
    });

    on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
        const deny = await guard($, e.file_path);
        return deny ? { deny } : next(e);
    });
    on('tool.call', { tool: 'Write' }, async ($, e, next) => {
        const deny = await guard($, e.file_path);
        return deny ? { deny } : next(e);
    });
    on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
        const deny = await guard($, e.notebook_path);
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
        const { Box, Text, Button } = $.ui.resolve(e);
        const surface = e.surface;
        const counts = groups
            .map(
                ([sid, v]) =>
                    `${sid === selfId ? 'here' : v.label} ${v.asks.length}`,
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
        const copyButton = (sid: string, asks: string[]) => (
            <Button
                key={`copy:${sid}`}
                onPress={() =>
                    void $.ui.copy({
                        surface,
                        text: [
                            'lane',
                            ...asks.map((a, i) => `${i + 1}. ${a}`),
                        ].join('\n'),
                    })
                }
                variant='secondary'>
                📋 copy all
            </Button>
        );
        const [first] = groups;
        const many = groups.length > 1;
        // other sessions' holds in this repo; ⚠ when a session was refused one of this session's files
        const holdsChip =
            holds.others || holds.warned ? (
                <Text color={holds.warned ? ACCENT : undefined}>
                    {[
                        holds.warned ? '⚠' : '',
                        holds.others ? `🔒 ${holds.others}` : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                </Text>
            ) : null;

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
                        {many ? <Text dimColor>{counts}</Text> : null}
                        {holdsChip}
                    </Box>
                ) : (
                    <Box flexDirection='row' gap={1}>
                        <Text dimColor>no open asks</Text>
                        {holdsChip}
                    </Box>
                )}
                <Box flexDirection='row' gap={1}>
                    {first ? copyButton(first[0], first[1].asks) : null}
                    <Button
                        key='afk'
                        onPress={() => void flipAfk()}
                        {...(afk
                            ? { variant: 'primary' as const }
                            : { plain: true as const })}>
                        {afk ? '🌙 afk' : '☕ afk'}
                    </Button>
                    {first ? (
                        <Button
                            hotkey='o'
                            key='asks-toggle'
                            onPress={toggle}
                            plain>
                            {open ? 'hide' : 'show'}
                        </Button>
                    ) : null}
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
                      <Box flexDirection='row' gap={1} key={`g:${sid}`}>
                          <Text bold>
                              {sid === selfId ? `${v.label} (here)` : v.label}
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
