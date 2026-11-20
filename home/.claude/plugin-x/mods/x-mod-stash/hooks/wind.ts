import type { EngineInterface } from 'claude-code';

import type { StashWind } from '../types/stash.d.ts';
import { ORBIT_TOOL } from './orbit.ts';

// 🐦‍🔥 second wind (todo 16): `wind:<sid>`, written by any board's press and read by that session's own stash at its next
// turn, so the ask rides the turn and never starts one (dima's slipstream)
export const WIND = 'wind:';
export async function windOf($: EngineInterface, sid: string) {
    return (await $.store.get(WIND + sid).catch(() => undefined)) as
        | StashWind
        | undefined;
}

// a board's press on a row: asks, or takes the ask back; a note already delivered is taken back at the next turn, a
// press on a cancel not yet delivered asks again, and a session already compacting goes on (no timer cancels, o2)
export const windAfterPress = (state?: StashWind['state']) => {
    if (!state) return 'asked';
    if (state === 'asked') return undefined;
    if (state === 'writing') return 'cancelled';
    return state === 'cancelled' ? 'writing' : state;
};
// the wind a press asks for, set, never flipped: on asks when none and takes a cancel back; off drops an ask and cancels a write
export const windAfterSet = (on: boolean, state?: StashWind['state']) => {
    if (on) return !state ? 'asked' : state === 'cancelled' ? 'writing' : state;
    if (state === 'asked') return undefined;
    return state === 'writing' ? 'cancelled' : state;
};
// what a press on the cc band asks for, from the state it reads
export const isWindWanted = (state?: StashWind['state']) =>
    !state || state === 'cancelled';
// the store's value decides, never the drawn one: another board may have pressed since
export async function flipWind($: EngineInterface, sid: string) {
    return setWind($, sid, isWindWanted((await windOf($, sid))?.state));
}
export async function setWind($: EngineInterface, sid: string, on: boolean) {
    const was = await windOf($, sid);
    const state = windAfterSet(on, was?.state);
    const key = WIND + sid;
    if (!state) await $.store.delete(key);
    else if (state !== was?.state)
        await $.store.set(key, {
            at: await $.clock.now(),
            state,
        } satisfies StashWind);
    return state;
}

export const WIND_HOW = `write your handoff with x:handoff, or \`x handoff write\` where that skill is missing (audience: your own role token, slug <lane or topic>-<n>); its first first-act is your role's init list — every skill your role loads at its start and every file it reads whole (codie: x:crew-codie, x:crew-dna read whole, the tree's AGENTS.md, and its lane's own, plugin-authoring for a mods codie; clio: her boot), since a compact re-attaches only some of your skills. then call ${ORBIT_TOOL} op second-wind with its slug and pending: none, or what is still pending (a subagent, a watch, a task not parked; a background command survives the compact and is no pending), which holds the compact until it resolves, never your work: at that turn's end the mod compacts this conversation and ingests the handoff, so your next turn starts fresh from it.`;
export const WIND_WORDS =
    'a second wind is a graceful context refresh, a request, never urgent — the session and its coders resolve every subagent and park everything before the compact, so nothing is lost.';
// `compacting:<sid>`: the engine is compacting this session, from the compact's start to its end
export const COMPACTING = 'compacting:';
export const COMPACT_MAX_MS = 10 * 60_000;
