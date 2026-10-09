import type { EngineInterface, Register } from 'claude-code';

import { briefPaths } from './rules/brief.ts';
import type { Brief, Context } from './rules/command.ts';
import { overwrittenPaths, writtenPaths } from './rules/overwrite.ts';
import { rewrite } from './rules/rewrite.ts';
import {
    addedPaths,
    check,
    message,
    namesWhole,
    removedTrees,
} from './rules.ts';

// x-mod-guard: every Bash call is read before it runs; a floor command or a hazard shape is refused with its door.
// each refusal and each escape is kept in $.store as one `event:` key, with per-day counts a halt reads.

export type GuardEvent = {
    at: number;
    sid: string;
    name?: string;
    command: string;
    kind: 'refused' | 'escaped';
    door: string;
    target: string;
    // why it was refused, the line x-mod-stash shows unfolded; an escape names every rule it stepped past
    why: string;
    // the rule that fired; an escape names every rule it stepped past, comma-joined
    rule: string;
};

type Tally = { refused: number; escaped: number };
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
});

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
const HOLD = 'hold:';
const HOLD_IDLE_MS = 30 * 60_000;
type Hold = { at: number; file: string; landed?: boolean };
type Holder = { pid?: number; start?: string; idleSince: number | null };

async function heldBy(
    $: EngineInterface,
    command: string,
    cwd: string,
    ctx: Context,
): Promise<string | undefined> {
    const paths = writtenPaths(command, cwd, ctx);
    if (!paths.length) return undefined;
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
    for (const path of paths) {
        const real = await $.fs.stat(path, { resolve: true }).then(
            (s) => s.realPath ?? path,
            () => path,
        );
        for (const [key, value] of Object.entries(held)) {
            if (!key.startsWith(HOLD)) continue;
            const cut = key.indexOf(':', HOLD.length);
            const holder = key.slice(HOLD.length, cut);
            if (key.slice(cut + 1) !== real.toLowerCase() || holder === sid)
                continue;
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
            const mins = Math.round((now - hold.at) / 60000);
            return `x-mod-holds: ${path} is held by session ${holder.slice(0, 8)}, which took it ${mins} min ago. wait, or ask it to commit the file.`;
        }
    }
    return undefined;
}

async function isReleased(
    $: EngineInterface,
    holder: Holder | undefined,
    hold: Hold,
    now: number,
) {
    if (!holder) return true;
    if (holder.idleSince !== null && now - holder.idleSince >= HOLD_IDLE_MS)
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
    if (!hold.landed) return false;
    const git = await $.process
        .run(['git', 'status', '--porcelain', '--', hold.file], {
            cwd: hold.file.slice(0, hold.file.lastIndexOf('/')) || '/',
        })
        .catch(() => null);
    return !git || git.exitCode !== 0 || git.stdout.trim() === '';
}

const isUnder = (path: string, dir: string) =>
    path === dir || path.startsWith(`${dir}/`);

const SEEN = { key: 'seen', plugin: 'x-mod-guard' } as const;
// dima's last prompt typed at the composer or sent over the bridge: a peer's message, a notification, a plugin's or an
// sdk turn never lands here, and only this plugin writes $.state, so no tool call can forge it
const PROMPT = { key: 'prompt', plugin: 'x-mod-guard' } as const;
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
    'edit a scratch copy: `scratch-edit pull <file>`, get `claude plugin test` green on it, then `scratch-edit push`';

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
        const missing = new Set<string>();
        for (const path of addedPaths(command, cwd, ctx))
            if (!(await $.fs.exists(path))) missing.add(path);
        const kinds: NonNullable<Context['kinds']> = new Map();
        for (const path of overwrittenPaths(command, cwd, ctx))
            if (await $.fs.exists(path))
                kinds.set(path, (await $.fs.stat(path)).kind);
        const cleanTrees = new Set<string>();
        for (const tree of removedTrees(command, cwd, ctx))
            if (await isCleanTree($, tree)) cleanTrees.add(tree);
        const briefs = new Map<string, Brief>();
        for (const path of briefPaths(command, cwd, ctx))
            if (await $.fs.exists(path))
                briefs.set(path, await readBrief($, path, ctx.home));
        const verdict = check(command, cwd, {
            ...ctx,
            briefs,
            cleanTrees,
            kinds,
            missing,
        });
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
        const go = async () => {
            const result = await next(notes.length ? { ...e, command } : e);
            if (result.deny !== undefined) return deny(result.deny);
            const context = [
                ...(notes.length
                    ? [
                          `x-mod-guard rewrote this call before it ran: ${notes.join('; ')}. it ran: ${command}`,
                      ]
                    : []),
                ...(drift && result.isError ? [drift] : []),
            ];
            if (!context.length) return result;
            return {
                ...result,
                context: [...(result.context ?? []), ...context],
            };
        };
        // a file another live session holds (x-mod-holds) is refused before any other rule; holds has no escape
        const held = await heldBy($, command, cwd, ctx).catch(() => undefined);
        if (held) return deny(held);
        if (verdict.kind === 'run') return go();
        if (verdict.kind === 'refused') {
            const { refusal } = verdict;
            await record($, {
                command,
                door: refusal.door,
                kind: 'refused',
                rule: refusal.rule,
                target: refusal.targets[0] ?? '',
                why: refusal.why,
            });
            return deny(message(refusal));
        }
        // the marker is only a claim: dima's own last prompt must name every target the refusals named
        const { value: said = '' } = await $.state.get(PROMPT);
        const unproven = [
            ...new Set(verdict.refusals.flatMap((r) => r.targets)),
        ].filter((t) => !namesWhole(said, t));
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
                const cwd = await $.session.cwd();
                if (!isUnder(cwd, `${home}/frame/cclio`)) return result;
                const n = ((await $.state.get(EDITS)).value ?? 0) + 1;
                await $.state.set(EDITS, n);
                if (n !== EDIT_LIMIT) return result;
                return {
                    ...result,
                    context: [...(result.context ?? []), DELEGATE_NOTE],
                };
            } catch {
                return result;
            }
        },
    );

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

    on('prompt.submit', async ($, e, next) => {
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
        if (!e.fork || WHY_FORK.test(e.prompt)) return next(e);
        await record($, {
            command: `fork: ${e.description}`,
            door: FORK_DOOR,
            kind: 'refused',
            rule: 'fork',
            target: 'why-fork',
            why: FORK_WHY,
        });
        return { deny: FORK_REFUSED };
    }).catch(() => ({ deny: FAILED }));
};
