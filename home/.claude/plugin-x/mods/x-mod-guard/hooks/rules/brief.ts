import {
    type Command,
    type Context,
    type Refusal,
    claudeSpawn,
    commandsDeep,
    operands,
    resolve,
} from './command.ts';

const CODIE = '/x:crew-codie';
// a command that prints a file: its last operand is the file (`sed -n p <file>`, `head -n 99 <file>`)
const READERS = new Set(['cat', 'sed', 'head', 'tail', 'awk', 'less', 'bat']);
const INLINE = 'inline-brief';
// a `claude --bg` call's brief file: the one `$(cat <path>)`, `$(< <path>)`, `cat <path> |` or `< <path>` reads
function spawnBrief(spawn: Command, ctx: Context) {
    const c = claudeSpawn(spawn);
    if (!c) return undefined;
    const dir = resolve(c.dir, '/', ctx);
    const text =
        c.feeders.flatMap((f) =>
            READERS.has(f.name)
                ? operands(f.args).slice(-1)
                : f.name
                  ? []
                  : f.reads.slice(0, 1),
        )[0] ?? c.reads[0];
    return {
        dir,
        file: text ? { path: resolve(text, dir, ctx), text } : undefined,
    };
}
// the brief files every codie summon in the command reads, each with its summon dir, for the caller to ask x brief check
export function briefPaths(command: string, cwd: string, ctx: Context = {}) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const spawn = spawnBrief(c, ctx);
        return spawn?.file ? [{ dir: spawn.dir, path: spawn.file.path }] : [];
    });
}
// a codie summon runs only on a brief whose bytes passed x brief check
export function brief(c: Command, ctx: Context): Refusal | undefined {
    const spawn = spawnBrief(c, ctx);
    if (!spawn) return undefined;
    const { dir, file } = spawn;
    const isNamed = c.args.some(
        (w) => w.text.includes(CODIE) || w.text.includes('/x:crew-coder'), // read-both: the skill id before 10-29
    );
    if (!file)
        return isNamed
            ? {
                  door: `write the brief to a file, run x brief check <path> --repo ${dir}, then spawn with "$(cat <path>)"`,
                  rule: 'brief',
                  targets: [INLINE],
                  why: 'x-mod-guard can check a brief only in a file, and a brief for codie must pass x brief check',
              }
            : undefined;
    const found = ctx.briefs?.get(file.path);
    if (!(isNamed || found?.isCodie) || found?.isStamped) return undefined;
    return {
        door: `x brief check ${file.path} --repo ${dir}, fix what it names, then spawn again`,
        rule: 'brief',
        targets: [file.text],
        why: found
            ? 'x brief check did not pass the brief as it is now'
            : 'the brief file is missing',
    };
}
