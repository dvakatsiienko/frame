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
 * the pick Claude Code confirmed on its screen, «Set effort level to high (this session only)» or «Set model to Sonnet
 * 5.5 for this session only»: mid-turn it writes neither to the transcript, so the label takes it from here
 * @param {'effort' | 'model'} kind @param {string} screen @returns {string | null}
 */
export function pickSeen(kind, screen) {
    if (kind === 'effort') {
        const level = /Set effort level to (\w+)/.exec(screen)?.[1];
        return level && EFFORTS.includes(level) ? level : null;
    }
    return /Set model to (.+?) for this session/.exec(screen)?.[1] ?? null;
}
