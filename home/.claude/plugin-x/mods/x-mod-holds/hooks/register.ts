import type { EngineInterface, Register } from 'claude-code';

// x-mod-holds: no two sessions write the same file. a session's first Edit or Write of a file holds it until the file
// is committed, the session ends or sits idle; another session's edit of it, or a Bash write to it, is refused and
// names the holder. x-mod-guard refuses a Bash write to a held file from this store; x-mod-stash's board reads it for
// its 🔒 line.

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

// this session's claude process, so a rival can tell a dead holder from a live one
let proc: Proc | undefined;

// holds: a session's first edit of a file holds it; another session's edit of it is refused.
// $.store has no compare-and-set, so each session writes only its own keys and the earliest claim wins.

// file is the real path in its own case, for git; landed once the edit went through
type Hold = { at: number; file: string; top: string; landed?: boolean };
type Claim = { deny?: string; key?: string };
type Holder = { pid?: number; start?: string; idleSince: number | null };
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
        $.ui.log(`x-mod-holds: git status failed on ${file}, hold released`);
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
    return `x-mod-holds: ${file} is held by session ${short(sid)}, which took it ${mins} min ago. wait, or ask it to commit the file.`;
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

// drop this session's holds whose files are clean again; answers how many are left
async function releaseClean($: EngineInterface, sid: string) {
    let left = 0;
    for (const key of await $.store.keys()) {
        if (parseHoldKey(key)?.sid !== sid) continue;
        const hold = (await $.store.get(key)) as Hold | undefined;
        if (!hold || (await isClean($, hold.file))) await $.store.delete(key);
        else left++;
    }
    return left;
}

// a commit run through the shell, `git commit` or `x lane commit`
const COMMIT = /\b(git|x\s+lane)\s+(-C\s+\S+\s+)?commit\b/;

// a turn ended: start the idle clock and drop the holds whose files are clean again
async function settle($: EngineInterface) {
    const sid = await $.session.id();
    await sweep($, sid);
    const holder = (await $.store.get(HOLDER + sid)) as Holder | undefined;
    if (!holder) return;
    if (await releaseClean($, sid)) {
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

// fail-open: a store or git error lets the edit through, with a line in the transcript
// the tool input is the model's: a path that is not a string is not guarded
async function guard($: EngineInterface, file: unknown): Promise<Claim> {
    if (typeof file !== 'string') return {};
    try {
        return await claim($, file, proc);
    } catch (err) {
        $.ui.log(
            `x-mod-holds: ${errorText(err)}; the edit went through unguarded`,
        );
        return {};
    }
}

export const register: Register = (on) => {
    on('session.start', async ($, e, next) => {
        proc = await procOf($).catch(() => {
            $.ui.log(
                'x-mod-holds: no pid for this session, a dead holder releases only by idle',
            );
            return undefined;
        });
        return next(e);
    });

    // a new turn: this session is no longer idle, so its holds keep
    on('prompt.submit', async ($, e, next) => {
        await markBusy($).catch(() => undefined);
        return next(e);
    });

    on('turn.complete', async ($, e, next) => {
        const r = await next(e);
        // a subagent's turn ending is not the session going idle
        if (e.agentId) return r;
        await settle($).catch(() =>
            $.ui.log("x-mod-holds: could not settle this turn's holds"),
        );
        return r;
    });

    on('session.end', async ($, e, next) => {
        await dropAll($, e.sessionId).catch(() => undefined);
        return next(e);
    });

    // `/clear` and `/resume` leave the conversation: its holds go now
    on('command.run', async ($, e, next) => {
        if (e.command !== 'clear' && e.command !== 'resume') return next(e);
        const left = await $.session.id().catch(() => undefined);
        const r = await next(e);
        if (left) await dropAll($, left).catch(() => undefined);
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

    // a commit made through Bash releases its clean files now, not at the turn's end
    on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
        const command = 'command' in e ? e.command : undefined;
        const r = await next(e);
        if (typeof command === 'string' && COMMIT.test(command))
            await releaseClean($, await $.session.id()).catch(() =>
                $.ui.log('x-mod-holds: could not release after a commit'),
            );
        return r;
    });
};
