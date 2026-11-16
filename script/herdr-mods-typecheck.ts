// pnpm herdr-mods:typecheck — type-checks every herdr mod of ours whose jsconfig.json turns `strictNullChecks` on, then
// prints one summary line; exit 1 when any is red or nothing was checked. herdr's own type files live only where herdr
// is installed (~/.config/herdr-app), never in git: with them, every file of a mod is checked; without them (ci), only
// the files that import nothing but their own siblings, and the line says how many were left out.
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
import { join, resolve } from 'node:path';

const IMPORT_FROM = /(?:\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"]+)\1/g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

/** A file that imports anything but its own siblings needs the types herdr writes. */
export function needsHerdrTypes(source: string) {
    const code = source.replace(LINE_COMMENT, '');
    return [...code.matchAll(IMPORT_FROM)].some(
        ([, , specifier]) => !specifier?.startsWith('.'),
    );
}

export function verdict({ checked, mods, red, skippedFiles }: Tally) {
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
    const skip = skippedFiles
        ? ` — ${skippedFiles} ${skippedFiles === 1 ? 'file that imports' : 'files that import'} herdr not checked: herdr's types are not on this machine`
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
    const tally: Tally = { checked: 0, mods: 0, red: [], skippedFiles: 0 };
    const scratch = mkdtempSync(join(tmpdir(), 'herdr-mods-typecheck-'));
    try {
        for (const mod of strictMods(root)) {
            const dir = join(root, mod);
            const sources = readdirSync(dir)
                .filter((name) => name.endsWith('.js'))
                .map((name) => join(dir, name));
            const files = hasHerdrTypes
                ? sources
                : sources.filter(
                      (path) => !needsHerdrTypes(readFileSync(path, 'utf8')),
                  );
            tally.skippedFiles += sources.length - files.length;
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
    skippedFiles: number;
};
