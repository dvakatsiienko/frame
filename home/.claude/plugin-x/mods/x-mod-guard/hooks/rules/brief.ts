import { parse } from '../shell.ts';
import {
    type Command,
    type Context,
    type Refusal,
    commands,
    operands,
    resolve,
} from './command.ts';

const CODER = '/x:crew-coder';
const INLINE = 'inline-brief';
// a `claude --bg` call's brief file: the one `$(cat <path>)`, `cat <path> |` or `< <path>` reads
function spawnBrief(c: Command, ctx: Context) {
    if (c.name !== 'claude' || !c.args.some((w) => w.text === '--bg'))
        return undefined;
    const dir = resolve(c.dir, '/', ctx);
    const text =
        c.feeders.flatMap((f) =>
            f.name === 'cat' ? operands(f.args) : [],
        )[0] ?? c.reads[0];
    return {
        dir,
        file: text ? { path: resolve(text, dir, ctx), text } : undefined,
    };
}
// the brief files every coder spawn in the command reads, for the caller to hash and look up
export function briefPaths(command: string, cwd: string, ctx: Context = {}) {
    return commands(parse(command), cwd).flatMap((c) => {
        const path = spawnBrief(c, ctx)?.file?.path;
        return path ? [path] : [];
    });
}
// a coder spawn runs only on a brief whose bytes passed x brief check
export function brief(c: Command, ctx: Context): Refusal | undefined {
    const spawn = spawnBrief(c, ctx);
    if (!spawn) return undefined;
    const { dir, file } = spawn;
    const isNamed = c.args.some((w) => w.text.includes(CODER));
    if (!file)
        return isNamed
            ? {
                  door: `write the brief to a file, run x brief check <path> --repo ${dir}, then spawn with "$(cat <path>)"`,
                  rule: 'brief',
                  targets: [INLINE],
                  why: 'x-mod-guard can check a brief only in a file, and a coder brief must pass x brief check',
              }
            : undefined;
    const found = ctx.briefs?.get(file.path);
    if (!(isNamed || found?.isCoder) || found?.isStamped) return undefined;
    return {
        door: `x brief check ${file.path} --repo ${dir}, fix what it names, then spawn again`,
        rule: 'brief',
        targets: [file.text],
        why: found
            ? 'the brief has no clean x brief check stamp for its current bytes'
            : 'the brief file is missing',
    };
}
