// «text (all of herdr)»: herdr draws a chat's text in the theme's foreground only, so his text colour goes into
// herdr's own settings.json as `colors.foreground`, the whole app's text. written only on his change, never at a
// load; the value there before his first change is kept, and Reset puts it back.

const BEFORE_KEY = 'foreground:before';
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * @typedef {object} ForegroundDoors
 * @property {() => Promise<string | null>} read herdr's settings.json as text, null when it does not exist
 * @property {(text: string, expected: string | null) => Promise<unknown>} write a write over the text it read; it
 *   refuses when the file changed since
 * @property {import('./look-store.js').Store} store the part's own store
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {ForegroundDoors} doors */
export function createForeground({ read, write, store }) {
    /**
     * herdr's settings with its text colour set, or taken out; a file that changed under the write is read again once
     * @param {(now: string | undefined) => string | undefined} next the colour to hold, from the one there now
     * @returns {Promise<string | undefined>} the colour there before the write
     */
    async function setColour(next) {
        for (let tries = 0; tries < 2; tries++) {
            const text = await read();
            /** @type {unknown} */
            let parsed;
            try {
                parsed = JSON.parse(text ?? '{}');
            } catch {
                // a file he broke by hand is his to fix: never written over
                return undefined;
            }
            if (!isRecord(parsed)) return undefined;
            const colors = isRecord(parsed.colors) ? { ...parsed.colors } : {};
            const now =
                typeof colors.foreground === 'string'
                    ? colors.foreground
                    : undefined;
            const wanted = next(now);
            if (wanted === now) return now;
            if (wanted === undefined) delete colors.foreground;
            else colors.foreground = wanted;
            const { colors: _, ...rest } = parsed;
            const settings = Object.keys(colors).length
                ? { ...rest, colors }
                : rest;
            try {
                await write(`${JSON.stringify(settings, null, 2)}\n`, text);
                return now;
            } catch {
                // the file changed since it was read: read it again
            }
        }
        return undefined;
    }

    /** the colour before his first change, as kept: undefined when none was kept, null when there was none */
    function kept() {
        try {
            const text = store.getItem(BEFORE_KEY);
            if (text === null) return undefined;
            const { foreground } = JSON.parse(text);
            return typeof foreground === 'string' ? foreground : null;
        } catch {
            return undefined;
        }
    }

    return {
        /** his pick on the row: a `#rrggbb`, or `theme` for none of his own @param {string} fg */
        async change(fg) {
            const was = await setColour(() => (HEX.test(fg) ? fg : undefined));
            if (kept() !== undefined) return;
            try {
                store.setItem(BEFORE_KEY, JSON.stringify({ foreground: was }));
            } catch {
                // with nothing kept, Reset takes his colour out
            }
        },
        /** Reset: the colour from before his first change is back, and nothing is kept any more */
        async reset() {
            const before = kept();
            if (before === undefined) return;
            await setColour(() => before ?? undefined);
            try {
                store.removeItem(BEFORE_KEY);
            } catch {
                // a store that refuses keeps the old colour, still right for the next Reset
            }
        },
    };
}
