import type { EngineInterface, Register, ToolCallResult } from 'claude-code';

import { herdrSafeOf, keepTabsMade } from './herdr-close.ts';
import { stashOver } from './holds.ts';
import {
    SEAT_GRANT_MS,
    brakeOf,
    dropSeatGrant,
    masterOverride,
    overrideFlip,
    overrideLogPass,
    seatSpends,
    writeSeatGrant,
} from './operator-override.ts';
import { CLIPBOARD, CLIPBOARD_TOOL, clipboardTool } from './rules/clipboard.ts';
import type { Context, Refusal } from './rules/command.ts';
import { TRASH, tickedRest } from './rules/command.ts';
import {
    PR_HINT,
    bareHelps,
    helpScripts,
    hints,
    verbHelps,
} from './rules/hint.ts';
import { overrideAsked } from './rules/operator-override.ts';
import {
    RELEASE_BRAKE,
    rawMergeRefused,
    rawMerges,
    releasesBrake,
} from './rules/raw-merge.ts';
import { rewrite } from './rules/rewrite.ts';
import { seatMove } from './rules/seat-move.ts';
import { message, refusals, removedTrees, tmpDirs } from './rules.ts';
import {
    type Tick,
    guardedOf,
    quotesCommand,
    spend,
    tickFor,
    unspend,
} from './ticks.ts';

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

// a lane member by either sign: its thread record's role, or a member badge in its registry name; a record or a row
// that does not read is no sign
const MEMBER_ROLES = new Set(['codie', 'sixth-sense', 'probe']);
const MEMBER_NAME = /🔧|🔎|🐕|^\s*probe/i;
async function isMemberSession($: EngineInterface, home: string | undefined) {
    const sid = await $.session.id().catch(() => undefined);
    if (!sid) return false;
    const raw = await $.fs
        .read(`${home}/.claude/shelf/threads.json`)
        .catch(() => '');
    try {
        const { threads } = JSON.parse(raw) as { threads?: unknown };
        const own = Array.isArray(threads)
            ? threads.find((t: { sessionId?: unknown }) => t?.sessionId === sid)
            : undefined;
        if (
            MEMBER_ROLES.has((own as { role?: string } | undefined)?.role ?? '')
        )
            return true;
    } catch {}
    const name = await sessionName($, sid).catch(() => undefined);
    return name !== undefined && MEMBER_NAME.test(name);
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

async function rememberHelps($: EngineInterface, clis: string[]) {
    if (!clis.length) return;
    const { value = [] } = await $.state
        .get(HELPED)
        .catch(() => ({ value: [] }));
    const fresh = clis.filter((c) => !value.includes(c));
    if (fresh.length)
        await $.state.set(HELPED, [...value, ...fresh]).catch(() => undefined);
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
    const { command, notes } = rewrite(
        typed,
        await $.env.get('HC_TERMINAL_ID').catch(() => undefined),
    );
    const cwd = await $.session.cwd();
    const home = await $.env.get('HOME');
    // a failed root reads as no session's, never the cwd a `cd` moved
    const root = await $.session.root().catch(() => '');
    const base: Context = {
        home,
        isClio: isUnder(root, `${home}/frame/_clio`),
        jobDir: await $.env.get('CLAUDE_JOB_DIR'),
    };
    // the member lookup runs only for a line the clipboard rule would stop
    const isMember =
        refusals(command, cwd, { ...base, isMember: true }).some(
            (r) => r.rule === CLIPBOARD,
        ) && (await isMemberSession($, home));
    const ctx = {
        ...base,
        isMember,
        ...(await lookUp($, command, cwd, base)),
    };
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

// his tick on a seat switch reaches x as a grant; what drops it, undefined when no tick covers the line. the grant's file is the
// whole record of the spend, never `$.state`: a background run says nothing of how it ended, and a timer's `$` may read the
// state as it was at the call, so writing it back would revive a tick another call spent meanwhile
async function openSeat($: EngineInterface, command: string, cwd: string) {
    const move = seatMove(command, cwd);
    const sid = move && (await $.session.id().catch(() => undefined));
    if (!move || !sid) return undefined;
    const held = await seatSpends($, sid).catch(() => undefined);
    if (!held) return undefined;
    const before = held.length;
    const tick = await tickFor(
        $,
        guardedOf(command),
        quotesCommand(command),
        held,
    );
    if (!tick) return undefined;
    const path = await writeSeatGrant($, {
        ...move,
        command,
        sid,
        spends: held.slice(before),
        tick,
    }).catch((err: unknown) => {
        $.ui.log(`x-mod-guard: the seat grant was not written: ${String(err)}`);
        return undefined;
    });
    if (path === undefined) return undefined;
    const close = () => dropSeatGrant($, path);
    $.clock.after(SEAT_GRANT_MS, close);
    return close;
}

export const register: Register = (on) => {
    // a member's call of computer use's pasteboard writer: the clipboard rule by the tool's name, his tick on an ask
    // quoting that name and the off switch open it as they open the floor; no member sign, or one that does not read, runs
    on(
        'tool.call',
        { tool: new RegExp(`^${CLIPBOARD_TOOL}$`) },
        async ($, e, next) => {
            const home = await $.env.get('HOME').catch(() => undefined);
            if (!(await isMemberSession($, home).catch(() => false)))
                return next(e);
            const master = await masterOverride($).catch(() => undefined);
            const stop = clipboardTool();
            const spends: string[] = [];
            const tick = master
                ? undefined
                : await tickFor(
                      $,
                      CLIPBOARD_TOOL,
                      quotesCommand(CLIPBOARD_TOOL),
                      spends,
                  ).catch(() => undefined);
            const event = {
                command: CLIPBOARD_TOOL,
                rule: stop.rule,
                target: CLIPBOARD_TOOL,
            };
            if (!master && !tick) {
                await record($, {
                    ...event,
                    door: stop.door,
                    kind: 'refused',
                    why: stop.why,
                });
                return { deny: message(stop) };
            }
            await record($, {
                ...event,
                door: master
                    ? `operator-override ${master.scope}, by ${master.by} at ${master.at}`
                    : `dima's tick on ${tick?.id}`,
                kind: master ? 'warned' : 'escaped',
                why: master ? stop.why : (tick?.text ?? ''),
            });
            if (master)
                await overrideLogPass(
                    $,
                    master,
                    `let through: ${CLIPBOARD_TOOL}`,
                ).catch(() => undefined);
            await spend($, spends);
            const result = await next(e);
            if (result.deny !== undefined || result.isError)
                await unspend($, spends);
            return master
                ? withContext(result, [
                      `x-mod-guard: operator-override is on, so this ran past the floor (rule ${stop.rule}): ${stop.why}`,
                  ])
                : result;
        },
    );

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
        const closeSeat = master ? undefined : await openSeat($, command, cwd);
        await spend($, spends);
        const result = await next(run !== typed ? { ...e, command: run } : e);
        if (result.deny !== undefined || result.isError) {
            await unspend($, spends);
            await closeSeat?.();
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
