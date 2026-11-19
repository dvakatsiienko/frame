// Lands our herdr mods from frame into herdr's mods folder as real folders: herdr reloads a real folder on save and
// never a link, so frame stays the source and one landing write reaches dima's window.
// Usage: pnpm herdr-mods:land <mod> [--dry] · pnpm herdr-mods:land --watch [mod…]
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync,
    watch,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ownHerdrTypes } from './herdr-mods-typecheck.ts';

// both roots move for a test's fixture home; herdr itself reads HERDR_APP_HOME the same way
const sourceRoot =
    process.env.HERDR_MODS_SOURCE ??
    join(resolve(import.meta.dirname, '..'), 'home/.config/herdr-app/mods');
const targetRoot = join(
    process.env.HERDR_APP_HOME ?? join(homedir(), '.config/herdr-app'),
    'mods',
);
// a save settles this long before it lands, so an editor's burst of writes reaches his window as one
const SETTLE_MS = 400;
const SWEEP_MS = 1000;
// code two mods share lives once here; a mod lists what it takes in its mod.json `shared` (herdr/docs/adr/0002)
const SHARED = '_shared';

const args = process.argv.slice(2);
const named = args.filter((a) => !a.startsWith('--'));
if (args.includes('--help') || (!named.length && !args.includes('--watch'))) {
    console.log('usage: pnpm herdr-mods:land <mod> [--dry]');
    console.log('       pnpm herdr-mods:land --watch [mod…]');
    console.log(
        `  copies ${sourceRoot}/<mod> into ${targetRoot}/<mod>, changed files only; --watch lands each save that passes herdr-app check`,
    );
    process.exit(args.includes('--help') ? 0 : 2);
}

if (args.includes('--watch')) watchMods(named.length ? named : ourMods());
else if (!land(named[0] ?? '', args.includes('--dry'))) process.exit(1);

function ourMods() {
    return readdirSync(sourceRoot, { withFileTypes: true })
        .filter(
            (e) =>
                e.isDirectory() &&
                existsSync(join(sourceRoot, e.name, 'mod.json')),
        )
        .map((e) => e.name);
}

function watchMods(mods: string[]) {
    for (const mod of mods) {
        let timer: NodeJS.Timeout | undefined;
        let seen = newest(mod);
        const settle = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                seen = newest(mod);
                const staged = stage(mod);
                const checked =
                    typeof staged === 'string'
                        ? { status: 1, stderr: staged, stdout: '' }
                        : spawnSync('herdr-app', ['check', staged.dir], {
                              encoding: 'utf8',
                          });
                if (typeof staged !== 'string') staged.done();
                if (checked.status !== 0) {
                    const why = `${checked.stdout}${checked.stderr}`
                        .trim()
                        .split('\n')[0];
                    console.log(
                        `herdr-mods:land: ${stamp()} ${mod} held, check failed: ${why}`,
                    );
                    return;
                }
                land(mod, false);
            }, SETTLE_MS);
        };
        for (const folder of [mod, SHARED].filter((f) =>
            existsSync(join(sourceRoot, f)),
        ))
            watch(
                join(sourceRoot, folder),
                { recursive: true },
                (_event, file) => {
                    if (file && isLanded(String(file).split('/').pop() ?? ''))
                        settle();
                },
            );
        // FSEvents drops some saves (a write right after the watch starts, a rename over the file): a sweep by mtime
        // lands what the events missed
        setInterval(() => {
            if (newest(mod) > seen) settle();
        }, SWEEP_MS);
    }
    // printed once every mod's baseline is read, so a save after this line is always newer than it
    console.log(
        `herdr-mods:land: watching ${mods.join(', ')}, pid ${process.pid}`,
    );
}

function newest(mod: string) {
    const files = filesOf(mod);
    return typeof files === 'string'
        ? Date.now()
        : Math.max(0, ...[...files.values()].map((p) => statSync(p).mtimeMs));
}

/**
 * what a mod lands, by name: its own files herdr reads, then each shared file its mod.json lists; a reason string when
 * its mod.json is not valid json, a listed file is missing, or the mod keeps its own copy of one, which would drift
 */
