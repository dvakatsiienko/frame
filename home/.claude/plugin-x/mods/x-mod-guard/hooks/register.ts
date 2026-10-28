import type { EngineInterface, Register } from 'claude-code';

import { briefPaths } from './rules/brief.ts';
import type { Brief, Context, Refusal } from './rules/command.ts';
import { stashSweep, stashSweeps } from './rules/floor.ts';
import { trashedPaths } from './rules/hazard.ts';
import { bareHelps, helpScripts, hints, verbHelps } from './rules/hint.ts';
import { projectMoves } from './rules/milestone.ts';
import { hasNotes, notedKey, notesEdits } from './rules/notes.ts';
import { overwrittenPaths, writtenPaths } from './rules/overwrite.ts';
import { rewrite } from './rules/rewrite.ts';
import { SPEC_DOOR, SPEC_WHY, TO_MEMBER, isSpecMissing } from './rules/spec.ts';
import {
    addedPaths,
    check,
    foregroundClaude,
    installDirs,
    isSignAsk,
    mergeAutoCall,
    mergeAutoPr,
    mergeAutoRepo,
    mergeWord,
    message,
    namesWhole,
    quotesPr,
    rawLinear,
    rawPluginUpdate,
    refusals,
    remoteSlug,
    removedTrees,
    signWord,
    withDimaOk,
} from './rules.ts';

// x-mod-guard: every Bash call is read before it runs; a floor command or a hazard shape is refused with its door.
// each refusal and each escape is kept in $.store as one `event:` key, with per-day counts a halt reads.

export type GuardEvent = {
    at: number;
    sid: string;
    name?: string;
    command: string;
    // warned: a warn-only rule fired and the call ran
    kind: 'refused' | 'escaped' | 'warned';
    door: string;
    target: string;
    // why it was refused, the line x-mod-stash shows unfolded; an escape names every rule it stepped past
    why: string;
    // the rule that fired; an escape names every rule it stepped past, comma-joined
    rule: string;
};

type Tally = { refused: number; escaped: number; warned?: number };
// what `x linear api` prints for PROJECTS_QUERY
type ProjectsReply = {
    data?: {
        projects?: {
            nodes?: {
                id: string;
                name: string;
                slugId: string;
                projectMilestones: { nodes: unknown[] };
            }[];
        };
    };
};
// rules: the same tally split by the rule that fired, so noise and real catches separate
export type DayCount = Tally & { rules?: Record<string, Tally> };

const EVENT = 'event:';
const KEEP = 50;
const DAY = 'day:';
const DAYS = 30;
const SHOWN = 160;
// a cclio session's own code edits: the 8th gets one note that a bigger job belongs to a helper
const CODE_FILE = /\.(ts|tsx|go|sh|py|swift)$/;
const EDITS = { key: 'edits', plugin: 'x-mod-guard' } as const;
const EDIT_LIMIT = 8;
const DELEGATE_NOTE =
    "x-mod-guard: 8 code edits in this cclio session — a bigger job goes to a helper (~137k base) instead of this thread's context";
const FAILED =
    'x-mod-guard: the check failed or ran out of time, so this call is refused (fail closed). retry it once; if it repeats, tell cclio';
// a fork carries the whole parent context; the line says what of it the fork needs
const WHY_FORK = /^\s*why-fork:\s*\S/m;
const FORK_DOOR =
    'a fresh agent with a self-contained brief, or helper for a mechanical job';
const FORK_WHY = 'a fork carries the whole parent context (~220k tokens)';
const FORK_REFUSED = `x-mod-guard stopped this fork. instead: ${FORK_DOOR}. why: ${FORK_WHY}. a fork that truly needs that context says so in a prompt line: why-fork: <what parent context it needs>`;
// an Agent prompt naming a ticket id, a backticked path or file, or one of matt's skills is a brief (FRM-392); the id
// shape copies brief.go's ticketID, which a mod cannot import. a SendMessage is never checked: reports name skills and
// example paths on purpose, and the verifier's verdict was refused three times live (13:40)
const BRIEF_SIGN =
    /\b(?:FRM|BYT|DOT)-\d+\b|`[^`\n]*\/[^`\n]*`|`[\w.@~-]+\.[a-z]{1,5}`|\bmattpocock-skills:|\bmatt's `?[a-z]/;
// of x brief check's findings only a missing path and a skill's user quiz refuse; a quoted code term is a message's own
const BRIEF_REFUSES = /^line \d+: (?:path|quiz) .+$/gm;
// a relative path the session's repo lacks may live in another repo, which an absolute or ~/ path names (dima's o66)
const RELATIVE_MISS = /^line \d+: path (?![/~])/;

// the findings that stop a brief, or none; it throws when x breaks, and the spawn goes then (fail open, unlike the
// floor): this runs on every Agent of every session, cclio's included
async function briefFindings($: EngineInterface, text: string) {
    if (!BRIEF_SIGN.test(text)) return [];
    const repo = await $.session.root().catch(() => $.session.cwd());
    const run = await $.process.run(
        ['x', 'brief', 'check', '/dev/stdin', '--repo', repo, '--json'],
        { stdin: text, timeoutMs: 8000 },
    );
    const out = JSON.parse(run.stdout) as { error?: unknown };
    return typeof out.error === 'string'
        ? (out.error.match(BRIEF_REFUSES) ?? [])
        : [];
}

// what x brief check stamps: sha256 over the file's raw bytes, under $X_STATE or ~/.local/state/x (x/go/brief.go)
async function readBrief(
    $: EngineInterface,
    path: string,
    home: string | undefined,
): Promise<Brief> {
    const { base64 } = await $.fs.read(path, { as: 'bytes' });
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
    const sum = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    ]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const state = (await $.env.get('X_STATE')) || `${home}/.local/state/x`;
    return {
        isCoder: new TextDecoder().decode(bytes).includes('/x:crew-coder'),
        isStamped: await $.fs.exists(`${state}/briefs/${sum}.json`),
    };
}

