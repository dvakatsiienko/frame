// pnpm mods:typecheck — every mod through tsc against the types the engine wrote for it, then one summary line;
// exit 1 when any mod is red. a mod whose types the engine has not written yet (a fresh clone) is skipped, never red
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = import.meta.dirname;
const red: string[] = [];
const skipped: string[] = [];
let checked = 0;
for (const mod of readdirSync(root).sort()) {
    const dir = join(root, mod);
    if (!existsSync(join(dir, '.claude-plugin'))) continue;
    if (!existsSync(join(dir, '.claude-plugin/types/tsconfig.json'))) {
        skipped.push(mod);
        continue;
    }
    // the engine's tsconfig leaves out .ts import paths, which every mod writes
    const r = spawnSync(
        'tsc',
        ['-p', dir, '--noEmit', '--allowImportingTsExtensions'],
        { encoding: 'utf8' },
    );
    process.stdout.write(`${r.stdout}${r.stderr}`);
    checked++;
    if (r.status !== 0) red.push(mod);
}
const skip = skipped.length
    ? `, no engine types yet in ${skipped.join(', ')}`
    : '';
console.log(
    `mods:typecheck: ${red.length ? `red in ${red.join(', ')}` : `${checked} mods clean`}${skip}`,
);
process.exit(red.length ? 1 : 0);
