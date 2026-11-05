import {
    ASK,
    type Command,
    type Context,
    NEVER,
    PIPE_READ,
    type Refusal,
    STASH,
    TRASH,
    VAULT,
    asMember,
    commandsDeep,
    gitDir,
    gitParts,
    hasFlag,
    operands,
    or,
    peel,
    resolve,
} from './command.ts';
import { isOwnRepo } from './hazard.ts';

// a whole-tree stash sets aside every uncommitted file in the tree, a peer session's too (the FRM-427 sixth sense, the
// 10-25 flawlog); the git dirs where one runs, for the caller to check against x-mod-holds
const STASH_READS = new Set([
    'list',
    'show',
    'pop',
    'apply',
    'drop',
    'clear',
    'branch',
    'create',
    'store',
]);
const STASH_VALUE = new Set(['-m', '--message', '--pathspec-from-file']);
const WHOLE_TREE = /^(?:\.\/?|\*|:\/?\*?|:\(top\)\*?)$/;
export function stashSweeps(command: string, cwd: string, ctx: Context) {
    const dirs: string[] = [];
    for (const c of commandsDeep(command, cwd)) {
        if (c.name !== 'git') continue;
        const { sub, subArgs } = gitParts(c.args);
        if (sub !== 'stash') continue;
        const words = subArgs.map((w) => w.text);
        const verb = words.find((w) => !w.startsWith('-'));
        if (verb && STASH_READS.has(verb)) continue;
        if (words.some((w) => w.startsWith('--pathspec-from-file'))) continue;
        // a push names pathspecs after its flags or a `--`; a bare stash and `save <message>` take none
        const rest = words.indexOf('--');
        const paths =
            rest >= 0
                ? words.slice(rest + 1)
                : verb === 'push'
                  ? words
                        .slice(words.indexOf('push') + 1)
                        .filter(
                            (w, i, all) =>
                                !w.startsWith('-') &&
                                !STASH_VALUE.has(all[i - 1] ?? ''),
                        )
                  : [];
        // `.`, `*` or a top pathspec names the whole tree under it
        if (!paths.length || paths.some((p) => WHOLE_TREE.test(p)))
            dirs.push(gitDir(c, ctx));
    }
    return dirs;
}
export const stashSweep = (dir: string, file: string): Refusal => ({
    door: STASH,
    rule: 'stash-sweep',
    targets: [dir],
    why: `a whole-tree git stash also sets aside ${file}, which another session holds`,
});

