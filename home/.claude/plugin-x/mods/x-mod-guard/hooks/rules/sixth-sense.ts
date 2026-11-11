import {
    type Command,
    type Context,
    type Refusal,
    claudeSpawn,
    commandsDeep,
} from './command.ts';

// one sixth sense a lane, reused by message (FRM-479): a thread's role and lane are its record in x's thread store, under
// the session id `x brief summon` minted into the argv; the name is never parsed, and a summon with no id or no record of
// a lane is never judged
const SKILL = '/x:crew-sixth-sense';
const SIXTH_SENSE = 'sixth-sense';

// the `--session-id` a claude call starts its thread under
function summonedSessionId(spawn: Command) {
    const c = claudeSpawn(spawn);
    if (!c) return undefined;
    const at = c.args.findIndex((w) => w.text === '--session-id');
    if (at >= 0) return c.args[at + 1]?.text;
    return c.args
        .find((w) => w.text.startsWith('--session-id='))
        ?.text.slice('--session-id='.length);
}
// the session ids a command summons under, for the caller to read the thread records of
export function summonedSessionIds(command: string, cwd: string) {
    return commandsDeep(command, cwd).flatMap((c) => {
        const sid = summonedSessionId(c);
        return sid ? [sid] : [];
    });
}
export function spawnSixthSense(c: Command, ctx: Context): Refusal | undefined {
    const sid = summonedSessionId(c);
    const me = ctx.threads?.find((t) => t.sessionId === sid);
    if (!me || me.role !== SIXTH_SENSE || !me.lane) return undefined;
    const lane = me.lane;
    const twin = ctx.threads?.find(
        (t) =>
            t.role === SIXTH_SENSE &&
            t.lane === lane &&
            t.pid !== undefined &&
            t.sessionId !== sid,
    );
    const live = twin?.name ?? twin?.display;
    if (!live) return undefined;
    const name = me.display ?? sid ?? '';
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
