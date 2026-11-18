// find in the chat (FRM-638 slice 6): his query, the rows holding it and the one shown. one owner for that state; the
// view hands each query and key here and draws `state`.

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {{ isOpen: boolean, q: string, hits: string[], at: number }} FindState hits by row id, newest first */

// his query settles this long before the rows are searched: each search redraws the hit's place
export const FIND_SETTLE_MS = 150;

/** the rows holding `q`, any case, newest first; none for an empty query @param {readonly Row[]} rows @param {string} q */
export function hitsOf(rows, q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return rows
        .filter((r) => r.text.toLowerCase().includes(needle))
        .map((r) => r.id)
        .reverse();
}

/** «2 / 5», «no match» or nothing before a query @param {FindState} state */
export function findCount(state) {
    if (!state.q.trim()) return '';
    return state.hits.length
        ? `${state.at + 1} / ${state.hits.length}`
        : 'No match';
}

export function createFind() {
    /** @type {FindState} */
    let state = { at: 0, hits: [], isOpen: false, q: '' };
    return {
        close() {
            state = { at: 0, hits: [], isOpen: false, q: '' };
        },
        /** the hit shown now */
        current: () => state.hits[state.at] ?? null,
        open() {
            state = { ...state, isOpen: true };
        },
        /** his settled query over the rows: the newest hit is shown @param {readonly Row[]} rows @param {string} q */
        search(rows, q) {
            state = { ...state, at: 0, hits: hitsOf(rows, q), q };
        },
        get state() {
            return state;
        },
        /**
         * Enter goes to the next older hit, ⇧Enter to the newer, wrapping
         * @param {'older' | 'newer'} way @returns {string | null} the row to show
         */
        step(way) {
            const n = state.hits.length;
            if (!n) return null;
            const at = (state.at + (way === 'older' ? 1 : n - 1)) % n;
            state = { ...state, at };
            return state.hits[at] ?? null;
        },
    };
}
