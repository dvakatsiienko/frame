import {
    ASK,
    type Command,
    type Context,
    NEVER,
    type Refusal,
    STASH,
    TRASH,
    VAULT,
    gitDir,
    gitParts,
    hasFlag,
    operands,
    or,
    peel,
} from './command.ts';
import { isOwnRepo } from './hazard.ts';
import { rewrite } from './rewrite.ts';

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
        c.assigns.some((a) => a.startsWith('HOME=')) ||
        (c.name === 'export' && ops.some((o) => o.startsWith('HOME=')))
    )
        return {
            door: 'run it without the HOME override',
            rule: 'home',
            targets: ['HOME'],
            why: 'a HOME override points every tool at the wrong config',
        };
    if (
        c.name === 'npm' &&
        hasFlag(c.args, ['--global', '--location=global'], 'g')
    )
        return {
            door: 'brew first, else pnpm add -g',
            rule: 'npm-global',
            targets: ['npm'],
            why: 'npm -g is not used here',
        };
    const isPip = /^pip\d*(\.\d+)?$/.test(c.name) && ops[0] === 'install';
    const pipAt = c.args.findIndex(
        (w, i) => w.text === '-m' && c.args[i + 1]?.text === 'pip',
    );
    const isPyPip =
        /^python\d*(\.\d+)?$/.test(c.name) &&
        pipAt >= 0 &&
        operands(c.args.slice(pipAt + 2))[0] === 'install';
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
            /^commit\.gpgsign=false$/i.test(k) ||
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
    const rewrite = (targets: string[], what: string): Refusal => ({
        door: ASK,
        rule: 'git-rewrite',
        targets,
        why: `${what} cannot be undone`,
    });
    if (
        sub === 'push' &&
        (hasFlag(
            subArgs,
            ['--force', '--force-with-lease', '--delete'],
            'fd',
        ) ||
            subOps.slice(1).some((o) => /^[+:]/.test(o)))
    )
        return rewrite(or(subOps, 'push'), 'a force-push');
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
