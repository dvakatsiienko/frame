// pnpm mods:probe <mod> <"prompt" | --bash '<line>' | --rows <tsv>> — one headless cc session with the dev copy of a mod (a
// worktree's, a scratch copy) loaded in place of the live one. a prompt prints the reply and every debug line naming the mod;
// a bash line or rows run through the real hooks behind a `false &&` and print each verdict. the swap rides the child's
// CLAUDE_CODE_PLUGIN_DIRS: a child inherits this session's, and the engine reads the plugin dirs from the process env
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
} from 'node:fs';
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

// a mod dir's plugin name from its manifest; undefined when it holds none
export function manifestName(dir: string, home: string) {
    const manifest = join(
        dir.replace(/^~(?=\/|$)/, home),
        '.claude-plugin/plugin.json',
    );
    if (!existsSync(manifest)) return undefined;
    const { name } = JSON.parse(readFileSync(manifest, 'utf8')) as {
        name?: unknown;
    };
    return typeof name === 'string' ? name : undefined;
}

// the user's live mod dirs, from settings.json's env
export function liveDirs(home: string) {
    const settings = JSON.parse(
        readFileSync(join(home, '.claude/settings.json'), 'utf8'),
    ) as { env?: Record<string, string> };
    return (settings.env?.CLAUDE_CODE_PLUGIN_DIRS ?? '')
        .split(':')
        .filter(Boolean);
}

// the folder the engine read the mod's hooks from, out of the child's debug lines; undefined when it never loaded
// a cli-entrypoint cc (a --bg session's) lets settings.json's env beat the swapped plugin dirs, so a child that reads the
// user settings loads the live mod; without them the swap alone names the dirs. mods:live and mods:probe both spawn with it
export const SWAP_SOURCES = ['--setting-sources', 'project,local'];
export function probeArgv(prompt: string, debugFile: string, extra: string[]) {
    return ['-p', prompt, '--debug-file', debugFile, ...SWAP_SOURCES, ...extra];
}

// the child's env: the swapped dirs, and the plugin cache, which holds $.store, moved under the run's dir, so a load-time
// write or a 🎛️ press never reaches the fleet's store (a live proof flipped it, 2026-11-05). CLAUDE_CONFIG_DIR would move the login too
export function childEnv(
    env: NodeJS.ProcessEnv,
    dirs: string[],
    scratch: string,
) {
    return {
        ...env,
        CLAUDE_CODE_PLUGIN_CACHE_DIR: join(scratch, 'plugin-cache'),
        CLAUDE_CODE_PLUGIN_DIRS: dirs.join(':'),
    };
}

// one `name<TAB>bash line` per line; `#` and blank lines skipped, a literal \n in the line is a newline
export function parseRows(tsv: string) {
    const rows: Row[] = [];
    for (const raw of tsv.split('\n')) {
        if (!raw.trim() || raw.startsWith('#')) continue;
        const tab = raw.indexOf('\t');
        if (tab < 1) throw new Error(`no tab between name and line: ${raw}`);
        rows.push({
            line: raw.slice(tab + 1).replaceAll('\\n', '\n'),
            name: raw.slice(0, tab),
        });
    }
    return rows;
}

// `false && <line>` alone runs a compound line's tail, so the line sits in a group the short circuit skips whole
export function behindFalse(line: string) {
    return `false && {\n${line}\n}`;
}

// a line that parses alone cannot close the group early: `true; }; touch x; {` is refused here, never run
export function holdsInGroup(line: string) {
    return (
        spawnSync('bash', ['-n', '-c', line], { stdio: 'ignore' }).status === 0
    );
}

export function rowPrompt(rows: Row[]) {
    const blocks = rows.map(
        ({ line }, i) => `${i + 1}.\n\`\`\`\n${behindFalse(line)}\n\`\`\``,
    );
    return `run each command below with the Bash tool, byte for byte, one call per command, in order, whatever each one answers. no other tool, no comment.\n\n${blocks.join('\n\n')}`;
}

// each row's verdict out of the session's transcript: the short circuit's own exit 1 reads «ran», any other error is the
// hook's refusal, and a hint or a warn-only «would refuse» lands only there, as an attachment on the call
export function rowVerdicts(transcript: string, rows: Row[]) {
    const callOf = new Map<string, string>();
    const resultOf = new Map<string, { isError: boolean; text: string }>();
    const contextOf = new Map<string, string[]>();
    for (const raw of transcript.split('\n')) {
        if (!raw.startsWith('{')) continue;
        const { attachment, message } = JSON.parse(raw) as {
            attachment?: {
                content?: string[];
                toolUseID?: string;
                type?: string;
            };
            message?: { content?: string | Block[] };
        };
        if (attachment?.type === 'hook_additional_context')
            contextOf.set(
                attachment.toolUseID?.replace(/-context$/, '') ?? '',
                attachment.content ?? [],
            );
        if (!Array.isArray(message?.content)) continue;
        for (const block of message.content) {
            if (block.type === 'tool_use' && block.name === 'Bash')
                callOf.set(block.input?.command ?? '', block.id ?? '');
            if (block.type === 'tool_result')
                resultOf.set(block.tool_use_id ?? '', {
                    isError: block.is_error === true,
                    text:
                        typeof block.content === 'string'
                            ? block.content
                            : (block.content ?? [])
                                  .map((c) => c.text ?? '')
                                  .join('\n'),
                });
        }
    }
    return rows.map(({ line, name }) => {
        const id = callOf.get(behindFalse(line)) ?? '';
        const result = resultOf.get(id);
        const context = contextOf.get(id) ?? [];
        if (!result)
            return { context, hasRun: false, name, verdict: 'never called' };
        const first = result.text.split('\n')[0]?.trim() ?? '';
        return result.isError && !/^Exit code \d+$/.test(first)
            ? { context, hasRun: true, name, verdict: `refused: ${first}` }
            : { context, hasRun: true, name, verdict: 'ran, no refusal' };
    });
}