// one class, judged after every other rule: a command whose name the line never typed as it runs — a `$` it cannot fill, a
// brace list, a name a variable takes several values for or `$(echo …)` prints, or a script printed into a shell, sourced
// or held in a git alias; the door names the literal spelling (dima's o1 and o35)
export function opaque(c: Command, hiddenBy?: string): Refusal | undefined {
    if (!c.name || c.name === '[' || c.name === '[[') return undefined;
    const spell = (
        why: string,
        door = `spell it as it runs: \`${c.name}\``,
    ): Refusal => ({
        door,
        rule: 'opaque-head',
        targets: [c.name],
        why,
    });
    // `"$@"` and `$1` are a function's own arguments; `$(( $(date +%s) - t ))` reads as a group headed by its substitution
    const isArithmetic =
        c.name === '$(…)' && c.args.some((w) => /^[-+*/%]$/.test(w.text));
    const head = c.head;
    if (
        /[$`]/.test(c.name) &&
        !/^\$\{?[@*0-9]\}?$/.test(c.name) &&
        !isArithmetic
    )
        return spell(
            'a command named by a variable the line never fills runs what the guard cannot read',
            'spell the command out, or run the script it names by path',
        );
    // a brace list widens to every name in it: `r{m,}` is rm, and the door names each
    const brace = head?.hasQuote
        ? undefined
        : (head?.text ?? '').match(/^(.*?)\{([^{}]*(?:,|\.\.)[^{}]*)\}(.*)$/s);
    if (brace) {
        const [, before = '', list = '', after = ''] = brace;
        const words = list.includes(',')
            ? list.split(',').map((w) => `\`${before}${w}${after}\``)
            : [];
        return spell(
            'a brace in a command name runs whatever it widens to',
            words.length
                ? `spell it as it runs: ${words.join(' or ')}`
                : 'spell the command out',
        );
    }
    if (head?.isFilled)
        return spell(
            'a command name a variable takes several values for, or a substitution prints, hides what runs',
        );
    if (hiddenBy)
        return spell(
            `a command inside ${hiddenBy} never shows as typed`,
            `run it as its own command: \`${c.name} …\``,
        );
    return undefined;
}
// the builtins that set a variable from their operands (`declare -x HOME=…`)
const DECLARERS = new Set([
    'export',
    'declare',
    'typeset',
    'local',
    'readonly',
]);
// what reads process ids by name
const FINDERS = new Set(['pgrep', 'ps', 'pidof', 'lsof', 'grep', 'rg', 'awk']);
export function floor(c: Command, ctx: Context): Refusal | undefined {
    const ops = operands(c.args);
    if (c.name === 'rm' || c.name === 'unlink')
        return {
            door: TRASH,
            rule: 'rm',
            targets: or(ops, 'rm'),
            why: 'rm deletes for good',
        };
    if (c.name === 'find') {
        const exec = c.args.findIndex((w) =>
            /^-(exec|execdir|ok)$/.test(w.text),
        );
        const execRm = exec >= 0 && peel(c.args.slice(exec + 1)).name === 'rm';
        if (execRm || hasFlag(c.args, ['-delete'])) {
            const roots = c.args.findIndex((w) => /^[-(!]/.test(w.text));
            const paths = c.args
                .slice(0, roots < 0 ? undefined : roots)
                .map((w) => w.text);
            return {
                door: TRASH,
                rule: 'rm',
                targets: or(paths, '.'),
                why: 'find deletes for good',
            };
        }
    }
    const pgrep = c.feeders.find((f) => f.name === 'pgrep');
    if (
        c.name === 'pkill' ||
        c.name === 'killall' ||
        (c.name === 'kill' && c.feeders.some((f) => FINDERS.has(f.name)))
    )
        return {
            door: 'claude stop <id>, or kill the pid you captured at spawn',
            rule: 'kill',
            targets: or(
                c.name === 'kill' ? operands(pgrep?.args ?? []) : ops,
                c.name,
            ),
            why: 'a kill by pattern hits your own process too',
        };
    if (
        c.name === 'mv' &&
        (c.dir.includes(VAULT) || ops.some((o) => o.includes(VAULT)))
    )
        return {
            door: 'obsidian rename / obsidian move — they rewrite the wikilinks',
            rule: 'vault-mv',
            targets: ops,
            why: 'a plain mv in the vault breaks every wikilink to the note',
        };
    if (
        c.assigns.some((a) => /^HOME\+?=/.test(a)) ||
        (DECLARERS.has(c.name) && ops.some((o) => /^HOME\+?=/.test(o)))
    )
        return {
            door: 'run it without the HOME override',
            rule: 'home',
            targets: ['HOME'],
            why: 'a HOME override points every tool at the wrong config',
        };
    if (
        c.name === 'npm' &&
        (hasFlag(c.args, ['--global', '--location=global'], 'g') ||
            c.args.some(
                (w, i) =>
                    w.text === '--location' && c.args[i + 1]?.text === 'global',
            ))
    )
        return {
            door: 'brew first, else pnpm add -g',
            rule: 'npm-global',
            targets: ['npm'],
            why: 'npm -g is not used here',
        };
    const isPip = /^pip\d*(\.\d+)?$/.test(c.name) && ops[0] === 'install';
    // `-m pip` or glued `-mpip`: the words after it are pip's
    const pipAt = c.args.findIndex(
        (w, i) =>
            w.text === '-mpip' ||
            (w.text === '-m' && c.args[i + 1]?.text === 'pip'),
    );
    const pipArgs = c.args.slice(
        pipAt + (c.args[pipAt]?.text === '-mpip' ? 1 : 2),
    );
    const isPyPip =
        /^python\d*(\.\d+)?$/.test(c.name) &&
        pipAt >= 0 &&
        operands(pipArgs)[0] === 'install';
    if (isPip || isPyPip)
        return {
            door: 'uv pip install',
            rule: 'pip',
            targets: ['pip'],
            why: 'pip is not used here; uv is',
        };
    const bypass = c.args.find(
        (w) => w.text === '--no-verify' || w.text === '--no-gpg-sign',
    );
    if (bypass && (c.name === 'git' || c.name === 'x'))
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [bypass.text],
            why: `${bypass.text} skips a gate`,
        };
    if (c.name !== 'git') return undefined;

    const { configs, sub, subArgs } = gitParts(c.args);
    const subOps = operands(subArgs);
    const config = configs.find(
        (k) =>
            /^commit\.gpgsign=(?:false|no|off|0)$/i.test(k) ||
            /^user\.(name|email)=/i.test(k),
    );
    if (config) {
        const key = config.split('=')[0] ?? config;
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [key],
            why: `-c ${key} overrides signing or identity`,
        };
    }
    const discard = (targets: string[], what: string): Refusal => ({
        door: STASH,
        rule: 'git-discard',
        targets,
        why: `${what} throws away uncommitted work`,
    });
    if (sub === 'commit' && hasFlag(subArgs, [], 'n'))
        return {
            door: NEVER,
            rule: 'bypass',
            targets: ['-n'],
            why: 'git commit -n skips the commit hooks',
        };
    if (
        sub === 'config' &&
        /^user\.(name|email)$/i.test(subOps[0] ?? '') &&
        subOps.length > 1
    )
        return {
            door: NEVER,
            rule: 'bypass',
            targets: [subOps[0] ?? ''],
            why: 'git config changes the commit identity',
        };
    if (sub === 'reset' && hasFlag(subArgs, ['--hard']))
        return discard(or(subOps, 'HEAD'), 'git reset --hard');
    if (
        sub === 'checkout' &&
        (subArgs.some((w) => w.text === '--') ||
            subOps.includes('.') ||
            hasFlag(subArgs, ['--force'], 'f'))
    )
        return discard(or(subOps, '.'), 'git checkout over files');
    if (
        sub === 'restore' &&
        !(
            hasFlag(subArgs, ['--staged'], 'S') &&
            !hasFlag(subArgs, ['--worktree'], 'W')
        )
    )
        return discard(or(subOps, '.'), 'git restore');
    if (sub === 'clean' && hasFlag(subArgs, ['--force'], 'f'))
        return discard(or(subOps, '.'), 'git clean');
    if (sub === 'stash' && (subOps[0] === 'drop' || subOps[0] === 'clear'))
        return {
            door: ASK,
            rule: 'git-discard',
            targets: or(
                subOps.slice(1),
                subOps[0] === 'drop' ? 'stash@{0}' : 'clear',
            ),
            why: `git stash ${subOps[0]} throws away set-aside work`,
        };
    const rewrite = (
        targets: string[],
        what: string,
        door: string = ASK,
    ): Refusal => ({
        door,
        rule: 'git-rewrite',
        targets,
        why: `${what} cannot be undone`,
    });
    const refspecs = subOps.slice(1);
    if (
        sub === 'push' &&
        (hasFlag(subArgs, ['--delete'], 'd') ||
            refspecs.some((o) => o.startsWith(':')))
    )
        return rewrite(or(subOps, 'push'), 'a remote branch delete');
    if (
        sub === 'push' &&
        (hasFlag(subArgs, ['--force', '--force-with-lease'], 'f') ||
            refspecs.some((o) => o.startsWith('+')))
    )
        return rewrite(
            or(subOps, 'push'),
            'a force-push',
            'x lane rebase-main — it rebases a codie/* (or older coder/*) branch and pushes it with a lease; any other force-push, ask clio',
        );
    // a mirror push makes every remote ref match the local ones: it rewrites and deletes like a force push
    if (sub === 'push' && hasFlag(subArgs, ['--mirror']))
        return rewrite(or(subOps.slice(0, 1), 'push'), 'a mirror push');
    if (
        sub === 'branch' &&
        (hasFlag(subArgs, [], 'D') ||
            (hasFlag(subArgs, ['--delete'], 'd') &&
                hasFlag(subArgs, ['--force'], 'f')))
    )
        return rewrite(subOps, 'git branch -D');
    if (sub === 'filter-repo' || sub === 'filter-branch')
        return rewrite([sub], `git ${sub}`);
    if (sub === 'gc' && hasFlag(subArgs, ['--prune=now']))
        return rewrite(['--prune=now'], 'git gc --prune=now');
    if (sub === 'worktree' && subOps[0] === 'prune')
        return rewrite(['prune'], 'git worktree prune');
    if (sub === 'worktree' && subOps[0] === 'remove')
        return rewrite(or(subOps.slice(1), 'remove'), 'git worktree remove');
    const toMain = subOps
        .slice(1)
        .find((o) => /^[^+:][^:]*:(refs\/heads\/)?main$/.test(o));
    if (sub === 'push' && toMain && isOwnRepo(gitDir(c, ctx), ctx))
        return {
            door: "x lane push — it pushes HEAD's sha and reads the remote back",
            rule: 'push-lane',
            targets: [toMain],
            why: 'a hand-typed sha or ref pushed to main skips the read-back',
        };
    return undefined;
}
// a git call past a door's gate, judged beside the rule chain: a plain push from frame's main checkout, a `-c core.hooksPath`
const LINEAR_READS = ['list', 'read'];
const LINEAR_MEMBER_WRITES = ['comment', 'create', 'delete', 'update'];

