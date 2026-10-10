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

const PR_HINT =
    'x-mod-guard hint: `x gh pr <n>` reads a pr — its checks and all three comment feeds, newest first — in one call';
const LANE_HINT =
    'x-mod-guard hint: `x lane commit <msg file> -- <paths>` formats and stages exactly those paths, then commits them';
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
    for (const c of commands(parse(command), cwd)) {
        const [sub, verb] = c.args.map((w) => w.text);
        if (
            c.name === 'gh' &&
            ((sub === 'pr' && (verb === 'view' || verb === 'checks')) ||
                (sub === 'api' && isPullsRead(c.args.slice(1))))
        )
            found.add(PR_HINT);
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
