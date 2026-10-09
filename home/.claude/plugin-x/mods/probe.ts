// pnpm mods:probe <mod dir> "<prompt>" — one headless cc session with the dev copy of a mod (a worktree's, a scratch
// copy) loaded in place of the live one, then its reply and every debug line naming the mod. the swap rides the child's
// CLAUDE_CODE_PLUGIN_DIRS: a child inherits this session's, and the engine reads the plugin dirs from the process env
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// the live dirs with the one carrying `name` swapped for `dev`; a mod not live yet is added last
export function swapDir(
    dirs: string[],
    dev: string,
    name: string,
    nameOf: (dir: string) => string | undefined,
) {
    const at = dirs.findIndex((d) => nameOf(d) === name);
    return at === -1 ? [...dirs, dev] : dirs.with(at, dev);
}

if (import.meta.main) {
    const [modArg, prompt, ...rest] = process.argv.slice(2);
    const fail = (line: string): never => {
        console.error(`mods:probe: ${line}`);
        process.exit(2);
    };
    if (!modArg || !prompt)
        fail('usage: pnpm mods:probe <mod dir> "<prompt>" [-- <claude args…>]');
    const dev = realpathSync(resolve(modArg as string));
    const home = homedir();
    const nameOf = (dir: string) => {
        const manifest = join(
            dir.replace(/^~(?=\/|$)/, home),
            '.claude-plugin/plugin.json',
        );
        if (!existsSync(manifest)) return undefined;
        const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as {
            name?: unknown;
        };
        return typeof name === 'string' ? name : undefined;
    };
    const name =
        nameOf(dev) ??
        fail(`${dev} holds no .claude-plugin/plugin.json with a name`);
    const settings = JSON.parse(
        readFileSync(join(home, '.claude/settings.json'), 'utf8'),
    ) as { env?: Record<string, string> };
    const live = (settings.env?.CLAUDE_CODE_PLUGIN_DIRS ?? '')
        .split(':')
        .filter(Boolean);
    const dirs = swapDir(live, dev, name, nameOf);
    const tmp = realpathSync(
        mkdtempSync(join(tmpdir(), `mods-probe-${name}-`)),
    );
    const debugFile = join(tmp, 'debug.log');
    const extra = rest[0] === '--' ? rest.slice(1) : rest;
    const run = spawnSync(
        'claude',
        ['-p', prompt as string, '--debug-file', debugFile, ...extra],
        {
            cwd: tmp,
            encoding: 'utf8',
            env: { ...process.env, CLAUDE_CODE_PLUGIN_DIRS: dirs.join(':') },
            timeout: 240_000,
        },
    );
    if (run.error || run.status === null)
        fail(
            `claude did not run — ${run.error?.message ?? 'timed out after 4 min'}`,
        );
    process.stdout.write(`${run.stdout}${run.stderr}`);
    const lines = existsSync(debugFile)
        ? readFileSync(debugFile, 'utf8')
              .split('\n')
              .filter((l) => l.includes(name))
        : [];
    console.log(`\n-- debug lines naming ${name} (${debugFile}) --`);
    for (const l of lines) console.log(l);
    const loaded = lines.some((l) => /hooks module .*loaded/.test(l));
    console.log(
        loaded
            ? `mods:probe: ${name} loaded from ${dev}`
            : `mods:probe: no load line for ${name} — the dev copy did not load`,
    );
    process.exit(loaded ? (run.status ?? 1) : 1);
}
