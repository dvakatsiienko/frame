// what a conversation leaves behind: a /clear or a resume forgets it, an exit keeps only its last reply, and the ended
// ones are pruned at a start; each key is forgotten by its owner, this module only calls them in order

import type { EngineInterface } from 'claude-code';

import { BAND_READ, forgetBandReads } from './band-presses.ts';
import { QUIET_HELD } from './held.ts';
import { leaveJoins } from './joins.ts';
import { forgetWarm } from './keep-warm.ts';
import { forgetAsks, keepState, pruneKept } from './orbit-store.ts';
import { forgetReply, pruneReplies } from './reply-fix.ts';
import { registry } from './roster.ts';
import {
    endIdentity,
    pruneSuccessors,
    refreshThreads,
} from './session-identity.ts';
import { dropState, forgetModel } from './session-record.ts';
import { HOT, MODEL, REPLY } from './store-keys.ts';
import { setPrimed } from './turn.ts';
import { forgetTold } from './turn-notes.ts';
import { CONTEXT, forgetContext } from './usage.ts';
import { forgetWind } from './wind.ts';
import { forgetFill } from './wind-run.ts';

// everything this mod keeps for one conversation, each through its owner; a new per-session key joins this list, or a
// /clear leaves it behind for good (marks did, FRM-400)
export async function forget($: EngineInterface, sid: string, isExit = false) {
    await leaveJoins($, sid);
    await dropState($, sid).catch(() => undefined);
    await forgetBandReads($, sid);
    await forgetAsks($, sid);
    await forgetWarm($, sid, isExit);
    await forgetReply($, sid, isExit);
    await forgetContext($, sid);
    await forgetModel($, sid);
    await forgetWind($, sid);
    await forgetFill($, sid);
}

// a killed session ends with no session.end, so `forget` never runs for it: past this age its keys go at a start, once a day.
// never `herdr-read:`, whose loss would replay dima's old presses into a session resumed after it
const GONE_DAYS = 7;
const GONE_FAMILIES = [
    REPLY,
    BAND_READ,
    MODEL,
    HOT,
    CONTEXT,
    QUIET_HELD,
] as const;
const isHotOff = (v: unknown) =>
    (v as { off?: boolean } | undefined)?.off === true;
const PRUNED_AT = 'pruned-at';
const SESSION_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
async function pruneGone($: EngineInterface, now: number) {
    const last = await $.store.get(PRUNED_AT);
    if (typeof last === 'number' && now - last < 86_400_000) return;
    // the keys first, the registry last: a session that starts or resumes meanwhile is live by then
    const keys = await $.store.keys();
    const home = await $.env.get('HOME');
    const found = await $.process.run([
        'find',
        `${home}/.claude/projects`,
        '-maxdepth',
        '2',
        '-name',
        '*.jsonl',
        '-mtime',
        // `d`: a bare number rounds the age up to whole days
        `-${GONE_DAYS}d`,
    ]);
    const recent = found.stdout
        .split('\n')
        .map((path) => path.slice(path.lastIndexOf('/') + 1, -'.jsonl'.length))
        .filter((sid) => SESSION_ID.test(sid));
    const entries = (await $.fs.list(`${home}/.claude/sessions`)).filter((f) =>
        f.name.endsWith('.json'),
    );
    const rows = await registry($);
    // a lookup that failed, found nobody or missed a torn registry file says nothing about who is gone
    if (found.exitCode !== 0 || !recent.length) return;
    if (!rows.length || rows.length < entries.length) return;
    const kept = new Set([
        await $.session.id(),
        ...recent,
        ...rows.map((r) => r.base.sid),
    ]);
    for (const key of keys) {
        const family = GONE_FAMILIES.find((f) => key.startsWith(f));
        if (!family) continue;
        const sid = key.slice(family.length);
        if (!SESSION_ID.test(sid) || kept.has(sid)) continue;
        // dima's 🔥 off outlives its session, so a seat's default never lights it on a resume
        if (family === HOT && isHotOff(await $.store.get(key))) continue;
        await $.store.delete(key);
    }
    await $.store.set(PRUNED_AT, now);
}

// an ended session's reply is dropped a day after it ended, a kept state and a successor link a week after their last save
export async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    await pruneKept($, now);
    await pruneSuccessors($, now);
    await pruneReplies($, now);
    await pruneGone($, now).catch(() => undefined);
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
        await forget($, sid, true);
    }
}
