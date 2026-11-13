// the effort popover (FRM-588, dima's 14:01 sketch): ⌘⇧E opens it on the current level, ← → slide, ⌘⇧E again closes it
// and applies; the track stops at its ends, and nothing applies while it is open

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** @typedef {{ at: number, from: number }} EffortPopover the stop picked, and the one it opened on */

/**
 * @param {EffortPopover | null} popover @param {string | null} current @param {boolean} isBlocked
 * @returns {{ popover: EffortPopover | null, apply: string | null }}
 */
export function effortKey(popover, current, isBlocked) {
    if (isBlocked) return { apply: null, popover: null };
    if (!popover) {
        const at = EFFORTS.indexOf(current ?? '');
        const from = at < 0 ? 1 : at;
        return { apply: null, popover: { at: from, from } };
    }
    // a thumb never moved applies nothing, an unknown level included: it opened on medium as a place to start
    const isMoved =
        popover.at !== popover.from && EFFORTS[popover.at] !== current;
    return { apply: isMoved ? EFFORTS[popover.at] : null, popover: null };
}

/** @param {EffortPopover} popover @param {'left' | 'right'} way @returns {EffortPopover} */
export function slideEffort(popover, way) {
    const at = popover.at + (way === 'right' ? 1 : -1);
    return { ...popover, at: Math.min(EFFORTS.length - 1, Math.max(0, at)) };
}

/** an effort level as people read it: «medium» → «Medium» @param {string} level */
export const effortWord = (level) =>
    level.charAt(0).toUpperCase() + level.slice(1);

/**
 * the picker's trigger, shepherdr's «Opus 5.5 · Medium» (dima's o13, 2026-11-13); a part still landing reads «…»
 * @param {string | null} model @param {string | null} effort
 * @param {{ kind: string, value: string } | null} pending the shown thread's pick in flight
 */
export function pickerLabel(model, effort, pending) {
    const m =
        pending?.kind === 'model' ? `${pending.value}…` : (model ?? 'Model');
    const e =
        pending?.kind === 'effort'
            ? `${effortWord(pending.value)}…`
            : effort
              ? effortWord(effort)
              : 'Effort';
    return `${m} · ${e}`;
}

/**
 * a pick Claude Code took: its picker closed on the press and no «switch?» question waits; mid-turn it prints no
 * confirmation and writes nothing to the transcript, and it runs the pick from the next turn (clio, 21:55)
 * @param {'effort' | 'model'} kind @param {string} screen
 */
export function pickTaken(kind, screen) {
    if (/Yes, switch|Switch model\?|Change effort level\?/.test(screen))
        return false;
    return kind === 'effort'
        ? !/Faster[\s\S]*Smarter/.test(screen)
        : !/Select model/.test(screen);
}

/**
 * the effort after a reply's stamp: his pick holds over replies still at the old effort; the first reply at it is the
 * moment it applied (mid-turn: the next request, clio's 22:09:17), the pick then settled
 * @param {{ isPicked?: boolean, level: string } | null} effort @param {unknown} stamp
 * @returns {{ isApplied: boolean, isPicked: boolean, level: string | null }}
 */
export function effortAfterStamp(effort, stamp) {
    const isPicked = Boolean(effort?.isPicked);
    if (typeof stamp !== 'string' || !EFFORTS.includes(stamp))
        return { isApplied: false, isPicked, level: effort?.level ?? null };
    if (isPicked && effort.level !== stamp)
        return { isApplied: false, isPicked: true, level: effort.level };
    return { isApplied: isPicked, isPicked: false, level: stamp };
}

/**
 * a pick Claude Code took still waits for a request to run at it: only while the thread works; once the turn ended no
 * request runs at the old effort again, so the pick settles (dima, 22:31: «stuck again»)
 * @param {boolean} isTaken @param {string | undefined} status
 */
export const isPickWaiting = (isTaken, status) =>
    isTaken && (status === 'working' || status === 'blocked');
