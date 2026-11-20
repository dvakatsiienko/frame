// the Tab loop (FRM-620 slice 5c, FRM-673): Tab and shift-Tab walk one ring of stops our mods register, never herdr's
// hidden ones. a mod joins by its own Tab member: it publishes its stops under `tab.stops.<mod>`, and the ring takes
// them in the order the shown layout places the mods, so no list of mods exists. a stop's Tab asks for the next one
// under `tab.go` ({ at, to }), and the mod whose published stops hold `to` focuses it on a fresh `at`. a mod gone from
// the layout drops out with its stale key. a new stop (an antenna thread, the header's gear) is one more id it publishes

export const TAB_GO = 'tab.go';
/** @param {string} mod */
export const tabStopsKey = (mod) => `tab.stops.${mod}`;

/**
 * the ask for stop `to`: its `at` counts on from the last ask, so a clock set back loses no Tab
 * @param {(key: string) => unknown} read @param {string} to
 */
export function tabAsk(read, to) {
    return { at: atOf(read(TAB_GO)) + 1, to };
}

/** every mod block's name in the layout, in its document order, each once @param {unknown} tree @returns {string[]} */
function modsOf(tree) {
    /** @type {string[]} */
    const mods = [];
    /** @param {unknown} node */
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node))
            if (key === 'mod' && typeof value === 'string') {
                if (!mods.includes(value)) mods.push(value);
            } else walk(value);
    };
    walk(tree);
    return mods;
}

/**
 * the whole loop: each mod's published stops, the mods in layout order
 * @param {(key: string) => unknown} read herdr's `shared` @param {unknown} tree herdr's `layout()` @returns {string[]}
 */
export const loopOf = (read, tree) =>
    modsOf(tree).flatMap((mod) => {
        const stops = read(tabStopsKey(mod));
        return Array.isArray(stops)
            ? stops.filter((s) => typeof s === 'string')
            : [];
    });

/** @param {unknown} go @returns {number} */
const atOf = (go) =>
    go && typeof go === 'object' && 'at' in go && typeof go.at === 'number'
        ? go.at
        : 0;

/**
 * a mod's seat in the Tab loop: `publish` its stops each draw, `ask` on its stop's Tab, and `take` each draw, which
 * names the stop of its own to focus once per fresh ask; an ask made before the member was made never fires
 * @param {string} mod the mod's folder name, as the layout names it
 * @param {{ shared: (key: string) => unknown, setShared: (key: string, value: unknown) => unknown, layout: () => unknown }} herdr
 */
export function createTabMember(mod, herdr) {
    const key = tabStopsKey(mod);
    let seen = atOf(herdr.shared(TAB_GO));
    return {
        /** @param {string} from the stop holding the keyboard @param {boolean} isBack */
        ask(from, isBack) {
            const to = nextStop(
                loopOf(herdr.shared, herdr.layout()),
                from,
                isBack,
            );
            herdr.setShared(TAB_GO, tabAsk(herdr.shared, to));
        },
        /** @param {string[]} stops in its own Tab order @param {(run: () => void) => void} later after the draw */
        publish(stops, later) {
            if (JSON.stringify(herdr.shared(key)) === JSON.stringify(stops))
                return;
            later(() => herdr.setShared(key, stops));
        },
        /** @returns {string | null} */
        take() {
            const go = herdr.shared(TAB_GO);
            const at = atOf(go);
            if (at <= seen) return null;
            seen = at;
            const to = /** @type {{ to?: unknown }} */ (go).to;
            const mine = herdr.shared(key);
            return typeof to === 'string' &&
                Array.isArray(mine) &&
                mine.includes(to)
                ? to
                : null;
        },
    };
}

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
