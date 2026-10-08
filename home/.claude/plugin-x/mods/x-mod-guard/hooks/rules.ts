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
import { background, lint, unbraced } from './rules/lint.ts';
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
            overwrite(c, ctx) ??
            lint(c, list[i + 1]) ??
            missingAdd(c, ctx) ??
            brief(c, ctx);
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
    for (const r of [background(list), unbraced(parsed)]) if (r) out.push(r);
    // one line per rule and target: a lint seen on every command of a pipeline is one finding
    return out.filter(
        (r, i) =>
            out.findIndex(
                (o) =>
                    o.rule === r.rule && o.targets.join() === r.targets.join(),
            ) === i,
    );
}
// a target dima named as a whole word: each edge is the prompt's end, a space, a quote or punctuation, or a
// sentence-ending period — so `.` inside `build.` or `&` inside `a&b` never proves itself
const EDGE = /[\s"'`,;:!?()[\]<>]/;
export function namesWhole(said: string, target: string) {
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
            (after === '.' &&
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
