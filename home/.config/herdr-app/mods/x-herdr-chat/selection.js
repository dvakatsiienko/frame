// the words he selected in each message drawn, as its text views report them; read only at a right press, so a report
// asks no redraw, which could drop a selection in progress. a text view that leaves the screen loses its selection and
// never says so: `keep` drops its words here

/** a cut row's halves, each a list item of its own @param {string} key */
const twinOf = (key) =>
    key.endsWith('#above')
        ? key.replace(/above$/, 'below')
        : key.endsWith('#below')
          ? key.replace(/below$/, 'above')
          : null;

export function createSelections() {
    /** by list item: the drawing it was reported from, and its words by text view @type {Map<string, { stamp: string, parts: Map<number, string> }>} */
    const items = new Map();

    /** @param {string} key @param {string} stamp @param {number} blocks */
    const wordsOf = (key, stamp, blocks) => {
        const item = items.get(key);
        if (item?.stamp !== stamp) return null;
        return (
            [...item.parts]
                .filter(([block]) => block < blocks)
                .sort(([a], [b]) => a - b)
                .map(([, words]) => words)
                .join('\n\n') || null
        );
    };

    return {
        clear() {
            items.clear();
        },
        /** @param {ReadonlySet<string>} keys the list items on screen */
        keep(keys) {
            for (const key of items.keys())
                if (!keys.has(key)) items.delete(key);
        },
        /**
         * @param {string} key its list item @param {string} stamp the drawing the text view stands in: a new one holds no selection
         * @param {number} block its place in the message @param {string | null} words null: its selection is gone
         */
        report(key, stamp, block, words) {
            let item = items.get(key);
            if (item?.stamp !== stamp) {
                item = { parts: new Map(), stamp };
                items.set(key, item);
            }
            if (words) item.parts.set(block, words);
            else item.parts.delete(block);
        },
        /**
         * the words selected in a list item, else in the other half of its message
         * @param {string} key @param {(key: string) => string} stampOf
         * @param {number} blocks how many text views its message draws: a fold leaves the rest out, and they never say so
         */
        textFor(key, stampOf, blocks) {
            const twin = twinOf(key);
            return (
                wordsOf(key, stampOf(key), blocks) ??
                (twin && wordsOf(twin, stampOf(twin), blocks))
            );
        },
    };
}
