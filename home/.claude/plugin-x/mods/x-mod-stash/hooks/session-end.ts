// what a conversation leaves behind: a /clear or a resume forgets it, an exit keeps only its last reply, and the ended
// ones are pruned at a start; each key is forgotten by its owner, this module only calls them in order

import type { EngineInterface } from 'claude-code';

import { forgetBandReads } from './band-presses.ts';
import { leaveJoins } from './joins.ts';
import { forgetWarm } from './keep-warm.ts';
import { forgetAsks, keepState, pruneKept } from './orbit-store.ts';
import { forgetReply, pruneReplies } from './reply-fix.ts';
import {
    endIdentity,
    pruneSuccessors,
    refreshThreads,
} from './session-identity.ts';
import { dropState, forgetModel } from './session-record.ts';
import { setPrimed } from './turn.ts';
import { forgetTold } from './turn-notes.ts';
import { forgetContext } from './usage.ts';
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

// an ended session's reply is dropped a day after it ended, a kept state and a successor link a week after their last save
export async function pruneEnded($: EngineInterface) {
    const now = await $.clock.now();
    await pruneKept($, now);
    await pruneSuccessors($, now);
    await pruneReplies($, now);
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
