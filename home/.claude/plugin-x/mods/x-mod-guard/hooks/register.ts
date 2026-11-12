import type { EngineInterface, Register, ToolCallResult } from 'claude-code';

import type { Context, Refusal } from './rules/command.ts';
import { TRASH, commandsDeep, tickedRest } from './rules/command.ts';
import { stashSweep, stashSweeps } from './rules/floor.ts';
import {
    type HerdrClose,
    herdrCloseKey,
    herdrCloseOf,
    isClioSeat,
    isHerdrTabNew,
} from './rules/herdr-close.ts';
import {
    PR_HINT,
    bareHelps,
    helpScripts,
    hints,
    verbHelps,
} from './rules/hint.ts';
import {
    type OverrideAsk,
    type OverrideGrants,
    overrideAsked,
    untilAt,
} from './rules/operator-override.ts';
import {
    RELEASE_BRAKE,
    rawMergeRefused,
    rawMerges,
    releasesBrake,
} from './rules/raw-merge.ts';
import { rewrite } from './rules/rewrite.ts';
import {
    message,
    pressTicks,
    refusals,
    removedTrees,
    tmpDirs,
} from './rules.ts';

// x-mod-guard: every Bash call is read before it runs. only the floor refuses — rm, a discard, a rewrite, a skipped gate,
// a kill by pattern, a seat's close, a raw merge, a stash over a held file, a remote delete, a machine change — and his one
// tick on an ask quoting the whole command opens it once; plain rm never opens, trash is its door. each refusal and each
// pass is kept in $.store as one `event:` key, with per-day counts x-mod-stash's band reads

export type GuardEvent = {
    at: number;
    sid: string;
    name?: string;
    command: string;
    // warned: the override let a floor command run
    kind: 'refused' | 'escaped' | 'warned';
    door: string;
    target: string;
    // why it was refused, the line x-mod-stash shows unfolded; an escape names every rule it stepped past
    why: string;
    // the rule that fired; an escape names every rule it stepped past, comma-joined
    rule: string;
};

type Tally = { refused: number; escaped: number; warned?: number };
// rules: the same tally split by the rule that fired
export type DayCount = Tally & { rules?: Record<string, Tally> };

const FAILED =
    'x-mod-guard: the check failed or ran out of time, so this call is refused (fail closed). retry it once; if it repeats, tell clio, or ask dima for operator-override all';
const isUnder = (path: string, dir: string) =>
    path === dir || path.startsWith(`${dir}/`);
const spentAt = (key: string) =>
    Number(key.split('@')[1]?.split(':')[0]) || Number.POSITIVE_INFINITY;
const withContext = (result: ToolCallResult, lines: string[]) =>
    result.deny !== undefined || !lines.length
        ? result
        : { ...result, context: [...(result.context ?? []), ...lines] };

const EVENT = 'event:';
const KEEP = 50;
const DAY = 'day:';
const DAYS = 30;
const SHOWN = 160;

// whole code points, and no half pair left from an older cut: a lone surrogate leaves the store file unreadable to jq
const points = (s: string) =>
    [...s].filter((c) => c.length === 2 || !/[\ud800-\udfff]/.test(c));
const cut = (s: string, n: number) => {
    const all = points(s);
    return all.length > n ? `${all.slice(0, n).join('')}…` : all.join('');
};
// a clio session's own code edits: the 8th gets one note that a bigger job belongs to a helper
const CODE_FILE = /\.(ts|tsx|go|sh|py|swift)$/;
const EDITS = { key: 'edits', plugin: 'x-mod-guard' } as const;
const EDIT_LIMIT = 8;
const DELEGATE_NOTE =
    "x-mod-guard: 8 code edits in this clio session — a bigger job goes to a helper (~137k base) instead of this thread's context";

// a session's entry in cc's registry: the name ListAgents shows, and `bg` for a background session
async function registryEntry($: EngineInterface, sid: string) {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!f.name.endsWith('.json')) continue;
        const raw = await $.fs.read(`${dir}/${f.name}`).catch(() => '');
        if (!raw.includes(sid)) continue;
        try {
            const v = JSON.parse(raw) as {
                sessionId?: unknown;
                name?: unknown;
                kind?: unknown;
                pid?: unknown;
            };
            if (v.sessionId === sid)
                return {
                    isBg: v.kind === 'bg',
                    name: typeof v.name === 'string' ? v.name : undefined,
                    pid: typeof v.pid === 'number' ? v.pid : undefined,
                };
        } catch {}
    }
    return undefined;
}

