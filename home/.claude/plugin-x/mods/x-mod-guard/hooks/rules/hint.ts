import { parse } from '../shell.ts';
import {
    type Command,
    type Context,
    commands,
    gitDir,
    gitParts,
    hasFlag,
    operands,
    resolve,
} from './command.ts';
import { isOwnRepo } from './hazard.ts';
import { writtenPaths } from './overwrite.ts';

const PR_HINT =
    'x-mod-guard hint: `x gh pr <n>` reads a pr — its checks and all three comment feeds, newest first — in one call';
const LANE_HINT =
    'x-mod-guard hint: `x lane commit <msg file> -- <paths>` formats and stages exactly those paths, then commits them';
// gh's --jq runs gojq built into gh, not the system jq: a program proven with jq can read differently inside gh
// (BYT-95/96 retros, FRM-394; was a fleet-hazards line)
const JQ_HINT =
    'x-mod-guard hint: `gh --jq` runs gojq, not jq — prove the program through gh itself, or pipe `gh --json …` into `jq`';
// PK-67 (the 10-11 halt flush): a scripted replace into a repo file skips the format and hold hooks Edit fires (5 slips
// on 10-11); zsh's echo reads backslash escapes inside json (two sixth senses); `claude -p` in a `while read` loop eats the
// loop's stdin (the 15:41 dima-caught)
const EDIT_HINT =
    'x-mod-guard hint: a hand edit to a repo file goes through `Edit` — it fires the format and hold hooks a scripted replace skips; a bulk change across many files may stay one script';
const ECHO_JSON_HINT =
    "x-mod-guard hint: zsh's `echo` reads `\\n` and other escapes inside json — print it with `printf '%s\\n'` or build it with `jq -n`";
const LOOP_HINT =
    "x-mod-guard hint: `claude -p` inside `while read` eats the loop's stdin — end it with `</dev/null`";
// rg skips dot dirs: a «0 left» proof over frame missed 4 live pointers under home/.claude (PK-139, 2026-10-14)
const RG_HINT =
    'x-mod-guard hint: `rg` skips dot dirs like `home/.claude` — add `--hidden` when the search must reach them';
// a pipe's exit is its last stage's: `gh api … | jq … && next` runs `next` after a failed gh api (PK-188)
const PIPESTATUS_HINT =
    "x-mod-guard hint: the `&&` after `| jq` reads jq's exit, not the producer's — check `$pipestatus[1]` (zsh) or start with `set -o pipefail`";
// curl -s exits 0 on a 404 and pipes its error page on as data (PK-188)
const CURL_FAIL_HINT =
    'x-mod-guard hint: `curl -s` exits 0 on an http error and pipes the error page on — add `curl -f` (or `--fail-with-body`)';
// a script that parses no help flag runs on `--help` (PK-208); some clis run the verb under `<cli> <verb> --help`
// (obsidian deleted a note, fleet-hazards § the bash tool)
// the package runners hand --help to the package they run, never to themselves
const RUNNERS = new Set([
    'node',
    'tsx',
    'bun',
    'deno',
    'ts-node',
    'npx',
    'bunx',
    'pnpx',
]);
const SCRIPT = /\.(ts|mts|js|mjs)$/;
const scriptHint = (path: string) =>
    `x-mod-guard hint: \`${path.split('/').at(-1)}\`'s source names no help flag — \`--help\` runs it; read its header instead`;
const verbHint = (cli: string) =>
    `x-mod-guard hint: \`${cli} --help\`, bare, lists its verbs — some clis run the verb under \`<verb> --help\``;
const isHelp = (args: Command['args']) =>
    args.some((w) => w.text === '--help' || w.text === '-h');