// any `x linear` verb but a known read writes, so a new verb warns by default
function isLinearWrite(c: Command) {
    const words = c.args.map((w) => w.text);
    // `x as <member> --` is a wrapper: the command the walker reads is the raw `linear` under it
    if (asMember(c) !== undefined && c.name === 'linear')
        return (
            words[0] === 'issue' &&
            LINEAR_MEMBER_WRITES.includes(words[1] ?? '')
        );
    if (c.name !== 'x' || words[0] !== 'linear') return false;
    const verb = words[1] ?? '';
    // no verb, or only a flag: it prints its help
    if (!verb || verb.startsWith('-') || words.includes('--help')) return false;
    if (LINEAR_READS.includes(verb)) return false;
    if (verb === 'body') return words.includes('--set');
    if (verb === 'archive') return words.includes('--apply');
    if (verb !== 'api') return true;
    // a query counts as a read only when its text is on the line to read
    const queries = c.args
        .slice(2)
        .filter((w) => /^\s*(?:query\b|mutation\b|\{)/.test(w.text));
    return (
        !queries.length ||
        queries.some((w) => w.isExpanding || /\bmutation\b/.test(w.text))
    );
}

// the pipe's exit is the reader's, so a failed write reads as a success; the call has already run by the time this speaks
export function linearPiped(command: string, cwd: string): Refusal | undefined {
    if (PIPE_READ.test(command)) return undefined;
    if (
        !commandsDeep(command, cwd).some(
            (c) => c.sep === '|' && isLinearWrite(c),
        )
    )
        return undefined;
    return {
        door: 'the call already ran: read the ticket back with x linear read before repeating it, a comment is not idempotent; run the next write unpiped, its exit is the receipt',
        rule: 'linear-write-piped',
        targets: ['x linear'],
        why: "a pipe after an x linear write reports the reader's exit, so a failed write reads as a success",
    };
}

export function gitDoor(c: Command, ctx: Context): Refusal | undefined {
    // the environment git reads its config from: a prefix, or an export that lasts for the calls after it
    const env = [
        ...c.assigns,
        ...(['export', 'declare', 'typeset'].includes(c.name)
            ? operands(c.args)
            : []),
    ];
    const fromEnv = env.flatMap(
        (a) =>
            a.match(/^GIT_CONFIG_KEY_\d+=(.*)$/)?.[1] ??
            (/^GIT_CONFIG_PARAMETERS=.*core\.hookspath/is.test(a)
                ? 'core.hooksPath'
                : []),
    );
    if (c.name !== 'git' && !fromEnv.length) return undefined;
    const { configs, sub, subArgs } = gitParts(c.args);
    // `-f`/`--file`/`--blob` name where git config writes, never the key
    const ops = operands(
        subArgs.filter(
            (w, i) => !/^(-f|--file|--blob)$/.test(subArgs[i - 1]?.text ?? ''),
        ),
    );
    const [key, value] = ops[0] === 'set' ? ops.slice(1) : ops;
    // a read, a list or an unset swaps nothing; only a key given a value persists
    const isSet =
        value !== undefined &&
        !subArgs.some((w) => /^(--get|--unset|--list$|-l$)/.test(w.text));
    // a `-c` or `--config-env` key, one `git config` persists, or one the environment hands git (`GIT_CONFIG_KEY_<n>`)
    const hooks = [
        ...configs,
        ...(sub === 'config' && key && isSet ? [key] : []),
        ...fromEnv,
    ].find((k) => /^core\.hookspath(?:=|$)/i.test(k));
    if (hooks)
        return {
            door: 'fix what the hook refused, then run it without the override',
            rule: 'hooks-bypass',
            targets: [hooks.split('=')[0] ?? hooks],
            why: '-c core.hooksPath swaps out the hooks a commit or push runs',
        };
    // the repo a push leaves from: where it runs, or the tree a `--git-dir` or `GIT_DIR` names
    if (c.name !== 'git') return undefined;
    const named =
        c.args.flatMap((w, i) =>
            w.text.startsWith('--git-dir=')
                ? [w.text.slice('--git-dir='.length)]
                : w.text === '--git-dir'
                  ? [c.args[i + 1]?.text ?? '']
                  : [],
        )[0] ??
        c.assigns.flatMap((a) => a.match(/^GIT_DIR=(.+)$/)?.[1] ?? [])[0];
    const dir =
        named === undefined
            ? gitDir(c, ctx)
            : resolve(named, gitDir(c, ctx), ctx).replace(/\/\.git\/?$/, '');
    const frame = `${ctx.home}/frame`;
    if (
        sub === 'push' &&
        ctx.home &&
        (dir === frame || dir.startsWith(`${frame}/`)) &&
        !dir.startsWith(`${frame}/.claude/worktrees/`) &&
        !hasFlag(subArgs, ['--dry-run'], 'n')
    )
        return {
            door: "x lane push — it pushes HEAD's sha and reads the remote back",
            rule: 'bare-push',
            targets: ['push'],
            why: 'a plain git push from frame skips the read-back and the push gates x lane push runs',
        };
    return undefined;
}
