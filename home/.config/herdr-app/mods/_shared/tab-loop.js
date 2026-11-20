// the Tab loop (FRM-620 slice 5c): Tab and shift-Tab walk one ring of stops our mods register, never herdr's hidden
// ones. each mod publishes its stops in its own order under `tab.stops.<mod>`, a mod with a stop focused asks for the
// next one under `tab.go` ({ at, to }), and the mod owning `to` focuses it on a fresh `at`. a new stop (an antenna
// thread, the header's gear) is one more id its mod publishes

/** the mods in the loop, in the order Tab walks them @type {readonly string[]} */
export const TAB_MODS = ['x-herdr-chat', 'x-herdr-deck'];
export const TAB_GO = 'tab.go';
/** @param {string} mod */
export const tabStopsKey = (mod) => `tab.stops.${mod}`;

/** the whole loop, read through herdr's `shared` @param {(key: string) => unknown} read @returns {string[]} */
export const loopOf = (read) =>
    TAB_MODS.flatMap((mod) => {
        const stops = read(tabStopsKey(mod));
        return Array.isArray(stops)
            ? stops.filter((s) => typeof s === 'string')
            : [];
    });

/**
 * the stop after `from` (before it with shift-Tab), wrapping at the ends; a stop gone from the loop hands the keyboard
 * to the first one
 * @param {string[]} loop @param {string} from @param {boolean} isBack
 */
export function nextStop(loop, from, isBack) {
    const at = loop.indexOf(from);
    if (at < 0) return loop[0] ?? from;
    return loop[(at + (isBack ? -1 : 1) + loop.length) % loop.length] ?? from;
}