// the frame or clio scripts a command runs with `--help` or `-h`, by real path
export function helpScripts(command: string, cwd: string, ctx: Context) {
    const out: string[] = [];
    for (const c of commands(parse(command), cwd)) {
        if (!isHelp(c.args)) continue;
        const script = RUNNERS.has(c.name)
            ? operands(c.args).find((o) => SCRIPT.test(o))
            : SCRIPT.test(c.name)
              ? c.name
              : undefined;
        if (!script) continue;
        const path = resolve(script, c.dir, ctx);
        if (ctx.home && path.startsWith(`${ctx.home}/frame/`)) out.push(path);
    }
    return out;
}
// cobra, commander or our own: every verb parses --help and only prints
const HELP_SAFE = new Set(['x', 'gh', 'git', 'claude', 'obsidian']);
const SHELL_WORDS = new Set(['for', 'case', 'select', 'function', 'in']);
// a package runner hands the words after the package to the package's own cli, so that cli is the one a hint names
// (FRM-426: `pnpm dlx biome check --help` hinted `pnpm --help`)
const PKG_RUNNERS = new Set(['npx', 'bunx', 'pnpx']);
function ranCli(c: Command) {
    const ops = operands(c.args);
    if (PKG_RUNNERS.has(c.name)) return { cli: ops[0], verbs: ops.slice(1) };
    if (c.name === 'pnpm' && (ops[0] === 'dlx' || ops[0] === 'exec'))
        return { cli: ops[1], verbs: ops.slice(2) };
    return undefined;
}
// the clis a command runs as `<cli> <verb> --help` that this session has not met yet: their hint fires once
export function verbHelps(command: string, cwd: string, ctx: Context) {
    const clis = new Set<string>();
    for (const c of commands(parse(command), cwd)) {
        const ran = ranCli(c);
        const cli = ran ? ran.cli : c.name;
        const verbs = ran ? ran.verbs : operands(c.args);
        if (
            cli &&
            /^[A-Za-z][\w.-]*$/.test(cli) &&
            !SHELL_WORDS.has(cli) &&
            !HELP_SAFE.has(cli) &&
            !RUNNERS.has(cli) &&
            !SCRIPT.test(cli) &&
            !ctx.helped?.has(cli) &&
            c.args.some((w) => w.text === '--help') &&
            verbs.length
        )
            clis.add(cli);
    }
    return [...clis];
}
// the clis a command runs with a bare `--help`, nothing else
export function bareHelps(command: string, cwd: string) {
    return commands(parse(command), cwd)
        .filter(
            (c) =>
                c.name &&
                c.args.length === 1 &&
                (c.args[0]?.text === '--help' || c.args[0]?.text === '-h'),
        )
        .map((c) => c.name);
}
// rg's options that take the next word, and the ones that carry the pattern so no positional one comes first
const RG_VALUE = new Set([
    '-e',
    '--regexp',
    '-f',
    '--file',
    '-g',
    '--glob',
    '--iglob',
    '-t',
    '--type',
    '-T',
    '--type-not',
    '-A',
    '-B',
    '-C',
    '--after-context',
    '--before-context',
    '--context',
    '-m',
    '--max-count',
    '--max-depth',
    '-d',
    '-r',
    '--replace',
    '-M',
    '--max-columns',
    '-j',
    '--threads',
    '--sort',
    '--sortr',
    '--encoding',
    '-E',
]);
const RG_PATTERN = new Set(['-e', '--regexp', '-f', '--file']);
function rgPaths(args: Command['args']) {
    const words: string[] = [];
    let isPatternGiven = false;
    let isRest = false;
    for (let i = 0; i < args.length; i++) {
        const t = args[i]?.text ?? '';
        if (isRest || !t.startsWith('-')) words.push(t);
        else if (t === '--') isRest = true;
        else if (RG_VALUE.has(t)) {
            isPatternGiven ||= RG_PATTERN.has(t);
            i++;
        } else if (/^--(regexp|file)=/.test(t)) isPatternGiven = true;
    }
    return isPatternGiven ? words : words.slice(1);
}
// an rg rooted where dot dirs live below it (frame, frame/home, ~): a path naming a dot dir outright is searched
function rgMissesDots(c: Command, ctx: Context) {
    if (
        hasFlag(c.args, ['--hidden'], '.') ||
        c.args.some((w) => /^-u{2,}$/.test(w.text))
    )
        return false;
    const dir = resolve(c.dir, '/', ctx);
    const paths = rgPaths(c.args);
    // no path and a pipe or a $( ) feeding it: rg reads stdin and searches no folder
    if (!paths.length && c.feeders.length) return false;
    const roots = paths.length ? paths.map((p) => resolve(p, dir, ctx)) : [dir];
    const frame = `${ctx.home}/frame`;
    return roots.some(
        (r) => r === frame || r === `${frame}/home` || r === ctx.home,
    );
}
const REPLACERS = new Set(['sd', 'sed', 'python', 'python3']);
const isJsonish = (text: string) => /^\s*[[{].*["\\]/s.test(text);
const isGhJq = (args: Command['args']) =>
    args.some(
        (w) =>
            w.text === '--jq' || w.text.startsWith('--jq=') || w.text === '-q',
    );
const PULLS = /(^|\/)pulls(\/|$|\?)/;
// a gh api call with a body or a method other than GET writes, and x gh pr covers only reads
function isPullsRead(args: Command['args']) {
    const method = args.findIndex(
        (w) => w.text === '-X' || w.text === '--method',
    );
    const isGet = method < 0 || args[method + 1]?.text.toUpperCase() === 'GET';
    return (
        isGet &&
        !hasFlag(args, ['--field', '--raw-field', '--input'], 'fF') &&
        operands(args).some((o) => PULLS.test(o))
    );
}
// a hint, never a rewrite: the raw command runs as typed, one context line names the x verb that covers it
export function hints(command: string, cwd: string, ctx: Context) {
    const found = new Set<string>();
    const all = commands(parse(command), cwd);
    if (
        all.some((c) => REPLACERS.has(c.name)) &&
        writtenPaths(command, cwd, ctx).some((p) => isOwnRepo(p, ctx))
    )
        found.add(EDIT_HINT);
    if (
        /\bwhile\b[^;\n]*\bread\b/.test(command) &&
        all.some(
            (c) =>
                c.name === 'claude' &&
                c.args.some((w) => w.text === '-p' || w.text === '--print'),
        ) &&
        !/<\s*\/dev\/null/.test(command)
    )
        found.add(LOOP_HINT);
    const isPipefail = /\bpipefail\b|\bpipestatus\b/.test(command);
    for (const [i, c] of all.entries()) {
        if (
            !isPipefail &&
            c.name === 'jq' &&
            c.sep === '&&' &&
            all[i - 1]?.sep === '|'
        )
            found.add(PIPESTATUS_HINT);
        if (
            c.name === 'curl' &&
            c.sep === '|' &&
            hasFlag(c.args, ['--silent'], 's') &&
            !hasFlag(c.args, ['--fail', '--fail-with-body'], 'f') &&
            !hasFlag(c.args, ['--write-out'], 'w')
        )
            found.add(CURL_FAIL_HINT);
        if (c.name === 'echo' && operands(c.args).some(isJsonish))
            found.add(ECHO_JSON_HINT);
        const [sub, verb] = c.args.map((w) => w.text);
        if (
            c.name === 'gh' &&
            ((sub === 'pr' && (verb === 'view' || verb === 'checks')) ||
                (sub === 'api' && isPullsRead(c.args.slice(1))))
        )
            found.add(PR_HINT);
        if (c.name === 'gh' && isGhJq(c.args)) found.add(JQ_HINT);
        if (c.name === 'rg' && ctx.home && rgMissesDots(c, ctx))
            found.add(RG_HINT);
        if (c.name === 'git') {
            const git = gitParts(c.args).sub;
            if (
                (git === 'add' || git === 'commit') &&
                isOwnRepo(gitDir(c, ctx), ctx)
            )
                found.add(LANE_HINT);
        }
    }
    for (const cli of verbHelps(command, cwd, ctx)) found.add(verbHint(cli));
    for (const path of helpScripts(command, cwd, ctx))
        if (ctx.helpless?.has(path)) found.add(scriptHint(path));
    return [...found];
}
