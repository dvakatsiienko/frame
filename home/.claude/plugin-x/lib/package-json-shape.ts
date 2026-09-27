/**
 * ? The manifest shape contract, derived rather than listed.
 * ?
 * ? The rules are the ones in
 * ? `home/.claude/plugin-x/skills/guide-conventions/conventions/package-json.md`:
 * ? root fields most-touched first, scripts reading top to bottom as the
 * ? engineering loop, `family:name` keys, exact pins. Encoding them here means a
 * ? randomly printed manifest fails a check instead of waiting to be re-sorted by
 * ? hand.
 * ?
 * ? Every rule is a pure function over a parsed manifest, so the test feeds it
 * ? fixtures as easily as the real files, and `plugin-x/bin/package-json-shape`
 * ? is a thin CLI over this — one implementation, any repo.
 */

/* Core */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ? One flat order rather than named sections with an order of their own: the
// ? section boundaries stay visible as the blank-line groups below, and a single
// ? list makes the failure message a plain "here is the order we expected".
export const rootKeyOrder = [
    'name',
    'version',
    'description',
    'keywords',
    'homepage',
    'bugs',
    'repository',
    'license',
    'author',
    'private',
    'type',
    'main',
    'types',
    'bin',
    'exports',
    'files',

    'scripts',

    'dependencies',
    'devDependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'optionalDependencies',

    'engines',
    'devEngines',
    'packageManager',
    'pnpm',
    'browserslist',
    'publishConfig',
] as const;

export const scriptSectionList = [
    'dev',
    'build',
    'domain',
    'lifecycle',
    'service',
] as const;

// ? Families, not names: `dev:convex` and `build:api` classify off the part
// ? before the colon, so a new variant never needs an entry here.
const devFamilySet = new Set(['dev']);
const buildFamilySet = new Set(['build', 'preview', 'serve', 'start']);
const serviceFamilySet = new Set([
    'check',
    'format',
    'lint',
    'test',
    'typecheck',
]);
const lifecycleNameSet = new Set([
    'postinstall',
    'preinstall',
    'prepare',
    'prepublishOnly',
    'postpublish',
]);

// ? Anything unclassifiable lands in `domain` — the zone the convention calls
// ? "prod infra + helpers". That default is deliberate: an unknown script sits in
// ? the middle, never silently at either end of the block.
export const scriptSection = (name: string): ScriptSection => {
    if (lifecycleNameSet.has(name)) return 'lifecycle';

    const family = familyOf(name);
    if (devFamilySet.has(family)) return 'dev';
    if (buildFamilySet.has(family)) return 'build';
    if (serviceFamilySet.has(family)) return 'service';

    return 'domain';
};

// ? Section, then family alphabetically, then the bare name ahead of its own
// ? variants, then the variants alphabetically. `build` before `build:api` before
// ? `preview`, with no per-repo list to maintain. The space separator is safe
// ? because scriptNamePattern forbids one inside a name, and it sorts below every
// ? character a name may contain.
// ? The service tail is the one section with a fixed order, the convention's
// ? `lint, typecheck, test, check, format` — the loop's own sequence, not the
// ? alphabet (the hook once rejected a manifest sorted by the convention).
const serviceOrder = ['lint', 'typecheck', 'test', 'check', 'format'] as const;

export const scriptSortKey = (name: string) => {
    const sectionName = scriptSection(name);
    const section = scriptSectionList.indexOf(sectionName);
    const isVariant = name.includes(':') ? '1' : '0';
    const family =
        sectionName === 'service'
            ? String(
                  serviceOrder.indexOf(
                      familyOf(name) as (typeof serviceOrder)[number],
                  ),
              )
            : familyOf(name);

    return `${section} ${family} ${isVariant} ${name}`;
};

export const sortScriptNames = (names: readonly string[]) => {
    return [...names].sort((left, right) =>
        scriptSortKey(left) < scriptSortKey(right) ? -1 : 1,
    );
};

export const sortRootKeys = (keys: readonly string[]) => {
    return [...keys].sort(
        (left, right) => rootKeyRank(left) - rootKeyRank(right),
    );
};

// ? An unrecognised key is not an error — it goes last, in the tech zone, and
// ? keeps its relative order among the other unknowns (Array#sort is stable).
export const rootKeyRank = (key: string) => {
    const index = rootKeyOrder.indexOf(key as RootKey);
    return index === -1 ? rootKeyOrder.length : index;
};

// ? `workspace:*`, `catalog:` and friends are pnpm protocols, not versions.
const protocolPattern = /^(workspace|catalog|link|file|npm|jsr|git|github):/;
const exactVersionPattern =
    /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export const isExactVersion = (spec: string) => {
    return protocolPattern.test(spec) || exactVersionPattern.test(spec);
};

// ? The character set `family:name` implies: lowercase, `:` between families, and
// ? the scope characters a workspace name needs (`dev:@space-explorer/ui`).
const scriptNamePattern = /^[a-z0-9@][a-z0-9@/.-]*(:[a-z0-9@][a-z0-9@/.-]*)*$/;

