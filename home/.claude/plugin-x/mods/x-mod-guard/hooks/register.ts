import type { EngineInterface, Register } from 'claude-code';

import { briefPaths } from './rules/brief.ts';
import { cleanStampWrite } from './rules/clean-stamp.ts';
import type { Brief, Context, Refusal, Written } from './rules/command.ts';
import {
    TICKET_KEY,
    UNREAD,
    commandsDeep,
    laidOver,
    resolve,
    scriptRun,
} from './rules/command.ts';
import { linearWritePiped, stashSweep, stashSweeps } from './rules/floor.ts';
import { trashedPaths } from './rules/hazard.ts';
import { bareHelps, helpScripts, hints, verbHelps } from './rules/hint.ts';
import { linearWrite } from './rules/linear.ts';
import {
    type MergeHolds,
    holdRecordWrite,
    mergeHold,
    rawMergeRefused,
    rawMerges,
} from './rules/merge-hold.ts';
import { projectMoves } from './rules/milestone.ts';
import { hasNotes, notedKey, notesEdits } from './rules/notes.ts';
import {
    type OverrideAsk,
    type OverrideGrants,
    isOverrideStore,
    overrideAfter,
    overrideAsked,
    overrideStoreRefusal,
    overrideStoreWrite,
    overrideTypedDown,
} from './rules/operator-override.ts';
import { overwrittenPaths, writtenPaths } from './rules/overwrite.ts';
import { rewrite } from './rules/rewrite.ts';
import { isSixthSense, sixthSenseSummons } from './rules/sixth-sense.ts';
import { SPEC_DOOR, SPEC_WHY, TO_MEMBER, isSpecMissing } from './rules/spec.ts';
import {
    RESIGN_DOOR,
    hasResign,
    isWorthScope,
    resignGap,
    worthCreates,
    worthRewrites,
} from './rules/worth.ts';
import {
    STORE_WRITE,
    TICKS_WRITE,
    addedPaths,
    bracesOf,
    check,
    fenceTexts,
    foregroundClaude,
    globMatches,
    installDirs,
    isGlob,
    isSignAsk,
    isStashKill,
    isStorePath,
    isTicksPath,
    keysIntoAgent,
    keysTargets,
    lineWrites,
    markedBy,
    markers,
    mergeAutoCall,
    mergeAutoPr,
    mergeAutoRepo,
    mergeWord,
    message,
    namesWhole,
    paneFiles,
    paneProof,
    pressTicks,
    quotesPr,
    rawLinear,
    rawPluginUpdate,
    refusals,
    remoteSlug,
    removedTrees,
    signWords,
    signsTyped,
    stashAsked,
    stashKills,
    storeWrite,
    ticksWrite,
    tmpDirs,
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
            pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
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
// the registry name is clio's: spaces and zero-width joiners dropped, the way x-mod-stash's bare() reads a name
const COORDINATORS = ['🦉clio', '🦉cclio']; // read-both: a clio tab resumed under its old title
const isCoordinator = (name: string) => {
    const bare = name.replaceAll(/[\s\u200d]/g, '');
    return COORDINATORS.includes(bare) || /^🦉🪽c?clio:wing\d+$/u.test(bare);
};
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
const FAILED =
    'x-mod-guard: the check failed or ran out of time, so this call is refused (fail closed). retry it once; if it repeats, tell clio';
// a fork carries the whole parent context; the line says what of it the fork needs
const WHY_FORK = /^\s*why-fork:\s*\S/m;
const FORK_DOOR =
    'a fresh agent with a self-contained brief, or helper for a mechanical job';
const FORK_WHY = 'a fork carries the whole parent context (~220k tokens)';
const FORK_REFUSED = `x-mod-guard stopped this fork. instead: ${FORK_DOOR}. why: ${FORK_WHY}. a fork that truly needs that context says so in a prompt line: why-fork: <what parent context it needs>`;
// an Agent prompt naming a ticket id, a backticked path or file, or one of matt's skills is a brief (FRM-392); the id
// shape copies brief.go's ticketID, which a mod cannot import. a SendMessage is never checked: reports name skills and
// example paths on purpose, and the sixth sense's verdict was refused three times live (13:40)
const BRIEF_SHAPES =
    /`[^`\n]*\/[^`\n]*`|`[\w.@~-]+\.[a-z]{1,5}`|\bmattpocock-skills:|\bmatt's `?[a-z]/;
const BRIEF_SIGN = new RegExp(
    `\\b(?:${TICKET_KEY}|DOT)-\\d+\\b|${BRIEF_SHAPES.source}`,
);
// of x brief check's findings only a missing path and a skill's user quiz refuse; a quoted code term is a message's own
const BRIEF_REFUSES = /^line \d+: (?:path|quiz) .+$/gm;
// a relative path the session's repo lacks may live in another repo, which an absolute or ~/ path names (dima's o66)
const RELATIVE_MISS = /^line \d+: path (?![/~])/;

// the findings that stop a brief, or none; it throws when x breaks, and the spawn goes then (fail open, unlike the
// floor): this runs on every Agent of every session, clio's included
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

// a start_session spawn is a member spawn like `claude --bg`: the gate that refuses a --bg brief leaving a live trial
// unnamed (frame's script/test-drive-list.ts --spawn-hook) reads its prompt as the same command (FRM-467). It answers
// the refusal's reason, or none; it throws when the gate breaks, and the spawn goes then
const START_SESSION = 'mcp__ccd_session__start_session';
async function trialGap($: EngineInterface, prompt: string) {
    const home = await $.env.get('HOME');
    const command = `claude --bg '${prompt.replaceAll("'", "'\\''")}'`;
    const run = await $.process.run(
        ['node', `${home}/frame/script/test-drive-list.ts`, '--spawn-hook'],
        {
            stdin: JSON.stringify({ tool_input: { command } }),
            timeoutMs: 8000,
        },
    );
    if (!run.stdout.trim()) return undefined;
    const out = JSON.parse(run.stdout) as {
        hookSpecificOutput?: {
            permissionDecision?: string;
            permissionDecisionReason?: string;
        };
    };
    const decision = out.hookSpecificOutput;
    return decision?.permissionDecision === 'deny'
        ? decision.permissionDecisionReason
        : undefined;
}

const CODIE_IDS = ['/x:crew-codie', '/x:crew-coder']; // read-both: the skill id before 10-29
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
        isCodie: CODIE_IDS.some((id) =>
            new TextDecoder().decode(bytes).includes(id),
        ),
        isStamped: await $.fs.exists(`${state}/briefs/${sum}.json`),
    };
}

// the dir a repo's `backlog.config.yml` names as `backlog_directory` (clio's pocket: `pocket`), else none
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

// the registry names of the sixth senses whose process still runs: a row outlives a crash, and a pid comes back as another
// process, so ps must name the pid with the start time the row wrote, in UTC as the registry writes it (FRM-479)
async function liveSixthSenses($: EngineInterface) {
    const dir = `${await $.env.get('HOME')}/.claude/sessions`;
    const rows: { name: string; pid: number; start?: string }[] = [];
    for (const f of await $.fs.list(dir).catch(() => [])) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const v = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as {
                name?: unknown;
                pid?: unknown;
                procStart?: unknown;
            };
            if (
                typeof v.name === 'string' &&
                typeof v.pid === 'number' &&
                isSixthSense(v.name)
            )
                rows.push({
                    name: v.name,
                    pid: v.pid,
                    start:
                        typeof v.procStart === 'string'
                            ? v.procStart.replaceAll(/\s+/g, ' ')
                            : undefined,
                });
        } catch {}
    }
    if (!rows.length) return [];
    const ps = await $.process.run(
        ['ps', '-o', 'pid=,lstart=', '-p', rows.map((r) => r.pid).join(',')],
        { env: { LC_ALL: 'C', TZ: 'UTC' }, timeoutMs: 4000 },
    );
    const running = new Map(
        ps.stdout.split('\n').flatMap((line) => {
            const m = line.trim().match(/^(\d+)\s+(.+)$/);
            return m
                ? [[Number(m[1]), m[2]?.replaceAll(/\s+/g, ' ').trim()]]
                : [];
        }),
    );
    return rows
        .filter(
            (r) =>
                running.has(r.pid) &&
                (!r.start || running.get(r.pid) === r.start),
        )
        .map((r) => r.name);
}

