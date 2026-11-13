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