export function loadedFrom(lines: string[], name: string) {
    const read = new RegExp(
        `Read hooks\\.json for plugin ${name} \\([^)]*\\): (.+)/hooks/hooks\\.json$`,
    );
    for (const l of lines) {
        const dir = l.match(read)?.[1];
        if (dir) return dir;
    }
    return undefined;
}

if (import.meta.main) {
    const [modArg, ...rest] = process.argv.slice(2);
    const fail = (line: string): never => {
        console.error(`mods:probe: ${line}`);
        process.exit(2);
    };
    const [mode, value] = rest;
    const hasRows = mode === '--bash' || mode === '--rows';
    if (
        !modArg ||
        !mode ||
        (hasRows && !value) ||
        (!hasRows && mode.startsWith('--'))
    )
        fail(
            `usage: pnpm mods:probe <mod> <"<prompt>" | --bash '<line>' | --rows <tsv>> [<claude args…>]`,
        );
    const extra = rest
        .slice(hasRows ? 2 : 1)
        .filter((w, i) => i > 0 || w !== '--');
    const dev = realpathSync(
        existsSync(modArg as string)
            ? resolve(modArg as string)
            : join(import.meta.dirname, modArg as string),
    );
    const home = homedir();
    const nameOf = (dir: string) => manifestName(dir, home);
    const name =
        nameOf(dev) ??
        fail(`${dev} holds no .claude-plugin/plugin.json with a name`);
    const dirs = swapDir(liveDirs(home), dev, name, nameOf);
    const tmp = realpathSync(
        mkdtempSync(join(tmpdir(), `mods-probe-${name}-`)),
    );
    const scratch = join(tmp, 'scratch');
    mkdirSync(scratch);
    const rows: Row[] | undefined =
        mode === '--bash'
            ? [{ line: value as string, name: 'bash' }]
            : mode === '--rows'
              ? parseRows(readFileSync(value as string, 'utf8'))
              : undefined;
    for (const row of rows ?? []) {
        row.line = row.line.replaceAll('<scratch>', scratch);
        if (!holdsInGroup(row.line))
            fail(
                `row «${row.name}» does not parse alone, so it could leave the false && group: ${row.line}`,
            );
    }
    const debugFile = join(tmp, 'debug.log');
    const sessionId = randomUUID();
    const run = spawnSync(
        'claude',
        probeArgv(
            rows ? rowPrompt(rows) : (mode as string),
            debugFile,
            rows
                ? [
                      '--session-id',
                      sessionId,
                      '--model',
                      'haiku',
                      '--allowedTools=Bash',
                      ...extra,
                  ]
                : extra,
        ),
        {
            cwd: tmp,
            encoding: 'utf8',
            env: childEnv(process.env, dirs, tmp),
            timeout: 240_000,
        },
    );
    if (run.error || run.status === null)
        fail(
            `claude did not run — ${run.error?.message ?? 'timed out after 4 min'}`,
        );
    const transcript = join(
        home,
        '.claude/projects',
        tmp.replaceAll(/[^A-Za-z0-9-]/g, '-'),
        `${sessionId}.jsonl`,
    );
    const verdicts =
        rows && existsSync(transcript)
            ? rowVerdicts(readFileSync(transcript, 'utf8'), rows)
            : (rows ?? []).map(({ name }) => ({
                  context: [],
                  hasRun: false,
                  name,
                  verdict: `no transcript at ${transcript}`,
              }));
    for (const v of verdicts) {
        console.log(`${v.name}: ${v.verdict}`);
        for (const c of v.context) console.log(`  ${c}`);
    }
    if (!rows) process.stdout.write(`${run.stdout}${run.stderr}`);
    const lines = existsSync(debugFile)
        ? readFileSync(debugFile, 'utf8')
              .split('\n')
              .filter((l) => l.includes(name))
        : [];
    if (!rows) {
        console.log(`\n-- debug lines naming ${name} (${debugFile}) --`);
        for (const l of lines) console.log(l);
    }
    // the verdict reads the folder the engine took, never assumes it: a «loaded» once hid that main's copy ran (FRM-392)
    const from = loadedFrom(lines, name);
    const isDev = from !== undefined && realpathSync(from) === dev;
    console.log(
        isDev
            ? `mods:probe: ${name} loaded from ${dev}`
            : `mods:probe: ${name} loaded from ${from ?? 'nowhere'}, not the dev copy ${dev}`,
    );
    const escaped = readdirSync(scratch);
    if (escaped.length)
        console.log(`mods:probe: a tail escaped: ${escaped.join(', ')}`);
    process.exit(
        isDev &&
            !escaped.length &&
            verdicts.every((v) => v.hasRun) &&
            (rows || run.status === 0)
            ? 0
            : 1,
    );
}

/* Types */

export type Row = { line: string; name: string };
type Block = {
    content?: string | { text?: string }[];
    id?: string;
    input?: { command?: string };
    is_error?: boolean;
    name?: string;
    tool_use_id?: string;
    type?: string;
};
