// Lands one of our herdr mods from frame into herdr's mods folder as a real folder: herdr reloads a real folder on
// save and never a link, so frame stays the source and this copy is the one write that reaches dima's window.
// Usage: pnpm herdr-mods:land <mod> [--dry]
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const sourceRoot = join(repo, 'home/.config/herdr-app/mods');
const targetRoot = join(homedir(), '.config/herdr-app/mods');
// what herdr reads; tests, types and editor config stay in frame
const isLanded = (name: string) =>
    !name.startsWith('.') &&
    !name.endsWith('.test.ts') &&
    !name.endsWith('.d.ts') &&
    name !== 'jsconfig.json';

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const mod = args.find((a) => !a.startsWith('--'));
if (!mod || args.includes('--help')) {
    console.log('usage: pnpm herdr-mods:land <mod> [--dry]');
    console.log(
        `  copies ${sourceRoot}/<mod> into ${targetRoot}/<mod>, changed files only`,
    );
    process.exit(mod ? 0 : 2);
}

const source = join(sourceRoot, mod);
const target = join(targetRoot, mod);
if (!existsSync(join(source, 'mod.json'))) {
    console.error(`herdr-mods:land: no mod.json in ${source}`);
    process.exit(1);
}

const plan: string[] = [];
const stat = lstatOrNull(target);
const isLink = stat?.isSymbolicLink() ?? false;
if (stat && !isLink && !stat.isDirectory()) {
    console.error(`herdr-mods:land: ${target} is neither a link nor a folder`);
    process.exit(1);
}
if (isLink) plan.push(`trash the link ${target}`);
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
plan.push(...changed.map((name) => `copy ${name}`));

if (!plan.length) {
    console.log(`herdr-mods:land: ${mod} is already landed, nothing to write`);
    process.exit(0);
}
for (const line of plan)
    console.log(`herdr-mods:land: ${isDry ? 'would ' : ''}${line}`);
if (isDry) process.exit(0);

if (isLink) {
    const trashed = spawnSync('trash', [target], { encoding: 'utf8' });
    if (trashed.status !== 0) {
        console.error(
            `herdr-mods:land: trash failed: ${trashed.stderr.trim()}`,
        );
        process.exit(1);
    }
}
mkdirSync(target, { recursive: true });
// each file lands whole: written beside its target, then renamed over it, so herdr never reads half a file
for (const name of changed) {
    const temp = join(target, `.${name}.landing`);
    copyFileSync(join(source, name), temp);
    renameSync(temp, join(target, name));
}
console.log(`herdr-mods:land: ${mod} landed, ${changed.length} file(s)`);

function lstatOrNull(path: string) {
    try {
        return lstatSync(path);
    } catch {
        return null;
    }
}
