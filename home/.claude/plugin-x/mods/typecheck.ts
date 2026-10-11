// pnpm mods:typecheck — the scripts beside the mods, then every mod through tsc against the types the engine wrote
// for it, then one summary line; exit 1 when any is red. a mod whose types the engine has not written yet (a fresh
// clone) is skipped, but a run that checked no mod at all is red: a green that ran nothing proves nothing (dima's o16)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function verdict({ checked, red, skipped }: Tally) {
    const skip = skipped.length
        ? ` — no engine types yet in ${skipped.join(', ')}`
        : '';
    if (red.length)
        return {
            isRed: true,
            line: `mods:typecheck: red in ${red.join(', ')}${skip}`,
        };
    if (!checked)
        return {
            isRed: true,
            line: `mods:typecheck: red, 0 mods checked${skip}`,
        };
    return {
        isRed: false,
        line: `mods:typecheck: ${checked} mods clean${skip}`,
    };
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const tally: Tally = { checked: 0, red: [], skipped: [] };
    const scripts = spawnSync('tsc', ['-p', root], { encoding: 'utf8' });
    process.stdout.write(`${scripts.stdout}${scripts.stderr}`);
    if (scripts.status !== 0) tally.red.push('the scripts beside the mods');
    for (const mod of readdirSync(root).sort()) {
        const dir = join(root, mod);
        if (!existsSync(join(dir, '.claude-plugin'))) continue;
        if (!existsSync(join(dir, '.claude-plugin/types/tsconfig.json'))) {
            tally.skipped.push(mod);
            continue;
        }
        // the engine's tsconfig leaves out .ts import paths, which every mod writes
        const r = spawnSync(
            'tsc',
            ['-p', dir, '--noEmit', '--allowImportingTsExtensions'],
            { encoding: 'utf8' },
        );
        process.stdout.write(`${r.stdout}${r.stderr}`);
        tally.checked++;
        if (r.status !== 0) tally.red.push(mod);
    }
    const { isRed, line } = verdict(tally);
    console.log(line);
    process.exit(isRed ? 1 : 0);
}

/* Types */

type Tally = { checked: number; red: string[]; skipped: string[] };
