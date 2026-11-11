import { brief } from './rules/brief.ts';
import { touchesStore } from './rules/clean-stamp.ts';
import {
    type Command,
    type Context,
    type Refusal,
    SHELLS,
    TICKET_KEY,
    TICK_DOOR,
    UNREAD,
    type Verdict,
    type Written,
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
    isAwkRunner,
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
import { herdrClose, herdrLabel } from './rules/herdr-close.ts';
import { herdrStart } from './rules/herdr-start.ts';
import { isForegroundOk } from './rules/hint.ts';
import { background, commentMidline, lint, unbraced } from './rules/lint.ts';
import { frozenInstallDirs, lockfile } from './rules/lockfile.ts';
import { milestone } from './rules/milestone.ts';
import { notes } from './rules/notes.ts';
import { overrideAsked } from './rules/operator-override.ts';
import { commandWrites, landings, overwrite } from './rules/overwrite.ts';
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
// the files a line leaves written, path to text, for the runs a later call of the turn makes, in line order; a file
// it rewrites another way (sd, sed -i) is left unread, and the writes after lay over that
export function lineWrites(command: string, cwd: string, ctx: Context) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const scripts = writtenScripts(c, ctx);
        return [
            ...scripts,
            ...commandWrites(c, ctx)
                .filter((p) => !scripts.some(([s]) => s === p))
                .map((p): Written => [p, UNREAD]),
        ];
    });
}
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
        const scripts = writtenScripts(c, ctx);
        laidOver(written, scripts);
        // a kept script the line rewrites another way (sd, sed -i) holds text the guard never saw
        for (const p of commandWrites(c, ctx))
            if (written.has(p) && !scripts.some(([s]) => s === p))
                written.set(p, UNREAD);
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
            herdrClose(cmd, ctx) ??
            herdrLabel(cmd, ctx) ??
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
        // judged beside the chain, never in it: a Herdr start hid `sudo` and an overwrite behind it (wisphunter on 63d5fa57)
        const start = herdrStart(c, ctx);
        if (start) out.push(start);
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
    return `nothing in this command ran — x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}. only after dima's word, end the command with # dima-ok: ${r.targets.join(' ')}, or ${TICK_DOOR}`;
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
    if (isForegroundOk(command)) return undefined;
    const isClaudeP = commandsDeep(command, cwd).some(
        (c) =>
            c.name === 'claude' &&
            c.args.some((w) => w.text === '-p' || w.text === '--print'),
    );
    if (!isClaudeP) return undefined;
    return {
        door: "x probe bare '<prompt>' for a clean run of plain cc, else the same command with run_in_background: true, or end it with # fg-ok: <why> for a real need",
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
// the writers a line points at a body file before it is set, each one the guard can read: an in-place `sd` or `sed`, an
// `echo` or `printf` of literal text, or an inline program whose own text names no other file (no `/`); a copy, a move,
// a download or any other writer may bring a sign line from a file the guard never saw (clio's FRM-567, 19:28)
const BODY_EDITORS = new Set(['echo', 'printf', 'sd', 'sed']);
// every command on the line but x's own that may write the body file: a write the guard reads, or an inline program whose
// text names the file or a variable that may (`python3 -c "open('$F','w')…"`, which no write reader expands)
export function bodyWriters(
    command: string,
    cwd: string,
    file: string,
    ctx: Context = {},
) {
    return commandsDeep(command, cwd).filter(
        (c) =>
            c.name !== 'x' &&
            (commandWrites(c, ctx).includes(file) ||
                [...c.writes, ...c.appends].includes(file) ||
                (OPAQUE_RUNNER.test(c.name) &&
                    c.args.some(
                        (w) => w.text.includes(file) || w.text.includes('$'),
                    ))),
    );
}
export function bodyWritersRead(
    command: string,
    cwd: string,
    file: string,
    ctx: Context = {},
) {
    // a loop's `$1`, `$2` hold the `set --` words; they name no file only when none of them holds a `/`
    const setWords = commandsDeep(command, cwd)
        .filter((c) => c.name === 'set' && c.args[0]?.text === '--')
        .flatMap((c) => c.args.slice(1).map((w) => w.text));
    const isPositionalPlain =
        setWords.length > 0 && setWords.every((w) => !/[/$]/.test(w));
    return bodyWriters(command, cwd, file, ctx).every((c) => {
        if (OPAQUE_RUNNER.test(c.name))
            return c.args.every(
                (w) =>
                    w.text === file ||
                    (isPositionalPlain && /^\$\d$/.test(w.text)) ||
                    !/[/$]/.test(w.text.replaceAll(file, '')),
            );
        // `cat >> <file> <<'EOF'`: the text is the heredoc on the line
        if (c.name === 'cat' || c.name === 'tee')
            return (
                c.bodies.length > 0 &&
                c.args.every((w) => w.text === file || w.text.startsWith('-'))
            );
        if (!BODY_EDITORS.has(c.name)) return false;
        return c.feeders.every((f) => f.name === 'echo' || f.name === 'printf');
    });
}
const OPAQUE_RUNNER = /^(python[\d.]*|node|bun|deno|ruby|perl)$/;
// what may stand before a script file: python's flags that take no value; any other runner's flag may take one
// (`-W ignore`, `node -r ./x.js`, `ruby -I lib`), so its value would read as the file (sixth sense round 5 on e9d68294)
const PY_BARE_FLAGS = /^-[BEIOSbdqsuv]+$/;
// a script word that is the line's own text: stdin by name, a fd or a process substitution (sixth sense round 6 on 77f877eb)
const STDIN_SCRIPT = /^(-|\/dev\/|<\(|>\()/;
// every sign on a line: `x linear set <id> --add-label signed`, or `x linear body <id> --set <file>` whose file the caller
// reads for a sign line (FRM-427, o197)
export function signWords(
    command: string,
    cwd: string,
    ctx: Context = {},
): { id: string; file?: string; isOpaque?: boolean }[] {
    const out: { id: string; file?: string; isOpaque?: boolean }[] = [];
    for (const c of commandsDeep(command, cwd)) {
        // a program the guard cannot parse that runs a linear set or body write signs each id its text names (sixth sense
        // round 2 on a3cfd939: python's subprocess ran `x linear body … --set` past every word of his)
        if (OPAQUE_RUNNER.test(c.name) || isAwkRunner(c)) {
            // a script file's own text is read as a script the line runs, so the words after it are its data (clio's o98:
            // a flyway line naming a body set on FRM-577 was read as a sign); inline code, stdin and a module stay code
            const words = c.args.map((w) => w.text);
            const script = words.findIndex((w) => !w.startsWith('-'));
            const isScriptFile =
                OPAQUE_RUNNER.test(c.name) &&
                script >= 0 &&
                !STDIN_SCRIPT.test(words[script] ?? '') &&
                words
                    .slice(0, script)
                    .every(
                        (w) =>
                            c.name.startsWith('python') &&
                            PY_BARE_FLAGS.test(w),
                    );
            // what a pipe or a process substitution feeds a runner is its code too; the parse hands a `<(…)` to its own
            // command, so the line's text stands in for it
            const fed = isScriptFile
                ? []
                : [
                      ...c.feeders.flatMap((f) => f.args.map((w) => w.text)),
                      ...(/[<>]\(/.test(command) ? [command] : []),
                  ];
            const text = [
                ...(isScriptFile ? [] : words),
                ...fed,
                ...c.bodies,
            ].join('\n');
            if (/\blinear\b/.test(text) && /--set\b|--add-label\b/.test(text))
                out.push(
                    ...[...new Set(text.match(TICKET_ANY) ?? [])].map((id) => ({
                        id,
                        isOpaque: true,
                    })),
                );
            continue;
        }
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
const TICKET_ANY = new RegExp(`\\b(?:${TICKET_KEY})-\\d+\\b`, 'g');
// a sign ask, `✍️ sign <id>: <title>` or `✍️ sign <id>, <id>: <title>` for a batch (FRM-459 o49): each id named is matched whole,
// and an id the ask does not list is not signed by it
// twin sign-ask — a copy lives in x-mod-stash, whose orbit refuses a sign pick without this shape; twins.test.ts holds them equal
export const SIGN_ASK =
    /(?:^|\s)✍️ sign ((?:FRM|BYT)-\d+(?:(?:,\s*|\s+and\s+|\s+)(?:FRM|BYT)-\d+)*):/u;
// twin end
export const isSignAsk = (text: string, id: string) =>
    SIGN_ASK.exec(text)?.[1]
        ?.split(/[,\s]+(?:and\s+)?/)
        .includes(id) ?? false;
// his typed sign (FRM-544 slice 0): a line of his prompt that is only «sign» or «re-sign» and ticket ids, an `←` aside cut
// off; an allow-list, so a question, a negation or a sign inside prose never reads as one. the line starts with the word
// itself, no indent, bullet, quote or ✍️: he pastes seats' replies back, and a reply's own «sign FRM-N» is not his
const SIGN_TYPED = new RegExp(
    `^(?:re-)?sign((?:[\\s,]+(?:${TICKET_KEY})-\\d+)+)\\.?$`,
    'iu',
);
export const signsTyped = (text: string) => [
    ...new Set(
        text.split('\n').flatMap((line) => {
            const ids = SIGN_TYPED.exec(
                line.split('←')[0]?.trimEnd() ?? '',
            )?.[1];
            return ids
                ? ids
                      .split(/[\s,]+/)
                      .filter(Boolean)
                      .map((id) => id.toUpperCase())
                : [];
        }),
    ),
];
// keys a seat types into a pane reach that pane's seat as dima's own composer prompt (measured 2026-11-10: `hc keys` and
// `hc send` both land as `composer`, a spawn prompt too), so a seat never types his proof words there: a sign line, a
// dima-ok marker, an operator-override word (FRM-544 slice 0 round 2); any other message passes
const verbOf = (words: string[]) => words.find((w) => !w.startsWith('-'));
const PANE_TYPERS: Record<string, (words: string[]) => boolean> = {
    claude: () => true,
    hc: (words) => ['keys', 'run', 'send'].includes(verbOf(words) ?? ''),
    'herdr-app': (words) => verbOf(words) === 'do',
    rex: (words) =>
        ['send', 'send-key', 'send-keys'].includes(verbOf(words) ?? ''),
    // `tmux -L <socket> send-keys …`: a flag's value reads as the verb, so any word may be it
    tmux: (words) => words.some((w) => w === 'send-keys' || w === 'send'),
};
// a feeder whose text is its own words: `printf … | hc send t -`, `"$(echo …)"`
const LITERAL_FEEDERS = new Set(['echo', 'printf']);
// the words a pane typer types, past its verb and the terminal it aims at; a herdr call types only through a verb that
// sends text, never `tab.rename` or `terminal.keep`
const HERDR_TYPES = /send|type|paste|key|input|text|prompt|write/i;
function textWordsOf(c: Command) {
    const words = c.args;
    const bare = words.filter((w) => !w.text.startsWith('-'));
    if (c.name === 'claude') return bare;
    if (c.name === 'herdr-app')
        return HERDR_TYPES.test(bare[1]?.text ?? '') ? bare.slice(2) : [];
    if (c.name === 'hc' && verbOf(words.map((w) => w.text)) === 'run') {
        const end = words.findIndex((w) => w.text === '--');
        return end < 0 ? [] : words.slice(end + 1);
    }
    if (c.name === 'tmux') {
        const at = words.findIndex(
            (w) => w.text === 'send-keys' || w.text === 'send',
        );
        return words
            .slice(at + 1)
            .filter(
                (w, i, all) =>
                    !w.text.startsWith('-') &&
                    !/^-[tN]$/.test(all[i - 1]?.text ?? ''),
            );
    }
    return bare.slice(2);
}
// the program that fills a typed variable, when the line holds one the guard cannot read: `NAME=$(…)`, `read NAME`; a
// word from a loop's literals, a literal assignment or an echo, printf or cat is read
function unreadFill(text: string, command: string) {
    for (const [, name] of text.matchAll(/\$\{?([A-Za-z_]\w*)/g)) {
        if (new RegExp(`\\bread\\b[^;&|\\n]*\\b${name}\\b`).test(command))
            return 'read';
        for (const m of command.matchAll(
            new RegExp(
                `\\b${name}=(?:"?\\$\\(\\s*([\\w./-]+)|\`\\s*([\\w./-]+))`,
                'g',
            ),
        )) {
            const by = m[1] ?? m[2] ?? '';
            if (!isReadFeeder(by)) return by;
        }
    }
    return undefined;
}
// an inline substitution's program, never one an assignment holds (`sp=$(herdr-app ls | jq …)` names a space)
function inlineFill(command: string) {
    for (const m of command.matchAll(/(?<![\w]=)"?(?:\$\(|`)\s*([\w./-]+)/g))
        if (!isReadFeeder(m[1] ?? '')) return m[1];
    return undefined;
}
const isReadFeeder = (name: string) =>
    LITERAL_FEEDERS.has(name) || name === 'cat';
const KEY_NAMES: Record<string, string> = {
    'c-m': '\n',
    enter: '\n',
    space: ' ',
    tab: '\t',
};
// what `hc keys` or `tmux send-keys` types from its key words: a letter as it is, a named key as its character
const keysText = (words: string[]) =>
    words
        .map(
            (w) =>
                KEY_NAMES[w.toLowerCase()] ??
                (/^shift\+.$/i.test(w) ? w.slice(-1).toUpperCase() : w),
        )
        .join('');
// the strings a json argument holds (`herdr-app do pane.send '{"text":…}'`)
const jsonStrings = (word: string): string[] => {
    try {
        const walk = (v: unknown): string[] =>
            typeof v === 'string'
                ? [v]
                : v && typeof v === 'object'
                  ? Object.values(v).flatMap(walk)
                  : [];
        return walk(JSON.parse(word));
    } catch {
        return [];
    }
};
// each word only where it would act: a sign line and a marker at a line's start, an override word as the whole prompt;
// seats talk about all three mid-sentence all day (wishkeeper on 7bfa5ff7)
// a typed line's leading blanks count as gone, since the box may trim them before the prompt lands (sixth sense round 1)
const isProofText = (text: string) => {
    const trimmed = text
        .split('\n')
        .map((l) => l.trimStart())
        .join('\n');
    return (
        signsTyped(trimmed).length > 0 ||
        /^\s*(?:#\s*)?dima-ok:/im.test(text) ||
        overrideAsked(text) !== undefined
    );
};
// his bare yes under the one open guarded ask is his tick (FRM-574 decided 3); «ok» and «stop it» never count
const BARE_YES = /^(yes|go|approve|i approve|merge|do it)[.!]?$/i;
export const isBareYes = (text: string) => BARE_YES.test(text.trim());
const isPaneTyper = (c: { name: string; args: { text: string }[] }) =>
    PANE_TYPERS[c.name]?.(c.args.map((w) => w.text)) ?? false;
const isFed = (c: Command) =>
    c.args.some((w) => w.isExpanding) || c.feeders.length > 0;
// the files a pane typer's `$(cat <file>)`, `cat <file> |` or `$(< <file>)` would type, for the caller to read
export function paneFiles(command: string, cwd: string, ctx: Context = {}) {
    const list = commandsDeep(command, cwd);
    if (!list.some((c) => isPaneTyper(c) && isFed(c))) return [];
    return [
        ...list
            .filter((c) => c.name === 'cat')
            .flatMap((c) =>
                c.args
                    .filter((w) => !w.isExpanding && !w.text.startsWith('-'))
                    .map((w) => resolve(w.text, c.dir, ctx)),
            ),
        ...[...command.matchAll(/\$\(\s*<\s*([^\s)]+)\s*\)/g)].map((m) =>
            resolve(m[1] ?? '', cwd, ctx),
        ),
    ];
}
// `typed`: the text of the files paneFiles named, as the caller read them
export function paneProof(
    command: string,
    cwd: string,
    typed: string[] = [],
): Refusal | undefined {
    for (const c of commandsDeep(command, cwd)) {
        if (!isPaneTyper(c)) continue;
        // an allow-list of text the guard can read: a feeder past echo, printf and cat types what it never sees. it counts
        // only where it reaches the typed text (a `-` read from stdin, or a text word filled by a program), never the
        // terminal it aims at or a herdr call that types nothing (`hc keys $T …` with `T=$(… | jq …)`, replay 18:50)
        // `-` reads stdin for a send; `hc keys … -` types the minus key
        const isStdin =
            c.args.some((w) => w.text === '-') &&
            !(c.name === 'hc' && verbOf(c.args.map((w) => w.text)) === 'keys');
        const unread = isStdin
            ? c.feeders.find(
                  (f) => !LITERAL_FEEDERS.has(f.name) && f.name !== 'cat',
              )
            : textWordsOf(c)
                  .filter((w) => w.isExpanding)
                  .map((w) =>
                      // the parser leaves `$(…)` where an inline substitution stood; its program is a feeder
                      /\$\(…\)|`…`/.test(w.text)
                          ? inlineFill(command)
                          : unreadFill(w.text, command),
                  )
                  .find((name) => name !== undefined);
        if (unread)
            return {
                door: 'type the text inline, through echo, printf or cat of a file, or send it with SendMessage',
                rule: 'pane-proof',
                targets: [c.name],
                why: `\`${typeof unread === 'string' ? unread : unread.name}\` feeds text into a pane that x-mod-guard cannot read, and keys typed there arrive as dima's own composer prompt`,
            };
        const words = c.args.map((w) => w.text);
        const fed = c.feeders
            .filter((f) => LITERAL_FEEDERS.has(f.name))
            .map((f) =>
                f.args
                    .map((w) => w.text)
                    .filter((w) => !w.startsWith('-'))
                    .join(' '),
            );
        const texts = [
            ...words.map((_, i) => words.slice(i).join(' ')),
            ...words.flatMap(jsonStrings),
            // from each word on: the verb and the pane name come first, the keys after them
            ...words.map((_, i) => keysText(words.slice(i))),
            ...fed,
            ...(isFed(c) ? typed : []),
        ];
        // a bare yes counts only in a running session's prompt box; a spawn's first prompt approves nothing
        const isLive = !(
            c.name === 'claude' ||
            (c.name === 'hc' && verbOf(words) === 'run')
        );
        if (!texts.some((t) => isProofText(t) || (isLive && isBareYes(t))))
            continue;
        return {
            door: 'send it with SendMessage, or leave that line out: «sign <id>», a dima-ok marker, an operator-override word and a bare yes are his to type',
            rule: 'pane-proof',
            targets: [c.name],
            why: "keys typed into a pane arrive as dima's own composer prompt, so a seat typing his proof words there could sign or unlock for itself",
        };
    }
    return undefined;
}
// the terminals `hc keys` types into: keys split across calls build a sign line no one call holds (sixth sense round 1),
// so the caller asks herdr what runs there and keeps keystrokes out of an agent's prompt box
export function keysTargets(command: string, cwd: string) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const bare = c.args
            .map((w) => w.text)
            .filter((w) => !w.startsWith('-'));
        return c.name === 'hc' && bare[0] === 'keys' && bare[1]
            ? [bare[1]]
            : [];
    });
}
export const keysIntoAgent = (target: string, app: string): Refusal => ({
    door: "send a whole message with `hc send` (its text is judged whole), or prefill only a plain shell's prompt",
    rule: 'pane-keys',
    targets: [target],
    why: `${target} runs ${app}, and keys typed into its prompt box across calls can build his proof words no single call holds`,
});
// herdr's x-herdr-deck writes his presses to `~/.claude/shelf/orbit-ticks/<sid>.jsonl`, and the guard reads a press there as
// his tick (FRM-544 slice 1), so no seat's tool call writes there; x-herdr-deck's own write is a herdr mod's, no cc tool call
// a glob or brace the shell would expand into a fenced folder (wisphunter: `orbit-tick?`), read per path word and per
// segment: a brace is its listed names, a `*`, `?` or `[` a pattern; so `orbit-{ticks,x}` or `s*/orbit-tick?` reach the
// folder, while `shelf/{a,b}` or `plugin-x/*/` never can (clio's runs refused at 16:52, sixth sense's round 1)
// a variable, never a regex's trailing `$` (`SKILL.md$`, replay 17:54)
const isVar = (seg: string) => /\$[\w{(@*#?]/.test(seg);
export const isGlob = (seg: string) => /[*?[{]/.test(seg) || isVar(seg);
// past the cap a word is a brace bomb (`{0,1}` 22 times is 4M words, wisphunter 18:06): it stops opening, and a write
// naming one is refused
export const BRACE_CAP = 256;
export const bracesOf = (seg: string) => {
    let words = [seg];
    for (let isOpened = true; isOpened; ) {
        isOpened = false;
        const next: string[] = [];
        for (const word of words) {
            const m = word.match(/\{([^{}]*)\}/);
            if (!m) next.push(word);
            else {
                isOpened = true;
                for (const alt of (m[1] ?? '').split(','))
                    next.push(word.replace(m[0], alt));
            }
            if (next.length > BRACE_CAP) return next;
        }
        words = next;
    }
    return words;
};
// APFS opens `SHELF` as `shelf`, so every name compares without case (wisphunter 18:06)
export const globMatches = (seg: string, name: string) =>
    bracesOf(seg).some((alt) => {
        // a variable the line never fills may hold any name
        if (isVar(alt)) return true;
        try {
            const pattern = alt
                .replace(/[.+^$()|\\]/g, '\\$&')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            return new RegExp(`^${pattern}$`, 'i').test(name);
        } catch {
            // a pattern the guard cannot read may reach anything
            return true;
        }
    });
// `<.claude or cc>/<names[0]>/<names[1]>…` reached by a word holding at least one glob segment on that walk
function globReaches(text: string, names: readonly string[]) {
    // a brace spanning a slash (`.claude/{shelf/orbit-ticks,x}`) opens before the walk
    for (const word of text.split(/[\s'"=]+/)) {
        const isBraced = word.includes('{');
        const paths = bracesOf(word);
        if (paths.length > BRACE_CAP) return true;
        for (const path of paths)
            if (walkReaches(path.split('/'), names, isBraced)) return true;
    }
    return false;
}
function walkReaches(
    raw: string[],
    names: readonly string[],
    isBraced: boolean,
) {
    // every root is walked: `.claude/../.claude/…`, and a root that is itself a glob (`.cl*de`, `.cla{u,x}de`,
    // sixth sense round 3)
    for (const [at, root] of raw.entries()) {
        const isGlobRoot =
            isGlob(root) &&
            (globMatches(root, '.claude') || globMatches(root, 'cc'));
        const isRoot = /^(\.claude|cc)$/i.test(root);
        if (!isRoot && !isGlobRoot) continue;
        // the path the kernel walks: `.` and empty segments drop, `..` steps back (sixth sense round 2)
        const walked: string[] = [];
        let isAbove = false;
        for (const seg of raw.slice(at + 1)) {
            if (seg === '' || seg === '.') continue;
            if (seg !== '..') walked.push(seg);
            else if (walked.pop() === undefined) isAbove = true;
        }
        if (isAbove) continue;
        const segs = walked.slice(0, names.length);
        // a walk that stops short names the parent, never the folder (`"$TMPDIR/v6-$i.txt"`, replay 17:48)
        if (segs.length < names.length) continue;
        // a path built of variables alone names nothing the guard can read (`$r/$seat/$d.md`, replay 17:54): a named limit
        if (isVar(root) && segs.every(isVar)) continue;
        if (!isBraced && !isGlobRoot && !segs.some(isGlob)) continue;
        if (
            segs.every((seg, i) =>
                isGlob(seg)
                    ? globMatches(seg, names[i] ?? '')
                    : seg.toLowerCase() === names[i],
            )
        )
            return true;
    }
    return false;
}
const isTicksName = (text: string) =>
    /(^|[/'"])orbit-ticks(\/|$|['"])/.test(text) ||
    globReaches(text, ['shelf', 'orbit-ticks']);
const isShelfDir = (text: string) => /(\.claude|cc)\/shelf\/?$/i.test(text);
export const isTicksPath = (path: string) =>
    /(^|\/)orbit-ticks(\/|$)/.test(path);
export const TICKS_WRITE = {
    door: "ask dima to tick the ask on x-herdr-deck or on the seat's own 🚦 board; a read goes through cat or jq",
    rule: 'ticks-write',
    targets: ['orbit-ticks'],
    why: "x-herdr-deck writes dima's presses there and x-mod-guard reads a press as his tick, so a seat's write would forge one",
} as const satisfies Refusal;
// `lands`: the words the hook resolved on disk into the fenced folder (a symlink, a glob it expanded), `landsDir` into its
// parent; both empty where nothing resolved, so the spelled checks alone stand (replay, a test)
export function ticksWrite(
    command: string,
    cwd: string,
    lands: ReadonlySet<string> = new Set(),
    landsDir: ReadonlySet<string> = new Set(),
): Refusal | undefined {
    return touchesStore(
        command,
        cwd,
        (t) => isTicksName(t) || lands.has(t),
        (t) => isShelfDir(t) || landsDir.has(t),
        true,
    )
        ? TICKS_WRITE
        : undefined;
}
// twin press-dir — a copy lives in x-mod-stash, which reads the presses; the twins lint keeps them equal
// herdr's band appends dima's presses (🐦‍🔥 🔥 ⏰ 💨) to `~/.claude/shelf/band-presses/band.jsonl` (dima's name, 21:36)
export const PRESS_DIR = 'band-presses';
// twin end
const isPressName = (text: string) =>
    new RegExp(`(^|[/'"])${PRESS_DIR}(\\/|$|['"])`).test(text) ||
    globReaches(text, ['shelf', PRESS_DIR]);
export const isPressPath = (path: string) =>
    new RegExp(`(^|/)${PRESS_DIR}(/|$)`).test(path);
export const PRESS_WRITE = {
    door: "ask dima to press the button on herdr's band or on the seat's own band; a read goes through cat or jq",
    rule: 'press-write',
    targets: [PRESS_DIR],
    why: "herdr's band writes dima's 🐦‍🔥 🔥 ⏰ 💨 presses there and every seat acts on them, so a seat's write would press for him (an AFK press sets every seat acting on its own picks)",
} as const satisfies Refusal;
// as the ticks fence: a seat's tool call never writes the press folder, herdr's band is no cc tool call (FRM-568)
export function pressWrite(
    command: string,
    cwd: string,
    lands: ReadonlySet<string> = new Set(),
    landsDir: ReadonlySet<string> = new Set(),
): Refusal | undefined {
    return touchesStore(
        command,
        cwd,
        (t) => isPressName(t) || lands.has(t),
        (t) => isShelfDir(t) || landsDir.has(t),
        true,
    )
        ? PRESS_WRITE
        : undefined;
}
// every word the store checks judge, so the hook can resolve each on disk before they run
export function fenceTexts(command: string, cwd: string) {
    const seen = new Set<string>();
    const take = (t: string) => {
        seen.add(t);
        return false;
    };
    touchesStore(command, cwd, take, take, true);
    return [...seen];
}
// the plugins' stores are written by their own plugins alone: x-herdr-deck takes the file a press lands in from
// x-mod-stash's `succ:` key and the ask from its `asks:` key, so a seat's write there could aim his press at itself
const isStoreName = (text: string) =>
    /(^|[/'"])plugins\/store(\/|$|['"])/.test(text) ||
    globReaches(text, ['plugins', 'store']);
const isPluginsDir = (text: string) => /(\.claude|cc)\/plugins\/?$/i.test(text);
export const isStorePath = (path: string) =>
    /\/\.claude\/plugins\/store(\/|$)/.test(path);
export const STORE_WRITE = {
    door: 'a plugin writes its own store; for this one write, ask dima to tick an orbit ask quoting the whole command',
    rule: 'store-write',
    targets: ['plugins/store'],
    why: "x-herdr-deck reads where dima's press lands from x-mod-stash's store, so a seat's write there could aim his press at itself",
} as const satisfies Refusal;
export function storeWrite(
    command: string,
    cwd: string,
    lands: ReadonlySet<string> = new Set(),
    landsDir: ReadonlySet<string> = new Set(),
): Refusal | undefined {
    return touchesStore(
        command,
        cwd,
        (t) => isStoreName(t) || lands.has(t),
        (t) => isPluginsDir(t) || landsDir.has(t),
        true,
    )
        ? STORE_WRITE
        : undefined;
}
// his presses in a ticks file as ticks: the newest press per ask decides, a ↩️ replay after a 🛎 taking it back; a press
// carries the ask text he pressed on, so a tick covers what that text quotes and nothing else
export function pressTicks(text: string) {
    const newest = new Map<
        string,
        { at: number; text?: string; verdict: string }
    >();
    for (const line of text.split('\n')) {
        let press: unknown;
        try {
            press = JSON.parse(line);
        } catch {
            continue;
        }
        if (typeof press !== 'object' || !press) continue;
        const {
            at,
            id,
            text: asked,
            verdict,
        } = press as Record<string, unknown>;
        if (typeof id !== 'string' || typeof at !== 'number') continue;
        // an untick takes a tick back like a ↩️ (FRM-574, PK-363:W934)
        if (verdict !== 'tick' && verdict !== 'replay' && verdict !== 'untick')
            continue;
        if ((newest.get(id)?.at ?? -1) > at) continue;
        newest.set(id, {
            at,
            text: typeof asked === 'string' ? asked : undefined,
            verdict,
        });
    }
    return [...newest].flatMap(([id, p]) =>
        p.verdict === 'tick' && p.text !== undefined
            ? [
                  {
                      at: p.at,
                      id: `herdr:${id}`,
                      targets: [...p.text.matchAll(/`([^`]+)`/g)].map(
                          (m) => m[1] as string,
                      ),
                      text: p.text,
                  },
              ]
            : [],
    );
}
// a tick quotes the pr when its text holds the pr's url in this repo, `github.com/<owner>/<name>/pull/<n>`, or reads
// `⚠️ merge <name>#<n>` (FRM-478); a bare `#<n>` or another repo's pr of the same number proves nothing (FRM-427, sixth sense round 1);
// a url cited for anything else proves nothing either: the ask opens «merge» or «land», ⚠️ or not, an allow-list since a tick now lives past newer ones (FRM-510)
const isMergeWord = (text: string) =>
    /^\s*(?:⚠️\s*)?(?:merge|land)\b/iu.test(text);
export const quotesPr = (text: string, repo: string, pr: string) =>
    (isMergeWord(text) &&
        text.includes(`github.com/${repo}/pull/${pr}`) &&
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
