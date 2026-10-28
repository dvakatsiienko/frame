import { brief } from './rules/brief.ts';
import {
    type Command,
    type Context,
    type Refusal,
    type Verdict,
    adds,
    commands,
    gitDir,
    gitParts,
    hasFlag,
    isJobTmp,
    operands,
    resolve,
} from './rules/command.ts';
import { floor } from './rules/floor.ts';
import { hazard } from './rules/hazard.ts';
import { background, commentMidline, lint, unbraced } from './rules/lint.ts';
import { frozenInstallDirs, lockfile } from './rules/lockfile.ts';
import { milestone } from './rules/milestone.ts';
import { notes } from './rules/notes.ts';
import { landings, overwrite } from './rules/overwrite.ts';
import { parse } from './shell.ts';

const SHELLS = new Set(['sh', 'bash', 'zsh']);
// the paths every git add in the command names, for the caller to look up on disk; a path an earlier part of the
// same command makes (a > redirect, touch, mkdir, a cp or mv dest) is there by the time the add runs
export function addedPaths(command: string, cwd: string, ctx: Context = {}) {
    const made = new Set<string>();
    return commands(parse(command), cwd).flatMap((c) => {
        const added = adds(c, ctx)
            .map((a) => a.path)
            .filter((p) => !made.has(p));
        const dir = resolve(c.dir, '/', ctx);
        for (const w of c.writes) made.add(resolve(w, dir, ctx));
        if (c.name === 'touch' || c.name === 'mkdir')
            for (const o of operands(c.args)) made.add(resolve(o, dir, ctx));
        if (c.name === 'cp' || c.name === 'mv')
            for (const l of landings(c, ctx)) made.add(l.path);
        return added;
    });
}
function missingAdd(c: Command, ctx: Context): Refusal | undefined {
    const gone = adds(c, ctx).filter((a) => ctx.missing?.has(a.path));
    if (!gone.length) return undefined;
    return {
        door: 'stage only paths that exist; a deleted file stages with git rm <path>',
        rule: 'git-add-missing',
        targets: gone.map((a) => a.text),
        why: 'git add of a missing path stages nothing and the commit lands partial',
    };
}
// the os temp roots: a throwaway repo from `mktemp -d` lands under /var/folders, a hand-made fixture under /tmp
const TEMP_ROOTS = [
    '/tmp/',
    '/private/tmp/',
    '/var/folders/',
    '/private/var/folders/',
];
// a scratch clone under the job's own tmp or an os temp root: everything its local git does stays there; a push or a
// skipped hook does not
const LOCAL_GIT = new Set(['git-discard', 'git-rewrite', 'git-sweep']);
function isScratchGit(c: Command, r: Refusal, ctx: Context) {
    if (c.name !== 'git' || !LOCAL_GIT.has(r.rule)) return false;
    const { sub, subArgs } = gitParts(c.args);
    if (sub === 'push') return false;
    const dir = gitDir(c, ctx);
    const paths = [dir, ...operands(subArgs).map((o) => resolve(o, dir, ctx))];
    return paths.every(
        (p) =>
            isJobTmp(p, ctx) || TEMP_ROOTS.some((root) => p.startsWith(root)),
    );
}
// cclio removes a scratch tree (a clean one: --force still asks) and deletes a scratch/* branch without dima's word;
// a merged branch's `git branch -d` already runs for everyone, since git itself refuses an unmerged one
const SCRATCH_TREE = /\/\.claude\/(worktrees\/[^/]+|jobs\/[^/]+\/tmp\/.+)$/;
// the scratch trees a cclio `git worktree remove` names, for the caller to look up; a tree elsewhere asks anyway
export function removedTrees(command: string, cwd: string, ctx: Context = {}) {
    if (!ctx.isCclio) return [];
    return commands(parse(command), cwd).flatMap((c) => {
        if (c.name !== 'git') return [];
        const { sub, subArgs } = gitParts(c.args);
        const ops = operands(subArgs);
        if (sub !== 'worktree' || ops[0] !== 'remove') return [];
        const dir = gitDir(c, ctx);
        return ops
            .slice(1)
            .map((t) => resolve(t, dir, ctx))
            .filter((t) => SCRATCH_TREE.test(t));
    });
}
function isCleanup(c: Command, r: Refusal, ctx: Context) {
    if (!ctx.isCclio || c.name !== 'git' || r.rule !== 'git-rewrite')
        return false;
    const { sub, subArgs } = gitParts(c.args);
    const ops = operands(subArgs);
    if (sub === 'branch')
        return ops.length > 0 && ops.every((o) => o.startsWith('scratch/'));
    if (sub !== 'worktree' || ops[0] !== 'remove') return false;
    if (hasFlag(subArgs, ['--force'], 'f')) return false;
    const dir = gitDir(c, ctx);
    const trees = ops.slice(1).map((t) => resolve(t, dir, ctx));
    // a tree never looked up, or holding a `.scratch/` plan or commits only its HEAD reaches, asks
    return (
        trees.length > 0 &&
        trees.every((t) => SCRATCH_TREE.test(t) && ctx.cleanTrees?.has(t))
    );
}
export function refusals(
    command: string,
    cwd: string,
    ctx: Context = {},
): Refusal[] {
    const parsed = parse(command);
    const list = commands(parsed, cwd);
    const out: Refusal[] = [];
    list.forEach((c, i) => {
        const found =
            floor(c, ctx) ??
            hazard(c, ctx) ??
            lockfile(c, ctx) ??
            overwrite(c, ctx) ??
            lint(c, list[i + 1]) ??
            missingAdd(c, ctx) ??
            brief(c, ctx) ??
            notes(c, ctx) ??
            milestone(c, ctx);
        if (found && !isScratchGit(c, found, ctx) && !isCleanup(c, found, ctx))
            out.push(found);
        // a nested shell's script is a command too
        // `-c` alone or in a cluster: `bash -lc`
        const dashC = SHELLS.has(c.name)
            ? c.args.findIndex((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w.text))
            : -1;
        const script = dashC >= 0 ? c.args[dashC + 1] : undefined;
        if (script) out.push(...refusals(script.text, c.dir, ctx));
        if (c.name === 'eval')
            out.push(
                ...refusals(c.args.map((w) => w.text).join(' '), c.dir, ctx),
            );
    });
    for (const r of [
        background(list),
        unbraced(parsed),
        commentMidline(parsed),
    ])
        if (r) out.push(r);
    // one line per rule and target: a lint seen on every command of a pipeline is one finding
    return out.filter(
        (r, i) =>
            out.findIndex(
                (o) =>
                    o.rule === r.rule && o.targets.join() === r.targets.join(),
            ) === i,
    );
}
// a target dima named as a whole word: each edge is the prompt's end, a space, a quote (his «», ios “” included),
// punctuation or a dash; a `.` or `/` closes it only before a space or the end (`build.`, `/x/build/`).
// a target of bare symbols (`.`, `&`) reads in any prose, so it counts only inside the marker phrase he pastes
const EDGE = /[\s"'`,;:!?()[\]<>«»“”‘’—–]/;
const CLOSER = /[./]/;
export function namesWhole(said: string, target: string) {
    if (!/[\p{L}\p{N}]/u.test(target))
        return namesWhole(said, `dima-ok: ${target}`);
    for (
        let i = said.indexOf(target);
        i >= 0;
        i = said.indexOf(target, i + 1)
    ) {
        const before = said[i - 1];
        const end = i + target.length;
        const after = said[end];
        const isStart = before === undefined || EDGE.test(before);
        const isEnd =
            after === undefined ||
            EDGE.test(after) ||
            (CLOSER.test(after) &&
                (end + 1 === said.length || /\s/.test(said[end + 1] ?? '')));
        if (isStart && isEnd) return true;
    }
    return false;
}
export function markers(command: string) {
    return parse(command)
        .comments.map((c) => c.match(/^\s*dima-ok:\s*(.+?)\s*$/)?.[1])
        .filter((t): t is string => !!t);
}
export function check(
    command: string,
    cwd: string,
    ctx: Context = {},
): Verdict {
    const found = refusals(command, cwd, ctx);
    if (!found.length) return { kind: 'run' };
    const marked = markers(command);
    // a marker names one target, or several split by spaces or commas; every target of a refusal must be named
    const ok = new Set(marked.flatMap((m) => [m, ...m.split(/[\s,]+/)]));
    const open = found.find((r) => !r.targets.every((t) => ok.has(t)));
    if (open) return { kind: 'refused', refusal: open };
    return { kind: 'escaped', refusals: found, targets: marked };
}
export function message(r: Refusal) {
    return `nothing in this command ran — x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}. only after dima's word, end the command with # dima-ok: ${r.targets.join(' ')}`;
}

// the dirs a `CI=1 pnpm install` in this command runs in, for the caller to check for a changed manifest
export function installDirs(command: string, cwd: string, ctx: Context = {}) {
    return frozenInstallDirs(commands(parse(command), cwd), ctx);
}

// a foreground `claude -p` holds the session's thread until it ends: a probe of eight runs blocked cclio for 3 minutes
// (dima's o102, FRM-395); `# fg-ok: <why>` lets a real need through, and a background run is never judged
export function foregroundClaude(
    command: string,
    cwd: string,
): Refusal | undefined {
    const parsed = parse(command);
    if (parsed.comments.some((c) => /^\s*fg-ok:\s*\S/.test(c)))
        return undefined;
    const isClaudeP = commands(parsed, cwd).some(
        (c) =>
            c.name === 'claude' &&
            c.args.some((w) => w.text === '-p' || w.text === '--print'),
    );
    if (!isClaudeP) return undefined;
    return {
        door: 'run the same command with run_in_background: true, or end it with # fg-ok: <why> for a real need',
        rule: 'foreground-claude',
        targets: ['claude -p'],
        why: 'a foreground claude -p holds this session until it ends',
    };
}

// a plugin's cache moves through x plugin bump, never a raw update: 36 raw update calls in 14 days, while the bump also
// reads the cache back (FRM-389 exit 7, dima's o33); every session, cclio's included
export function rawPluginUpdate(
    command: string,
    cwd: string,
): Refusal | undefined {
    for (const c of commands(parse(command), cwd)) {
        if (c.name !== 'claude') continue;
        const [a, b, d] = c.args.map((w) => w.text);
        if (a !== 'plugin') continue;
        const isUpdate =
            b === 'update' || (b === 'marketplace' && d === 'update');
        if (!isUpdate) continue;
        return {
            door: 'x plugin bump --apply <plugin>',
            rule: 'raw-plugin-update',
            targets: [
                b === 'update'
                    ? 'claude plugin update'
                    : 'claude plugin marketplace update',
            ],
            why: 'x plugin bump bumps, updates the marketplace and the plugin, and reads the cache back in one call (FRM-345)',
        };
    }
    return undefined;
}

// x lane merge-auto trusts a --dima-ok <pr> that reached it, so this is the proof: dima's own last prompt names the pr
// (FRM-423 o140, the guard's door); the caller checks the prompt
// the words of a command's `x lane merge-auto` call, one in a nested shell or an eval included
export function mergeAutoWords(
    command: string,
    cwd: string,
): string[] | undefined {
    for (const c of commands(parse(command), cwd)) {
        const words = c.args.map((w) => w.text);
        // a nested shell's script, or an eval's words, is a command too
        const dashC = SHELLS.has(c.name)
            ? words.findIndex((w) => /^-[A-Za-z]*c[A-Za-z]*$/.test(w))
            : -1;
        const nested =
            dashC >= 0
                ? words[dashC + 1]
                : c.name === 'eval'
                  ? words.join(' ')
                  : undefined;
        const inner = nested ? mergeAutoWords(nested, c.dir) : undefined;
        if (inner) return inner;
        // x's root booleans (--json, --board) sit before the family or between it and the verb
        const bare = words.filter((w) => !w.startsWith('-'));
        const isMerge = bare.some(
            (w, i) => w === 'lane' && bare[i + 1] === 'merge-auto',
        );
        if (c.name === 'x' && isMerge) return words;
    }
    return undefined;
}
// the pr a merge-auto call merges: the first bare word after the verb, a pr url read as its number
export function mergeAutoPr(words: string[]) {
    const pr = words
        .slice(words.indexOf('merge-auto') + 1)
        .find((w) => !w.startsWith('-'));
    return pr?.match(/(\d+)\/?$/)?.[1];
}
// a sign on a ticket: `x linear set <id> --add-label signed`, or `x linear body <id> --set <file>` whose file the caller
// reads for a sign line (FRM-427, o197)
export function signWord(
    command: string,
    cwd: string,
    ctx: Context = {},
): { id: string; file?: string } | undefined {
    for (const c of commands(parse(command), cwd)) {
        const words = c.args.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
        const at = bare.findIndex(
            (w, i) =>
                w === 'linear' &&
                (bare[i + 1] === 'set' || bare[i + 1] === 'body'),
        );
        if (c.name !== 'x' || at < 0) continue;
        // the ticket the verb acts on, never a --parent's
        const id = words
            .filter((w, i) => TICKET.test(w) && words[i - 1] !== '--parent')
            .at(-1);
        if (!id) continue;
        const value = (flag: string) =>
            words.flatMap((w, i) =>
                w === flag
                    ? [words[i + 1] ?? '']
                    : w.startsWith(`${flag}=`)
                      ? [w.slice(flag.length + 1)]
                      : [],
            );
        if (bare[at + 1] === 'set') {
            const added = value('--add-label').flatMap((v) => v.split(','));
            if (added.some((l) => l.trim() === 'signed')) return { id };
            continue;
        }
        const [file] = value('--set');
        if (file) return { file: resolve(file, c.dir, ctx), id };
    }
    return undefined;
}
const TICKET = /^(FRM|BYT)-\d+$/;
// a sign ask, `✍️ sign <id>: <title>`, its id matched whole
export const isSignAsk = (text: string, id: string) =>
    new RegExp(`(^|\\s)✍️ sign ${id}:`, 'u').test(text);
// a tick quotes the pr when its text holds the pr's url or `#<n>` as a whole word (FRM-427)
export const quotesPr = (text: string, pr: string) =>
    new RegExp(`/pull/${pr}(?!\\d)`).test(text) || namesWhole(text, `#${pr}`);
export function mergeWord(command: string, cwd: string): Refusal | undefined {
    const words = mergeAutoWords(command, cwd);
    if (!words) return undefined;
    const targets = words.flatMap((w, i) =>
        w === '--dima-ok'
            ? [words[i + 1] ?? '']
            : w.startsWith('--dima-ok=')
              ? [w.slice('--dima-ok='.length)]
              : [],
    );
    if (!targets.length) return undefined;
    return {
        door: "ask dima; his own next prompt naming the pr (104 or #104), or his tick on an orbit ask quoting the pr url, lets merge-auto's --dima-ok through. a bg session counts only what dima types into it himself",
        rule: 'dima-ok-flag',
        targets,
        why: "merge-auto's --dima-ok stands for dima's word on a self-edit, and counts only when his last typed prompt names the pr or his tick quotes it",
    };
}

// a member reads and comments on tickets through x linear, never the raw cli (FRM-398, rules-lazy/linear-flow.md);
// cclio's own session is never asked, the caller checks the registry name
export function rawLinear(command: string, cwd: string): Refusal | undefined {
    for (const c of commands(parse(command), cwd)) {
        if (c.name !== 'linear') continue;
        const [a, b, d] = c.args.map((w) => w.text);
        const isComment = a === 'issue' && b === 'comment' && d === 'add';
        const isRead = (a === 'issue' && b === 'view') || a === 'api';
        if (!isComment && !isRead) continue;
        return isComment
            ? {
                  door: 'x linear comment <id> --body-file <file>',
                  rule: 'raw-linear',
                  targets: ['linear issue comment add'],
                  why: "a member's one linear write is its done comment, through x linear (rules-lazy/linear-flow.md)",
              }
            : {
                  door: 'x linear read <id> --comments --relations',
                  rule: 'raw-linear',
                  targets: [a === 'api' ? 'linear api' : 'linear issue view'],
                  why: 'a member reads tickets through x linear, the whole ticket in one call (rules-lazy/linear-flow.md)',
              };
    }
    return undefined;
}
