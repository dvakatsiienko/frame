// the tab bar past its width: it moves one tab per swipe (dima, 20:52: the sideways scroll was too fast), never by
// pixels, and the active tab is always in the window

// the narrowest an inactive tab gets, its gap included: how many fit is the bar's width over this
export const TAB_STEP_PX = 113;

/**
 * the first tab to draw: `first` moved by `step` tabs, kept so the last tab still fills the bar; when the active tab
 * changed (a click, a switch, a new tab), moved just enough to show it, so a swipe can still browse past it
 * @param {{ first: number, count: number, width: number, active: number, step?: number, isActiveNew?: boolean }} bar
 * @returns {number}
 */
export function firstTab({
    first,
    count,
    width,
    active,
    step = 0,
    isActiveNew = false,
}) {
    const fit = Math.max(1, Math.floor(width / TAB_STEP_PX));
    const last = Math.max(0, count - fit);
    let next = Math.max(0, Math.min(first + step, last));
    if (isActiveNew && active >= 0 && active < next) next = active;
    if (isActiveNew && active >= next + fit) next = active - fit + 1;
    return next;
}
