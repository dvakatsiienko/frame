// find in the chat (FRM-638 slice 6): his query, the rows holding it and the one shown. one owner for that state; the
// view hands each query and key here and draws `state`.

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {{ id: string, n: number }} Hit one match: its row, and its place among that row's matches */
/** @typedef {{ isOpen: boolean, q: string, hits: Hit[], at: number }} FindState hits newest row first, each row's in reading order */

// his query settles this long before the rows are searched: each search redraws the hit's place
export const FIND_SETTLE_MS = 150;

/**
 * a message as he reads it once drawn: markdown's marks dropped, so the stepped row's plain words read clean and a
 * match hidden in a link address is no hit (dima's o14)
 * @param {string} text
 */
export function plainOf(text) {
    return text
        .split('\n')
        .filter((line) => !/^\s*(```|~~~)/.test(line))
        .map((line) => {
            // code is read as written: its spans step aside while the marks around them drop
            /** @type {string[]} */
            const codes = [];
            const marked = line
                .replace(/^\s{0,3}>\s?/, '')
                .replace(/^\s{0,3}#{1,6}\s+/, '')
                .replace(/(`+)([^`]*?)\1/g, (_all, _ticks, code) => {
                    codes.push(code);
                    return `\uE000${codes.length - 1}\uE000`;
                })
                .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '$1')
                .replace(/(^|[^\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])/g, '$1$2')
                .replace(/(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1$2')
                .replace(/(^|[^\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, '$1$2');
            return marked.replace(
                /\uE000(\d+)\uE000/g,
                (_all, n) => codes[Number(n)] ?? '',
            );
        })
        .join('\n');
}

/**
 * every match of `q`, any case: the newest row first, a row's matches in reading order; none for an empty query
 * @param {readonly Row[]} rows @param {string} q @returns {Hit[]}
 */
export function hitsOf(rows, q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return [...rows].reverse().flatMap((r) => {
        const text = plainOf(r.text).toLowerCase();
        /** @type {Hit[]} */
        const hits = [];
        for (
            let at = text.indexOf(needle);
            at >= 0;
            at = text.indexOf(needle, at + needle.length)
        )
            hits.push({ id: r.id, n: hits.length });
        return hits;
    });
}

/**
 * a matched message, its marks dropped, cut into plain words and its matches, line by line, for the word marks probe (dima, 17:46): each
 * match carries its place among the message's matches
 * @param {string} text @param {string} q
 * @returns {{ text: string, match: number | null }[][]}
 */
export function findSpans(text, q) {
    const needle = q.trim().toLowerCase();
    let n = 0;
    return plainOf(text)
        .split('\n')
        .map((line) => {
            /** @type {{ text: string, match: number | null }[]} */
            const spans = [];
            const lower = line.toLowerCase();
            let from = 0;
            for (
                let at = needle ? lower.indexOf(needle) : -1;
                at >= 0;
                at = lower.indexOf(needle, from)
            ) {
                if (at > from)
                    spans.push({ match: null, text: line.slice(from, at) });
                spans.push({
                    match: n++,
                    text: line.slice(at, at + needle.length),
                });
                from = at + needle.length;
            }
            if (from < line.length || !spans.length)
                spans.push({ match: null, text: line.slice(from) });
            return spans;
        });
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
        current: () => state.hits[state.at]?.id ?? null,
        /** the hit shown now, its row and its place in it */
        currentHit: () => state.hits[state.at] ?? null,
        open() {
            state = { ...state, isOpen: true };
        },
        /** a page landed: the same query over the rows now loaded, the stepped hit kept @param {readonly Row[]} rows */
        recount(rows) {
            const was = state.hits[state.at];
            const hits = hitsOf(rows, state.q);
            const at = was
                ? hits.findIndex((h) => h.id === was.id && h.n === was.n)
                : -1;
            state = { ...state, at: Math.max(0, at), hits };
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
            return state.hits[at]?.id ?? null;
        },
    };
}
