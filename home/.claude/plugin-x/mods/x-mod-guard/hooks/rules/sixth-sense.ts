import {
    type Command,
    type Context,
    type Refusal,
    commandsDeep,
} from './command.ts';

// one sixth sense a lane, reused by message (FRM-479): a thread name reads `<mode> 🔎 sixth sense: <scope> | <what>`, and
// the scope names the lane; a name with no `|` has no scope (`⚡ 🔎 sixth sense: main`), names no lane and is never judged
const SIXTH_SENSE = 'sixth sense';
const SKILL = '/x:crew-sixth-sense';
const laneOf = (name: string) =>
    name
        .match(/:([^|]*)\|/)?.[1]
        ?.replaceAll(/[\s\u200d]/g, '')
        .toLowerCase() || undefined;
export const isSixthSense = (name: string) =>
    name.split(':')[0]?.toLowerCase().includes(SIXTH_SENSE) ?? false;

// the `-n` / `--name` a `claude --bg` call gives its thread
function summonedName(c: Command) {
    if (c.name !== 'claude' || !c.args.some((w) => w.text === '--bg'))
        return undefined;
    const at = c.args.findIndex((w) => w.text === '-n' || w.text === '--name');
    if (at >= 0) return c.args[at + 1]?.text;
    return c.args
        .find((w) => w.text.startsWith('--name='))
        ?.text.slice('--name='.length);
}
// the sixth sense names a command summons, for the caller to look up live twins of
export function sixthSenseSummons(command: string, cwd: string) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const name = summonedName(c);
        return name && isSixthSense(name) && laneOf(name) ? [name] : [];
    });
}
export function spawnSixthSense(c: Command, ctx: Context): Refusal | undefined {
    const name = summonedName(c);
    if (!name || !isSixthSense(name)) return undefined;
    const lane = laneOf(name);
    if (!lane) return undefined;
    const live = ctx.sixthSenses?.find((n) => laneOf(n) === lane);
    if (!live) return undefined;
    // the summon's own skill line carries the chunk: `/x:crew-sixth-sense <ticket> <pr url | main:<base>> … final: <sha> spec: <path>`
    const words =
        c.args
            .map((w) => w.text.split(/\s+/))
            .find((ws) => ws.includes(SKILL)) ?? [];
    const at = words.indexOf(SKILL);
    const after = (key: string) => {
        const i = words.indexOf(key, at);
        return i > at ? words[i + 1] : undefined;
    };
    const ticket = (at >= 0 && words[at + 1]) || '<ticket>';
    const target = (at >= 0 && words[at + 2]) || '<pr url | main:<base>>';
    return {
        door: `send the live one the next chunk instead — SendMessage to «${live}»: next: ${ticket} ${target} final: ${after('final:') ?? '<sha>'} spec: ${after('spec:') ?? '<path>'}`,
        rule: 'spawn-sixth-sense',
        targets: [name],
        why: `«${name}» would be a second sixth sense of lane «${lane}», where «${live}» is live; one sixth sense a lane, reused by message`,
    };
}
