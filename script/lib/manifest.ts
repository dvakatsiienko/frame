/**
 * ? The symlink engine.
 * ?
 * ? The mirror rule: a path under home/ IS the path under ~. The manifest is
 * ? derived by walking the tree, never hand-maintained — add a file to home/
 * ? and it gets linked, with no list to update.
 * ?
 * ? Directory vs file granularity is derived too. A directory is linked
 * ? wholesale unless the matching path in ~ is already a real directory, which
 * ? means it holds content this repo doesn't own (~/.config, ~/.ssh, ~/.claude
 * ? and its caches) — then we descend and link the leaves instead.
 * ?
 * ? Every root is a parameter with a default, so the walk can be pointed at a
 * ? fixture in tests (and, later, at a clone living anywhere).
 */

/* Core */
import * as zx from 'zx';

export const homedir = zx.os.homedir();

// ? Found by searching upward for package.json, never by counting directory
// ? levels: a hardcoded '../..' silently points at the wrong tree the moment
// ? this file moves, and no test catches it — the suite passes a fixture root
// ? in on purpose, so it never touches the real one.
export function findRepoRoot(from: string) {
    let dir = from;

    while (!zx.fs.existsSync(`${dir}/package.json`)) {
        const parent = zx.path.dirname(dir);
        if (parent === dir) throw new Error(`No package.json above ${from}`);
        dir = parent;
    }

    return dir;
}

export const repoRoot = findRepoRoot(import.meta.dirname);
export const mirrorRoot = `${repoRoot}/home`;

// ? Stored in home/ but never linked into ~. The reason is the interesting part
// ? and there are two of them, so it is data rather than a comment above a
// ? flat list — `pnpm frame:link` prints it, and a new entry has to declare
// ? which rule it belongs to instead of joining an undifferentiated set.
export const noLinkReasons = {
    absolutePath: 'reached by absolute path, so a link would be dead weight',
    // ? Cowork refuses to trust any folder that a protected home path resolves
    // ? into, and its protected list covers the shell rc files. A real ~/.zshrc
    // ? that sources this one keeps the resolved path in ~ and leaves the repo
    // ? grantable.
    sourcedByStub:
        'sourced by a stub instead of linked, so cowork can trust the repo',
} as const;

export const noLink = new Map<string, keyof typeof noLinkReasons>([
    ['.claude/plugin-x', 'absolutePath'],
    ['.claude/mcp-x-cloud-chat', 'absolutePath'],
    ['.zshrc', 'sourcedByStub'],
    ['.zshenv', 'sourcedByStub'],
    ['.zprofile', 'sourcedByStub'],
]);

const ignoredNames = new Set(['.DS_Store']);

export type Entry = {
    kind: 'dir' | 'file';
    rel: string;
    source: string;
    target: string;
};

type WalkConfig = {
    ignored: Set<string>;
    mirror: string;
    repo: string;
    skip: Map<string, keyof typeof noLinkReasons> | Set<string>;
    target: string;
};

export async function buildManifest(
    options: Partial<WalkConfig> = {},
): Promise<Entry[]> {
    const config: WalkConfig = {
        ignored: ignoredNames,
        mirror: mirrorRoot,
        repo: repoRoot,
        skip: noLink,
        target: homedir,
        ...options,
    };

    const entries: Entry[] = [];
    await walk('', entries, config);

    // ? Group by destination directory so the report reads as one block per place.
    return entries.sort((a, b) => {
        const byDir = zx.path
            .dirname(a.rel)
            .localeCompare(zx.path.dirname(b.rel));
        return byDir !== 0 ? byDir : a.rel.localeCompare(b.rel);
    });
}

export function toTilde(path: string) {
    return path.replace(homedir, '~');
}

export async function lstatOrNull(path: string) {
    try {
        return await zx.fs.lstat(path);
    } catch {
        return null;
    }
}

// ? The blind spot the walk cannot see. Every entry above is derived FROM the
// ? mirror, so a link whose source left the repo is not in the manifest at all
// ? and reconcile never looks at it — `frame-link` reported "everything
// ? mirrored" while ~/.claude held two links to files deleted hours earlier.
// ? Finding them needs the opposite direction: read what is actually in the
// ? link directories and keep the ones pointing at a repo path that is gone.
export type Orphan = { link: string; points: string };

export async function findOrphans(
    entries: Entry[],
    options: Partial<WalkConfig> = {},
): Promise<Orphan[]> {
    const repo = options.repo ?? repoRoot;
    const expected = new Set(entries.map((entry) => entry.target));
    // ? Exactly the directories the mirror reaches into — ~ plus every dir the
    // ? walk descended into. Scanning wider would judge links this repo does
    // ? not own.
    const dirs = new Set(entries.map((entry) => zx.path.dirname(entry.target)));
    const orphans: Orphan[] = [];

    for (const dir of dirs) {
        let names: string[];
        try {
            names = await zx.fs.readdir(dir);
        } catch {
            continue;
        }

        for (const name of names) {
            const link = `${dir}/${name}`;
            if (expected.has(link)) continue;

            const stats = await lstatOrNull(link);
            if (!stats?.isSymbolicLink()) continue;

            const points = zx.path.resolve(dir, await zx.fs.readlink(link));
            if (!points.startsWith(`${repo}/`)) continue;
            if (zx.fs.existsSync(points)) continue;

            orphans.push({ link, points });
        }
    }

    return orphans.sort((a, b) => a.link.localeCompare(b.link));
}

async function walk(rel: string, out: Entry[], config: WalkConfig) {
    const dir = rel ? `${config.mirror}/${rel}` : config.mirror;

    for (const entry of await zx.fs.readdir(dir, { withFileTypes: true })) {
        if (config.ignored.has(entry.name)) continue;

        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (config.skip.has(childRel)) continue;

        const record: Entry = {
            kind: entry.isDirectory() ? 'dir' : 'file',
            rel: childRel,
            source: `${config.mirror}/${childRel}`,
            target: `${config.target}/${childRel}`,
        };

        if (entry.isDirectory()) {
            const stats = await lstatOrNull(record.target);

            // ? A real directory in ~ holds content we don't own — descend past it.
            if (stats?.isDirectory() && !stats.isSymbolicLink()) {
                await walk(childRel, out, config);
                continue;
            }
        }

        out.push(record);
    }
}