// a milestone id's name, read through x's api door (FRM-486); undefined when linear does not answer in 3 s
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function milestoneName($: EngineInterface, id: string) {
    const run = await $.process.run(
        [
            'x',
            'linear',
            'api',
            `query { projectMilestone(id: "${id}") { name } }`,
        ],
        { timeoutMs: 3000 },
    );
    if (run.exitCode !== 0) return undefined;
    const name = (
        JSON.parse(run.stdout) as {
            data?: { projectMilestone?: { name?: unknown } };
        }
    ).data?.projectMilestone?.name;
    return typeof name === 'string' ? name : undefined;
}
// a ticket's body, project and milestone as linear holds them, through the door sign-untick reads; undefined past 3 s
async function ticketOf($: EngineInterface, id: string) {
    const run = await $.process.run(['x', 'linear', 'read', id], {
        timeoutMs: 3000,
    });
    if (run.exitCode !== 0) return undefined;
    const t = (
        JSON.parse(run.stdout) as {
            data?: {
                tickets?: {
                    description?: unknown;
                    milestone?: unknown;
                    project?: unknown;
                }[];
            };
        }
    ).data?.tickets?.[0];
    return typeof t?.description === 'string'
        ? {
              description: t.description,
              milestone:
                  typeof t.milestone === 'string' ? t.milestone : undefined,
              project: typeof t.project === 'string' ? t.project : '',
          }
        : undefined;
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
// twin end

async function overrideGrant($: EngineInterface, scope: string) {
    const path = await overrideStorePath($);
    return path ? overrideGrantAt($, path, scope) : undefined;
}

// the store after his typed ask, and the note the model reads; a write that fails is told, never silent
async function overrideFlip($: EngineInterface, ask: OverrideAsk) {
    const path = await overrideStorePath($);
    if (!path)
        return 'operator-override: the system user record did not read, so the switch did not move';
    const raw = await $.fs.read(path).catch(() => '{}');
    let grants: OverrideGrants = {};
    try {
        grants = JSON.parse(raw) as OverrideGrants;
    } catch {}
    const at = new Date(await $.clock.now()).toISOString();
    const after = JSON.stringify(overrideAfter(grants, ask, at));
    if (after !== raw) await $.fs.write(path, after);
    return ask.scope === 'off'
        ? "operator-override is off, by dima's typed words"
        : `operator-override prs is on, by ${ask.by}: x lane merge-auto <pr> --apply lands every pr; his hold and the brake still stop it`;
}

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

// one rule, one reader: x's brakeOn answers for each repo the line merges in, and a failed read refuses
async function rawMergeBrake($: EngineInterface) {
    const store = await overrideStorePath($);
    const home = store?.replace(/\/\.local\/state\/x\/[^/]*$/, '');
    // outside any tree, so the shim runs main's x and a stale worktree can't answer; a line can't name its repo safely, so
    // both repos' brakes are read: a brake on either stops a raw merge, and merge-auto stays the door
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
        if (typeof data?.brake !== 'string')
            return 'the brake did not read, so it reads on';
        return data.brake ? `the brake is on: ${data.brake}` : undefined;
    } catch {
        return 'the brake did not read, so it reads on';
    }
}