// the dir a repo's `backlog.config.yml` names as `backlog_directory` (cclio's pocket: `pocket`), else none
async function backlogDir($: EngineInterface, dir: string) {
    const config = await $.fs.read(`${dir}/backlog.config.yml`).catch(() => '');
    return config
        .match(/^backlog_directory:\s*["']?([^"'#\n]+?)["']?\s*(#.*)?$/m)?.[1]
        ?.trim();
}

// backlog finds its project from the root up; a task file is `<id> - <title>.md` under the configured dir's `tasks`,
// else `.backlog/tasks` or `backlog/tasks`
async function isTaskNoted(
    $: EngineInterface,
    root: string,
    id: string,
    home: string | undefined,
) {
    const prefix = `${id.toLowerCase()} - `;
    for (let dir = root; dir && dir !== '/' && dir !== home; ) {
        const configured = await backlogDir($, dir);
        const dirs = configured
            ? [`${dir}/${configured}/tasks`]
            : [`${dir}/.backlog/tasks`, `${dir}/backlog/tasks`];
        for (const tasks of dirs) {
            const names = await $.fs.list(tasks).catch(() => undefined);
            if (!names) continue;
            const file = names.find((n) =>
                n.name.toLowerCase().startsWith(prefix),
            );
            if (!file) return false;
            return hasNotes(await $.fs.read(`${tasks}/${file.name}`));
        }
        dir = dir.slice(0, dir.lastIndexOf('/'));
    }
    return false;
}

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
            };
            if (v.sessionId === sid)
                return {
                    isBg: v.kind === 'bg',
                    name: typeof v.name === 'string' ? v.name : undefined,
                };
        } catch {}
    }
    return undefined;
}

async function sessionName($: EngineInterface, sid: string) {
    return (await registryEntry($, sid))?.name;
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
        command: line.length > SHOWN ? `${line.slice(0, SHOWN)}…` : line,
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

// a new refusing rule ships warn-only: the call runs and the model reads what would have been refused, until the rule's
// verifier says clean and it leaves this set (dima's o70, after FRM-392's guard refused plain reports live)
const WARN_ONLY: ReadonlySet<string> = new Set([
    'frozen-lockfile',
    'raw-plugin-update',
]);
// the store's `rule-mode:<rule>` = «enforce» turns a listed rule on early; nothing in the store can make a rule warn —
// any session writes that store, and a «warn» there switched the floor off for every session (verifier, 15:08)
async function isWarnOnly($: EngineInterface, rule: string) {
    if (!WARN_ONLY.has(rule)) return false;
    return (
        (await $.store.get(`rule-mode:${rule}`).catch(() => undefined)) !==
        'enforce'
    );
}
const wouldRefuse = (rule: string, text: string) =>
    `x-mod-guard would refuse this (rule ${rule}, warn-only until its verifier says clean): ${text}`;

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

// twin dirname — a copy lives in x-mod-holds; the twins lint keeps them equal
const dirname = (file: string) => file.slice(0, file.lastIndexOf('/')) || '/';
// twin end

// twin real-path — a copy lives in x-mod-holds; the twins lint keeps them equal
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
// twin end

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
    const live: { holder: string; hold: Hold; key: string; now: number }[] = [];
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
        live.push({ hold, holder, key: key.slice(cut + 1), now });
    }
    return live;
}

