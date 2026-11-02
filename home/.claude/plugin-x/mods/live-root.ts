// what pnpm mods:live serves for a dir: the dir alone when it is a mod, else every mod of its mods root — the dir
// itself, or a frame tree's home/.claude/plugin-x/mods — each swapped into its live namesake's place
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { loadedFrom, manifestName, swapDir } from './probe.ts';

export type ServedMod = { dir: string; name: string };

const TREE_ROOT = 'home/.claude/plugin-x/mods';

const nameAt = (dir: string) => manifestName(dir, homedir());

function modsUnder(root: string): ServedMod[] {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .flatMap((e) => {
            const dir = join(root, e.name);
            const name = nameAt(dir);
            return name ? [{ dir, name }] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function modsOf(
    arg: string,
): { mods: ServedMod[]; root: string } | undefined {
    const dir = resolve(arg);
    const name = nameAt(dir);
    if (name) return { mods: [{ dir, name }], root: dirname(dir) };
    for (const root of [dir, join(dir, TREE_ROOT)]) {
        const mods = modsUnder(root);
        if (mods.length) return { mods, root };
    }
    return undefined;
}

export const servedDirs = (
    live: string[],
    mods: ServedMod[],
    nameOf: (dir: string) => string | undefined,
) => mods.reduce((dirs, m) => swapDir(dirs, m.dir, m.name, nameOf), live);

const real = (p: string) => (existsSync(p) ? realpathSync(p) : p);

// out of the child's debug lines: each served mod the engine read from anywhere but its served dir, and each hooked mod
// with no read line yet (a hooks.json that fails, a slow start); a mod with no hooks.json has nothing to read
export function loadCheck(lines: string[], mods: ServedMod[]) {
    const elsewhere: string[] = [];
    const unseen: string[] = [];
    for (const m of mods) {
        if (!existsSync(join(m.dir, 'hooks/hooks.json'))) continue;
        const got = loadedFrom(lines, m.name);
        if (!got) unseen.push(m.name);
        else if (real(got) !== real(m.dir))
            elsewhere.push(`${m.name} loaded from ${got}, not ${m.dir}`);
    }
    return { elsewhere, unseen };
}

const rootSlot = (root: string) =>
    `root-${createHash('sha1').update(real(root)).digest('hex').slice(0, 8)}`;

// the slots a dir may be served under, in order: a mod's own, then its root's; a root has only its own
export const slotsOf = (served: { mods: ServedMod[]; root: string }) =>
    served.mods.length === 1 && served.mods[0]
        ? [served.mods[0].name, rootSlot(served.root)]
        : [rootSlot(served.root)];
