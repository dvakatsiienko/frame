import {
    ASK,
    type Command,
    type Context,
    NEVER,
    type Refusal,
    STASH,
    TRASH,
    commandsDeep,
    gitDir,
    gitParts,
    hasFlag,
    operands,
    or,
    peel,
} from './command.ts';

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

// what reads process ids by name
const FINDERS = new Set(['pgrep', 'ps', 'pidof', 'lsof', 'grep', 'rg', 'awk']);
export function floor(c: Command): Refusal | undefined {
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
            'x lane rebase-main — it rebases a codie/* branch and pushes it with a lease; any other force-push, ask clio',
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
    // a dry run only prints what it would remove (FRM-519 item 17)
    if (
        sub === 'worktree' &&
        subOps[0] === 'prune' &&
        (!hasFlag(subArgs, ['--dry-run'], 'n') ||
            hasFlag(subArgs, ['--no-dry-run']))
    )
        return rewrite(['prune'], 'git worktree prune');
    if (sub === 'worktree' && subOps[0] === 'remove')
        return rewrite(or(subOps.slice(1), 'remove'), 'git worktree remove');
    return undefined;
}

// a `-c` or `--config-env` key, one `git config` persists, or one the environment hands git (`GIT_CONFIG_KEY_<n>`): each
// swaps out the hooks a commit or push runs
export function hooksBypass(c: Command): Refusal | undefined {
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
            (_, i) => !/^(-f|--file|--blob)$/.test(subArgs[i - 1]?.text ?? ''),
        ),
    );
    const [key, value] = ops[0] === 'set' ? ops.slice(1) : ops;
    // a read, a list or an unset swaps nothing; only a key given a value persists
    const isSet =
        value !== undefined &&
        !subArgs.some((w) => /^(--get|--unset|--list$|-l$)/.test(w.text));
    const hooks = [
        ...configs,
        ...(sub === 'config' && key && isSet ? [key] : []),
        ...fromEnv,
    ].find((k) => /^core\.hookspath(?:=|$)/i.test(k));
    if (!hooks) return undefined;
    return {
        door: 'fix what the hook refused, then run it without the override',
        rule: 'hooks-bypass',
        targets: [hooks.split('=')[0] ?? hooks],
        why: '-c core.hooksPath swaps out the hooks a commit or push runs',
    };
}
