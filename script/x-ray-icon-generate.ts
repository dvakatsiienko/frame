// renders an emoji into an x-ray command tile — 512×512 png, clipped to the 22% round-rect
// every icon in the extension wears, transparent outside the glyph.
//   pnpm x-ray:icon-generate 📜 handoff      → import/raycast/extensions/x-ray/assets/handoff.png
//
// the pipeline was run four times by hand on 2026-09-18 and thrown away each time, so the
// icons shipped and the recipe did not. the render itself needs CoreText, which node cannot
// reach — `script/lib/x-ray-icon-generate.swift` is that half, and this half owns the arguments, the
// path, and reading the result back off disk.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [emoji, name] = process.argv.slice(2);
const repoRoot = join(import.meta.dirname, '..');
const assetDir = join(repoRoot, 'import/raycast/extensions/x-ray/assets');

if (!emoji || !name) fail('usage: pnpm x-ray:icon-generate <emoji> <name>');

// the name becomes a path, so it is a raycast command name or nothing — a stray `../` here
// would write a png anywhere in the tree the shell can reach.
if (!/^[a-z0-9-]+$/.test(name))
    fail(
        `"${name}" is not a command name — lowercase, digits and dashes only.`,
    );

const outPath = join(assetDir, `${name}.png`);
const isReplacing = existsSync(outPath);

const rendered = execFileSync(
    'swift',
    [join(repoRoot, 'script/lib/x-ray-icon-generate.swift'), emoji, outPath],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();

// swift measured the bitmap it held; this reads the file that actually landed.
if (!existsSync(outPath))
    fail(`swift reported success and wrote no ${outPath}`);

console.log(`${isReplacing ? 'replaced' : 'written'} ${outPath}`);
console.log(`${rendered} · ${(statSync(outPath).size / 1024).toFixed(0)} kB`);

/* Helpers */
function fail(message: string): never {
    console.error(message);
    process.exit(1);
}