export const checkManifest = (manifest: Manifest) => {
    const problems: string[] = [];

    const keys = Object.keys(manifest);
    const sortedKeys = sortRootKeys(keys);
    if (keys.join() !== sortedKeys.join()) {
        problems.push(
            `root keys out of order — expected ${sortedKeys.join(', ')}`,
        );
    }

    const scriptNames = Object.keys(manifest.scripts ?? {});
    const sortedScriptNames = sortScriptNames(scriptNames);
    if (scriptNames.join() !== sortedScriptNames.join()) {
        problems.push(
            `scripts out of order — expected ${sortedScriptNames.join(', ')}`,
        );
    }

    for (const name of scriptNames) {
        if (!scriptNamePattern.test(name)) {
            problems.push(
                `script "${name}" is not a lowercase family:name key`,
            );
        }
    }

    // ? peerDependencies are exempt on purpose: a published config package
    // ? declaring an exact peer would break every consumer that pins its own.
    for (const field of ['dependencies', 'devDependencies'] as const) {
        for (const [pkg, spec] of Object.entries(manifest[field] ?? {})) {
            if (!isExactVersion(spec)) {
                problems.push(`${field}.${pkg} is "${spec}" — pins are exact`);
            }
        }
    }

    return problems;
};

/**
 * ? One version per name, across the whole workspace.
 * ?
 * ? The only rule here that a single manifest cannot answer: a disagreement
 * ? exists between files, so the check takes the whole set. It is what holds the
 * ? placement rule together — a tool a subset of apps uses stays in those apps,
 * ? and the thing that used to make that dangerous was the versions drifting
 * ? apart one renovate PR at a time. Hoisting to the root bought agreement by
 * ? making there be one declaration; this buys it without moving anything.
 * ?
 * ? `touching` narrows the REPORT, never the comparison. A pre-commit hook
 * ? passes its staged manifests, and a name is worth reporting only if one of
 * ? them takes part in it — otherwise an old drift elsewhere blocks a commit
 * ? that had nothing to do with it. The comparison stays repo-wide either way,
 * ? because half the set cannot show a disagreement.
 */
export const checkVersionAgreement = (
    entries: readonly ManifestEntry[],
    touching?: readonly string[],
) => {
    const pins = new Map<string, Map<string, string[]>>();

    for (const { path, manifest } of entries) {
        for (const field of ['dependencies', 'devDependencies'] as const) {
            for (const [pkg, spec] of Object.entries(manifest[field] ?? {})) {
                // ? A protocol is not a version: `workspace:*` beside a pin is
                // ? the normal shape for a package consumed both ways.
                if (protocolPattern.test(spec)) continue;

                const versions = pins.get(pkg) ?? new Map<string, string[]>();
                versions.set(spec, [...(versions.get(spec) ?? []), path]);
                pins.set(pkg, versions);
            }
        }
    }

    const problems: string[] = [];

    for (const [pkg, versions] of [...pins].sort(([left], [right]) =>
        left < right ? -1 : 1,
    )) {
        if (versions.size < 2) continue;

        const paths = [...versions.values()].flat();
        if (touching && !paths.some((path) => touching.includes(path)))
            continue;

        const detail = [...versions]
            .sort(([left], [right]) => (left < right ? -1 : 1))
            .map(([spec, where]) => `      ${spec} in ${where.join(', ')}`)
            .join('\n');

        problems.push(
            `${pkg} is pinned to ${versions.size} versions — one version per name\n${detail}`,
        );
    }

    return problems;
};

/**
 * ? The `packages:` entries of a pnpm workspace, and only those.
 * ?
 * ? Reading every `- ` line is the obvious shortcut and it is wrong: frame's
 * ? own workspace also lists `minimumReleaseAgeExclude`, whose items are package
 * ? NAMES rather than paths. So the block is bounded by indentation — items
 * ? belong to `packages:` until a line returns to column zero.
 */
export const readWorkspaceGlobs = (repoRoot: string) => {
    const path = join(repoRoot, 'pnpm-workspace.yaml');
    if (!existsSync(path)) return [];

    const globs: string[] = [];
    let inPackages = false;

    for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (/^\S/.test(line)) {
            inPackages = /^packages:/.test(line);
            continue;
        }
        if (!inPackages) continue;

        const item = /^\s+-\s*['"]?([^'"#]+?)['"]?\s*$/.exec(line);
        // ? A negation excludes; it never adds a manifest to check.
        if (item?.[1] && !item[1].startsWith('!')) globs.push(item[1]);
    }

    return globs;
};

/**
 * ? Every manifest the workspace covers, repo-relative and sorted.
 * ?
 * ? Derived, never hand-kept, so adding an app is covered without touching this.
 * ? A repo with no `pnpm-workspace.yaml` is not an error — it is a plain package,
 * ? and its root manifest is the whole list.
 */
export const findManifestPaths = (repoRoot: string) => {
    const paths = new Set<string>();
    if (existsSync(join(repoRoot, 'package.json'))) paths.add('package.json');

    for (const glob of readWorkspaceGlobs(repoRoot)) {
        // ? Two shapes carry every workspace we have: `dir/*` fans out one level,
        // ? anything else names a package directly (frame uses the second).
        const dirs = glob.endsWith('/*')
            ? childDirs(repoRoot, glob.slice(0, -2))
            : [glob];

        for (const dir of dirs) {
            const rel = `${dir}/package.json`;
            if (existsSync(join(repoRoot, rel))) paths.add(rel);
        }
    }

    return [...paths].sort();
};

export const readManifest = (repoRoot: string, rel: string): Manifest => {
    return JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));
};

/* Helpers */
const familyOf = (name: string) => name.split(':')[0] ?? name;

const childDirs = (repoRoot: string, dir: string) => {
    const absolute = join(repoRoot, dir);
    if (!existsSync(absolute)) return [];

    return readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${dir}/${entry.name}`);
};

/* Types */
export type RootKey = (typeof rootKeyOrder)[number];
export type ScriptSection = (typeof scriptSectionList)[number];
export interface Manifest {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}
export interface ManifestEntry {
    manifest: Manifest;
    path: string;
}
