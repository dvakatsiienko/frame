// an ask's press, one record per ask, moved only by named events (FRM-648, x:guide-code § state): his press is local
// until its write lands, written until a read of the shelf shows it, then read; a turn that takes it locks it, a write
// that fails is failed with its reason until his next press, and a press the session never answers is given up. the
// board draws from the record alone

/** @typedef {'tick' | 'replay' | 'untick'} Verdict */
/** @typedef {'local' | 'written' | 'read' | 'locked' | 'failed' | 'given-up'} PressPhase */
/** @typedef {{ verdict: Verdict | null, phase: PressPhase, at: number, shelf: Verdict | null, reason?: string }} PressRecord */
/**
 * @typedef {{ type: 'pressed', verdict: Verdict, at: number }
 *   | { type: 'writeOk', at: number }
 *   | { type: 'timedOut', at: number }
 *   | { type: 'writeFailed', at: number, reason: string }
 *   | { type: 'shelfRead', pending: Verdict | null | undefined, mark: string | null | undefined, isLocked: boolean, isGone: boolean }} PressEvent
 */

/** a press the session never took is given up after this long; the timer belongs to `local` and `written` */
export const SENT_MS = 2 * 60 * 1000;

/** @param {PressRecord | null | undefined} record @returns {'open' | 'ticked' | 'replayed' | 'locked'} */
export function pressState(record) {
    if (record?.phase === 'locked') return 'locked';
    if (record?.verdict === 'tick') return 'ticked';
    if (record?.verdict === 'replay') return 'replayed';
    return 'open';
}

/**
 * his press as the shelf shows it: a line in the ticks file the stash has not taken, else the stash's mark
 * @param {Verdict | null | undefined} pending @param {string | null | undefined} mark @returns {Verdict | null}
 */
const shelfVerdict = (pending, mark) =>
    pending ?? (mark === 'accepted' ? 'tick' : mark ? 'replay' : null);

/** @param {PressRecord} record */
const isInFlight = (record) =>
    record.phase === 'local' || record.phase === 'written';

/**
 * @param {PressRecord | null} record
 * @param {PressEvent} event
 * @returns {PressRecord | null} null: the ask left
 */
export function next(record, event) {
    if (event.type === 'shelfRead') {
        if (event.isGone) return null;
        const shelf = shelfVerdict(event.pending, event.mark);
        if (event.isLocked)
            return {
                at: record?.at ?? 0,
                phase: 'locked',
                shelf,
                verdict: shelf,
            };
        if (!record) return { at: 0, phase: 'read', shelf, verdict: shelf };
        if (record.phase === 'local') return { ...record, shelf };
        // a failure stays drawn until his next press, its press drawn as the shelf has it
        if (record.phase === 'failed')
            return { ...record, shelf, verdict: shelf };
        if (
            record.phase === 'written' &&
            pressState(record) !== pressState({ ...record, verdict: shelf })
        )
            return { ...record, shelf };
        return { ...record, phase: 'read', shelf, verdict: shelf };
    }
    if (event.type === 'pressed') {
        if (record?.phase === 'locked') return record;
        return {
            at: event.at,
            phase: 'local',
            shelf: record?.shelf ?? null,
            verdict: event.verdict,
        };
    }
    // a write's answer or a timer moves only the press made at its `at`, never a newer one
    if (!record || !isInFlight(record) || record.at !== event.at) return record;
    if (event.type === 'writeOk')
        return record.phase === 'local'
            ? { ...record, phase: 'written' }
            : record;
    if (event.type === 'timedOut')
        return { ...record, phase: 'given-up', verdict: record.shelf };
    return {
        ...record,
        phase: 'failed',
        reason: event.reason,
        verdict: record.shelf,
    };
}

/**
 * how his second press takes a tick back: one the stash has not read leaves the ticks file, so neither the stash nor
 * the guard ever sees it; one it has read gets an untick line, which the stash answers by dropping the mark
 * @param {PressRecord | null | undefined} record @param {string | null | undefined} mark the stash's mark
 * @returns {'drop' | 'untick'}
 */
export const untickDoor = (record, mark) =>
    (record?.verdict === 'tick' || record?.verdict === 'replay') && !mark
        ? 'drop'
        : 'untick';
