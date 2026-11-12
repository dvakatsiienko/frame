import {
    type Command,
    type Context,
    type Refusal,
    SHELLS,
    TICK_DOOR,
    actsIn,
    aliasRun,
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
    nestedScripts,
    operands,
    peel,
    persistedAlias,
    resolve,
} from './rules/command.ts';
import { floor, hooksBypass } from './rules/floor.ts';
import { hazard } from './rules/hazard.ts';
import { herdrClose } from './rules/herdr-close.ts';
import { type Parsed, parse } from './shell.ts';

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
// a throwaway repo under the job's own tmp lifts the identity a `-c user.*` or `git config user.*` sets (FRM-467)
function isThrowawayLift(c: Command, r: Refusal, ctx: Context) {
    return (
        r.rule === 'bypass' &&
        c.name === 'git' &&
        r.targets.every((t) => IDENTITY.test(t)) &&
        isThrowaway(c, ctx)
    );
}
// the command with the lifted `-c user.*` taken off, so the rules behind it judge what is left: it must not hide a
// force-push in the same command
function without(c: Command) {
    return {
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
    };
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
// the floor: what deletes, discards, rewrites, skips a gate, kills by pattern, ends a seat or reaches production for
// good. isPlain: the whole command, a nested shell's script included, is on the lift's lists; a nested call carries its parent's
export function refusals(
    command: string,
    cwd: string,
    ctx: Context = {},
    isPlain = isPlainScript(command, cwd, ctx),
    hiddenBy?: string,
): Refusal[] {
    const list = commands(parse(command), cwd);
    const out: Refusal[] = [];
    // the git aliases the line has persisted so far, by name
    const aliases = new Map<string, string>();
    for (const c of list) {
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
        const judge = (cmd: Command) =>
            floor(cmd) ?? herdrClose(cmd, ctx) ?? hazard(cmd, ctx);
        let found = judge(c);
        // a lifted rule hides every rule behind it, so the command is judged again without the lifted part
        let rest = c;
        while (found && isPlain && isThrowawayLift(rest, found, ctx)) {
            const stripped = without(rest);
            const isSame = stripped.args.length === rest.args.length;
            rest = stripped;
            found = isSame ? undefined : judge(rest);
        }
        if (found && !isScratchGit(c, found, ctx) && !isCleanup(c, found, ctx))
            out.push(found);
        const hooks = hooksBypass(c);
        if (hooks) out.push(hooks);
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
    }
    // one line per rule and target: a rule seen on every command of a pipeline is one finding
    return out.filter(
        (r, i) =>
            out.findIndex(
                (o) =>
                    o.rule === r.rule && o.targets.join() === r.targets.join(),
            ) === i,
    );
}
// plain rm never opens, so its refusal names only its door
export function message(r: Refusal) {
    const said = `nothing in this command ran — x-mod-guard stopped this one command. instead: ${r.door}. why: ${r.why}`;
    return r.rule === 'rm'
        ? `${said}.`
        : `${said}. only on dima's word: ${TICK_DOOR}`;
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
