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
