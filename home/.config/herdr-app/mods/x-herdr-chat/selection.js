// the words he selected in each message drawn, as its text views report them; read only at a right press and at F6, so a
// report asks no redraw, which could drop a selection in progress. a text view that leaves the screen loses its selection
// and never says so: `keep` drops its words here. a left press anywhere clears herdr's selection, so an act takes the one
// that stood at its press, never what stands when the chat reads it

/**
 * one text view's share of the words he selected
 * @typedef {object} Reported
 * @property {{ x: number, y: number } | null} position where the selection ended, window px; a select-all gives none
 * @property {{ start: number, end: number } | null} range the characters of `source`, null with none
 * @property {string} source the markdown that text view drew
 * @property {string} words the words, as drawn
 */
/** @typedef {Reported & { block: number }} Part `block` its place in the message */
/** @typedef {{ passage: import('./note-states.js').Passage, at: { x: number, y: number } | null }} SelectedAt what a note is written on, and where it ended, in the list's px */
/** @typedef {{ key: string, stamp: string, parts: Part[], at: { x: number, y: number } | null }} Selected `at` where it ended */

// a stand older than this is no act's: an F6 read later than 2 s is dropped (shown.js)
const STANDS_KEPT_MS = 5000;

/** a cut row's halves, each a list item of its own @param {string} key */
const twinOf = (key) =>
    key.endsWith('#above')
        ? key.replace(/above$/, 'below')
        : key.endsWith('#below')
          ? key.replace(/below$/, 'above')
          : null;

/** @param {Map<number, Reported>} parts @returns {Part[]} */
const inOrder = (parts) =>
    [...parts]
        .sort(([a], [b]) => a - b)
        .map(([block, part]) => ({ ...part, block }));

/** the words as Copy gives them @param {readonly Reported[]} parts */
export const wordsOf = (parts) => parts.map((p) => p.words).join('\n\n');

/**
 * the passage a note is written on (FRM-585): words of a reply, or of his own message once it is the thread's
 * @param {import('./row-model.js').Row | undefined} row @param {readonly Part[] | null} parts
 * @returns {import('./note-states.js').Passage | null}
 */
export function passageOf(row, parts) {
    if (!row || row.isWaiting || !parts?.length) return null;
    const { at, id, kind } = row;
    if (kind !== 'mine' && kind !== 'reply') return null;
    return {
        parts: parts.map(({ block, range, source, words }) => ({
            block,
            range,
            source,
            words,
        })),
        row: { at, id, kind },
    };
}

export function createSelections() {
    /** by list item: the drawing it was reported from, and its words by text view @type {Map<string, { stamp: string, parts: Map<number, Reported> }>} */
    const items = new Map();
    /** what stood selected, from when to when, the last one open @type {{ from: number, to: number, selected: Selected | null }[]} */
    let stands = [];

    /** @param {Selected | null} selected @param {number} now */
    const stand = (selected, now) => {
        const last = stands.at(-1);
        if (last) last.to = now;
        stands = [
            ...stands.filter((s) => s.to > now - STANDS_KEPT_MS),
            { from: now, selected, to: Number.POSITIVE_INFINITY },
        ];
    };

    /** @param {string} key @param {string} stamp @param {number} blocks */
    const partsIn = (key, stamp, blocks) => {
        const item = items.get(key);
        if (item?.stamp !== stamp) return null;
        const parts = inOrder(item.parts).filter((p) => p.block < blocks);
        return parts.length ? parts : null;
    };

    /**
     * the words selected in a list item by text view, else in the other half of its message
     * @param {string} key @param {(key: string) => string} stampOf
     * @param {number} blocks how many text views its message draws: a fold leaves the rest out, and they never say so
     */
    function partsFor(key, stampOf, blocks) {
        const twin = twinOf(key);
        return (
            partsIn(key, stampOf(key), blocks) ??
            (twin ? partsIn(twin, stampOf(twin), blocks) : null)
        );
    }

    return {
        /**
         * what stood selected at a time, in the item that reported last: of two messages herdr says nothing of the first
         * once its row has gone
         * @param {number} at the press's time
         */
        current: (at) =>
            [...stands].reverse().find((s) => s.from <= at && at < s.to)
                ?.selected ?? null,
        /** @param {ReadonlySet<string>} keys the list items on screen @param {number} now */
        keep(keys, now) {
            for (const key of items.keys())
                if (!keys.has(key)) items.delete(key);
            const last = stands.at(-1)?.selected;
            if (last && !keys.has(last.key)) stand(null, now);
        },
        partsFor,
        /**
         * @param {string} key its list item @param {string} stamp the drawing the text view stands in: a new one holds no selection
         * @param {number} block its place in the message @param {Reported | null} part null: its selection is gone
         * @param {number} now
         */
        report(key, stamp, block, part, now) {
            let item = items.get(key);
            if (item?.stamp !== stamp) {
                item = { parts: new Map(), stamp };
                items.set(key, item);
            }
            if (part) item.parts.set(block, part);
            else item.parts.delete(block);
            const last = stands.at(-1)?.selected;
            if (!part && last?.key !== key) return;
            const parts = inOrder(item.parts);
            stand(
                parts.length
                    ? {
                          at: part ? part.position : (last?.at ?? null),
                          key,
                          parts,
                          stamp,
                      }
                    : null,
                now,
            );
        },
    };
}