async function sessionName($: EngineInterface, sid: string) {
    return (await registryEntry($, sid))?.name;
}

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
async function overrideLogPass(
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

// one key per event, so parallel sessions never overwrite each other; the oldest past KEEP are dropped
async function record(
    $: EngineInterface,
    event: Omit<GuardEvent, 'at' | 'sid' | 'name'>,
) {
    const sid = await $.session.id();
    const at = await $.clock.now();
    // one line on the band, whatever the command's shape
    const line = event.command.replace(/\s+/g, ' ').trim();
    const value: GuardEvent = {
        ...event,
        at,
        command: cut(line, SHOWN),
        name: await sessionName($, sid),
        sid,
    };
    // the band's record only: a store failure never turns a verdict into a refusal
    try {
        await $.store.set(`${EVENT}${at}:${sid}`, value);
        const keys = await $.store.keys();
        const events = keys.filter((k) => k.startsWith(EVENT));
        for (const old of events.slice(0, Math.max(0, events.length - KEEP)))
            await $.store.delete(old);
        await count($, keys, at, sid, event).catch(() => undefined);
    } catch (err) {
        $.ui.log(`x-mod-guard: the event was not kept: ${err}`);
    }
}

const tally = (was: Tally | undefined, kind: GuardEvent['kind']): Tally => ({
    escaped: (was?.escaped ?? 0) + (kind === 'escaped' ? 1 : 0),
    refused: (was?.refused ?? 0) + (kind === 'refused' ? 1 : 0),
    ...(kind === 'warned' || was?.warned
        ? { warned: (was?.warned ?? 0) + (kind === 'warned' ? 1 : 0) }
        : {}),
});

// the pr-read hint once a session: it fired 187 times in one (FRM-519 item 11); a /clear's new id hears it again
const PR_HINTED = 'pr-hinted:';
async function oncePrHint($: EngineInterface, found: string[]) {
    if (!found.includes(PR_HINT)) return found;
    const sid = await $.session.id().catch(() => undefined);
    if (!sid) return found;
    if (await $.store.get(PR_HINTED + sid).catch(() => undefined))
        return found.filter((h) => h !== PR_HINT);
    await $.store.set(PR_HINTED + sid, true).catch(() => undefined);
    return found;
}

// the local day, `yyyy-mm-dd`
function day(at: number) {
    const d = new Date(at);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

// one `day:<yyyy-mm-dd>:<session>` key per session a day, so a halt counts the whole day past the KEEP kept events; a count past DAYS is dropped
async function count(
    $: EngineInterface,
    keys: string[],
    at: number,
    sid: string,
    { kind, rule }: Pick<GuardEvent, 'kind' | 'rule'>,
) {
    const key = `${DAY}${day(at)}:${sid}`;
    const was = (await $.store.get(key)) as DayCount | undefined;
    const rules = { ...was?.rules };
    for (const r of new Set(rule.split(', '))) rules[r] = tally(rules[r], kind);
    await $.store.set(key, {
        ...tally(was, kind),
        rules,
    } satisfies DayCount);
    const oldest = `${DAY}${day(at - DAYS * 86_400_000)}`;
    for (const old of keys)
        if (old.startsWith(DAY) && old < oldest) await $.store.delete(old);
}

// x-mod-holds' store file: a session's first edit of a file holds it, and a Bash write by another session is refused here,
// by the one Bash parser. the release checks are holds' own: a holder idle 30 min, a dead pid, a landed hold clean in git
const HOLDS_FILE = /^x-mod-holds_.*\.json$/;
// stash's 🎛️ «guard verdicts» knob lives in stash's own store file; silent drops the rewrite, hint and delegate notes, never a
// refusal or a would-refuse (FRM-391 slice 06, dima's o11) — read-only, the store is one file per plugin
const STASH_FILE = /^x-mod-stash_.*\.json$/;
async function isSilent($: EngineInterface, home: string | undefined) {
    const dir = `${home}/.claude/plugins/store`;
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!STASH_FILE.test(f.name)) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`));
            if (v?.['guard-silent'] === true) return true;
        } catch {}
    }
    return false;
}
const HOLD = 'hold:';
const IDLE_MS = 30 * 60 * 1000;
type Hold = { at: number; file: string; landed?: boolean; top?: string };
type Holder = { pid?: number; start?: string; idleSince: number | null };

// twin holder-gone — a copy lives in x-mod-holds; the twins lint keeps them equal
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
// twin end

// the holds another live session keeps, read from x-mod-holds' store file
async function liveHolds($: EngineInterface, ctx: Context) {
    const dir = `${ctx.home}/.claude/plugins/store`;
    const held: Record<string, unknown> = {};
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!HOLDS_FILE.test(f.name)) continue;
        try {
            Object.assign(
                held,
                JSON.parse(await $.fs.read(`${dir}/${f.name}`)),
            );
        } catch {}
    }
    const sid = await $.session.id();
    const now = await $.clock.now();
    const live: {
        holder: string;
        hold: Hold;
        isPassed: boolean;
        key: string;
        now: number;
    }[] = [];
    for (const [key, value] of Object.entries(held)) {
        if (!key.startsWith(HOLD)) continue;
        const cut = key.indexOf(':', HOLD.length);
        const holder = key.slice(HOLD.length, cut);
        if (holder === sid) continue;
        const hold = value as Hold;
        if (
            await isReleased(
                $,
                held[`holder:${holder}`] as Holder | undefined,
                hold,
                now,
            )
        )
            continue;
        const path = key.slice(cut + 1);
        // x-mod-holds' pass: dima's tick let this session write the file until its next commit or its turn's end
        const isPassed = held[`pass:${sid}:${path}`] !== undefined;
        live.push({ hold, holder, isPassed, key: path, now });
    }
    return live;
}

// a whole-tree stash in a repo where another live session holds a file sweeps that file too
async function stashOver(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
) {
    const dirs = stashSweeps(command, cwd, ctx);
    if (!dirs.length) return undefined;
    const live = await liveHolds($, ctx);
    for (const dir of dirs) {
        const found = live.find(
            (l) =>
                l.hold.top !== undefined &&
                (dir === l.hold.top || dir.startsWith(`${l.hold.top}/`)),
        );
        if (found) return stashSweep(dir, found.hold.file);
    }
    return undefined;
}

async function isReleased(
    $: EngineInterface,
    holder: Holder | undefined,
    hold: Hold,
    now: number,
) {
    if (await isGone($, holder, now)) return true;
    if (!hold.landed) return false;
    const git = await $.process
        .run(['git', 'status', '--porcelain', '--', hold.file], {
            cwd: hold.file.slice(0, hold.file.lastIndexOf('/')) || '/',
        })
        .catch(() => null);
    return git?.exitCode !== 0 || git.stdout.trim() === '';
}

const HELPED = { key: 'helped', plugin: 'x-mod-guard' } as const;
const IMAGES = { key: 'images', plugin: 'x-mod-guard' } as const;

// cc core refuses a worktree command naming git where it cannot prove the git stays in the tree — a heredoc body, a
// `gh api` path — and no hook may override it (dima's o26); its refusal leaves with the door (fleet-hazards § the bash sandbox)
const ISOLATED = /^This (session|agent) is isolated in the worktree /;
const ISOLATED_DOOR =
    'x-mod-guard: write the command into a scratch script ($CLAUDE_JOB_DIR/tmp or the session scratchpad) and run that script by path; git itself goes through `x lane <verb>`';
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i;
const IMAGE_LIMIT = 3;
// screenshots read for their data go to helper-lite (PK-148); clio reads them herself and pays for each
const IMAGE_NOTE = `x-mod-guard: ${IMAGE_LIMIT} image Reads this turn — screenshots read for their data go to \`helper-lite\` cards, ≤20 a batch, transcribed to text (\`rules/fleet-tooling.md\`)`;

// dima's ticks: x-mod-stash writes them into its own $.state from his 🛎️ press alone, and any plugin reads another's
// value while only its owner writes it — so no Bash, Edit, Write or orbit op can forge one, and it is this session's
// own (FRM-427)
const TICKS = { key: 'ticks', plugin: 'x-mod-stash' } as const;
const SPENT = { key: 'spent', plugin: 'x-mod-guard' } as const;
// a tick counts for 2 h: a yes for this afternoon's push never unlocks tonight's (dima's o2)
const TICK_MS = 2 * 60 * 60 * 1000;
// a tick is spent per use: `scope` names what it authorized (a command, a pr, a sign), so one ask quoting a guarded
// command and a pr carries both once. a use counts only when its command runs: `spends` holds it until `go`, so a later
// rule's refusal leaves dima's word for the retry (three re-ticks on 2026-11-05)
// the ask quotes the whole guarded command in one backtick span, spacing aside, never only a target its refusal names
// (dima's tick on the sixth sense's ask, 2026-10-28: `git push origin main` never unlocks `git push --mirror origin`)
const spaced = (text: string) => text.trim().replace(/\s+/g, ' ');
const guardedOf = (command: string) =>
    spaced(command.replace(/\s#\s*dima-ok:.*$/, ''));
const quotesCommand = (command: string) => (t: Tick) =>
    t.targets.some((q) => spaced(q) === guardedOf(command));
// markAt: the time x-mod-stash marked the press's ask, so spending the press spends the mark that stands for it once
// x-herdr-deck prunes the press (12b's live click: his one press ran the brake twice)
type Tick = {
    id: string;
    text: string;
    targets: string[];
    at: number;
    markAt?: number;
};
// his presses on x-herdr-deck for this session (FRM-544 slice 1, reversing FRM-552's decision 4 on his word): the ticks-write
// rule keeps every seat's tool call out of that folder, so only x-herdr-deck writes it; a file that cannot be read is no tick
async function herdrTicks($: EngineInterface): Promise<Tick[]> {
    const sid = await $.session.id().catch(() => undefined);
    const home = await $.env.get('HOME').catch(() => undefined);
    if (!sid || !home) return [];
    const text = await $.fs
        .read(`${home}/.claude/shelf/orbit-ticks/${sid}.jsonl`)
        .catch(() => '');
    // a press counts only while this session's own orbit, x-mod-stash's owner-written `$.state`, holds that ask with its
    // text and his accepted mark: his take-back on the seat board ends it, and a press a forged store aimed here
    // matches no ask of this seat's that he accepted (wisphunter on 15a31816)
    const { value: orbit } = await $.state
        .get(STASH_ORBIT)
        .catch(() => ({ value: undefined }));
    const pressed = pressTicks(text).flatMap((t) => {
        const a = orbit?.asks.find(
            (a) =>
                `herdr:${a.id}` === t.id &&
                a.text === t.text &&
                a.mark === 'accepted',
        );
        if (!a) return [];
        return typeof a.markedAt === 'number'
            ? [{ ...t, markAt: a.markedAt }]
            : [t];
    });
    // x-herdr-deck prunes a press from the file once x-mod-stash has taken it, so his next press there drops it: the
    // accepted mark x-mod-stash kept from it stands for the press, at the time it was marked (wing 1's o13, 19:08)
    const marked = (orbit?.asks ?? []).flatMap((a) =>
        a.mark === 'accepted' &&
        a.isHerdrMark &&
        typeof a.markedAt === 'number' &&
        !pressed.some((t) => t.id === `herdr:${a.id}`) &&
        // a ↩️ there newer than the mark takes it back before x-mod-stash reads it
        !pressedSince(text, a.id, a.markedAt)
            ? pressTicks(
                  JSON.stringify({
                      at: a.markedAt,
                      id: a.id,
                      text: a.text,
                      verdict: 'tick',
                  }),
              )
            : [],
    );
    return [...pressed, ...marked];
}
const pressedSince = (text: string, id: string, at: number) =>
    text.split('\n').some((line) => {
        try {
            const p = JSON.parse(line) as { at?: unknown; id?: unknown };
            return p.id === id && typeof p.at === 'number' && p.at > at;
        } catch {
            return false;
        }
    });
const STASH_ORBIT = { key: 'orbit', plugin: 'x-mod-stash' } as const;
async function tickFor(
    $: EngineInterface,
    scopeOf: string | ((tick: Tick) => string),
    covers: (tick: Tick) => boolean,
    spends: string[],
) {
    const scope = (t: Tick) =>
        typeof scopeOf === 'string' ? scopeOf : scopeOf(t);
    const { value: seatTicks = [] } = await $.state
        .get(TICKS)
        .catch(() => ({ value: [] }));
    const ticks = [...seatTicks, ...(await herdrTicks($))];
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    const keys = (t: Tick) =>
        [t.at, t.markAt]
            .filter((at) => at !== undefined)
            .map((at) => `${t.id}@${at}:${scope(t)}`);
    const tick = [...ticks]
        .reverse()
        .find(
            (t) =>
                now - t.at <= TICK_MS &&
                t.at <= now &&
                covers(t) &&
                !keys(t).some((k) => spent.includes(k) || spends.includes(k)),
        );
    if (tick) spends.push(...keys(tick));
    return tick;
}

const TYPED_BY_DIMA = new Set(['composer', 'bridge']);
// a --bg session's spawn prompt arrives as `composer` and dima's typing there as `bridge` (measured 2026-10-09, FRM-358),
// so in a bg session only the bridge is his
const TYPED_BY_DIMA_IN_BG = new Set(['bridge']);

// a lookup that fails counts as unclean, so the remove asks
async function isCleanTree($: EngineInterface, tree: string) {
    if (await $.fs.exists(`${tree}/.scratch`)) return false;
    const orphans = await $.process
        .run(
            [
                'git',
                'rev-list',
                '-n',
                '1',
                'HEAD',
                '--not',
                '--branches',
                '--remotes',
            ],
            { cwd: tree },
        )
        .catch(() => null);
    return !!orphans && orphans.exitCode === 0 && orphans.stdout.trim() === '';
}

// a job-tmp dir whose real path, or whose repo's git dir, lies outside the real job tmp: a symlink at frame, a worktree
// of frame. A dir not yet made is judged by its nearest ancestor; a lookup that fails counts as outside
async function isTmpEscape($: EngineInterface, dir: string, jobDir: string) {
    const real = async (p: string) =>
        (await $.fs.stat(p, { resolve: true })).realPath ?? p;
    const isInside = (p: string, root: string) =>
        p === root || p.startsWith(`${root}/`);
    try {
        const root = await real(`${jobDir}/tmp`);
        let at = dir;
        while (at !== '/' && !(await $.fs.exists(at)))
            at = at.slice(0, at.lastIndexOf('/')) || '/';
        if (!isInside(await real(at), root)) return true;
        const git = await $.process.run(
            [
                'git',
                '-C',
                at,
                'rev-parse',
                '--path-format=absolute',
                '--git-common-dir',
            ],
            { cwd: at },
        );
        // no repo up from here yet: a `git init` in the tmp makes its own
        return (
            git.exitCode === 0 && !isInside(await real(git.stdout.trim()), root)
        );
    } catch {
        return true;
    }
}

// the herdr closes on the line that end no live seat: herdr names every terminal each one ends, and none carries a
// `seat=` label or runs a claude agent this seat did not start; a terminal that finished ends nothing. a close herdr
// cannot answer for stays out, so it is refused (dima's o53). a clio seat ends any seat but a clio's, and a lead the seat
// it labelled `lead=<its own HC_TERMINAL_ID>` (FRM-574 decided 1; the id herdr set, never a registry name a seat can
// write); a clio seat is ended by none
async function herdrSafeOf($: EngineInterface, command: string, cwd: string) {
    const safe = new Set<string>();
    const closes = commandsDeep(command, cwd).flatMap((c) => {
        const close = herdrCloseOf(c);
        return close?.target &&
            !close.target.includes('$') &&
            ['overlay', 'pane', 'space', 'tab', 'terminal'].includes(
                close.scope,
            )
            ? [close]
            : [];
    });
    if (!closes.length) return safe;
    // an overlay close is safe on what herdr lists open; a mod toggle on a mod not open opens it
    const status = closes.some((c) => c.scope === 'overlay')
        ? await herdrJson($, ['herdr-app', 'status'])
        : undefined;
    const open: unknown[] = Array.isArray(status?.overlays)
        ? status.overlays
        : [];
    for (const close of closes.filter((c) => c.scope === 'overlay'))
        if (
            status &&
            (close.verb === 'herdr-app do mod.open' ||
                open.some(
                    (o) =>
                        o === close.target ||
                        (typeof o === 'object' &&
                            o !== null &&
                            ((o as { id?: unknown }).id === close.target ||
                                (o as { name?: unknown }).name ===
                                    close.target)),
                ))
        )
            safe.add(herdrCloseKey(close));
    const self = await $.env.get('HC_TERMINAL_ID').catch(() => undefined);
    const isClio = await isClioCaller($, self);
    const window = closes.some((c) => c.scope !== 'terminal')
        ? await herdrJson($, ['herdr-app', 'ls'])
        : undefined;
    const { value: made = [] } = await $.state
        .get(TABS_MADE)
        .catch(() => ({ value: [] }));
    for (const close of closes.filter((c) => c.scope !== 'overlay')) {
        const terminals = terminalsOf(close, window, made);
        if (!terminals) continue;
        let isSafe = true;
        for (const t of terminals) {
            const got = await herdrJson($, ['hc', 'get', t, '--json']);
            if (!got) {
                isSafe = false;
                continue;
            }
            if (got.state !== 'live') continue;
            const seat = got.labels?.seat;
            if (isClioSeat(seat)) {
                isSafe = false;
                continue;
            }
            if (isClio || (self !== undefined && got.labels?.lead === self))
                continue;
            if (
                typeof seat === 'string' ||
                (/claude/.test(
                    `${got.status?.app ?? ''} ${got.argv?.[0] ?? ''}`,
                ) &&
                    got.parent !== self)
            )
                isSafe = false;
        }
        if (isSafe) safe.add(herdrCloseKey(close));
    }
    return safe;
}
// this seat's own terminal, as herdr labels it; an env with no terminal, or one herdr cannot read, is no clio
async function isClioCaller($: EngineInterface, self: string | undefined) {
    if (!self) return false;
    const got = await herdrJson($, ['hc', 'get', self, '--json']);
    return got?.state === 'live' && isClioSeat(got.labels?.seat);
}
// the tabs this seat's own tab.new printed (r1, sixth sense's spec read: a mod-only tab closes on its owner's command
// only, so one of dima's mod panels in a tab of its own stays his); a line that echoes a tab id beside a tab.new can
// still claim one, a local guard's limit
const TABS_MADE = { key: 'tabsMade', plugin: 'x-mod-guard' } as const;
async function keepTabsMade(
    $: EngineInterface,
    command: string,
    cwd: string,
    text: unknown,
) {
    if (typeof text !== 'string') return;
    if (!commandsDeep(command, cwd).some(isHerdrTabNew)) return;
    const ids = [...text.matchAll(/"tab":\s*"(tb[0-9a-f]+)"/g)].flatMap((m) =>
        m[1] ? [m[1]] : [],
    );
    if (!ids.length) return;
    const { value: made = [] } = await $.state.get(TABS_MADE);
    await $.state.set(TABS_MADE, [...made, ...ids].slice(-50));
}
type HerdrWindow = {
    spaces?: {
        id?: string;
        tabs?: {
            id?: string;
            terminals?: { pane?: string; terminal?: string }[];
        }[];
    }[];
};
// the terminals a close ends, as the window lists them; undefined when its target is not there
function terminalsOf(
    close: HerdrClose,
    window: HerdrWindow | undefined,
    made: string[] = [],
) {
    if (close.scope === 'terminal')
        return close.target ? [close.target] : undefined;
    const spaces = window?.spaces ?? [];
    const tabs = spaces
        .flatMap((s) =>
            close.scope === 'space' && s.id !== close.target
                ? []
                : (s.tabs ?? []),
        )
        .filter((t) => close.scope !== 'tab' || t.id === close.target);
    const terminals = tabs
        .flatMap((t) => t.terminals ?? [])
        .filter((t) => close.scope !== 'pane' || t.pane === close.target)
        .flatMap((t) => (t.terminal ? [t.terminal] : []));
    // a tab herdr lists with no terminal holds only mods, so its close ends none, the seat's own tab.new tab alone (r1: a
    // pin-probe tab); a pane herdr never lists a mod's, so an empty pane or space stays unnamed
    // only a whole listing counts: a tab with no `terminals` array, or an entry with no terminal id, is unread
    const isWhole = tabs.every(
        (t) =>
            Array.isArray(t.terminals) &&
            t.terminals.every((x) => typeof x.terminal === 'string'),
    );
    const isNamed =
        isWhole &&
        close.scope === 'tab' &&
        tabs.length > 0 &&
        made.includes(close.target ?? '');
    return terminals.length || isNamed ? terminals : undefined;
}
async function herdrJson($: EngineInterface, argv: string[]) {
    const run = await $.process
        .run(argv, { timeoutMs: 3000 })
        .catch(() => undefined);
    if (run?.exitCode !== 0) return undefined;
    try {
        return JSON.parse(run.stdout);
    } catch {
        return undefined;
    }
}

async function rememberHelps($: EngineInterface, clis: string[]) {
    if (!clis.length) return;
    const { value = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    const fresh = clis.filter((c) => !value.includes(c));
    if (fresh.length)
        await $.state.set(HELPED, [...value, ...fresh]).catch(() => undefined);
}

// the off switch: his «operator-override all», bare or «until HH:MM», or the band's 🔓 press. on, the floor warns and
// runs, plain rm and the brake aside. it always ends: at its until, at the end of the session that typed it, or for a
// press with no until PRESS_MS after it
const PRESS_MS = 12 * 60 * 60 * 1000;
async function masterOverride($: EngineInterface) {
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
    if (press?.by !== 'band') return undefined;
    const raw = JSON.parse(await $.fs.read(path)) as OverrideGrants;
    if (raw.prs?.until) return press;
    return (await $.clock.now()) - Date.parse(press.at) < PRESS_MS
        ? press
        : undefined;
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

// the store after his typed ask, and the note the model reads; a write that fails is told, never silent. every flip is one
// log line naming where the words came from, so a seat's typing into a pane shows beside his own
async function overrideFlip(
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
                  : new Date(now + PRESS_MS).toISOString()
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
        : `operator-override prs is on, by ${ask.by}: x lane merge-auto <pr> --apply lands every pr; the brake still stops it`;
}

// x's --brake-check answers the brake, per repo the line may merge in; a failed read reads as braked
const BRAKE_UNREAD = 'the brake did not read, so it reads on';
async function brakeOf($: EngineInterface) {
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

// the disk facts the floor and the hints need, looked up in one round
async function lookUp(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
): Promise<Context> {
    const cleanTrees = new Set<string>();
    for (const tree of removedTrees(command, cwd, ctx))
        if (await isCleanTree($, tree)) cleanTrees.add(tree);
    const helpless = new Set<string>();
    for (const path of helpScripts(command, cwd, ctx)) {
        const source = await $.fs.read(path).catch(() => undefined);
        if (source !== undefined && !/--help|['"]-h['"]/.test(source))
            helpless.add(path);
    }
    const unsafeTmp = new Set<string>();
    if (ctx.jobDir)
        for (const dir of new Set(tmpDirs(command, cwd, ctx)))
            if (await isTmpEscape($, dir, ctx.jobDir)) unsafeTmp.add(dir);
    const { value: helped = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    return {
        cleanTrees,
        helped: new Set(helped),
        helpless,
        herdrSafe: await herdrSafeOf($, command, cwd).catch(
            () => new Set<string>(),
        ),
        unsafeTmp,
    };
}

// what the floor says of one line, judged before anything runs
async function judge($: EngineInterface, typed: string) {
    const { command, notes } = rewrite(typed);
    const cwd = await $.session.cwd();
    const home = await $.env.get('HOME');
    // a failed root reads as no session's, never the cwd a `cd` moved
    const root = await $.session.root().catch(() => '');
    const base: Context = {
        home,
        isClio: isUnder(root, `${home}/frame/_clio`),
        jobDir: await $.env.get('CLAUDE_JOB_DIR'),
    };
    const ctx = { ...base, ...(await lookUp($, command, cwd, base)) };
    const sweep = await stashOver($, command, cwd, ctx);
    const merged = rawMergeRefused(rawMerges(typed, cwd));
    const stops = [
        ...refusals(command, cwd, ctx),
        ...(sweep ? [sweep] : []),
        ...(merged ? [merged] : []),
        ...(releasesBrake(typed, cwd) ? [RELEASE_BRAKE] : []),
    ];
    return { command, ctx, cwd, notes, root, stops };
}

const isRm = (r: Refusal) => r.rule === 'rm';
const isBrake = (r: Refusal) => r.targets.includes('merge-brake');
// a line the judge never finished is read again with no disk fact: plain rm, a raw merge and a brake release in it stay
// refused, whatever the switch says; a line even that read throws on is matched by its words alone
const RM_WORD =
    /(^|[\s;&|(`$/\\'"])(rm|unlink)(['"]?)(\s|$)|\s-delete\b|-exec\s+\S*rm\b/;
const MERGE_WORD = /\bmerge\b|--release-brake|graphql/;
function unjudgedStop(typed: string): Refusal | undefined {
    try {
        const rm = refusals(typed, '/', {}).find(isRm);
        if (rm) return rm;
        const merged = rawMergeRefused(rawMerges(typed, '/'));
        if (merged) return merged;
        return releasesBrake(typed, '/') ? RELEASE_BRAKE : undefined;
    } catch {
        if (RM_WORD.test(typed))
            return {
                door: TRASH,
                rule: 'rm',
                targets: ['rm'],
                why: 'rm deletes for good',
            };
        return MERGE_WORD.test(typed) ? RELEASE_BRAKE : undefined;
    }
}
const JUDGE_MS = 2000;

export const register: Register = (on) => {
    // a Monitor's command is a shell command too
    on('tool.call', { tool: /^(Bash|Monitor)$/ }, async ($, e, next) => {
        // the input is the model's: a command that is not a string is the tool's to refuse
        if (e.tool !== 'Bash' && e.tool !== 'Monitor') return next(e);
        const typed = e.command;
        if (typeof typed !== 'string') return next(e);
        // the off switch is read before any rule, so a rule that breaks can never lock him out
        const master = await masterOverride($).catch(() => undefined);
        const judged = judge($, typed).catch(() => undefined);
        // fail open under the switch: a judge that throws or hangs past JUDGE_MS lets the line run with a warn
        const verdict = master
            ? await Promise.race([
                  judged,
                  $.clock.sleep(JUDGE_MS).then(() => undefined),
              ])
            : await judged;
        if (!verdict) {
            if (!master) return { deny: FAILED };
            const stop = unjudgedStop(typed);
            if (stop)
                return {
                    deny: `nothing in this command ran — x-mod-guard stopped this one command. instead: ${stop.door}. why: the guard's check failed, and ${stop.rule === 'rm' ? 'plain rm' : 'a merge, which the brake may hold,'} stays refused under operator-override`,
                };
            await overrideLogPass(
                $,
                master,
                `let through unjudged: ${typed}`,
            ).catch(() => undefined);
            return withContext(await next(e), [
                'x-mod-guard: its check failed or ran out of time, and operator-override is on, so this ran unchecked',
            ]);
        }
        const { command, ctx, cwd, notes, root, stops } = verdict;
        // a worktree session whose shell `cd`ed out (`cd ~/frame && …`) reads its own tree's door beside the refusal
        const drift =
            root.includes('/.claude/worktrees/') &&
            cwd !== root &&
            !cwd.startsWith(`${root}/`)
                ? `this worktree session's shell left its tree for ${cwd}: cd ${root}, or EnterWorktree(path: "${root}")`
                : undefined;
        const refuse = async (r: Refusal, text = message(r)) => {
            await record($, {
                command,
                door: r.door,
                kind: 'refused',
                rule: r.rule,
                target: r.targets[0] ?? '',
                why: r.why,
            });
            return { deny: drift ? `${text} — ${drift}` : text };
        };
        const spends: string[] = [];
        const warns: string[] = [];
        let run = command;
        if (stops.length) {
            const rm = stops.find(isRm);
            if (rm) return refuse(rm);
            const whole = master
                ? undefined
                : await tickFor(
                      $,
                      guardedOf(command),
                      quotesCommand(command),
                      spends,
                  );
            // his tick on one command of a longer line passes that one when the rest of the line meets no floor rule; a
            // pipe it feeds runs with pipefail, so a failed run reads as failed and keeps his tick (FRM-574 decided 2 and 7)
            const spanOf = (t: Tick) =>
                t.targets.find((q) => tickedRest(command, q.trim()));
            // a stash sweep or a brake release on the line is judged whole, never past a tick on another part of it
            const inLine =
                master ||
                whole ||
                stops.some((r) => r.rule === 'stash-sweep' || isBrake(r))
                    ? undefined
                    : await tickFor(
                          $,
                          (t) => guardedOf(spanOf(t) ?? ''),
                          (t) => {
                              const q = spanOf(t);
                              const swap = q && tickedRest(command, q.trim());
                              return (
                                  !!swap &&
                                  !refusals(swap.rest, cwd, ctx).length &&
                                  !rawMerges(swap.rest, cwd).length
                              );
                          },
                          spends,
                      );
            const tick = whole ?? inLine;
            if (
                inLine &&
                tickedRest(command, spanOf(inLine)?.trim() ?? '')?.isPiped
            ) {
                run = `set -o pipefail; ${command}`;
                notes.push(
                    "set -o pipefail first, so the ticked command's own exit is the one read and a failed run keeps dima's tick",
                );
            }
            if (master && stops.some(isBrake))
                return refuse(
                    stops.find(isBrake) ?? RELEASE_BRAKE,
                    `nothing in this command ran — x-mod-guard stopped this one command. instead: ${RELEASE_BRAKE.door}. why: ${RELEASE_BRAKE.why}, and operator-override never takes it off`,
                );
            if (!master && !tick) {
                const [first] = stops;
                if (first) return refuse(first);
            }
            // his tick or the switch opens a raw merge, never past a brake that reads on
            if (stops.some((r) => r.rule === 'raw-merge' && !isBrake(r))) {
                const brake = await brakeOf($);
                if (brake)
                    return refuse(
                        RELEASE_BRAKE,
                        `nothing in this command ran — x-mod-guard stopped this one command. instead: ${RELEASE_BRAKE.door}. why: ${brake}`,
                    );
            }
            const rules = [...new Set(stops.map((r) => r.rule))].join(', ');
            const targets = stops.flatMap((r) => r.targets).join(', ');
            await record($, {
                command,
                door: master
                    ? `operator-override ${master.scope}, by ${master.by} at ${master.at}`
                    : `dima's tick on ${tick?.id}`,
                kind: master ? 'warned' : 'escaped',
                rule: rules,
                target: targets,
                why: master
                    ? stops.map((r) => r.why).join('; ')
                    : (tick?.text ?? ''),
            });
            if (master) {
                await overrideLogPass(
                    $,
                    master,
                    `let through: ${command}`,
                ).catch(() => undefined);
                warns.push(
                    `x-mod-guard: operator-override is on, so this ran past the floor (rule ${rules}): ${stops.map((r) => r.why).join('; ')}`,
                );
            } else
                $.ui.log(
                    `x-mod-guard: ran on dima's tick ${tick?.id}: ${targets}`,
                );
        }
        // a spend lives as long as its tick, never a count: the 51st spend once revived the 1st's word
        if (spends.length) {
            const { value: spent = [] } = await $.state.get(SPENT);
            const now = await $.clock.now();
            await $.state.set(SPENT, [
                ...spent.filter((k) => now - spentAt(k) <= TICK_MS),
                ...spends,
            ]);
        }
        const result = await next(run !== typed ? { ...e, command: run } : e);
        // a call that failed never spends his word: the retry passes on it
        if ((result.deny !== undefined || result.isError) && spends.length) {
            const { value: held = [] } = await $.state.get(SPENT);
            await $.state.set(
                SPENT,
                held.filter((k) => !spends.includes(k)),
            );
        }
        if (result.deny !== undefined)
            return {
                deny: ISOLATED.test(result.deny)
                    ? `${result.deny} — ${ISOLATED_DOOR}`
                    : result.deny,
            };
        if (!result.isError)
            await keepTabsMade($, typed, cwd, result.text).catch(
                () => undefined,
            );
        const isQuiet = await isSilent($, ctx.home);
        // a quiet session spends no verb hint it never showed
        await rememberHelps($, [
            ...bareHelps(command, cwd),
            ...(isQuiet ? [] : verbHelps(command, cwd, ctx)),
        ]);
        return withContext(result, [
            ...(notes.length && !isQuiet
                ? [
                      `x-mod-guard rewrote this call before it ran: ${notes.join('; ')}. it ran: ${run}`,
                  ]
                : []),
            ...warns,
            ...(drift && result.isError ? [drift] : []),
            ...(isQuiet
                ? []
                : await oncePrHint(
                      $,
                      hints(command, cwd, {
                          ...ctx,
                          isForeground:
                              e.tool === 'Bash' && e.run_in_background !== true,
                      }),
                  )),
        ]);
    });

    on('prompt.submit', async ($, e, next) => {
        await $.state.set(IMAGES, 0).catch(() => undefined);
        const ask = overrideAsked(e.text);
        let note: string | undefined;
        if (ask && TYPED_BY_DIMA.has(e.origin.kind)) {
            const sid = await $.session.id().catch(() => undefined);
            const entry = sid
                ? await registryEntry($, sid).catch(() => undefined)
                : undefined;
            // a bg session's spawn prompt arrives as `composer`, so there only the bridge is his; no registry row reads
            // as not his, said out loud, since a word that moved nothing must not pass for one that did
            const isHis =
                entry &&
                (entry.isBg ? TYPED_BY_DIMA_IN_BG : TYPED_BY_DIMA).has(
                    e.origin.kind,
                );
            note = !entry
                ? "operator-override: this session's registry row did not read, so the switch did not move; type it in a session that reads"
                : isHis
                  ? await overrideFlip($, ask, {
                        origin: e.origin.kind,
                        pid: entry.pid,
                        sid: sid ?? '',
                    }).catch(
                        (err: unknown) =>
                            `operator-override: the switch did not move: ${String(err)}`,
                    )
                  : undefined;
        }
        const sent = await next(e);
        return note === undefined || sent.drop !== undefined
            ? sent
            : { ...sent, context: [...(sent.context ?? []), note] };
    });

    on(
        'tool.call',
        { tool: /^(Edit|Write|MultiEdit)$/ },
        async ($, e, next) => {
            const result = await next(e);
            const path = 'file_path' in e ? e.file_path : undefined;
            if (
                result.deny !== undefined ||
                typeof path !== 'string' ||
                !CODE_FILE.test(path)
            )
                return result;
            try {
                const home = await $.env.get('HOME');
                // the session's root, never its cwd: a clio cd'd into ~/frame is still clio, codie cd'd into clio is not
                const root = await $.session.root().catch(() => '');
                if (!isUnder(root, `${home}/frame/_clio`)) return result;
                const n = ((await $.state.get(EDITS)).value ?? 0) + 1;
                await $.state.set(EDITS, n);
                if (n !== EDIT_LIMIT || (await isSilent($, home)))
                    return result;
                return {
                    ...result,
                    context: [...(result.context ?? []), DELEGATE_NOTE],
                };
            } catch {
                return result;
            }
        },
    );

    on('tool.call', { tool: 'Read' }, async ($, e, next) => {
        const result = await next(e);
        const path = 'file_path' in e ? e.file_path : undefined;
        if (
            result.deny !== undefined ||
            e.agentId !== undefined ||
            typeof path !== 'string' ||
            !IMAGE_FILE.test(path)
        )
            return result;
        try {
            const home = await $.env.get('HOME');
            const root = await $.session.root().catch(() => '');
            if (!isUnder(root, `${home}/frame/_clio`)) return result;
            const n = ((await $.state.get(IMAGES)).value ?? 0) + 1;
            await $.state.set(IMAGES, n);
            if (n !== IMAGE_LIMIT || (await isSilent($, home))) return result;
            return {
                ...result,
                context: [...(result.context ?? []), IMAGE_NOTE],
            };
        } catch {
            return result;
        }
    });
};