async function heldBy(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
): Promise<string | undefined> {
    const paths = writtenPaths(command, cwd, ctx);
    if (!paths.length) return undefined;
    const live = await liveHolds($, ctx);
    for (const path of paths) {
        const real = await realPath($, path);
        const found = live.find((l) => l.key === real.key);
        if (!found) continue;
        const mins = Math.round((found.now - found.hold.at) / 60000);
        return `x-mod-holds: ${path} is held by session ${found.holder.slice(0, 8)}, which took it ${mins} min ago. wait, or ask it to commit the file.`;
    }
    return undefined;
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

const isUnder = (path: string, dir: string) =>
    path === dir || path.startsWith(`${dir}/`);

const SEEN = { key: 'seen', plugin: 'x-mod-guard' } as const;
// dima's last prompt typed at the composer or sent over the bridge: a peer's message, a notification, a plugin's or an
// sdk turn never lands here, and only this plugin writes $.state, so no tool call can forge it
const PROMPT = { key: 'prompt', plugin: 'x-mod-guard' } as const;
const HELPED = { key: 'helped', plugin: 'x-mod-guard' } as const;
const IMAGES = { key: 'images', plugin: 'x-mod-guard' } as const;
// cc core refuses a worktree command naming git where it cannot prove the git stays in the tree — a heredoc body, a
// `gh api` path — and no hook may override it (dima's o26); its refusal leaves with the door (fleet-hazards § the bash sandbox)
const ISOLATED = /^This (session|agent) is isolated in the worktree /;
const ISOLATED_DOOR =
    'x-mod-guard: write the command into a scratch script ($CLAUDE_JOB_DIR/tmp or the session scratchpad) and run that script by path; git itself goes through `x lane <verb>`';
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|heic|bmp|tiff?)$/i;
const IMAGE_LIMIT = 3;
// screenshots read for their data go to helper-lite (PK-148); cclio reads them herself and pays for each
const IMAGE_NOTE = `x-mod-guard: ${IMAGE_LIMIT} image Reads this turn — screenshots read for their data go to \`helper-lite\` cards, ≤20 a batch, transcribed to text (\`rules/fleet-tooling.md\`)`;
// dima's ticks: x-mod-stash writes them into its own $.state from his 🛎️ press alone, and any plugin reads another's
// value while only its owner writes it — so no Bash, Edit, Write or orbit op can forge one, and it is this session's
// own (FRM-427); a tick still in its sending window is not his word yet
const TICKS = { key: 'ticks', plugin: 'x-mod-stash' } as const;
const SPENT = { key: 'spent', plugin: 'x-mod-guard' } as const;
// a tick counts for 2 h after its sending window: a yes for this afternoon's push never unlocks tonight's (dima's o2)
const TICK_MS = 2 * 60 * 60 * 1000;
// a tick is spent per use: `scope` names what it authorized (a command, a pr, a sign), so one ask quoting a guarded
// command and a pr carries both once
// the ask quotes the whole guarded command in one backtick span, spacing aside, never only a target its refusal names
// (dima's tick on the verifier's ask, 2026-10-28: `git push origin main` never unlocks `git push --mirror origin`)
const spaced = (text: string) => text.trim().replace(/\s+/g, ' ');
const guardedOf = (command: string) =>
    spaced(command.replace(/\s#\s*dima-ok:.*$/, ''));
const quotesCommand = (command: string) => (t: Tick) =>
    t.targets.some((q) => spaced(q) === guardedOf(command));
type Tick = { id: string; text: string; targets: string[]; at: number };
async function tickFor(
    $: EngineInterface,
    scope: string,
    covers: (tick: Tick) => boolean,
) {
    const { value: ticks = [] } = await $.state
        .get(TICKS)
        .catch(() => ({ value: [] }));
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    const tick = [...ticks]
        .reverse()
        .find(
            (t) =>
                t.at <= now &&
                now - t.at <= TICK_MS &&
                !spent.includes(`${t.id}@${t.at}:${scope}`) &&
                covers(t),
        );
    if (tick)
        await $.state.set(
            SPENT,
            [...spent, `${tick.id}@${tick.at}:${scope}`].slice(-50),
        );
    return tick;
}
// the github slug merge-auto reads when no --repo names one: the dir's origin, as x/go/gh.go repoOf does
async function repoOf($: EngineInterface, dir: string) {
    const r = await $.process
        .run(['git', '-C', dir, 'remote', 'get-url', 'origin'])
        .catch(() => undefined);
    return r?.exitCode === 0 ? remoteSlug(r.stdout) : undefined;
}
const TYPED_BY_DIMA = new Set(['composer', 'bridge']);
// a --bg session's spawn prompt arrives as `composer` and dima's typing there as `bridge` (measured 2026-10-09, FRM-358),
// so in a bg session only the bridge is his
const TYPED_BY_DIMA_IN_BG = new Set(['bridge']);
const UNPROVEN_DOOR =
    'ask dima; his own next prompt naming each target as a word lets the # dima-ok marker through (a bare symbol like . or & only as «dima-ok: <target>»). a bg session counts only what dima types into it himself; ask cclio to get him there';
const UNPROVEN_WHY =
    "a # dima-ok marker counts only when dima's last typed prompt names its target";
// a live mod's hooks reload into every session on save, so while its own tests are red a half-done edit there breaks the fleet
// (FRM-350: Bash down fleet-wide for ~5 min); the fix goes through a scratch copy and lands only once it is green
const LIVE_RED_DOOR =
    'edit a scratch copy: `x mods edit pull <file>`, then `x mods edit push`, which lands it only when the mod validates and tests green';

// the live mod dir a path sits under `hooks/` of, from CLAUDE_CODE_PLUGIN_DIRS; real paths on both sides, so a symlinked
// route into the tree counts too
async function liveModOf($: EngineInterface, path: string) {
    const home = await $.env.get('HOME');
    const dirs = (await $.env.get('CLAUDE_CODE_PLUGIN_DIRS')) ?? '';
    const real = async (p: string) =>
        $.fs.stat(p, { resolve: true }).then(
            (s) => s.realPath ?? p,
            () => p,
        );
    const file = await real(path);
    for (const entry of dirs.split(':').filter(Boolean)) {
        const dir = entry.replace(/^~(?=\/|$)/, home ?? '~');
        if (file.startsWith(`${await real(dir)}/hooks/`)) return dir;
    }
    return undefined;
}

// every prompt's origin and fields, the last 20 across sessions, so a probe reads what a session really saw (FRM-358):
// whether dima's typing can be told from a machine's is a measurement, never a guess from the types
const ORIGINS = 'origins';
async function logOrigin(
    $: EngineInterface,
    e: {
        text: string;
        origin: { kind: string };
        turnId?: string;
        wait: boolean;
        attachments?: readonly unknown[];
        context?: readonly string[];
    },
) {
    const was = ((await $.store.get(ORIGINS)) ?? []) as {
        text?: string;
    }[];
    // whole code points, and no half pair left from an older cut: a lone surrogate leaves the store file unreadable to jq
    const whole = (s: string) =>
        [...s].filter((c) => c.length === 2 || !/[\ud800-\udfff]/.test(c));
    const head = (s: string) => whole(s).slice(0, 80).join('');
    const row = {
        at: await $.clock.now(),
        attachments: e.attachments?.length ?? 0,
        context: e.context?.map(head),
        origin: e.origin,
        sid: await $.session.id().catch(() => undefined),
        text: head(e.text),
        turnId: e.turnId,
        wait: e.wait,
    };
    // a row an older build cut mid-pair is mended on the next write
    const kept = was.map((r) =>
        typeof r.text === 'string' ? { ...r, text: head(r.text) } : r,
    );
    await $.store.set(ORIGINS, [row, ...kept].slice(0, 20));
}

const UNREAD_DOOR = 'Read the file first, then Write';
const UNREAD_WHY = 'a Write replaces a tracked file this session never read';

async function isTracked($: EngineInterface, path: string) {
    if (!(await $.fs.exists(path))) return false;
    const cut = path.lastIndexOf('/');
    // a slow or locked repo fails open on this lookup only: the Write runs as cc would run it
    const ls = await $.process
        .run(
            ['git', 'ls-files', '--error-unmatch', '--', path.slice(cut + 1)],
            { cwd: path.slice(0, cut) || '/' },
        )
        .catch(() => null);
    return ls?.exitCode === 0;
}

// a tree cclio may drop unasked: no `.scratch/` plan inside, and every commit its HEAD reaches is on a branch;
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

// a manifest the working tree changed since HEAD: `CI=1 pnpm install` would freeze the lockfile against it
async function isManifestChanged($: EngineInterface, dir: string) {
    const r = await $.process
        .run(['git', 'diff', '--name-only', 'HEAD'], { cwd: dir })
        .catch(() => null);
    if (!r || r.exitCode !== 0) return false;
    return r.stdout
        .split('\n')
        .some((f) =>
            /(^|\/)(package\.json|pnpm-workspace\.yaml)$/.test(f.trim()),
        );
}

// parallel Reads in one step each add their path: a write that lost the race reads again
async function markSeen($: EngineInterface, path: string) {
    for (let tries = 0; tries < 3; tries++) {
        const { value = [], version } = await $.state.get(SEEN);
        if (value.includes(path)) return;
        const { isSet } = await $.state.set(SEEN, [...value, path], {
            ifVersion: version,
        });
        if (isSet) return;
    }
}

// the disk facts the pure rules need, looked up in one round: each rule names the paths it asks about, this answers
// them; a rule that needs a new fact adds its question here and its field to Context
async function lookUp(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
): Promise<Context> {
    const missing = new Set<string>();
    for (const path of addedPaths(command, cwd, ctx))
        if (!(await $.fs.exists(path))) missing.add(path);
    const kinds: NonNullable<Context['kinds']> = new Map();
    for (const path of [
        ...overwrittenPaths(command, cwd, ctx),
        ...trashedPaths(command, cwd, ctx),
    ])
        if (await $.fs.exists(path))
            kinds.set(path, (await $.fs.stat(path)).kind);
    const cleanTrees = new Set<string>();
    for (const tree of removedTrees(command, cwd, ctx))
        if (await isCleanTree($, tree)) cleanTrees.add(tree);
    const briefs = new Map<string, Brief>();
    for (const path of briefPaths(command, cwd, ctx))
        if (await $.fs.exists(path))
            briefs.set(path, await readBrief($, path, ctx.home));
    const manifestDirs = new Set<string>();
    for (const dir of installDirs(command, cwd, ctx))
        if (await isManifestChanged($, dir)) manifestDirs.add(dir);
    const notedTasks = new Set<string>();
    for (const edit of notesEdits(command, cwd, ctx))
        if (await isTaskNoted($, edit.root, edit.id, ctx.home))
            notedTasks.add(notedKey(edit));
    const helpless = new Set<string>();
    for (const path of helpScripts(command, cwd, ctx)) {
        const source = await $.fs.read(path).catch(() => undefined);
        if (source !== undefined && !/--help|['"]-h['"]/.test(source))
            helpless.add(path);
    }
    const { value: helped = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    const moves = projectMoves(command, cwd);
    const milestoneProjects = moves.length
        ? await projectsWithMilestones($).catch(() => undefined)
        : undefined;
    return {
        briefs,
        cleanTrees,
        helped: new Set(helped),
        helpless,
        kinds,
        manifestDirs,
        milestoneProjects,
        milestoneUnread:
            moves.length && !milestoneProjects
                ? moves.map((m) => m.project)
                : [],
        missing,
        notedTasks,
    };
}

// the projects that hold milestones, read from linear once a day; it throws when linear cannot be read, and the call
// then runs with a warn (fail open, like pocket-check's closed-ticket net)
const MILESTONES = 'linear-milestones';
const DAY_MS = 86_400_000;
const PROJECTS_QUERY =
    '{ projects(first: 250) { nodes { id name slugId projectMilestones(first: 1) { nodes { id } } } } }';
async function projectsWithMilestones($: EngineInterface) {
    const now = await $.clock.now();
    const kept = (await $.store.get(MILESTONES).catch(() => undefined)) as
        | { at: number; keys: string[] }
        | undefined;
    if (kept && now - kept.at < DAY_MS) return new Set(kept.keys);
    const run = await $.process.run(['x', 'linear', 'api', PROJECTS_QUERY], {
        timeoutMs: 8000,
    });
    if (run.exitCode !== 0) throw new Error(run.stderr);
    const nodes = (JSON.parse(run.stdout) as ProjectsReply).data?.projects
        ?.nodes;
    if (!nodes) throw new Error('linear sent no projects');
    const keys = nodes
        .filter((n) => n.projectMilestones.nodes.length)
        .flatMap((n) => [n.id, n.name, n.slugId].map((k) => k.toLowerCase()));
    await $.store.set(MILESTONES, { at: now, keys });
    return new Set(keys);
}
const milestoneSkipped = (projects: string[]) =>
    `x-mod-guard: the milestone check was skipped — linear could not be read, so whether ${projects.join(', ')} holds milestones is unknown; name --milestone if it does`;

async function rememberHelps($: EngineInterface, clis: string[]) {
    if (!clis.length) return;
    const { value = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    const fresh = clis.filter((c) => !value.includes(c));
    if (fresh.length)
        await $.state.set(HELPED, [...value, ...fresh]).catch(() => undefined);
}

export const register: Register = (on) => {
    // a Monitor's command is a shell command too
    on('tool.call', { tool: /^(Bash|Monitor)$/ }, async ($, e, next) => {
        // the input is the model's: a command that is not a string is the tool's to refuse
        if (e.tool !== 'Bash' && e.tool !== 'Monitor') return next(e);
        const typed = e.command;
        if (typeof typed !== 'string') return next(e);
        // a shape with one right spelling is fixed, then the fixed command is what every rule reads
        const { command, notes } = rewrite(typed);
        const cwd = await $.session.cwd();
        const home = await $.env.get('HOME');
        const root = await $.session.root().catch(() => cwd);
        const ctx: Context = {
            home,
            isCclio: isUnder(root, `${home}/frame/cclio`),
            jobDir: await $.env.get('CLAUDE_JOB_DIR'),
        };
        const facts = await lookUp($, command, cwd, ctx);
        const verdict = check(command, cwd, { ...ctx, ...facts });
        // a worktree session whose shell `cd`ed out (`cd ~/frame && …`) is refused for the wrong tree; the root still names its own
        const drift =
            root.includes('/.claude/worktrees/') &&
            cwd !== root &&
            !cwd.startsWith(`${root}/`)
                ? `this worktree session's shell left its tree for ${cwd}: cd ${root}, or EnterWorktree(path: "${root}")`
                : undefined;
        const deny = (text: string) => ({
            deny: drift ? `${text} — ${drift}` : text,
        });
        // the model typed the old command: it is told what changed, or it reads a surprise
        const go = async (run = command) => {
            const result = await next(
                run !== typed ? { ...e, command: run } : e,
            );
            if (result.deny !== undefined)
                return deny(
                    ISOLATED.test(result.deny)
                        ? `${result.deny} — ${ISOLATED_DOOR}`
                        : result.deny,
                );
            const isQuiet = await isSilent($, ctx.home);
            // a quiet session spends no verb hint it never showed
            await rememberHelps($, [
                ...bareHelps(run, cwd),
                ...(isQuiet
                    ? []
                    : verbHelps(command, cwd, { ...ctx, ...facts })),
            ]);
            const context = [
                ...(notes.length && !isQuiet
                    ? [
                          `x-mod-guard rewrote this call before it ran: ${notes.join('; ')}. it ran: ${run}`,
                      ]
                    : []),
                ...(drift && result.isError ? [drift] : []),
                ...(facts.milestoneUnread?.length
                    ? [milestoneSkipped(facts.milestoneUnread)]
                    : []),
                ...(isQuiet ? [] : hints(command, cwd, { ...ctx, ...facts })),
            ];
            if (!context.length) return result;
            return {
                ...result,
                context: [...(result.context ?? []), ...context],
            };
        };
        // every Bash refusal goes through here: recorded, then refused — or, for a rule in WARN_ONLY, run with the
        // would-refuse note the model reads
        const enforce = async (
            r: Pick<Refusal, 'door' | 'rule' | 'targets' | 'why'>,
            denial: string,
            note = denial,
        ) => {
            const isWarn = await isWarnOnly($, r.rule);
            await record($, {
                command,
                door: r.door,
                kind: isWarn ? 'warned' : 'refused',
                rule: r.rule,
                target: r.targets[0] ?? '',
                why: r.why,
            });
            if (!isWarn) return deny(denial);
            const ran = await go();
            return ran.deny !== undefined
                ? ran
                : {
                      ...ran,
                      context: [
                          ...(ran.context ?? []),
                          wouldRefuse(r.rule, note),
                      ],
                  };
        };
        // a file another live session holds (x-mod-holds) is refused before any other rule; holds has no escape
        const held = await heldBy($, command, cwd, ctx).catch(() => undefined);
        if (held) return deny(held);
        const sweep = await stashOver($, command, cwd, ctx).catch(
            () => undefined,
        );
        if (sweep)
            return enforce(
                sweep,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${sweep.door}. why: ${sweep.why}.`,
                `instead: ${sweep.door}. why: ${sweep.why}`,
            );
        // a refusal, never a warning, so it stays out of WARN_ONLY: a warn would fire after the block it means to
        // prevent (dima's o102)
        const fg =
            e.tool === 'Bash' && e.run_in_background !== true
                ? foregroundClaude(command, cwd)
                : undefined;
        if (fg)
            return enforce(
                fg,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${fg.door}. why: ${fg.why}.`,
            );
        // a member's raw linear read or comment, as typed (before the api rewrite), names its x linear door; cclio's runs (FRM-398)
        const raw = rawLinear(typed, cwd);
        if (raw) {
            const sid = await $.session.id().catch(() => undefined);
            const name = sid ? await sessionName($, sid) : undefined;
            if (
                name !== undefined &&
                name.replaceAll(/[\s\u200d]/g, '') !== '🦉cclio'
            ) {
                const said = `x-mod-guard stopped this one command. instead: ${raw.door}. why: ${raw.why}.`;
                return enforce(
                    raw,
                    `nothing in this command ran — ${said}`,
                    said,
                );
            }
        }
        // a raw plugin update names x plugin bump, every session's door (FRM-389 exit 7); warn-only until its verifier
        const bump = rawPluginUpdate(typed, cwd);
        if (bump) {
            const said = `x-mod-guard stopped this one command. instead: ${bump.door}. why: ${bump.why}.`;
            return enforce(bump, `nothing in this command ran — ${said}`, said);
        }
        // dima's tick on an ask quoting the pr is his word for merge-auto, never for the brake (FRM-427)
        const mergeCall = mergeAutoCall(typed, cwd);
        const mergeArgs = mergeCall?.words;
        const pr = mergeArgs && mergeAutoPr(mergeArgs);
        const prTick = async () => {
            if (!mergeCall || !pr || mergeArgs?.includes('--release-brake'))
                return undefined;
            const repo =
                mergeAutoRepo(mergeCall.words) ??
                (await repoOf($, mergeCall.dir));
            return repo
                ? tickFor($, `pr:${repo}#${pr}`, (t) =>
                      quotesPr(t.text, repo, pr),
                  )
                : undefined;
        };
        // a refusal, never in WARN_ONLY: a warn would run the merge it means to stop (dima's o102, FRM-423)
        const word = mergeWord(typed, cwd);
        if (word) {
            const { value: prompt = '' } = await $.state.get(PROMPT);
            const unproven = word.targets.filter(
                (t) => !namesWhole(prompt, t) && !namesWhole(prompt, `#${t}`),
            );
            const isTicked =
                unproven.length > 0 &&
                unproven.every((t) => t.replace(/^#/, '') === pr) &&
                (await prTick()) !== undefined;
            if (unproven.length && !isTicked) {
                const said = `x-mod-guard stopped this one command. instead: ${word.door}. why: ${word.why} (rule dima-ok-flag); it does not name: ${unproven.join(' ')}.`;
                return enforce(
                    { ...word, targets: unproven },
                    `nothing in this command ran — ${said}`,
                    said,
                );
            }
            // the flag goes right after the call's own words, only on a command every other rule lets run
        } else if (
            verdict.kind === 'run' &&
            pr &&
            mergeArgs?.includes('--apply') &&
            withDimaOk(command, pr) !== undefined &&
            (await prTick())
        ) {
            notes.push(
                `dima's tick quotes pr ${pr}, so it carries his word: --dima-ok ${pr}`,
            );
            return go(withDimaOk(command, pr));
        }
        // a sign lands only on dima's tick on its sign ask (FRM-427, o197); a body's sign line dated today is a new sign
        const sign = signWord(typed, cwd, ctx);
        const isNewSign =
            sign !== undefined &&
            (sign.file === undefined ||
                new RegExp(
                    `✍️ (re-)?signed ${day(await $.clock.now())}`,
                    'u',
                ).test(await $.fs.read(sign.file).catch(() => '')));
        if (
            verdict.kind === 'run' &&
            isNewSign &&
            !(await tickFor(
                $,
                `sign-${sign.file ? 'body' : 'label'}:${sign.id}`,
                (t) => isSignAsk(t.text, sign.id),
            ))
        ) {
            const r = {
                door: `ask dima to tick an orbit ask «✍️ sign ${sign.id}: <title>», then sign`,
                rule: 'sign-untick',
                targets: [sign.id],
                why: "a sign is dima's word, and only his tick on the ticket's sign ask carries it",
            };
            const said = `x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}.`;
            return enforce(r, `nothing in this command ran — ${said}`, said);
        }
        if (verdict.kind === 'run') return go();
        // dima's tick on an ask quoting every target is his word, no marker needed (FRM-427)
        if (verdict.kind === 'refused') {
            const found = refusals(command, cwd, { ...ctx, ...facts });
            const targets = [...new Set(found.flatMap((r) => r.targets))];
            const tick = await tickFor(
                $,
                guardedOf(command),
                quotesCommand(command),
            );
            if (!tick)
                return enforce(verdict.refusal, message(verdict.refusal));
            await record($, {
                command,
                door: `dima's tick on ${tick.id}`,
                kind: 'escaped',
                rule: [...new Set(found.map((r) => r.rule))].join(', '),
                target: targets.join(', '),
                why: tick.text,
            });
            $.ui.log(
                `x-mod-guard: ran on dima's tick ${tick.id}: ${targets.join(', ')}`,
            );
            return go();
        }
        // the marker is only a claim: dima's own last prompt, or his tick, must name every target the refusals named
        const { value: said = '' } = await $.state.get(PROMPT);
        const named = [
            ...new Set(verdict.refusals.flatMap((r) => r.targets)),
        ].filter((t) => !namesWhole(said, t));
        const unproven =
            named.length &&
            (await tickFor($, guardedOf(command), quotesCommand(command)))
                ? []
                : named;
        if (unproven.length) {
            await record($, {
                command,
                door: UNPROVEN_DOOR,
                kind: 'refused',
                rule: 'dima-ok-unproven',
                target: unproven[0] ?? '',
                why: UNPROVEN_WHY,
            });
            return deny(
                `nothing in this command ran — x-mod-guard stopped it. instead: ${UNPROVEN_DOOR}. why: ${UNPROVEN_WHY}; it does not name: ${unproven.join(' ')}`,
            );
        }
        await record($, {
            command,
            door: verdict.refusals.map((r) => r.door).join('; '),
            kind: 'escaped',
            rule: [...new Set(verdict.refusals.map((r) => r.rule))].join(', '),
            target: verdict.targets.join(', '),
            why: verdict.refusals.map((r) => r.why).join('; '),
        });
        $.ui.log(`x-mod-guard: ran on dima-ok: ${verdict.targets.join(', ')}`);
        return go();
    }).catch(() => ({ deny: FAILED }));

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
                // the session's root, never its cwd: a cclio cd'd into ~/frame is still cclio, a coder cd'd into cclio is not
                const root = await $.session
                    .root()
                    .catch(() => $.session.cwd());
                if (!isUnder(root, `${home}/frame/cclio`)) return result;
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
            const root = await $.session.root().catch(() => $.session.cwd());
            if (!isUnder(root, `${home}/frame/cclio`)) return result;
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

    // an Edit or Write under a live mod's hooks/ waits for that mod's own tests to be green
    on(
        'tool.call',
        { tool: /^(Edit|MultiEdit|Write)$/ },
        async ($, e, next) => {
            const path = 'file_path' in e ? e.file_path : undefined;
            if (typeof path !== 'string') return next(e);
            const mod = await liveModOf($, path);
            if (!mod) return next(e);
            const run = await $.process.run(['claude', 'plugin', 'test', mod], {
                timeoutMs: 60_000,
            });
            if (run.exitCode === 0) return next(e);
            const name = mod.split('/').filter(Boolean).at(-1) ?? mod;
            const why = `${name}'s plugin test is red, and a save under its hooks/ reloads into every live session`;
            await record($, {
                command: `${e.tool} ${path}`,
                door: LIVE_RED_DOOR,
                kind: 'refused',
                rule: 'live-hook-red',
                target: path,
                why,
            });
            return {
                deny: `x-mod-guard stopped this ${e.tool}. instead: ${LIVE_RED_DOOR}. why: ${why}: ${path}`,
            };
        },
    ).catch(() => ({ deny: FAILED }));

    // a Write over a tracked file this session never saw replaces what it never read; a Read, Edit or Write marks it seen
    on(
        'tool.call',
        { tool: /^(Read|Edit|MultiEdit|Write)$/ },
        async ($, e, next) => {
            const path = 'file_path' in e ? e.file_path : undefined;
            if (typeof path !== 'string') return next(e);
            const real = await $.fs.stat(path, { resolve: true }).then(
                (s) => s.realPath ?? path,
                () => path,
            );
            const { value: seen = [] } = await $.state.get(SEEN);
            if (
                e.tool === 'Write' &&
                !seen.includes(real) &&
                (await isTracked($, real))
            ) {
                await record($, {
                    command: `Write ${path}`,
                    door: UNREAD_DOOR,
                    kind: 'refused',
                    rule: 'write-unread',
                    target: path,
                    why: UNREAD_WHY,
                });
                return {
                    deny: `x-mod-guard stopped this Write. instead: ${UNREAD_DOOR}. why: ${UNREAD_WHY}: ${path}`,
                };
            }
            const result = await next(e);
            if (result.deny === undefined && !result.isError)
                // bookkeeping only: the call already ran, so a failed mark never turns it into a refusal
                await markSeen($, real).catch(() => undefined);
            return result;
        },
    ).catch(() => ({ deny: FAILED }));

    // fail open: a message is never stopped by a broken check
    on('tool.call', { tool: 'SendMessage' }, async ($, e, next) => {
        const { message, to } = e as { message?: unknown; to?: unknown };
        if (
            typeof to !== 'string' ||
            typeof message !== 'string' ||
            !isSpecMissing(to, message)
        )
            return next(e);
        // a member's own traffic (a verifier's findings, a coder's «final») is a report, never a lane job
        const sid = await $.session.id().catch(() => undefined);
        const from = sid
            ? await sessionName($, sid).catch(() => undefined)
            : undefined;
        if (from && TO_MEMBER.test(from)) return next(e);
        const isWarn = await isWarnOnly($, 'spec').catch(() => true);
        await record($, {
            command: `SendMessage → ${to}: ${message}`,
            door: SPEC_DOOR,
            kind: isWarn ? 'warned' : 'refused',
            rule: 'spec',
            target: to,
            why: SPEC_WHY,
        }).catch(() => undefined);
        if (!isWarn)
            return {
                deny: `x-mod-guard stopped this message. instead: ${SPEC_DOOR}. why: ${SPEC_WHY}`,
            };
        const sent = await next(e);
        return sent.deny !== undefined
            ? sent
            : {
                  ...sent,
                  context: [
                      ...(sent.context ?? []),
                      wouldRefuse('spec', `${SPEC_WHY}; ${SPEC_DOOR}`),
                  ],
              };
    });

    on('prompt.submit', async ($, e, next) => {
        await $.state.set(IMAGES, 0).catch(() => undefined);
        if (TYPED_BY_DIMA.has(e.origin.kind)) {
            const sid = await $.session.id().catch(() => undefined);
            const isBg = sid
                ? ((await registryEntry($, sid).catch(() => undefined))?.isBg ??
                  false)
                : false;
            if ((isBg ? TYPED_BY_DIMA_IN_BG : TYPED_BY_DIMA).has(e.origin.kind))
                await $.state.set(PROMPT, e.text).catch(() => undefined);
        }
        await logOrigin($, e).catch(() => undefined);
        return next(e);
    });

    on('agent.spawn', async ($, e, next) => {
        const found = await briefFindings($, e.prompt).catch(() => []);
        if (found.length) {
            const why = found.join('; ');
            // a spawn takes no note, so a warn-only rule is seen in the kept events alone
            const isWarn = await isWarnOnly($, 'brief');
            await record($, {
                command: `Agent: ${e.description}`,
                door: 'fix what x brief check names',
                kind: isWarn ? 'warned' : 'refused',
                rule: 'brief',
                target: found[0] ?? '',
                why,
            }).catch(() => undefined);
            if (isWarn) return next(e);
            return {
                deny: `x-mod-guard stopped this brief. instead: fix what x brief check names, then spawn again${found.some((f) => RELATIVE_MISS.test(f)) ? '; a path from another repo: write it absolute or ~/' : ''}. why: ${why}`,
            };
        }
        if (!e.fork || WHY_FORK.test(e.prompt)) return next(e);
        const isWarn = await isWarnOnly($, 'fork');
        await record($, {
            command: `fork: ${e.description}`,
            door: FORK_DOOR,
            kind: isWarn ? 'warned' : 'refused',
            rule: 'fork',
            target: 'why-fork',
            why: FORK_WHY,
        });
        return isWarn ? next(e) : { deny: FORK_REFUSED };
    }).catch(() => ({ deny: FAILED }));
};
