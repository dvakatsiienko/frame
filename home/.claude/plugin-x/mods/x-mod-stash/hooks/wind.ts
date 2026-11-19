import type { EngineInterface } from 'claude-code';

import type { StashWind } from '../types/stash.d.ts';

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
