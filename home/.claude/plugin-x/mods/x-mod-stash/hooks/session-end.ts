// what a conversation leaves behind: a /clear or a resume forgets its keys, an exit keeps only its last reply, and
// the ended ones are pruned at a start; above session-record.ts and keep-warm.ts, whose keys it drops

import type { EngineInterface } from 'claude-code';

import { BAND_READ, BAND_REFUSED } from './band-presses.ts';
import { JOIN_OWED, handBackJoins } from './joins.ts';
import { AUTO_WIND } from './keep-warm.ts';
import { KEPT, PREFIX, keepState } from './orbit-store.ts';
import { SUCC, endIdentity, refreshThreads } from './session-identity.ts';
import { dropState } from './session-record.ts';
import { HOT, MODEL, REPLY, type Reply, hotOf } from './store-keys.ts';
import { setPrimed } from './turn.ts';
import { forgetTold } from './turn-notes.ts';
import { CONTEXT } from './usage.ts';
import { STALE_MS } from './util.ts';
import { WIND } from './wind.ts';
import { FILL } from './wind-run.ts';

const KEPT_MS = 7 * 24 * 60 * 60 * 1000;
// everything this mod keeps for one conversation: one store key per prefix, the session id after it, plus its pending
// lane marks; a new per-session key joins this list, or a /clear leaves it behind for good (marks did, FRM-400)
const SESSION_KEYS = [
    PREFIX,
    HOT,
    REPLY,
    CONTEXT,
    MODEL,
    WIND,
    FILL,
    AUTO_WIND,
] as const;
export async function forget($: EngineInterface, sid: string) {
    const home = await $.env.get('HOME').catch(() => undefined);
    const isHandedBack = home
        ? await handBackJoins($, home, sid).catch(() => false)
        : true;
    if (!isHandedBack)
        await $.store.set(JOIN_OWED + sid, true).catch(() => undefined);
    await dropState($, sid).catch(() => undefined);
    await $.store.delete(BAND_READ + sid);
    await $.store.delete(BAND_REFUSED + sid);
    for (const prefix of SESSION_KEYS) await $.store.delete(prefix + sid);
}
// a session that exited keeps only its last reply, marked ended, dropped a day later
async function retire($: EngineInterface, sid: string) {
    const reply = (await $.store.get(REPLY + sid)) as Reply | undefined;
    const heat = await $.store.get(HOT + sid);
    const autoWind = await $.store.get(AUTO_WIND + sid);
    await forget($, sid);
    if (autoWind) await $.store.set(AUTO_WIND + sid, autoWind);
    // a resume of this id keeps dima's off: a seat's default fills only a key never written
    if (heat && !hotOf(heat)) await $.store.set(HOT + sid, heat);
    if (reply)
        await $.store.set(REPLY + sid, {
            ...reply,
            ended: await $.clock.now(),
        } satisfies Reply);
}
// an ended session's reply is dropped a day after it ended, a kept state a week after its last save
export async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    for (const key of await $.store.keys()) {
        if (key.startsWith(KEPT) || key.startsWith(SUCC)) {
            const v = (await $.store.get(key)) as { at?: number } | undefined;
            if (now - (v?.at ?? 0) >= KEPT_MS) await $.store.delete(key);
            continue;
        }
        if (!key.startsWith(REPLY)) continue;
        const v = (await $.store.get(key)) as Reply | undefined;
        if (v?.ended !== undefined && now - v.ended >= STALE_MS)
            await $.store.delete(key);
    }
}
// a /clear or a resume leaves the conversation behind; an exit keeps only its last reply
export async function endSession(
    $: EngineInterface,
    sid: string,
    isLeft: boolean,
) {
    await refreshThreads($);
    if (isLeft) {
        // the process outlives a /clear, so the next conversation is primed again: no session.start fires for it
        setPrimed(false);
        forgetTold();
        // the process goes on under a new id with no session.start: the next read takes it fresh
        endIdentity(sid);
        await forget($, sid);
    } else {
        // a quit keeps what the board drew, so the resumed session draws it again
        await keepState($).catch(() => undefined);
        await retire($, sid);
    }
}
