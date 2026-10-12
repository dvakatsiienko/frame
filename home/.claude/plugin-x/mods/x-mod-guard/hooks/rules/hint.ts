import { parse } from '../shell.ts';
import {
    type Command,
    type Context,
    commands,
    gitDir,
    gitParts,
    hasFlag,
    operands,
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
// on 10-11); zsh's echo reads backslash escapes inside json (two verifiers); `claude -p` in a `while read` loop eats the
// loop's stdin (the 15:41 dima-caught)
const EDIT_HINT =
    'x-mod-guard hint: a hand edit to a repo file goes through `Edit` — it fires the format and hold hooks a scripted replace skips; a bulk change across many files may stay one script';
const ECHO_JSON_HINT =
    "x-mod-guard hint: zsh's `echo` reads `\\n` and other escapes inside json — print it with `printf '%s\\n'` or build it with `jq -n`";
const LOOP_HINT =
    "x-mod-guard hint: `claude -p` inside `while read` eats the loop's stdin — end it with `</dev/null`";
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
    for (const c of all) {
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
        if (c.name === 'git') {
            const git = gitParts(c.args).sub;
            if (
                (git === 'add' || git === 'commit') &&
                isOwnRepo(gitDir(c, ctx), ctx)
            )
                found.add(LANE_HINT);
        }
    }
    return [...found];
}
