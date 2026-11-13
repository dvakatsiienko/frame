// the effort popover (FRM-588, dima's 14:01 sketch): ⌘⇧E opens it on the current level, ← → slide, ⌘⇧E again closes it
// and applies; the track stops at its ends, and nothing applies while it is open

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** @typedef {{ at: number }} EffortPopover */

/**
 * @param {EffortPopover | null} popover @param {string | null} current @param {boolean} isBlocked
 * @returns {{ popover: EffortPopover | null, apply: string | null }}
 */
export function effortKey(popover, current, isBlocked) {
    if (isBlocked) return { apply: null, popover: null };
    if (!popover) {
        const at = EFFORTS.indexOf(current ?? '');
        return { apply: null, popover: { at: at < 0 ? 1 : at } };
    }
    const picked = EFFORTS[popover.at];
    return { apply: picked === current ? null : picked, popover: null };
}

/** @param {EffortPopover} popover @param {'left' | 'right'} way @returns {EffortPopover} */
export function slideEffort(popover, way) {
    const at = popover.at + (way === 'right' ? 1 : -1);
    return { at: Math.min(EFFORTS.length - 1, Math.max(0, at)) };
}
