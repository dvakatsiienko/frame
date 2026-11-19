// pnpm herdr-mods:typecheck — type-checks every herdr mod of ours whose jsconfig.json turns `strictNullChecks` on, then
// prints one summary line; exit 1 when any is red or nothing was checked. herdr's own type files live only where herdr
// is installed (~/.config/herdr-app), never in git: with them, every file of a mod is checked; without them (ci), each
// file that imports herdr, or imports such a file, is left out, and the line names each one.
// Usage: pnpm herdr-mods:typecheck [mods root]
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const IMPORT_FROM = /(?:\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"]+)\1/g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

/** A file that imports anything but its own siblings needs the types herdr writes. */
export function needsHerdrTypes(source: string) {
    const code = source.replace(LINE_COMMENT, '');
    return [...code.matchAll(IMPORT_FROM)].some(
        ([, , specifier]) => !specifier?.startsWith('.'),
    );
}

/**
 * the files that need herdr's types: each that imports herdr, then each that imports one of those by a relative path,
 * through any depth (tsc pulls an imported file back in whatever the files list says). `rootDirs` resolve a relative
 * import the way the check's config does, `./keypress.js` from a mod into `_shared/`
 */
export function needingHerdr(
    sources: Record<string, string>,
    rootDirs: string[],
) {
    const skipped = new Set(
        Object.keys(sources).filter((path) =>
            needsHerdrTypes(sources[path] ?? ''),
        ),
    );
    const importsOf = (path: string) =>
        [
            ...(sources[path] ?? '')
                .replace(LINE_COMMENT, '')
                .matchAll(IMPORT_FROM),
        ]
            .map(([, , specifier]) => specifier ?? '')
            .filter((specifier) => specifier.startsWith('.'))
            .flatMap((specifier) =>
                [dirname(path), ...rootDirs].map((root) =>
                    resolve(root, specifier),
                ),
            );
    for (let grew = true; grew; ) {
        grew = false;
        for (const path of Object.keys(sources))
            if (
                !skipped.has(path) &&
                importsOf(path).some((to) => skipped.has(to))
            ) {
                skipped.add(path);
                grew = true;
            }
    }
    return [...skipped].sort();
}

// herdr writes these two into a mod's folder; the gate passes herdr's own copies once, beside the files
const HERDR_TYPE_FILES = new Set(['gpui-kit.d.ts', 'herdr.d.ts']);

/** the files of a mod the gate checks: its js, and its own declarations of a runtime global ES2022 leaves out */
export function checkedNames(names: string[]) {
    return names.filter(
        (name) =>
            name.endsWith('.js') ||
            (name.endsWith('.d.ts') && !HERDR_TYPE_FILES.has(name)),
    );
}

export function verdict({ checked, mods, red, skipped }: Tally) {
    if (red.length)
        return {
            isRed: true,
            line: `herdr-mods:typecheck: red in ${red.join(', ')}`,
        };
    if (!checked)
        return {
            isRed: true,
            line: 'herdr-mods:typecheck: red, 0 files checked',
        };
    const skip = skipped.length
        ? ` — ${skipped.length} ${skipped.length === 1 ? 'file needs' : 'files need'} herdr's types, not on this machine: ${skipped.join(', ')}`
        : '';
    return {
        isRed: false,
        line: `herdr-mods:typecheck: ${mods} ${mods === 1 ? 'mod' : 'mods'} clean, ${checked} ${checked === 1 ? 'file' : 'files'}${skip}`,
    };
}

if (import.meta.main) {
    const root = resolve(
        process.argv[2] ??
            join(import.meta.dirname, '..', 'home/.config/herdr-app/mods'),
    );
    const herdrHome =
        process.env.HERDR_APP_HOME ?? join(homedir(), '.config/herdr-app');
    const herdrTypes = [
        join(herdrHome, 'gpui-kit.d.ts'),
        join(herdrHome, 'herdr.d.ts'),
    ];
    const hasHerdrTypes = herdrTypes.every((path) => existsSync(path));
    const tally: Tally = { checked: 0, mods: 0, red: [], skipped: [] };
    const scratch = mkdtempSync(join(tmpdir(), 'herdr-mods-typecheck-'));
    try {
        for (const mod of strictMods(root)) {
            const dir = join(root, mod);
            // a shared file lands beside the mod's own (herdr-mods:land), so it is checked as the mod's, and `rootDirs`
            // resolves `./keypress.js` from the mod to `_shared/`
            const shared = sharedOf(root, mod);
            const sources = [
                ...checkedNames(readdirSync(dir)).map((name) =>
                    join(dir, name),
                ),
                ...shared,
            ];
            const rootDirs = [dir, join(root, '_shared')];
            const skipped = hasHerdrTypes
                ? []
                : needingHerdr(
                      Object.fromEntries(
                          sources.map((path) => [
                              path,
                              readFileSync(path, 'utf8'),
                          ]),
                      ),
                      rootDirs,
                  );
            const files = sources.filter((path) => !skipped.includes(path));
            tally.skipped.push(...skipped.map((path) => relative(root, path)));
            if (!files.length) continue;
            const config = join(scratch, `${mod}.json`);
            writeFileSync(
                config,
                JSON.stringify({
                    compilerOptions: {
                        allowJs: true,
                        checkJs: true,
                        lib: ['ES2022'],
                        module: 'ES2022',
                        moduleResolution: 'bundler',
                        noEmit: true,
                        noUncheckedIndexedAccess: true,
                        paths: { herdr: [herdrTypes[1]] },
                        rootDirs,
                        skipLibCheck: true,
                        strict: true,
                        target: 'ES2022',
                        types: [],
                    },
                    files: hasHerdrTypes ? [...files, herdrTypes[0]] : files,
                }),
            );
            const run = spawnSync('tsc', ['-p', config], { encoding: 'utf8' });
            process.stdout.write(`${run.stdout}${run.stderr}`);
            tally.checked += files.length;
            tally.mods++;
            if (run.status !== 0) tally.red.push(mod);
        }
    } finally {
        rmSync(scratch, { force: true, recursive: true });
    }
    const { isRed, line } = verdict(tally);
    console.log(line);
    process.exit(isRed ? 1 : 0);
}

/** the `_shared/` files a mod's mod.json lists */
function sharedOf(root: string, mod: string) {
    const listed: unknown = JSON.parse(
        readFileSync(join(root, mod, 'mod.json'), 'utf8'),
    ).shared;
    return (Array.isArray(listed) ? listed.map(String) : []).map((name) =>
        join(root, '_shared', name),
    );
}

function strictMods(root: string) {
    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((mod) => {
            const config = join(root, mod, 'jsconfig.json');
            if (!existsSync(config)) return false;
            const { compilerOptions } = JSON.parse(
                readFileSync(config, 'utf8'),
            ) as { compilerOptions?: { strictNullChecks?: boolean } };
            return compilerOptions?.strictNullChecks === true;
        })
        .sort();
}

/* Types */

type Tally = {
    checked: number;
    mods: number;
    red: string[];
    skipped: string[];
};
