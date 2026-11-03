import { brief } from './rules/brief.ts';
import {
    type Command,
    type Context,
    type Refusal,
    SHELLS,
    TICKET_KEY,
    UNREAD,
    type Verdict,
    actsIn,
    adds,
    aliasRun,
    asMember,
    basename,
    commands,
    commandsDeep,
    gitDir,
    gitParts,
    hasFlag,
    hidingScript,
    isFlag,
    isJobTmp,
    isThrowaway,
    laidOver,
    nestedScripts,
    operands,
    peel,
    persistedAlias,
    resolve,
    scriptRun,
    writtenScripts,
} from './rules/command.ts';
import { floor, gitDoor, opaque } from './rules/floor.ts';
import { hazard } from './rules/hazard.ts';
import { background, commentMidline, lint, unbraced } from './rules/lint.ts';
import { frozenInstallDirs, lockfile } from './rules/lockfile.ts';
import { milestone } from './rules/milestone.ts';
import { notes } from './rules/notes.ts';
import { landings, overwrite } from './rules/overwrite.ts';
import { spawnSixthSense } from './rules/sixth-sense.ts';
import { worth } from './rules/worth.ts';
import { type Parsed, parse } from './shell.ts';

// the paths every git add in the command names, for the caller to look up on disk; a path an earlier part of the
// same command makes (a > redirect, touch, mkdir, a cp or mv dest) is there by the time the add runs
export function addedPaths(command: string, cwd: string, ctx: Context = {}) {
    const made = new Set<string>();
    return commandsDeep(command, cwd).flatMap((c) => {
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
const LOCAL_GIT = new Set(['git-discard', 'git-rewrite']);
// what a throwaway repo under the job's own tmp lifts (FRM-467): a sweep (`git add -A`, a pathless commit), the identity
// a `-c user.*` or `git config user.*` sets, a gate piped to tail, and a HOME that itself points into the job tmp
const IDENTITY = /^user\.(?:name|email)$/i;
// a chain lifts only when every command of it is on the plain lists below and every dir it enters is the job tmp
const PLAIN_NAMES = new Set([
    'cat',
    'cd',
    'echo',
    'git',
    'grep',
    'head',
    'ls',
    'mkdir',
    'mktemp',
    'pnpm',
    'tail',
    'wc',
]);
const PLAIN_GIT = new Set([
    'add',
    'branch',
    'checkout',
    'commit',
    'config',
    'diff',
    'init',
    'log',
    'ls-files',
    'merge',
    'reset',
    'restore',
    'rev-parse',
    'rm',
    'show',
    'stash',
    'status',
    'switch',
    'tag',
]);
const PLAIN_PNPM = new Set([
    'build',
    'check',
    'install',
    'lint',
    'run',
    'test',
    'typecheck',
]);
const GIT_REDIRECTS =
    /^--(?:git-dir|work-tree|separate-git-dir|exec-path|namespace|super-prefix)(?:=|$)/;
const PNPM_REDIRECTS =
    /^(?:-[CFrw]|--(?:dir|filter|recursive|workspace-root|prefix))/;
// an env name that moves git or a shell (GIT_*, XDG_*, BASH_ENV, LD_*) has an underscore; these five do without
const ENV_MOVERS = new Set(['CDPATH', 'ENV', 'IFS', 'PATH', 'SHELL']);
// what runs or writes where the parse does not look: a backtick, a process substitution, `$((`, a heredoc, `>|`, and `>&` into a file
const HIDDEN = /`|[<>]\(|\$\(\(|(?<!<)<<(?!<)|>\||>&(?!\d|-)/;
const isTmpPath = (path: string, dir: string, ctx: Context) => {
    const p = resolve(path, dir, ctx);
    // a `~` left after the home is filled in is `~user` or `~-`, which the shell expands; a typed `..` may climb a symlink
    return (
        !/[`$*?[{\\~]/.test(p) &&
        !/(?:^|\/)\.\.(?:\/|$)/.test(path) &&
        isJobTmp(p, ctx)
    );
};
type Plain = ReturnType<typeof peel>;
// dir: where the command runs; undefined for one inside a `$( … )`, which then takes no git
function isPlainCommand(c: Plain, dir: string | undefined, ctx: Context) {
    const where = dir === undefined ? '/' : resolve(dir, '/', ctx);
    const isEnvOk = c.assigns.every((a) => {
        const name = a.slice(0, a.indexOf('='));
        return /^[A-Za-z][A-Za-z0-9]*$/.test(name) && !ENV_MOVERS.has(name);
    });
    const isRedirectOk = [...c.writes, ...c.appends, ...c.stdouts].every(
        (to) =>
            to === '/dev/null' ||
            (isTmpPath(to, where, ctx) &&
                !resolve(to, where, ctx)
                    .split('/')
                    .some((s) => /^\.git(?!ignore$)/.test(s)) &&
                !/^\.(?!gitignore$)/.test(basename(to))),
    );
    if (c.wrappers.length > 0 || !isEnvOk || !isRedirectOk) return false;
    // a bare assignment, `R=<path>`: its substitution is judged as a command of its own
    if (!c.name) return true;
    if (SHELLS.has(c.name))
        return c.args.length === 2 && c.args[0]?.text === '-c';
    if (!PLAIN_NAMES.has(c.name)) return false;
    if (c.name === 'cd')
        return (
            dir !== undefined &&
            c.args.length === 1 &&
            !isFlag(c.args[0]?.text ?? '') &&
            isTmpPath(dir, '/', ctx)
        );
    if (c.name === 'mktemp')
        return (
            c.args.length === 2 &&
            ['-d', '--directory'].includes(c.args[0]?.text ?? '') &&
            isTmpPath(c.args[1]?.text ?? '', where, ctx)
        );
    if (c.name === 'mkdir')
        return c.args.every(
            (w) => w.text === '-p' || isTmpPath(w.text, where, ctx),
        );
    if (c.name === 'pnpm')
        return (
            PLAIN_PNPM.has(c.args[0]?.text ?? '') &&
            !c.args.some((w) => PNPM_REDIRECTS.test(w.text))
        );
    if (c.name === 'git') return dir !== undefined && isPlainGit(c, where, ctx);
    return true;
}
function isPlainGit(c: Plain, where: string, ctx: Context) {
    const { at, configs, sub, subArgs } = gitParts(c.args);
    const ops = operands(subArgs);
    // before the subcommand only `-c <key=value>`, `-C <dir>` and `--no-pager`: `-ckey=value` hides a config from the parse
    const prefix = c.args.slice(0, c.args.length - subArgs.length - 1);
    const isPrefixOk = prefix.every(
        (w, i) =>
            ['-c', '-C'].includes(prefix[i - 1]?.text ?? '') ||
            ['-c', '-C', '--no-pager'].includes(w.text),
    );
    if (
        !isPrefixOk ||
        c.args.some((w) => GIT_REDIRECTS.test(w.text)) ||
        c.args.filter((w) => w.text === '-C').length > 1 ||
        (at !== undefined && !isTmpPath(at, where, ctx)) ||
        !configs.every((k) => IDENTITY.test(k.split('=')[0] ?? '')) ||
        !PLAIN_GIT.has(sub)
    )
        return false;
    if (sub === 'config')
        return (
            !subArgs.some((w) => isFlag(w.text)) && IDENTITY.test(ops[0] ?? '')
        );
    if (sub === 'init') return ops.every((o) => isTmpPath(o, where, ctx));
    return true;
}
function isPlainScript(script: string, cwd: string, ctx: Context): boolean {
    if (HIDDEN.test(script)) return false;
    const parsed = parse(script);
    const isSubstPlain = (s: Parsed['segments'][number]): boolean =>
        s.subst.every(
            (x) =>
                isPlainCommand(peel(x.words), undefined, ctx) &&
                isSubstPlain(x),
        );
    return (
        parsed.segments.every(isSubstPlain) &&
        commands(parsed, cwd).every(
            (c) =>
                isPlainCommand(c, c.dir, ctx) &&
                (!SHELLS.has(c.name) ||
                    isPlainScript(c.args[1]?.text ?? '', c.dir, ctx)),
        )
    );
}
// a test door (FRM-470), an allowlist of the whole line: `NAME=$(mktemp -d) && HOME=$NAME <runner> <plain words>`, two commands and
// nothing between or after them. the HOME is an empty dir this line made, so the hook never sees the real config. the runner is
// one a mods test uses (node, a `pnpm mods:` verb): git through a shell, `env`, `eval`, `pnpm exec` or a claude child with no
// gitconfig drops the signing and identity the commit rules rest on. a parse of which variables survive to the second command kept leaking (printf -v, eval, a subshell), so none is read
const FRESH_HOME =
    /^([A-Za-z][A-Za-z0-9]*)=\$\(mktemp (?:-d|--directory)\) ?(?:&&|;) ?HOME=(?:\$\1|"\$\1"|\$\{\1\}) (?:node|pnpm mods:[\w:-]+)(?: [^;&|<>(){}`$\\\n]*)?$/;
// pnpm reads -C, --dir, --filter and the like anywhere among its words, so a `pnpm mods:` line carries none of them
const isFreshHomeLine = (command: string) =>
    FRESH_HOME.test(command) &&
    !ENV_MOVERS.has(command.match(FRESH_HOME)?.[1] ?? '') &&
    !commands(parse(command), '/').some(
        (c) =>
            c.name === 'pnpm' &&
            c.args.some((w) => PNPM_REDIRECTS.test(w.text)),
    );
function isThrowawayLift(c: Command, r: Refusal, ctx: Context) {
    if (r.rule === 'home') {
        // the command must act inside the tmp too: a HOME there alone never lifts a command run from frame, and a shell or a
        // script it hands on would carry the HOME to git
        if (!isThrowaway(c, ctx) || nestedScripts(c).length) return false;
        return c.assigns
            .filter((a) => a.startsWith('HOME='))
            .every((a) => isTmpPath(a.slice(5), '/', ctx));
    }
    if (r.rule === 'git-sweep') return c.name === 'git' && isThrowaway(c, ctx);
    if (r.rule === 'gate-pipe') return isThrowaway(c, ctx);
    if (r.rule === 'bypass')
        return (
            c.name === 'git' &&
            r.targets.every((t) => IDENTITY.test(t)) &&
            isThrowaway(c, ctx)
        );
    return false;
}
// the command with the lifted part taken off, so the rules that sat behind it judge what is left: a `-c user.name=t`
// must not hide a force-push in the same command
function without(c: Command, r: Refusal, next: Command | undefined) {
    if (r.rule === 'home')
        return {
            c: {
                ...c,
                assigns: c.assigns.filter((a) => !a.startsWith('HOME=')),
            },
            next,
        };
    if (r.rule === 'gate-pipe') return { c: { ...c, sep: ';' as const }, next };
    if (r.rule === 'bypass')
        return {
            c: {
                ...c,
                args: c.args.filter(
                    (w, i) =>
                        !(
                            (w.text === '-c' &&
                                IDENTITY.test(
                                    c.args[i + 1]?.text.split('=')[0] ?? '',
                                )) ||
                            (c.args[i - 1]?.text === '-c' &&
                                IDENTITY.test(w.text.split('=')[0] ?? ''))
                        ),
                ),
            },
            next,
        };
    return { c, next };
}
function isScratchGit(c: Command, r: Refusal, ctx: Context) {
    if (c.name !== 'git' || !LOCAL_GIT.has(r.rule)) return false;
    const { sub, subArgs } = gitParts(c.args);
    if (sub === 'push' || actsIn(c, ctx) === undefined) return false;
    const dir = gitDir(c, ctx);
    const { at } = gitParts(c.args);
    if (/[`$~]/.test(dir) || /(?:^|\/)\.\.(?:\/|$)/.test(at ?? ''))
        return false;
    // a job tmp that is frame underneath (a symlink, a worktree) is no scratch
    if (ctx.unsafeTmp?.has(actsIn(c, ctx) ?? dir)) return false;
    const paths = [dir, ...operands(subArgs).map((o) => resolve(o, dir, ctx))];
    return paths.every(
        (p) =>
            isJobTmp(p, ctx) || TEMP_ROOTS.some((root) => p.startsWith(root)),
    );
}
// clio removes a scratch tree (a clean one: --force still asks) and deletes a scratch/* branch without dima's word;
// a merged branch's `git branch -d` already runs for everyone, since git itself refuses an unmerged one
const SCRATCH_TREE = /\/\.claude\/(worktrees\/[^/]+|jobs\/[^/]+\/tmp\/.+)$/;
// the scratch trees a clio `git worktree remove` names, for the caller to look up; a tree elsewhere asks anyway
export function removedTrees(command: string, cwd: string, ctx: Context = {}) {
    if (!ctx.isClio) return [];
    return commandsDeep(command, cwd).flatMap((c) => {
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
    if (!ctx.isClio || c.name !== 'git' || r.rule !== 'git-rewrite')
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
// the job-tmp dirs a throwaway lift would rest on, for the caller to look up on disk: a symlink or a worktree already
// there reaches out of the tmp; a nested shell's script and an eval count too
export function tmpDirs(
    command: string,
    cwd: string,
    ctx: Context = {},
): string[] {
    return commandsDeep(command, cwd).flatMap((c) => {
        const dir = actsIn(c, ctx);
        return dir !== undefined && isJobTmp(dir, ctx) ? [dir] : [];
    });
}
// the files a line leaves written, path to text, for the runs a later call of the turn makes
export const lineWrites = (command: string, cwd: string, ctx: Context) =>
    commandsDeep(command, cwd).flatMap((c) => writtenScripts(c, ctx));
// the rules on how a typed line reads, never on what a script file runs: a file's `&`, mid-line `#` and `$name:x` are its own
const TYPED_LINE = new Set(['background', 'comment-midline', 'unbraced']);
// isPlain: the whole command, a nested shell's script included, is on the lift's lists; a nested call carries its parent's
export function refusals(
    command: string,
    cwd: string,
    ctx: Context = {},
    isPlain = isPlainScript(command, cwd, ctx),
    hiddenBy?: string,
): Refusal[] {
    const parsed = parse(command);
    const list = commands(parsed, cwd);
    const out: Refusal[] = [];
    // the files the turn and the line have written so far, by path: a later `bash s.sh`, `source s.sh` or `./s.sh` runs that text
    const written = new Map(ctx.written);
    // the git aliases the line has persisted so far, by name
    const aliases = new Map<string, string>();
    list.forEach((c, i) => {
        const ran = scriptRun(c, ctx);
        const body = ran === undefined ? undefined : written.get(ran);
        // read with the line's own writes, and without itself: a script that runs itself is read once
        const others = new Map(written);
        if (ran !== undefined) others.delete(ran);
        // text the guard could not keep runs unread: said, beside what the kept part trips
        if (ran !== undefined && body?.includes(UNREAD))
            out.push({
                door: `read ${ran} first, then run its commands as a call of their own`,
                rule: 'write-then-run',
                targets: [ran],
                why: `${ran} was written this turn past what the guard keeps (32k characters, or an edit it could not follow), so what it runs is unread`,
            });
        if (body !== undefined)
            out.push(
                ...refusals(
                    body.replaceAll(UNREAD, ''),
                    c.dir,
                    { ...ctx, written: others },
                    isPlain,
                    hiddenBy,
                )
                    .filter((r) => !TYPED_LINE.has(r.rule))
                    .map((r) => ({
                        ...r,
                        rule: 'write-then-run',
                        why: `${ran} was written earlier this turn, and running it runs a refused command (rule ${r.rule}): ${r.why}`,
                    })),
            );
        laidOver(written, writtenScripts(c, ctx));
        const { sub, subArgs } = gitParts(c.args);
        const alias =
            c.name === 'git' ? aliases.get(sub.toLowerCase()) : undefined;
        if (alias !== undefined)
            out.push(
                ...refusals(
                    aliasRun(alias, subArgs),
                    c.dir,
                    ctx,
                    isPlain,
                    hiddenBy ?? 'a git alias',
                ),
            );
        const persisted = persistedAlias(c);
        if (persisted) aliases.set(...persisted);
        const judge = (cmd: Command, next: Command | undefined) =>
            floor(cmd, ctx) ??
            hazard(cmd, ctx) ??
            lockfile(cmd, ctx) ??
            overwrite(cmd, ctx) ??
            lint(cmd, next) ??
            missingAdd(cmd, ctx) ??
            brief(cmd, ctx) ??
            spawnSixthSense(cmd, ctx) ??
            notes(cmd, ctx) ??
            milestone(cmd, ctx) ??
            worth(cmd, ctx) ??
            opaque(cmd, hiddenBy);
        let found = judge(c, list[i + 1]);
        // a lifted rule hides every rule behind it, so the command is judged again without the lifted part
        let rest: { c: Command; next: Command | undefined } = {
            c,
            next: list[i + 1],
        };
        while (
            found &&
            ((isPlain && isThrowawayLift(rest.c, found, ctx)) ||
                (found.rule === 'home' && isFreshHomeLine(command)))
        ) {
            const stripped = without(rest.c, found, rest.next);
            const isSame =
                stripped.c.args.length === rest.c.args.length &&
                stripped.c.assigns.length === rest.c.assigns.length &&
                stripped.c.sep === rest.c.sep;
            rest = stripped;
            found = isSame ? undefined : judge(rest.c, rest.next);
        }
        if (found && !isScratchGit(c, found, ctx) && !isCleanup(c, found, ctx))
            out.push(found);
        // a door flag speaks where no rule stopped the command or dima's marker lets that rule through, and never hides one
        const door =
            found && !markedBy(command)(found) ? undefined : gitDoor(c, ctx);
        if (door) out.push(door);
        // a nested script is commands too: a shell's, an eval's, env -S's, find -exec's, a function body (command.ts)
        for (const script of nestedScripts(c))
            out.push(
                ...refusals(
                    script,
                    c.dir,
                    ctx,
                    isPlain,
                    hiddenBy ?? hidingScript(c),
                ),
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
// dima's word on a stash drop: one sentence of his prompt that names «stash» (never inside x-mod-stash), a kill verb and
// the repo, with no negation, lets `git stash drop` through in that repo; `clear` needs «all» or «clear» too (FRM-426)
const word = (re: string) => new RegExp(`(?<![\\w-])(?:${re})(?![\\w-])`, 'i');
const STASH_WORD = word('stash(?:es)?');
const KILL_WORD = word(
    'drop(?:s|ped|ping)?|kill(?:s|ed|ing)?|delete(?:s|d)?|deleting|clear(?:s|ed|ing)?',
);
// «all the stashes» or «clear» itself: a bare «that's all» never widens a drop into a clear
const ALL_WORD = word(
    'clear|all (?:of )?(?:the )?stash(?:es)?|every stash|stash(?:es)? all',
);
// a command that points git at another dir by env or flag runs where the word never named
// a git pointed elsewhere, read off the parsed words so quotes cannot split it: an env name, or git's own flag
const REDIRECTED =
    /^GIT_(?:DIR|WORK_TREE|COMMON_DIR)=|^--(?:git-dir|work-tree)(?:=|$)/;
const isRedirected = (c: Command) =>
    [...c.assigns, ...c.args.map((w) => w.text)].some((t) =>
        REDIRECTED.test(t),
    );
const NEGATED =
    /(?<![\w-])(?:do not|never|not|no|without|avoid|stop|leave)(?![\w-])|n['’]t(?![\w-])/i;
export const isStashKill = (r: Refusal) =>
    r.rule === 'git-discard' && /^git stash (drop|clear) /.test(r.why);
// every stash drop or clear of the command with the git dir it runs in, nested ones included as the refusals read them; a
// command with a shell or eval names none, since a script's stash drop could ride beside a plain one
export function stashKills(command: string, cwd: string, ctx: Context = {}) {
    const list = commandsDeep(command, cwd);
    if (list.some(isRedirected)) return [];
    if (list.some((c) => SHELLS.has(c.name) || c.name === 'eval')) return [];
    return list.flatMap((c) => {
        if (c.name !== 'git') return [];
        const { sub, subArgs } = gitParts(c.args);
        const verb = operands(subArgs)[0];
        return sub === 'stash' && (verb === 'drop' || verb === 'clear')
            ? [{ dir: gitDir(c, ctx), verb }]
            : [];
    });
}
export function stashAsked(said: string, verb: string, repo: string) {
    return said
        .split(/(?<=[.!?])\s+|\n+/)
        .some(
            (s) =>
                STASH_WORD.test(s) &&
                KILL_WORD.test(s) &&
                !NEGATED.test(s) &&
                namesWhole(s.toLowerCase(), repo.toLowerCase()) &&
                (verb === 'drop' || ALL_WORD.test(s)),
        );
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
    const isMarked = markedBy(command);
    const open = found.find((r) => !isMarked(r));
    if (open) return { kind: 'refused', refusal: open };
    return { kind: 'escaped', refusals: found };
}
// a marker names one target, or several split by spaces or commas; a refusal is marked when every target is named
export function markedBy(command: string) {
    const ok = new Set(
        markers(command).flatMap((m) => [m, ...m.split(/[\s,]+/)]),
    );
    return (r: Refusal) => r.targets.every((t) => ok.has(t));
}
export function message(r: Refusal) {
    return `nothing in this command ran — x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}. only after dima's word, end the command with # dima-ok: ${r.targets.join(' ')}`;
}

// the dirs a `CI=1 pnpm install` in this command runs in, for the caller to check for a changed manifest
export function installDirs(command: string, cwd: string, ctx: Context = {}) {
    return frozenInstallDirs(commandsDeep(command, cwd), ctx);
}

// a foreground `claude -p` holds the session's thread until it ends: a probe of eight runs blocked clio for 3 minutes
// (dima's o102, FRM-395); `# fg-ok: <why>` lets a real need through, and a background run is never judged
export function foregroundClaude(
    command: string,
    cwd: string,
): Refusal | undefined {
    const parsed = parse(command);
    if (parsed.comments.some((c) => /^\s*fg-ok:\s*\S/.test(c)))
        return undefined;
    const isClaudeP = commandsDeep(command, cwd).some(
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
// reads the cache back (FRM-389 exit 7, dima's o33); every session, clio's included
export function rawPluginUpdate(
    command: string,
    cwd: string,
): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
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
// a command's `x lane merge-auto` call, one in a nested shell or an eval included: its words and the dir it runs in
export function mergeAutoCalls(
    command: string,
    cwd: string,
): { words: string[]; dir: string }[] {
    return commandsDeep(command, cwd).flatMap((c) => {
        const words = c.args.map((w) => w.text);
        // x's root booleans (--json, --board) sit before the family or between it and the verb
        const bare = words.filter((w) => !w.startsWith('-'));
        const isMerge = bare.some(
            (w, i) => w === 'lane' && bare[i + 1] === 'merge-auto',
        );
        return c.name === 'x' && isMerge ? [{ dir: c.dir, words }] : [];
    });
}
// the one merge-auto call a tick can carry: a line with two never takes one
export function mergeAutoCall(command: string, cwd: string) {
    const calls = mergeAutoCalls(command, cwd);
    return calls.length === 1 ? calls[0] : undefined;
}
// the pr a merge-auto call merges: the first bare word after the verb, a pr url read as its number
export function mergeAutoPr(words: string[]) {
    const pr = words
        .slice(words.indexOf('merge-auto') + 1)
        .find((w) => !w.startsWith('-'));
    return pr?.match(/(\d+)\/?$/)?.[1];
}
// every sign on a line: `x linear set <id> --add-label signed`, or `x linear body <id> --set <file>` whose file the caller
// reads for a sign line (FRM-427, o197)
export function signWords(
    command: string,
    cwd: string,
    ctx: Context = {},
): { id: string; file?: string }[] {
    const out: { id: string; file?: string }[] = [];
    for (const c of commandsDeep(command, cwd)) {
        const words = c.args.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
        const at = bare.findIndex(
            (w, i) =>
                w === 'linear' &&
                (bare[i + 1] === 'set' || bare[i + 1] === 'body'),
        );
        if (c.name !== 'x' || at < 0) continue;
        // the ticket the verb acts on is its first id, as x reads args[0]; never a --parent's or a --blocks'. a loop var the
        // walker filled with every value it takes stands for each of them, so each id is a sign of its own (R3)
        const ids = words.filter(
            (w, i) => TICKET.test(w) && !isFlag(words[i - 1] ?? ''),
        );
        // an id the line never shows (`$ID`, xargs' `{}`) is a sign no tick names
        const slot = bare[at + 2];
        const hidden =
            slot !== undefined &&
            (/[$`{}]/.test(slot) || c.wrappers.includes('xargs'))
                ? slot
                : undefined;
        const firstId = ids[0] ?? hidden;
        if (!firstId) continue;
        const looped = c.args.some(
            (w) => w.isExpanding && /^\$\{?\w+\}?$/.test(w.text),
        );
        const signed = looped && ids.length ? ids : [firstId];
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
            // x matches labels by name ignoring case; a label the shell fills in may be the sign
            if (added.some((l) => /^signed$/i.test(l.trim()) || /[$`]/.test(l)))
                out.push(...signed.map((id) => ({ id })));
            continue;
        }
        const [file] = value('--set');
        if (file)
            out.push(
                ...signed.map((id) => ({
                    file: resolve(file, c.dir, ctx),
                    id,
                })),
            );
    }
    return out;
}
const TICKET = new RegExp(`^(${TICKET_KEY})-\\d+$`);
// a sign ask, `✍️ sign <id>: <title>` or `✍️ sign <id>, <id>: <title>` for a batch (FRM-459 o49): each id named is matched whole,
// and an id the ask does not list is not signed by it
const SIGN_ASK = new RegExp(
    `(?:^|\\s)✍️ sign ((?:${TICKET_KEY})-\\d+(?:(?:,\\s*|\\s+and\\s+|\\s+)(?:${TICKET_KEY})-\\d+)*):`,
    'u',
);
export const isSignAsk = (text: string, id: string) =>
    SIGN_ASK.exec(text)?.[1]
        ?.split(/[,\s]+(?:and\s+)?/)
        .includes(id) ?? false;
// a tick quotes the pr when its text holds the pr's url in this repo, `github.com/<owner>/<name>/pull/<n>`, or reads
// `⚠️ merge <name>#<n>` (FRM-478); a bare `#<n>` or another repo's pr of the same number proves nothing (FRM-427, sixth sense round 1)
export const quotesPr = (text: string, repo: string, pr: string) =>
    (text.includes(`github.com/${repo}/pull/${pr}`) &&
        !new RegExp(`github\\.com/${repo}/pull/${pr}\\d`).test(text)) ||
    new RegExp(
        `(?:^|\\s)⚠️ merge ${(repo.split('/').at(-1) ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#${pr}(?!\\d)`,
        'u',
    ).test(text);
// the repo a merge-auto call merges in: its --repo, or the caller reads the cwd's origin
export const mergeAutoRepo = (words: string[]) =>
    words.flatMap((w, i) =>
        w === '--repo'
            ? [words[i + 1] ?? '']
            : w.startsWith('--repo=')
              ? [w.slice('--repo='.length)]
              : [],
    )[0];
// the github slug in a remote url: `git@github.com:o/n.git`, `https://github.com/o/n`
export const remoteSlug = (url: string) =>
    url.trim().match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1];
// `--dima-ok <pr>` added right after a top-level merge-auto call's own last word, so a following `&&`, `;` or comment
// keeps it; a call in a nested shell, or one whose last word is not a plain word, gets none
export function withDimaOk(command: string, pr: string) {
    for (const seg of parse(command).segments) {
        const words = seg.words.map((w) => w.text);
        const bare = words.filter((w) => !w.startsWith('-'));
        const isMerge =
            words[0] === 'x' &&
            bare.some((w, i) => w === 'lane' && bare[i + 1] === 'merge-auto');
        const last = seg.words.at(-1);
        if (!isMerge || last?.at === undefined || mergeAutoPr(words) !== pr)
            continue;
        const end = last.at + last.text.length;
        return `${command.slice(0, end)} --dima-ok ${pr}${command.slice(end)}`;
    }
    return undefined;
}
export function mergeWord(command: string, cwd: string): Refusal | undefined {
    const words = mergeAutoCalls(command, cwd).flatMap((c) => c.words);
    if (!words.length) return undefined;
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
// clio's own session is never asked, the caller checks the registry name
export function rawLinear(command: string, cwd: string): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
        if (c.name !== 'linear' || asMember(c) !== undefined) continue;
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
