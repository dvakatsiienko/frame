// the repo's settings a mods:live child can write: it runs in the caller's tree and reads project and local settings, so a
// plugin toggle at either scope lands in that tree's `.claude/`, past the sandbox HOME (FRM-649). a file is copied at
// start and put back at stop only when the child's own debug log names its write; any other change stays, both named
import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const NAMES = ['.claude/settings.json', '.claude/settings.local.json'];

// the cwd's and its git root's, as cc reads project settings from either
export function repoSettingsPaths(cwd: string) {
    const top = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
    }).stdout?.trim();
    const roots = [...new Set([resolve(cwd), ...(top ? [top] : [])])];
    return roots.flatMap((root) => NAMES.map((name) => join(root, name)));
}

export function snapshotRepoSettings(paths: string[]): SettingsStart[] {
    return paths.map((path) => ({
        path,
        text: existsSync(path) ? readFileSync(path, 'utf8') : undefined,
    }));
}

// cc writes a settings file through `<path>.tmp.<pid>.<hex>` and logs the temp path
export const childWrote = (debugText: string, path: string) =>
    debugText.includes(`Writing to temp file: ${path}.tmp.`);

// one line per file that changed during the run; `keepDir` takes every copy, so nothing of his is lost
export function putBackRepoSettings(
    starts: SettingsStart[],
    debugText: string,
    keepDir: string,
) {
    const lines: string[] = [];
    for (const start of starts) {
        const now = existsSync(start.path)
            ? readFileSync(start.path, 'utf8')
            : undefined;
        if (now === start.text) continue;
        mkdirSync(keepDir, { recursive: true });
        const keep = join(keepDir, start.path.replaceAll('/', '_'));
        if (childWrote(debugText, start.path)) {
            if (now !== undefined) copyFileSync(start.path, `${keep}.child`);
            if (start.text === undefined) rmSync(start.path, { force: true });
            else writeFileSync(start.path, start.text);
            lines.push(
                `mods:live: the child wrote ${start.path}; put back as it was at start${now === undefined ? '' : `, its version kept at ${keep}.child`}`,
            );
            continue;
        }
        if (start.text !== undefined)
            writeFileSync(`${keep}.start`, start.text);
        lines.push(
            `mods:live: ${start.path} changed during the run, not by the child's write; left as it is, ${start.text === undefined ? 'it did not exist at start' : `the start copy at ${keep}.start`}`,
        );
    }
    return lines;
}

/* Types */
export interface SettingsStart {
    path: string;
    text?: string;
}
