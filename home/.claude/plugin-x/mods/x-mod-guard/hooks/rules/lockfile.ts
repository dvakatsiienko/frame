import {
    type Command,
    type Context,
    type Refusal,
    resolve,
} from './command.ts';

// `CI=1` makes pnpm freeze the lockfile: a dep add or removal, or an install over a changed manifest, leaves the
// lockfile behind and the commit ships half (FRM-393, was a fleet-hazards line)
const ADDS = new Set(['add', 'remove', 'rm', 'uninstall', 'un']);
const INSTALLS = new Set(['install', 'i']);
// pnpm's own flags that take the next word: the verb follows them
const VALUED = new Set(['--filter', '-F', '-C', '--dir', '--workspace-dir']);
const verbOf = (c: Command) =>
    c.args.find(
        (w, i) =>
            !w.text.startsWith('-') && !VALUED.has(c.args[i - 1]?.text ?? ''),
    )?.text ?? '';
const isFrozenPnpm = (c: Command) =>
    c.name === 'pnpm' &&
    c.assigns.some((a) => /^CI=(1|true)$/.test(a)) &&
    !c.args.some((w) => w.text === '--no-frozen-lockfile');

// the dirs whose `CI=1 pnpm install` needs a manifest check before it is judged
export function frozenInstallDirs(cs: Command[], ctx: Context) {
    return cs
        .filter((c) => isFrozenPnpm(c) && INSTALLS.has(verbOf(c)))
        .map((c) => resolve(c.dir, '/', ctx));
}

export function lockfile(c: Command, ctx: Context): Refusal | undefined {
    if (!isFrozenPnpm(c)) return undefined;
    const verb = verbOf(c);
    const isAdd = ADDS.has(verb);
    const isChangedInstall =
        INSTALLS.has(verb) && !!ctx.manifestDirs?.has(resolve(c.dir, '/', ctx));
    if (!isAdd && !isChangedInstall) return undefined;
    return {
        door: `add --no-frozen-lockfile: CI=1 pnpm ${verb} --no-frozen-lockfile …`,
        rule: 'frozen-lockfile',
        targets: [`pnpm ${verb}`],
        why: isAdd
            ? 'CI=1 freezes the lockfile, so the dep change never reaches it and the commit ships half'
            : 'a package.json or pnpm-workspace.yaml changed, and CI=1 freezes the lockfile against it',
    };
}
