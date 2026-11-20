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

/**
 * every mod block's name in the layout, in its document order, each once; a `view` copy (glide is the deck drawn in the
 * sidebar) holds no stops, so only a mod's own block places it
 * @param {unknown} tree @returns {string[]}
 */
function modsOf(tree) {
    /** @type {string[]} */
    const mods = [];
    /** @param {unknown} node */
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        const view = /** @type {{ props?: { view?: unknown } }} */ (node).props
            ?.view;
        for (const [key, value] of Object.entries(node))
            if (key === 'mod' && typeof value === 'string') {
                if (!view && !mods.includes(value)) mods.push(value);
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

/** the stop holding the keyboard, so a reloaded mod takes it back @type {string} */
export const TAB_HELD = 'tab.held';

/**
 * a mod's seat in the Tab loop: `draw` once each render with the stops it draws, `ask` on its stop's Tab, `held` and
 * `left` on its stop's focus and blur. `draw` publishes the stops and names the one of them to focus: once per fresh
 * ask, an ask made before the member was made never firing; and, on a new member, once, its stop that held the keyboard
 * when the mod went down, as soon as it is drawn again: a keys reload restarts the mod mid-typing (FRM-673 exit 5).
 * one call, so a stop is only ever focused on the render that draws it
 * @param {string} mod the mod's folder name, as the layout names it
 * @param {{ shared: (key: string) => unknown, setShared: (key: string, value: unknown) => unknown, layout: () => unknown }} herdr
 */
export function createTabMember(mod, herdr) {
    const key = tabStopsKey(mod);
    let seen = atOf(herdr.shared(TAB_GO));
    let isRestoring = true;
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
        /**
         * @param {string[]} stops this render's stops, in its own Tab order
         * @param {(run: () => void) => void} later after the draw @returns {string | null} the stop to focus
         */
        draw(stops, later) {
            if (JSON.stringify(herdr.shared(key)) !== JSON.stringify(stops))
                later(() => herdr.setShared(key, stops));
            /** @param {unknown} stop @returns {stop is string} */
            const isDrawn = (stop) =>
                typeof stop === 'string' && stops.includes(stop);
            const go = herdr.shared(TAB_GO);
            const at = atOf(go);
            if (at > seen) {
                seen = at;
                isRestoring = false;
                const to = /** @type {{ to?: unknown }} */ (go).to;
                return isDrawn(to) ? to : null;
            }
            const was = herdr.shared(TAB_HELD);
            if (!isRestoring || !isDrawn(was)) return null;
            isRestoring = false;
            return was;
        },
        /** @param {string} stop took the keyboard */
        held(stop) {
            isRestoring = false;
            herdr.setShared(TAB_HELD, stop);
        },
        /**
         * the blur clears the hold after the draw: a mod torn down by a reload never runs it, so the hold outlives it
         * @param {string} stop lost the keyboard @param {(run: () => void) => void} later after the draw
         */
        left(stop, later) {
            later(() => {
                if (herdr.shared(TAB_HELD) === stop)
                    herdr.setShared(TAB_HELD, null);
            });
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