// x's own record of dima's holds, one file per repo (`x/go/merge_hold.go`); a pr number across repos counts as held in each,
// the safe side. no dir is no hold; a file that does not read holds everything
async function readMergeHolds($: EngineInterface) {
    const dir = `${await $.env.get('HOME')}/.local/state/x/merge-hold`;
    const holds: MergeHolds = { isUnreadable: false, prs: new Set() };
    if (!(await $.fs.exists(dir).catch(() => true))) return holds;
    const files = await $.fs.list(dir).catch(() => undefined);
    if (!files) return { ...holds, isUnreadable: true };
    for (const f of files) {
        if (!f.name.endsWith('.json')) continue;
        try {
            const note = JSON.parse(await $.fs.read(`${dir}/${f.name}`)) as {
                prs?: unknown;
            };
            if (!Array.isArray(note.prs)) throw new Error('no prs list');
            for (const pr of note.prs) holds.prs.add(String(pr));
        } catch {
            holds.isUnreadable = true;
        }
    }
    return holds;
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

// a new refusing rule ships warn-only: the call runs and the model reads what would have been refused, until the rule's
// sixth sense says clean and it leaves this set (dima's o70, after FRM-392's guard refused plain reports live)
const WARN_ONLY: ReadonlySet<string> = new Set([
    'bare-push',
    'frozen-lockfile',
    'hooks-bypass',
    'linear-write-piped',
    'opaque-head',
    'raw-plugin-update',
    'write-then-run',
    // warn-only until sixth sense's clean and a 2-day replay with 0 fires on real calls (clio, 17:04)
    'pane-keys',
]);
// the store's `rule-mode:<rule>` = «enforce» turns a listed rule on early; nothing in the store can make a rule warn —
// any session writes that store, and a «warn» there switched the floor off for every session (sixth sense, 15:08)
async function isWarnOnly($: EngineInterface, rule: string) {
    if (!WARN_ONLY.has(rule)) return false;
    return (
        (await $.store.get(`rule-mode:${rule}`).catch(() => undefined)) !==
        'enforce'
    );
}
// a warn runs the call, so the refusal's «nothing ran» words never ride it
const wouldRefuse = (rule: string, text: string) =>
    `x-mod-guard would refuse this (rule ${rule}, warn-only for now), and the command ran: ${text.replace(/^nothing in this command ran — x-mod-guard stopped this one command\. /, '')}`;

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

// the fenced folders judged where a write lands on disk, not how it is spelled: a symlink, a glob, a `..` hop all
// resolve before the compare (clio's stop at the round-3 cap: three rounds of spellings, one shape)
const FENCE_TEXTS = 256;
const FENCE_FANOUT = 1024;
async function fenceLanding($: EngineInterface, command: string, cwd: string) {
    const home = (await $.env.get('HOME')) ?? '';
    const ticks = (await realPath($, `${home}/.claude/shelf/orbit-ticks`)).key;
    const shelf = (await realPath($, `${home}/.claude/shelf`)).key;
    const store = (await realPath($, `${home}/.claude/plugins/store`)).key;
    const plugins = (await realPath($, `${home}/.claude/plugins`)).key;
    const lands = {
        plugins: new Set<string>(),
        shelf: new Set<string>(),
        store: new Set<string>(),
        ticks: new Set<string>(),
    };
    const dirs = new Map<string, string>();
    const texts = fenceTexts(command, cwd);
    for (const text of texts) {
        const paths =
            texts.length > FENCE_TEXTS
                ? undefined
                : await onDisk($, text, home);
        // past a cap the word is unread, so it counts as landing: a write is refused, a read still runs. past the word
        // cap every word is (wisphunter 18:06: padding pushed the target past it); past the fan-out only that word, so
        // `cut -c1-120` after an `ls` over 503 project folders stays a read (clio's line, 18:58)
        if (!paths) {
            for (const set of Object.values(lands)) set.add(text);
            continue;
        }
        for (const path of paths) {
            const key = await landingOf($, path, dirs);
            if (key === ticks || key.startsWith(`${ticks}/`))
                lands.ticks.add(text);
            if (key === store || key.startsWith(`${store}/`))
                lands.store.add(text);
            if (key === shelf) lands.shelf.add(text);
            if (key === plugins) lands.plugins.add(text);
        }
    }
    return lands;
}
// a variable or a substitution the line never fills: one segment of any name, or none
const UNFILLED = /\$\{[^}]*\}|\$\([^)]*\)|`[^`]*`|\$[\w@*#?]+/g;
const ANY = '\u0000';
// a word as the shell would hand it over: `~` and `$HOME` filled, braces opened, globs matched against the folder they
// sit in, an unfilled variable read as any entry or none (wisphunter 18:06: `orbit-tick?/$x` with `$x` empty);
// undefined past a cap, which the caller reads as landing
async function onDisk($: EngineInterface, text: string, home: string) {
    const spelled = text
        .replace(/^~(?=\/|$)/, home)
        .replace(/\$\{?HOME\}?(?=\/|$)/g, home)
        .replace(UNFILLED, ANY);
    if (!spelled.startsWith('/') || /\s/.test(spelled)) return [];
    // a brace bomb never gets here: the spelled check refuses its word first
    const out: string[] = [];
    for (const alt of bracesOf(spelled)) {
        let at = ['/'];
        for (const seg of alt.split('/')) {
            if (seg === '' || seg === '.') continue;
            const next: string[] = seg === ANY ? [...at] : [];
            const pattern = seg.replaceAll(ANY, '*');
            for (const dir of at) {
                if (seg === '..')
                    // the kernel steps back from where a link lands, never from its spelling
                    next.push(dirname((await realPath($, dir)).file));
                else if (!isGlob(pattern)) next.push(joinPath(dir, seg));
                else
                    for (const entry of await $.fs.list(dir).catch(() => []))
                        if (globMatches(pattern, entry.name))
                            next.push(joinPath(dir, entry.name));
            }
            if (next.length > FENCE_FANOUT) return undefined;
            at = next;
        }
        out.push(...at);
    }
    return out;
}
const joinPath = (dir: string, name: string) =>
    dir === '/' ? `/${name}` : `${dir}/${name}`;
// a file that exists lands where its link points; a new one lands in its folder's real path
async function landingOf(
    $: EngineInterface,
    path: string,
    dirs: Map<string, string>,
) {
    const direct = await $.fs.stat(path, { resolve: true }).then(
        (s) => s.realPath,
        () => undefined,
    );
    if (direct) return direct.toLowerCase();
    const dir = dirname(path);
    const known = dirs.get(dir) ?? (await realPath($, dir)).key;
    dirs.set(dir, known);
    return `${known}/${path.slice(dir.length + 1).toLowerCase()}`;
}

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

// dima's own prompt naming the stash, a kill verb and the repo lets a stash drop through in that repo (FRM-426); the
// repo is the toplevel of the dir the command runs in, never the session's cwd
async function stashAllowed(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
    found: Refusal[],
) {
    if (!found.length || !found.every(isStashKill)) return undefined;
    const kills = stashKills(command, cwd, ctx);
    if (!kills.length) return undefined;
    const { value: said = '' } = await $.state.get(TOLD);
    for (const k of kills) {
        const top = await $.process
            .run(['git', '-C', k.dir, 'rev-parse', '--show-toplevel'])
            .catch(() => undefined);
        const repo =
            top?.exitCode === 0 ? top.stdout.trim().split('/').pop() : '';
        if (!repo || !stashAsked(said, k.verb, repo)) return undefined;
    }
    return { dirs: kills.map((k) => k.dir), said };
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
const TOLD = { key: 'told', plugin: 'x-mod-guard' } as const;
const WRITTEN = { key: 'written', plugin: 'x-mod-guard' } as const;
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
type Tick = { id: string; text: string; targets: string[]; at: number };
// his presses on fleet-board for this session (FRM-544 slice 1, reversing FRM-552's decision 4 on his word): the ticks-write
// rule keeps every seat's tool call out of that folder, so only fleet-board writes it; a file that cannot be read is no tick
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
    const pressed = pressTicks(text).filter((t) =>
        orbit?.asks.some(
            (a) =>
                `herdr:${a.id}` === t.id &&
                a.text === t.text &&
                a.mark === 'accepted',
        ),
    );
    // fleet-board prunes a press from the file once x-mod-stash has taken it, so his next press there drops it: the
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
    scope: string,
    covers: (tick: Tick) => boolean,
    spends: string[],
) {
    const { value: seatTicks = [] } = await $.state
        .get(TICKS)
        .catch(() => ({ value: [] }));
    const ticks = [...seatTicks, ...(await herdrTicks($))];
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    const tick = [...ticks]
        .reverse()
        .find(
            (t) =>
                now - t.at <= TICK_MS &&
                t.at <= now &&
                !spent.includes(`${t.id}@${t.at}:${scope}`) &&
                !spends.includes(`${t.id}@${t.at}:${scope}`) &&
                covers(t),
        );
    if (tick) spends.push(`${tick.id}@${tick.at}:${scope}`);
    return tick;
}
// his typed «sign <id>» (FRM-544 slice 0): written only by this plugin's prompt.submit from his own prompt, the proof a
// # dima-ok marker rests on; it opens what a sign tick opens for its id, each write once, inside a tick's 2 h
const SIGNS = { key: 'signs', plugin: 'x-mod-guard' } as const;
const FIRST_PROMPT_NOTE =
    "x-mod-guard: a session's first prompt never signs and proves no # dima-ok target, since a seat's spawn prompt reads the same; tell dima his sign counts from his next prompt here (his operator-override works from the first)";
const PROMPTED = { key: 'prompted', plugin: 'x-mod-guard' } as const;
async function wasPrompted($: EngineInterface) {
    const { value: isPrompted } = await $.state
        .get(PROMPTED)
        .catch(() => ({ value: undefined }));
    if (isPrompted) return true;
    const { value: kept } = await $.state
        .get(PROMPT)
        .catch(() => ({ value: undefined }));
    return !!kept;
}
// a spend's time is its word's, `<ask id or typed>@<time>:<scope>`; an unreadable one counts as live
const spentAt = (key: string) =>
    Number(key.split('@')[1]?.split(':')[0]) || Number.POSITIVE_INFINITY;
async function keepTypedSigns($: EngineInterface, text: string) {
    const ids = signsTyped(text);
    if (!ids.length) return;
    const now = await $.clock.now();
    const { value: kept = [] } = await $.state.get(SIGNS);
    await $.state.set(SIGNS, [
        ...kept.filter((s) => now - s.at <= TICK_MS),
        ...ids.map((id) => ({ at: now, id })),
    ]);
}
async function typedSignFor(
    $: EngineInterface,
    scope: string,
    id: string,
    spends: string[],
) {
    const { value: signs = [] } = await $.state
        .get(SIGNS)
        .catch(() => ({ value: [] }));
    const { value: spent = [] } = await $.state.get(SPENT);
    const now = await $.clock.now();
    const key = (at: number) => `typed@${at}:${scope}`;
    const sign = signs.find(
        (s) =>
            s.id === id &&
            now - s.at <= TICK_MS &&
            !spent.includes(key(s.at)) &&
            !spends.includes(key(s.at)),
    );
    if (sign) spends.push(key(sign.at));
    return sign;
}
// the raw merges a script run by path holds, as far as the guard reads one (BYT-94): a file this turn or this line wrote, or
// the one on disk; a file past the cap, or a language other than shell, stays the rule's known gap
const SCRIPT_READ_MAX = 256 * 1024;
async function scriptMerges(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
    seen = new Set<string>(),
): Promise<ReturnType<typeof rawMerges>> {
    const written = new Map<string, string>([
        ...(ctx.written ?? []),
        ...lineWrites(command, cwd, ctx).map(
            ([path, text]): [string, string] => [path, text],
        ),
    ]);
    const found: ReturnType<typeof rawMerges> = [];
    for (const c of commandsDeep(command, cwd)) {
        const ran = scriptRun(c, ctx);
        if (ran === undefined || seen.has(ran)) continue;
        seen.add(ran);
        // text the guard could not keep: the disk answers, as of before this line runs
        const kept = written.get(ran);
        const known = kept?.includes(UNREAD) ? undefined : kept;
        const size =
            known !== undefined
                ? 0
                : (await $.fs.stat(ran).catch(() => undefined))?.size;
        const text =
            known ??
            (size !== undefined && size <= SCRIPT_READ_MAX
                ? await $.fs.read(ran).catch(() => undefined)
                : undefined);
        if (!text) continue;
        found.push(
            ...rawMerges(text, c.dir),
            ...(await scriptMerges($, text, c.dir, { ...ctx, written }, seen)),
        );
    }
    return found;
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
    'ask dima; his own next prompt naming each target as a word lets the # dima-ok marker through (a bare symbol like . or & only as «dima-ok: <target>»). a bg session counts only what dima types into it himself; ask clio to get him there';
const UNPROVEN_WHY =
    "a # dima-ok marker counts only when dima's last typed prompt names its target";
// a live mod's hooks reload into every session on save, so while its own tests are red a half-done edit there breaks the fleet
// (FRM-350: Bash down fleet-wide for ~5 min); the fix goes through a scratch copy and lands only once it is green
const LIVE_RED_DOOR =
    'edit a scratch copy: `x mods edit pull <file>`, then `x mods edit push`, which lands it only when the mod validates and tests green';
const LIVE_TEST_MS = 60_000;

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
    const head = (s: string) => points(s).slice(0, 80).join('');
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

// a tree clio may drop unasked: no `.scratch/` plan inside, and every commit its HEAD reaches is on a branch;
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

// a manifest the working tree changed since HEAD: `CI=1 pnpm install` would freeze the lockfile against it
async function isManifestChanged($: EngineInterface, dir: string) {
    const r = await $.process
        .run(['git', 'diff', '--name-only', 'HEAD'], { cwd: dir })
        .catch(() => null);
    if (r?.exitCode !== 0) return false;
    return r.stdout
        .split('\n')
        .some((f) =>
            /(^|\/)(package\.json|pnpm-workspace\.yaml)$/.test(f.trim()),
        );
}

// the turn's written files, newest kept: a few scripts is the shape, so a big Write keeps only its head
const WRITTEN_FILES = 16;
const WRITTEN_CHARS = 32_000;
async function markWritten($: EngineInterface, files: Written[]) {
    if (!files.length) return;
    for (let tries = 0; tries < 3; tries++) {
        const { value = {}, version } = await $.state.get(WRITTEN);
        // an unread mark keeps nothing for a file the turn never kept
        const kept = files.reduce<Written[]>(
            (out, file) =>
                file[1] !== UNREAD ||
                value[file[0]] !== undefined ||
                out.some(([w]) => w === file[0])
                    ? [...out, file]
                    : out,
            [],
        );
        const next = [...laidOver(new Map(Object.entries(value)), kept)].map(
            ([path, text]) => [
                path,
                text.length > WRITTEN_CHARS
                    ? `${text.slice(0, WRITTEN_CHARS)}${UNREAD}`
                    : text,
            ],
        );
        const { isSet } = await $.state.set(
            WRITTEN,
            Object.fromEntries(next.slice(-WRITTEN_FILES)),
            { ifVersion: version },
        );
        if (isSet) return;
    }
}
// an Edit of a file the turn wrote changes the text a later run reads; an edit the kept text cannot place leaves it unread
type TextEdit = {
    old_string: string;
    new_string: string;
    replace_all?: boolean;
};
async function editWritten(
    $: EngineInterface,
    path: string,
    edits: TextEdit[],
) {
    for (let tries = 0; tries < 3; tries++) {
        const { value = {}, version } = await $.state.get(WRITTEN);
        const kept = value[path];
        if (kept === undefined) return;
        let text: string | undefined = kept;
        for (const e of edits) {
            if (text === undefined || !text.includes(e.old_string)) {
                text = undefined;
                break;
            }
            text = e.replace_all
                ? text.replaceAll(e.old_string, e.new_string)
                : text.replace(e.old_string, () => e.new_string);
        }
        const { isSet } = await $.state.set(
            WRITTEN,
            { ...value, [path]: text ?? UNREAD },
            { ifVersion: version },
        );
        if (isSet) return;
    }
}
async function unreadWritten($: EngineInterface, paths: string[]) {
    for (let tries = 0; tries < 3; tries++) {
        const { value = {}, version } = await $.state.get(WRITTEN);
        const kept = paths.filter((p) => value[p] !== undefined);
        if (!kept.length) return;
        const { isSet } = await $.state.set(
            WRITTEN,
            { ...value, ...Object.fromEntries(kept.map((p) => [p, UNREAD])) },
            { ifVersion: version },
        );
        if (isSet) return;
    }
}
async function turnWritten($: EngineInterface) {
    const { value = {} } = await $.state.get(WRITTEN);
    return new Map(Object.entries(value));
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
    const unsafeTmp = new Set<string>();
    if (ctx.jobDir)
        for (const dir of new Set(tmpDirs(command, cwd, ctx)))
            if (await isTmpEscape($, dir, ctx.jobDir)) unsafeTmp.add(dir);
    const { value: helped = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    const sixthSenses = sixthSenseSummons(command, cwd).length
        ? await liveSixthSenses($).catch(() => [])
        : [];
    const worthFiles = new Map<string, string | undefined>();
    const milestoneNames = new Map<string, string>();
    for (const create of worthCreates(command, cwd, ctx)) {
        if ('file' in create.body && !worthFiles.has(create.body.file))
            worthFiles.set(
                create.body.file,
                await signFile($, create.body.file).catch(() => undefined),
            );
        if (
            create.milestone &&
            UUID.test(create.milestone) &&
            create.project.toLowerCase() === 'fleet'
        ) {
            const name = await milestoneName($, create.milestone).catch(
                () => undefined,
            );
            if (name) milestoneNames.set(create.milestone, name);
        }
    }
    const moves = projectMoves(command, cwd);
    const milestoneProjects = moves.length
        ? await projectsWithMilestones(
              $,
              moves.map((m) => m.project.toLowerCase()),
          ).catch(() => undefined)
        : undefined;
    return {
        briefs,
        cleanTrees,
        helped: new Set(helped),
        helpless,
        kinds,
        manifestDirs,
        milestoneNames,
        milestoneProjects,
        milestoneUnread:
            moves.length && !milestoneProjects
                ? moves.map((m) => m.project)
                : [],
        missing,
        notedTasks,
        sixthSenses,
        unsafeTmp,
        worthFiles,
    };
}

// the projects that hold milestones, read from linear once a day; it throws when linear cannot be read, and the call
// then runs with a warn (fail open, like pocket-check's closed-ticket net). A move into a project the cache holds
// without milestones reads again after ten minutes, since a project can gain its first one; an unreachable linear is
// not asked again for a minute, so each move does not wait the timeout out again
// a body file as the command will read it: the engine's read, else `cat` (the hook may not reach every path the shell
// does, clio's scratchpad for one); undefined when neither reads it
async function signFile($: EngineInterface, file: string) {
    const read = await $.fs.read(file).catch(() => undefined);
    if (read !== undefined) return read;
    const run = await $.process
        .run(['cat', file], { timeoutMs: 4000 })
        .catch(() => undefined);
    return run?.exitCode === 0 ? run.stdout : undefined;
}
// a new sign: a sign line the ticket's current body lacks word for word, whatever its date (a backdated line, one dated
// tomorrow, an old line whose text changed: sixth sense R1 on FRM-478), or a block x now grants a merge from where it did
// not, or from another sign (R2: a pre-approval added, a cancel deleted); an unreadable linear counts it as new
const SIGN_LINE = /^✍️ (re-)?signed /u;
// what x's merge door grants from a body's last ## signed block (x/go/merge_sign.go readSign): the sign line the grant
// hangs on ('' when the block holds none, and x reads the whole block), or undefined when it grants nothing — a cancel
// or a re-sign pending after the last sign voids it, and a grant needs a `merge: pre-approved` line after it
function grantOf(body: string) {
    const heading = [...body.matchAll(/^## signed\s*$/gmu)].at(-1);
    if (!heading) return undefined;
    const rest = body.slice((heading.index ?? 0) + heading[0].length);
    const end = rest.search(/^## /mu);
    const block = end < 0 ? rest : rest.slice(0, end);
    const lines = block.split('\n');
    const at = lines.findLastIndex((l) => /^✍️ (re-)?signed\b/u.test(l));
    const since = lines.slice(Math.max(at, 0));
    if (since.some((l) => /^(🚫 cancelled|✍️ re-sign pending)\b/u.test(l)))
        return undefined;
    if (!since.some((l) => /^merge: pre-approved\s*$/u.test(l)))
        return undefined;
    return at < 0 ? '' : lines[at];
}
async function hasNewSignLine($: EngineInterface, id: string, body: string) {
    const lines = body.split('\n').filter((l) => SIGN_LINE.test(l));
    const grant = grantOf(body);
    if (!lines.length && grant === undefined) return false;
    const run = await $.process.run(['x', 'linear', 'read', id], {
        timeoutMs: 8000,
    });
    let current: string | undefined;
    try {
        current = (
            JSON.parse(run.stdout) as {
                data?: { tickets?: { description?: string }[] };
            }
        ).data?.tickets?.[0]?.description;
    } catch {}
    if (run.exitCode !== 0 || current === undefined) return true;
    const held = new Set(current.split('\n'));
    return (
        lines.some((l) => !held.has(l)) ||
        (grant !== undefined && grantOf(current) !== grant)
    );
}
const MILESTONES = 'linear-milestones';
const LINEAR_DOWN = 'linear-down';
const DAY_MS = 86_400_000;
const RECHECK_MS = 600_000;
const DOWN_MS = 60_000;
const PAGES_MAX = 10;
const projectsQuery = (after?: string) =>
    `{ projects(first: 250${after ? `, after: "${after}"` : ''}) { nodes { id name slugId projectMilestones(first: 1) { nodes { id } } } pageInfo { hasNextPage endCursor } } }`;
async function projectsWithMilestones($: EngineInterface, asked: string[]) {
    const now = await $.clock.now();
    const kept = (await $.store.get(MILESTONES).catch(() => undefined)) as
        | { at: number; keys: string[] }
        | undefined;
    const age = kept ? now - kept.at : Infinity;
    const isStale =
        age >= DAY_MS ||
        (age >= RECHECK_MS && asked.some((p) => !kept?.keys.includes(p)));
    if (kept && !isStale) return new Set(kept.keys);
    const down = (await $.store.get(LINEAR_DOWN).catch(() => undefined)) as
        | number
        | undefined;
    if (typeof down === 'number' && now - down < DOWN_MS)
        throw new Error('linear was unreachable a moment ago');
    try {
        const nodes: NonNullable<
            NonNullable<ProjectsReply['data']>['projects']
        >['nodes'] = [];
        let after: string | undefined;
        for (let page = 0; page < PAGES_MAX; page++) {
            const run = await $.process.run(
                ['x', 'linear', 'api', projectsQuery(after)],
                { timeoutMs: 8000 },
            );
            if (run.exitCode !== 0) throw new Error(run.stderr);
            const projects = (JSON.parse(run.stdout) as ProjectsReply).data
                ?.projects;
            if (!projects?.nodes) throw new Error('linear sent no projects');
            nodes.push(...projects.nodes);
            after = projects.pageInfo?.hasNextPage
                ? (projects.pageInfo.endCursor ?? undefined)
                : undefined;
            if (!after) break;
            if (page === PAGES_MAX - 1)
                throw new Error(
                    'linear holds more projects than the check reads',
                );
        }
        const keys = nodes
            .filter((n) => n.projectMilestones.nodes.length)
            .flatMap((n) =>
                [n.id, n.name, n.slugId].map((k) => k.toLowerCase()),
            );
        await $.store.set(MILESTONES, { at: now, keys });
        return new Set(keys);
    } catch (err) {
        await $.store.set(LINEAR_DOWN, now).catch(() => undefined);
        throw err;
    }
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
        // what a warn-only rule would have refused: the call goes on through the checks below and runs with these read
        const warns: string[] = [];
        const cwd = await $.session.cwd();
        const home = await $.env.get('HOME');
        // a failed root reads as no session's, never the cwd a `cd` moved (R6)
        const root = await $.session.root().catch(() => '');
        const ctx: Context = {
            home,
            isClio: isUnder(root, `${home}/frame/_clio`),
            jobDir: await $.env.get('CLAUDE_JOB_DIR'),
            written: await turnWritten($).catch(() => undefined),
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
        const spends: string[] = [];
        const go = async (run = command) => {
            // every run leaves through here, so a call any rule stopped never reads «already ran» or counts as warned
            const piped = linearWritePiped(typed, cwd);
            const isPipedWarn = !!piped && (await isWarnOnly($, piped.rule));
            if (piped && !isPipedWarn) {
                const stop = await enforce(
                    piped,
                    `nothing in this command ran — x-mod-guard stopped this one command. instead: run the write unpiped, its exit is the receipt. why: ${piped.why}.`,
                );
                if (stop) return stop;
            }
            const { value: spent = [] } = await $.state.get(SPENT);
            // a spend lives as long as its tick or typed sign, never a count: the 51st spend once revived the 1st's word
            if (spends.length) {
                const now = await $.clock.now();
                await $.state.set(SPENT, [
                    ...spent.filter((k) => now - spentAt(k) <= TICK_MS),
                    ...spends,
                ]);
            }
            const result = await next(
                run !== typed ? { ...e, command: run } : e,
            );
            if (result.deny !== undefined && spends.length) {
                const { value: held = [] } = await $.state.get(SPENT);
                await $.state.set(
                    SPENT,
                    held.filter((k) => !spends.includes(k)),
                );
            }
            if (result.deny !== undefined)
                return deny(
                    ISOLATED.test(result.deny)
                        ? `${result.deny} — ${ISOLATED_DOOR}`
                        : result.deny,
                );
            // only now is «already ran» true
            if (piped && isPipedWarn)
                await enforce(
                    piped,
                    `x-mod-guard: instead: ${piped.door}. why: ${piped.why}.`,
                );
            // a line that errors may have run any of its writes before the error, so what it wrote is unread
            const writes = lineWrites(run, cwd, ctx);
            await markWritten($, writes).catch(() => undefined);
            if (result.isError)
                await unreadWritten(
                    $,
                    writes.map(([p]) => p),
                ).catch(() => undefined);
            // a kept script the line rewrote another way (sd, sed -i, a piped tee) holds text the guard never saw
            await unreadWritten(
                $,
                writtenPaths(run, cwd, ctx).filter(
                    (p) => !writes.some(([w]) => w === p),
                ),
            ).catch(() => undefined);
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
                ...warns,
                ...(drift && result.isError ? [drift] : []),
                ...(facts.milestoneUnread?.length
                    ? [milestoneSkipped(facts.milestoneUnread)]
                    : []),
                ...(isQuiet
                    ? []
                    : hints(command, cwd, {
                          ...ctx,
                          ...facts,
                          isForeground:
                              e.tool === 'Bash' && e.run_in_background !== true,
                      })),
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
            // a warning keeps every check below in play: the caller goes on, and the note rides the run (R8)
            warns.push(wouldRefuse(r.rule, note));
            return undefined;
        };
        // a file another live session holds (x-mod-holds) is refused before any other rule; holds has no escape
        const held = await heldBy($, command, cwd, ctx).catch(() => undefined);
        if (held) return deny(held);
        const sweep = await stashOver($, command, cwd, ctx).catch(
            () => undefined,
        );
        if (sweep) {
            const stop = await enforce(
                sweep,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${sweep.door}. why: ${sweep.why}.`,
                `instead: ${sweep.door}. why: ${sweep.why}`,
            );
            if (stop) return stop;
        }
        // a refusal, never a warning, so it stays out of WARN_ONLY: a warn would fire after the block it means to
        // prevent (dima's o102)
        const fg =
            e.tool === 'Bash' && e.run_in_background !== true
                ? foregroundClaude(command, cwd)
                : undefined;
        if (fg) {
            const stop = await enforce(
                fg,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${fg.door}. why: ${fg.why}.`,
            );
            if (stop) return stop;
        }
        // born refusing: the typed sign door it fences opened live (FRM-544 slice 0 round 2)
        // a brief typed from a file is read as it stands, a file this turn wrote as written
        const paneTexts: string[] = [];
        for (const file of paneFiles(typed, cwd, ctx)) {
            const text =
                new Map(ctx.written ?? []).get(file) ??
                (await signFile($, file));
            if (text !== undefined) paneTexts.push(text);
        }
        const pane = paneProof(typed, cwd, paneTexts);
        if (pane) {
            const stop = await enforce(
                pane,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${pane.door}. why: ${pane.why}.`,
            );
            if (stop) return stop;
        }
        // herdr names what runs in the terminal; one it cannot read runs, since this fence is narrow by design
        for (const target of keysTargets(typed, cwd)) {
            const got = await $.process
                .run(['hc', 'get', target, '--json'], { timeoutMs: 3000 })
                .catch(() => undefined);
            let app: unknown;
            try {
                app =
                    got?.exitCode === 0
                        ? JSON.parse(got.stdout)?.status?.app
                        : undefined;
            } catch {
                app = undefined;
            }
            if (typeof app !== 'string' || !app) continue;
            const r = keysIntoAgent(target, app);
            const stop = await enforce(
                r,
                `nothing in this command ran — x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}.`,
            );
            if (stop) return stop;
        }
        // a member's raw linear read or comment, as typed (before the api rewrite), names its x linear door; clio's runs (FRM-398)
        const raw = rawLinear(typed, cwd);
        if (raw) {
            const sid = await $.session.id().catch(() => undefined);
            const name = sid ? await sessionName($, sid) : undefined;
            if (name !== undefined && !isCoordinator(name)) {
                const said = `x-mod-guard stopped this one command. instead: ${raw.door}. why: ${raw.why}.`;
                {
                    const stop = await enforce(
                        raw,
                        `nothing in this command ran — ${said}`,
                        said,
                    );
                    if (stop) return stop;
                }
            }
        }
        // a body written past `x linear body --set`, or an actor of dima's, from a member's session: the registry lists its name
        // and it is not clio's, a session the registry does not list fails open (FRM-459)
        const write = linearWrite(typed, cwd);
        if (write) {
            const sid = await $.session.id().catch(() => undefined);
            const name = sid ? await sessionName($, sid) : undefined;
            if (name !== undefined && !isCoordinator(name)) {
                const said = `x-mod-guard stopped this one command. instead: ${write.door}. why: ${write.why}.`;
                const stop = await enforce(
                    write,
                    `nothing in this command ran — ${said}`,
                    said,
                );
                if (stop) return stop;
            }
        }
        // a raw plugin update names x plugin bump, every session's door (FRM-389 exit 7); warn-only until its sixth sense
        const bump = rawPluginUpdate(typed, cwd);
        if (bump) {
            const said = `x-mod-guard stopped this one command. instead: ${bump.door}. why: ${bump.why}.`;
            {
                const stop = await enforce(
                    bump,
                    `nothing in this command ran — ${said}`,
                    said,
                );
                if (stop) return stop;
            }
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
                ? tickFor(
                      $,
                      `pr:${repo}#${pr}`,
                      (t) => quotesPr(t.text, repo, pr),
                      spends,
                  )
                : undefined;
        };
        // a sign lands only on dima's tick on its sign ask (FRM-427, o197) or his typed «sign <id>» (FRM-544); a body's sign line is a new sign
        // unless the ticket's current body already holds it word for word (FRM-478: a tiny write keeps the line). the file is read
        // before the command runs, so one this command writes, one behind a variable and one that cannot be read count as new
        // every sign on the line is judged on its own (R2: a second sign behind an old one)
        const written = writtenPaths(typed, cwd, ctx);
        for (const sign of signWords(typed, cwd, ctx)) {
            const signText =
                sign.file === undefined ||
                sign.file.includes('$') ||
                written.includes(sign.file)
                    ? undefined
                    : await signFile($, sign.file);
            const isNewSign =
                sign.file === undefined ||
                signText === undefined ||
                (await hasNewSignLine($, sign.id, signText));
            // ahead of every other door: a tick, a stash word or a marker on the line's other targets never carries a sign (R3)
            const scope = `sign-${sign.file ? 'body' : 'label'}:${sign.id}`;
            if (
                isNewSign &&
                !(await tickFor(
                    $,
                    scope,
                    (t) => isSignAsk(t.text, sign.id),
                    spends,
                )) &&
                !(await typedSignFor($, scope, sign.id, spends))
            ) {
                const r = {
                    door: `ask dima to tick an orbit ask «✍️ sign ${sign.id}: <title>», or to type «sign ${sign.id}» himself, then sign`,
                    rule: 'sign-untick',
                    targets: [sign.id],
                    why: "a sign is dima's word: only his tick on the ticket's sign ask, or his own typed «sign <id>», carries it",
                };
                const said = `x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}.`;
                {
                    const stop = await enforce(
                        r,
                        `nothing in this command ran — ${said}`,
                        said,
                    );
                    if (stop) return stop;
                }
            }
        }
        // a re-sign on a cli or mods ticket carries a changed `## ⚖️ worth it` section or says why it stands (FRM-486); a ticket linear
        // cannot read counts as unchanged, and the warning names the failed read
        for (const rewrite of worthRewrites(typed, cwd, ctx)) {
            // a body this command writes cannot be read before it runs: judged unread, like the sign check's
            const isWritten = written.includes(rewrite.file);
            const rewritten = isWritten
                ? undefined
                : await signFile($, rewrite.file);
            if (
                !isWritten &&
                (rewritten === undefined || !hasResign(rewritten))
            )
                continue;
            const current = await ticketOf($, rewrite.id).catch(
                () => undefined,
            );
            if (current && !isWorthScope(current.project, current.milestone))
                continue;
            if (
                current &&
                rewritten !== undefined &&
                !resignGap(rewritten, current)
            )
                continue;
            const r = {
                door: isWritten
                    ? `write the body in a call of its own first, so its section can be read; then ${RESIGN_DOOR}`
                    : RESIGN_DOOR,
                rule: 'worth',
                targets: [rewrite.id],
                why: isWritten
                    ? `the body for ${rewrite.id} is a file this command writes, so its \`## ⚖️ worth it\` section cannot be read before the call`
                    : current
                      ? `a re-sign on ${rewrite.id} keeps its \`## ⚖️ worth it\` section as it was, and its line names no reason`
                      : `x-mod-guard could not read ${rewrite.id} from linear, so its \`## ⚖️ worth it\` section counts as unchanged`,
            };
            const said = `x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}.`;
            const stop = await enforce(
                r,
                `nothing in this command ran — ${said}`,
                said,
            );
            if (stop) return stop;
        }
        // enforcing from their first head, never in WARN_ONLY: each fires only on a held layer or a clean's write (FRM-511)
        const stamp = cleanStampWrite(typed, cwd);
        if (stamp) {
            const sid = await $.session.id().catch(() => undefined);
            const name = sid ? await sessionName($, sid) : undefined;
            if (!name || !(isSixthSense(name) || isCoordinator(name))) {
                const said = `x-mod-guard stopped this one command. instead: ${stamp.door}. why: ${stamp.why} (rule ${stamp.rule}).`;
                const stop = await enforce(
                    stamp,
                    `nothing in this command ran — ${said}`,
                    said,
                );
                if (stop) return stop;
            }
        }
        // born refusing: the folder is a tick only while no seat writes it, and the store aims a press (FRM-544 slice 1)
        // a resolve that throws leaves the spelled checks standing
        const lands = await fenceLanding($, typed, cwd).catch(() => undefined);
        const ticksFile =
            ticksWrite(typed, cwd, lands?.ticks, lands?.shelf) ??
            storeWrite(typed, cwd, lands?.store, lands?.plugins);
        if (ticksFile) {
            const said = `x-mod-guard stopped this one command. instead: ${ticksFile.door}. why: ${ticksFile.why} (rule ${ticksFile.rule}).`;
            const stop = await enforce(
                ticksFile,
                `nothing in this command ran — ${said}`,
                said,
            );
            if (stop) return stop;
        }
        const handEdit = holdRecordWrite(typed, cwd);
        if (handEdit) {
            const said = `x-mod-guard stopped this one command. instead: ${handEdit.door}. why: ${handEdit.why} (rule ${handEdit.rule}).`;
            const stop = await enforce(
                handEdit,
                `nothing in this command ran — ${said}`,
                said,
            );
            if (stop) return stop;
        }
        for (const refusal of [
            overrideStoreWrite(typed, cwd),
            overrideTypedDown(typed, cwd),
        ]) {
            if (!refusal) continue;
            const said = `x-mod-guard stopped this one command. instead: ${refusal.door}. why: ${refusal.why} (rule ${refusal.rule}).`;
            const stop = await enforce(
                refusal,
                `nothing in this command ran — ${said}`,
                said,
            );
            if (stop) return stop;
        }
        const merges = [
            ...rawMerges(typed, cwd),
            // a file in another language can read as anything, so its parse failing refuses nothing
            ...(await scriptMerges($, typed, cwd, ctx).catch(() => [])),
        ];
        if (merges.length) {
            const isStackTicked =
                merges.some((m) => m.isStack) &&
                (await tickFor(
                    $,
                    `stack-merge:${guardedOf(typed)}`,
                    quotesCommand(typed),
                    spends,
                )) !== undefined;
            const held = mergeHold(merges, await readMergeHolds($));
            const override = held
                ? undefined
                : await overrideGrant($, 'prs').catch(() => undefined);
            const landsAny = merges.some((m) => !m.isHoldOnly);
            const brake =
                !held && override && landsAny
                    ? await rawMergeBrake($)
                    : undefined;
            const hold =
                held ??
                (brake
                    ? {
                          door: "dima's look, then x lane merge-auto <pr> --release-brake --dima-ok <pr>",
                          rule: 'raw-merge',
                          targets: ['merge-brake'],
                          why: `${brake}, and operator-override never opens it`,
                      }
                    : rawMergeRefused(
                          // `gh stack merge` stays outside the override (FRM-524 `## out`)
                          override ? merges.filter((m) => m.isStack) : merges,
                          isStackTicked,
                      ));
            if (override && !hold && landsAny)
                await overrideLogPass(
                    $,
                    override,
                    `let through: ${typed}`,
                ).catch(() => undefined);
            if (hold) {
                const said = `x-mod-guard stopped this one command. instead: ${hold.door}. why: ${hold.why} (rule ${hold.rule}).`;
                const stop = await enforce(
                    hold,
                    `nothing in this command ran — ${said}`,
                    said,
                );
                if (stop) return stop;
            }
        }
        // a refusal, never in WARN_ONLY: a warn would run the merge it means to stop (dima's o102, FRM-423)
        const word = mergeWord(typed, cwd);
        if (word) {
            const { value: prompt = '' } = await $.state.get(PROMPT);
            const unproven = word.targets.filter(
                (t) => !namesWhole(prompt, t) && !namesWhole(prompt, `#${t}`),
            );
            // his tick on the pr's ask, or on an ask quoting this whole command in backticks (sixth sense round 1: the o40
            // shape, `x lane merge-auto 104 --apply --dima-ok 104`, stayed refused)
            const isTicked =
                unproven.length > 0 &&
                ((unproven.every((t) => t.replace(/^#/, '') === pr) &&
                    (await prTick()) !== undefined) ||
                    (await tickFor(
                        $,
                        guardedOf(typed),
                        quotesCommand(typed),
                        spends,
                    )) !== undefined);
            if (unproven.length && !isTicked) {
                const said = `x-mod-guard stopped this one command. instead: ${word.door}. why: ${word.why} (rule dima-ok-flag); it does not name: ${unproven.join(' ')}.`;
                {
                    const stop = await enforce(
                        { ...word, targets: unproven },
                        `nothing in this command ran — ${said}`,
                        said,
                    );
                    if (stop) return stop;
                }
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
        if (verdict.kind === 'run') return go();
        // the marker is only a claim: dima's own last prompt, or his tick, must name every target the marked refusals named
        const runMarked = async (marked: Refusal[]) => {
            const { value: said = '' } = await $.state.get(PROMPT);
            const named = [...new Set(marked.flatMap((r) => r.targets))].filter(
                (t) => !namesWhole(said, t),
            );
            const unproven =
                named.length &&
                (await tickFor(
                    $,
                    guardedOf(command),
                    quotesCommand(command),
                    spends,
                ))
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
            const targets = markers(command);
            await record($, {
                command,
                door: marked.map((r) => r.door).join('; '),
                kind: 'escaped',
                rule: [...new Set(marked.map((r) => r.rule))].join(', '),
                target: targets.join(', '),
                why: marked.map((r) => r.why).join('; '),
            });
            $.ui.log(`x-mod-guard: ran on dima-ok: ${targets.join(', ')}`);
            return go();
        };
        // dima's tick on an ask quoting every target is his word, no marker needed (FRM-427)
        if (verdict.kind === 'refused') {
            const found = refusals(command, cwd, { ...ctx, ...facts });
            const targets = [...new Set(found.flatMap((r) => r.targets))];
            const asked = await stashAllowed($, command, cwd, ctx, found);
            if (asked) {
                await record($, {
                    command,
                    door: "dima's word on the stash",
                    kind: 'escaped',
                    rule: 'git-discard',
                    target: asked.dirs.join(', '),
                    why: asked.said,
                });
                $.ui.log(
                    `x-mod-guard: ran on dima's word on the stash: ${asked.dirs.join(', ')}`,
                );
                return go();
            }
            const tick = await tickFor(
                $,
                guardedOf(command),
                quotesCommand(command),
                spends,
            );
            // every refusal on the line is judged: a warn-only one ahead of a floor rule never runs the line past it, and
            // one the marker names waits for the marker's own proof, so a warn-only flag never turns a proven marker into a deny
            if (!tick) {
                const isMarked = markedBy(command);
                const all = found.length ? found : [verdict.refusal];
                for (const r of all.filter((r) => !isMarked(r))) {
                    const stop = await enforce(r, message(r));
                    if (stop) return stop;
                }
                const marked = all.filter(isMarked);
                return marked.length ? runMarked(marked) : go();
            }
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
        return runMarked(verdict.refusals);
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

    // an Edit or Write into the ticks folder would forge his press, through any path that reaches it (FRM-544 slice 1)
    on(
        'tool.call',
        { tool: /^(Edit|MultiEdit|NotebookEdit|Write)$/ },
        async ($, e, next) => {
            const path =
                'file_path' in e
                    ? e.file_path
                    : 'notebook_path' in e
                      ? e.notebook_path
                      : undefined;
            if (typeof path !== 'string') return next(e);
            const home = await $.env.get('HOME').catch(() => undefined);
            const spelled = path.replace(/^~(?=\/|$)/, home ?? '~');
            const resolved = (
                await realPath($, spelled).catch(() => ({ file: spelled }))
            ).file;
            const fence = [spelled, resolved].some(isTicksPath)
                ? TICKS_WRITE
                : [spelled, resolved].some(isStorePath)
                  ? STORE_WRITE
                  : undefined;
            if (!fence) return next(e);
            await record($, {
                command: `${e.tool} ${path}`,
                door: fence.door,
                kind: 'refused',
                rule: fence.rule,
                target: path,
                why: fence.why,
            });
            return {
                deny: `x-mod-guard stopped this ${e.tool}. instead: ${fence.door}. why: ${fence.why}: ${path}`,
            };
        },
    ).catch(() => ({ deny: FAILED }));

    // an Edit or Write under a live mod's hooks/ waits for that mod's own tests to be green
    on(
        'tool.call',
        { tool: /^(Edit|MultiEdit|Write)$/ },
        async ($, e, next) => {
            const path = 'file_path' in e ? e.file_path : undefined;
            if (typeof path !== 'string') return next(e);
            const mod = await liveModOf($, path);
            if (!mod) return next(e);
            // a run past the limit rejects; it is refused with the same door, never the bare fail-closed line
            const run = await $.process
                .run(['claude', 'plugin', 'test', mod], {
                    timeoutMs: LIVE_TEST_MS,
                })
                .catch(() => undefined);
            if (run?.exitCode === 0) return next(e);
            const name = mod.split('/').filter(Boolean).at(-1) ?? mod;
            const verdict = run
                ? 'is red'
                : `outlived ${LIVE_TEST_MS / 1000} s`;
            const why = `${name}'s plugin test ${verdict}, and a save under its hooks/ reloads into every live session`;
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
            if (
                e.tool !== 'Read' &&
                (isOverrideStore(real) || isOverrideStore(path))
            ) {
                const refusal = overrideStoreRefusal(path);
                await record($, {
                    command: `${e.tool} ${path}`,
                    door: refusal.door,
                    kind: 'refused',
                    rule: refusal.rule,
                    target: path,
                    why: refusal.why,
                });
                return {
                    deny: `x-mod-guard stopped this ${e.tool}. instead: ${refusal.door}. why: ${refusal.why}: ${path}`,
                };
            }
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
            if (
                e.tool === 'Write' &&
                typeof e.content === 'string' &&
                result.deny === undefined &&
                !result.isError
            )
                await markWritten($, [
                    [resolve(path, '/', {}), e.content],
                ]).catch(() => undefined);
            // MultiEdit is missing from this build's tool types but reaches the hook live
            const tool: string = e.tool;
            const edits =
                e.tool === 'Edit'
                    ? [e as unknown as TextEdit]
                    : tool === 'MultiEdit'
                      ? ((e as unknown as { edits?: TextEdit[] }).edits ?? [])
                      : [];
            if (edits.length && result.deny === undefined && !result.isError)
                await editWritten($, resolve(path, '/', {}), edits).catch(
                    () => undefined,
                );
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
        // a member's own traffic (sixth sense's findings, codie's «final») is a report, never a lane job
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
        let overrideNote: string | undefined;
        let signNote: string | undefined;
        if (TYPED_BY_DIMA.has(e.origin.kind)) {
            const sid = await $.session.id().catch(() => undefined);
            const entry = sid
                ? await registryEntry($, sid).catch(() => undefined)
                : undefined;
            const isBg = entry?.isBg ?? false;
            const isHis = (isBg ? TYPED_BY_DIMA_IN_BG : TYPED_BY_DIMA).has(
                e.origin.kind,
            );
            // a session's first typed prompt is read as its spawn prompt, since no field tells the two apart (measured
            // 2026-11-10): a seat could start a seat whose brief approves. so it approves nothing: no sign, no # dima-ok
            // target, no stash word, no override. a bg session's spawn prompt is no origin of his already; a session
            // that kept his prompt before this rule counts as prompted
            const isFirst = isHis && !isBg && !(await wasPrompted($));
            if (isHis) await $.state.set(PROMPTED, true).catch(() => undefined);
            if (isHis && !isFirst) {
                await $.state.set(PROMPT, e.text).catch(() => undefined);
                await $.state.set(TOLD, e.text).catch(() => undefined);
                await keepTypedSigns($, e.text).catch(() => undefined);
            }
            const ask = overrideAsked(e.text);
            if (isFirst && signsTyped(e.text).length)
                signNote = FIRST_PROMPT_NOTE;
            // no registry row reads as not his: a bg session's brief must never slip through a read that failed; said out
            // loud, since a word that moved nothing must not pass for one that did
            if (ask && !entry)
                overrideNote =
                    "operator-override: this session's registry row did not read, so the switch did not move; tell dima to type it in a session that reads, or x lane merge-auto --override-check";
            // his override works from a session's first prompt (dima, 16:26: «I want my system override switch working
            // from the start»); pane-proof fences a seat typing it, the registry row a bg brief
            if (ask && entry && isHis)
                overrideNote = await overrideFlip($, ask).catch(
                    (err: unknown) =>
                        `operator-override: the switch did not move: ${String(err)}`,
                );
        }
        await logOrigin($, e).catch(() => undefined);
        const sent = await next(e);
        const notes = [overrideNote, signNote].filter(
            (n): n is string => n !== undefined,
        );
        return !notes.length || sent.drop !== undefined
            ? sent
            : { ...sent, context: [...(sent.context ?? []), ...notes] };
    });

    // his word on the stash holds for the turn it was typed in (FRM-426 exit 1: «in this turn»)
    on('turn.complete', async ($, e, next) => {
        if (!e.agentId) {
            await $.state.set(TOLD, '').catch(() => undefined);
            await $.state.set(WRITTEN, {}).catch(() => undefined);
        }
        return next(e);
    });

    // an MCP tool is outside the typed tool table, so the hook reads every call and answers the one it names
    on('tool.call', async ($, e, next) => {
        if ((e.tool as string) !== START_SESSION) return next(e);
        const prompt = (e as { prompt?: unknown }).prompt;
        // a summon's first prompt can read as typed, so a brief that is only the phrase never starts
        if (typeof prompt === 'string' && overrideAsked(prompt)) {
            const refusal = overrideStoreRefusal('start_session');
            await record($, {
                command: 'start_session',
                door: refusal.door,
                kind: 'refused',
                rule: refusal.rule,
                target: 'start_session',
                why: refusal.why,
            }).catch(() => undefined);
            return {
                deny: `x-mod-guard stopped this spawn. instead: ${refusal.door}. why: ${refusal.why}`,
            };
        }
        const reason =
            typeof prompt === 'string'
                ? await trialGap($, prompt).catch(() => undefined)
                : undefined;
        if (!reason) return next(e);
        const door =
            'name each live trial in the brief with how the lane uses it, or write «trial skipped: <name> — <why>»; a blind trial stays unnamed';
        const isWarn = await isWarnOnly($, 'spawn-trial');
        await record($, {
            command: 'start_session',
            door,
            kind: isWarn ? 'warned' : 'refused',
            rule: 'spawn-trial',
            target: 'live trial',
            why: reason,
        }).catch(() => undefined);
        if (!isWarn)
            return {
                deny: `x-mod-guard stopped this spawn. instead: ${door}. why: ${reason}`,
            };
        const ran = await next(e);
        if (ran.deny !== undefined) return ran;
        return {
            ...ran,
            context: [
                ...(ran.context ?? []),
                wouldRefuse('spawn-trial', `${door}. why: ${reason}`),
            ],
        };
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
