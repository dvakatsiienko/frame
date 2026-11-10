// Lands our herdr mods from frame into herdr's mods folder as real folders: herdr reloads a real folder on save and
// never a link, so frame stays the source and one landing write reaches dima's window.
// Usage: pnpm herdr-mods:land <mod> [--dry] · pnpm herdr-mods:land --watch [mod…]
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    watch,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

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
    console.log(
        `herdr-mods:land: watching ${mods.join(', ')}, pid ${process.pid}`,
    );
    for (const mod of mods) {
        let timer: NodeJS.Timeout | undefined;
        watch(join(sourceRoot, mod), { recursive: true }, (_event, file) => {
            if (!file || !isLanded(String(file).split('/').pop() ?? '')) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                const checked = spawnSync(
                    'herdr-app',
                    ['check', join(sourceRoot, mod)],
                    { encoding: 'utf8' },
                );
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
        });
    }
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
    const changed = readdirSync(source, { withFileTypes: true })
        .filter((e) => e.isFile() && isLanded(e.name))
        .map((e) => e.name)
        .filter((name) => {
            const now = join(target, name);
            return (
                isLink ||
                !existsSync(now) ||
                !readFileSync(now).equals(readFileSync(join(source, name)))
            );
        });
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
        copyFileSync(join(source, name), temp);
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