function filesOf(mod: string): Map<string, string> | string {
    const source = join(sourceRoot, mod);
    const ownTypes = ownHerdrTypes(readdirSync(source));
    if (ownTypes.length)
        return `${ownTypes.map((name) => `${mod}/${name}`).join(', ')}: a mod keeps no copy of herdr's types, trash it`;
    const files = new Map(
        readdirSync(source, { withFileTypes: true })
            .filter((e) => e.isFile() && isLanded(e.name))
            .map((e) => [e.name, join(source, e.name)] as const),
    );
    let listed: unknown;
    try {
        listed = JSON.parse(
            readFileSync(join(source, 'mod.json'), 'utf8'),
        ).shared;
    } catch (err) {
        // a mod.json caught mid-save is a reason to hold, never a throw that ends the watcher
        return `${mod}/mod.json is not valid json: ${err instanceof Error ? err.message : err}`;
    }
    for (const name of Array.isArray(listed) ? listed.map(String) : []) {
        if (files.has(name))
            return `${mod} keeps its own ${name}, which ${SHARED}/ holds: trash the copy`;
        const path = join(sourceRoot, SHARED, name);
        if (!existsSync(path))
            return `${mod} lists ${name}, missing from ${SHARED}/`;
        files.set(name, path);
    }
    return files;
}

/** the mod as herdr would read it, its shared files beside its own, in a temp folder `herdr-app check` can read */
function stage(mod: string) {
    const files = filesOf(mod);
    if (typeof files === 'string') return files;
    const dir = join(mkdtempSync(join(tmpdir(), 'herdr-mods-land-')), mod);
    mkdirSync(dir);
    for (const [name, path] of files) copyFileSync(path, join(dir, name));
    return {
        dir,
        done: () => rmSync(join(dir, '..'), { force: true, recursive: true }),
    };
}

// what herdr reads; tests, types and editor config stay in frame
function isLanded(name: string) {
    return (
        Boolean(name) &&
        !name.startsWith('.') &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.d.ts') &&
        name !== 'jsconfig.json'
    );
}

function land(mod: string, isDry: boolean) {
    const source = join(sourceRoot, mod);
    const target = join(targetRoot, mod);
    if (!existsSync(join(source, 'mod.json'))) {
        console.error(`herdr-mods:land: no mod.json in ${source}`);
        return false;
    }
    const stat = lstatOrNull(target);
    const isLink = stat?.isSymbolicLink() ?? false;
    if (stat && !isLink && !stat.isDirectory()) {
        console.error(
            `herdr-mods:land: ${target} is neither a link nor a folder`,
        );
        return false;
    }
    const files = filesOf(mod);
    if (typeof files === 'string') {
        console.error(`herdr-mods:land: ${files}`);
        return false;
    }
    const changed = [...files.keys()]
        .filter((name) => {
            const now = join(target, name);
            return (
                isLink ||
                !existsSync(now) ||
                !readFileSync(now).equals(readFileSync(files.get(name) ?? ''))
            );
        })
        // main.js lands last: herdr reloads a mod when its main.js changes, and a main.js landed before a new file it
        // imports kept the old build on screen
        .sort((a, b) => Number(a === 'main.js') - Number(b === 'main.js'));
    const plan = [
        ...(isLink ? [`trash the link ${target}`] : []),
        ...changed.map((name) => `copy ${name}`),
    ];
    if (!plan.length) {
        console.log(
            `herdr-mods:land: ${mod} is already landed, nothing to write`,
        );
        return true;
    }
    for (const line of plan)
        console.log(`herdr-mods:land: ${isDry ? 'would ' : ''}${line}`);
    if (isDry) return true;

    if (isLink) {
        const trashed = spawnSync('trash', [target], { encoding: 'utf8' });
        if (trashed.status !== 0) {
            console.error(
                `herdr-mods:land: trash failed: ${trashed.stderr.trim()}`,
            );
            return false;
        }
    }
    mkdirSync(target, { recursive: true });
    // each file lands whole: written beside its target, then renamed over it, so herdr never reads half a file
    for (const name of changed) {
        const temp = join(target, `.${name}.landing`);
        copyFileSync(files.get(name) ?? '', temp);
        renameSync(temp, join(target, name));
    }
    console.log(
        `herdr-mods:land: ${stamp()} ${mod} landed, ${changed.length} file(s)`,
    );
    return true;
}

function stamp() {
    return new Date().toTimeString().slice(0, 8);
}

function lstatOrNull(path: string) {
    try {
        return lstatSync(path);
    } catch {
        return null;
    }
}
