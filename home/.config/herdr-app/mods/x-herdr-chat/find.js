// find in the chat (FRM-638 slice 6): his query, the rows holding it and the one shown. one owner for that state; the
// view hands each query and key here and draws `state`.

import { drawnBlocks } from './drawn.js';

/** @typedef {import('./row-model.js').Row} Row */
/** @typedef {{ id: string, n: number }} Hit one match: its row, and its place among that row's matches */
/** @typedef {{ isOpen: boolean, q: string, hits: Hit[], at: number }} FindState hits newest row first, each row's in reading order */

// his query settles this long before the rows are searched: each search redraws the hit's place
export const FIND_SETTLE_MS = 150;

/** @typedef {{ text: string, at: number[] }} Read what he reads of a markdown source, and each char's offset in it */
/** @typedef {{ block: number, start: number, end: number, n: number }} FindRange one match in the row's `block`th source, `n` its place in the row */

// a char read as written: no mark rule below matches it, as none matches the chars of a code span
const LITERAL = String.fromCharCode(0xe000);

/** @type {Record<string, string>} */
const ENTITIES = {
    '#39': "'",
    amp: '&',
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"',
};

// a line that draws no words: a rule, a table's line under its head, a link's definition
const WORDLESS =
    /^\s{0,3}(?:([-*_])(?:[ \t]*\1){2,}[ \t]*|\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*|\|[ \t]*:?-+:?[ \t]*\|[ \t]*|\[[^\]]+\]:[ \t]+\S+.*)$/;

// a mark dropped, its words kept: how many chars of the match stand before them, and after
/** @type {[RegExp, (match: RegExpExecArray) => [number, number]][]} */
const MARKS = [
    [/^\s{0,3}>\s?/g, (m) => [m[0].length, 0]],
    [/^\s{0,3}#{1,6}\s+/g, (m) => [m[0].length, 0]],
    // raw html draws nothing; what stands between two tags does
    [
        /<!--.*?-->|<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/g,
        (m) => [m[0].length, 0],
    ],
    // a picture first, so one inside a link leaves its words there; brackets and parentheses nest once
    [
        /!\[([^[\]]*(?:\[[^[\]]*\][^[\]]*)*)\]\([^()]*(?:\([^()]*\)[^()]*)*\)/g,
        (m) => [2, m[0].length - 2 - (m[1] ?? '').length],
    ],
    [
        /\[([^[\]]*(?:\[[^[\]]*\][^[\]]*)*)\]\([^()]*(?:\([^()]*\)[^()]*)*\)/g,
        (m) => [1, m[0].length - 1 - (m[1] ?? '').length],
    ],
    [/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, () => [2, 2]],
    [/(?<![\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])/g, () => [2, 2]],
    [/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, () => [1, 1]],
    [/(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, () => [1, 1]],
    [/(?<!~)~~(?=[^\s~])(.+?)(?<=[^\s~])~~(?!~)/g, () => [2, 2]],
];

/** one line of prose, its marks dropped @param {string} line @param {number} from its offset in the source @returns {Read} */
function readLine(line, from) {
    // what the rules read, what he reads, and where each char stands
    let mask = '';
    let text = '';
    /** @type {number[]} */
    const at = [];
    const add = (
        /** @type {number} */ start,
        /** @type {number} */ end,
        isLiteral = true,
    ) => {
        for (let i = start; i < end; i++) {
            mask += isLiteral ? LITERAL : line[i];
            text += line[i];
            at.push(from + i);
        }
    };
    // an escaped char and a code span are read as written, an entity as its char; a `\` that ends the line breaks it
    let done = 0;
    for (const m of line.matchAll(
        /\\([!-/:-@[-`{-~])|(?<!(?<!\\)`)(`+)(?!`)(.+?)(?<!`)\2(?!`)|\\$|&(amp|lt|gt|quot|nbsp|#39);/g,
    )) {
        add(done, m.index, false);
        done = m.index + m[0].length;
        if (m[1]) add(done - 1, done);
        else if (m[2]) add(m.index + m[2].length, done - m[2].length);
        else if (m[4]) {
            mask += LITERAL;
            text += ENTITIES[m[4]] ?? '';
            at.push(from + m.index);
        }
    }
    add(done, line.length, false);
    for (const [rule, cut] of MARKS) {
        const matches = [...mask.matchAll(rule)].reverse();
        for (const m of matches) {
            const [before, after] = cut(m);
            const end = m.index + m[0].length;
            for (const [a, b] of [
                [end - after, end],
                [m.index, m.index + before],
            ]) {
                mask = mask.slice(0, a) + mask.slice(b);
                text = text.slice(0, a) + text.slice(b);
                at.splice(
                    /** @type {number} */ (a),
                    /** @type {number} */ (b) - /** @type {number} */ (a),
                );
            }
        }
    }
    return { at, text };
}

/**
 * a drawn markdown source as he reads it: its marks dropped, so a match hidden in a link address is no hit (dima's o14);
 * code is read as written
 * @param {string} source
 * @param {(line: string) => boolean} [mayHold] a prose line it refuses is left out unread
 * @returns {Read[]} line by line
 */
export function readOf(source, mayHold = () => true) {
    /** @type {Read[]} */
    const lines = [];
    /** @type {string | null} the fence that opened the code around this line */
    let fence = null;
    let from = 0;
    for (const line of source.split('\n')) {
        const mark = /^\s*(`{3,}(?=[^`]*$)|~{3,})(.*)$/.exec(line);
        const isEnd =
            fence && !mark?.[2]?.trim() && mark?.[1]?.startsWith(fence);
        if (isEnd) fence = null;
        else if (mark && !fence) fence = mark[1] ?? null;
        else if (fence) {
            const start = from;
            lines.push({
                at: Array.from(line.split(''), (_c, k) => start + k),
                text: line,
            });
        } else if (!WORDLESS.test(line) && mayHold(line))
            lines.push(readLine(line, from));
        from += line.length + 1;
    }
    return lines;
}

/** @param {string} words */
const anyCase = (words) =>
    new RegExp(words.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&'), 'giu');

/** a line as written with no mark in it, as the cheap look below compares it @param {string} words */
const bare = (words) => words.replace(/[\\`*_]/g, '');

/**
 * his query as a search, any case: the words, and which prose lines may hold them, told cheaply from the line as written,
 * since reading the marks of every line at each key he types costs. a link, a tag, an entity or a struck word is
 * always read. null for an empty query
 * @param {string} q
 */
function searchOf(q) {
    const words = q.trim();
    if (!words) return null;
    const about = bare(words) ? anyCase(bare(words)) : null;
    return {
        mayHold: (/** @type {string} */ line) =>
            !about ||
            /\]\(|[<&]|~~/.test(line) ||
            bare(line).search(about) >= 0,
        needle: anyCase(words),
    };
}

/** @param {string[]} blocks @param {NonNullable<ReturnType<typeof searchOf>>} search */
function rangesIn(blocks, { mayHold, needle }) {
    /** @type {FindRange[]} */
    const ranges = [];
    blocks.forEach((source, block) => {
        for (const { at, text } of readOf(source, mayHold))
            for (const m of text.matchAll(needle)) {
                const start = at[m.index] ?? 0;
                const last = at[m.index + m[0].length - 1] ?? start;
                ranges.push({ block, end: last + 1, n: ranges.length, start });
            }
    });
    return ranges;
}

/**
 * every match in a row's drawn markdown, in reading order; a match stays inside one line of one block
 * @param {Row} row @param {string} q @returns {FindRange[]}
 */
export function findRanges(row, q) {
    const search = searchOf(q);
    return search ? rangesIn(drawnBlocks(row), search) : [];
}

/**
 * every match of `q`, any case: the newest row first, a row's matches in reading order; none for an empty query. a row
 * drawn as plain labels (a tool line, a file) is searched as it stands
 * @param {readonly Row[]} rows @param {string} q @returns {Hit[]}
 */
export function hitsOf(rows, q) {
    const search = searchOf(q);
    if (!search) return [];
    return [...rows].reverse().flatMap((row) => {
        const blocks = drawnBlocks(row);
        const matches = blocks.length
            ? rangesIn(blocks, search)
            : [...row.text.matchAll(search.needle)];
        return matches.map((_match, n) => ({ id: row.id, n }));
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
    // a row's ranges, placed once per version: the list draws its rows on every frame of a scroll
    /** @type {Map<string, { q: string, ranges: FindRange[], version: number }>} */
    const placed = new Map();
    return {
        close() {
            placed.clear();
            state = { at: 0, hits: [], isOpen: false, q: '' };
        },
        /** the hit shown now */
        current: () => state.hits[state.at]?.id ?? null,
        /** the hit shown now, its row and its place in it */
        currentHit: () => state.hits[state.at] ?? null,
        open() {
            state = { ...state, isOpen: true };
        },
        /** where the query stands in the row's drawn markdown @param {Row} row */
        rangesOf(row) {
            const kept = placed.get(row.id);
            if (kept?.q === state.q && kept.version === row.version)
                return kept.ranges;
            const ranges = findRanges(row, state.q);
            placed.set(row.id, { q: state.q, ranges, version: row.version });
            return ranges;
        },
        /**
         * the rows changed (a page landed, a reply grew, a transcript was replaced): the same query over them, the stepped hit kept
         * @param {readonly Row[]} rows
         * @param {{ from: string, to: string } | null} [joined] the page's last reply joined row `from` above, as `to`
         */
        recount(rows, joined = null) {
            placed.clear();
            const was = state.hits[state.at];
            const hits = hitsOf(rows, state.q);
            /** @param {Hit[]} list @param {string} id */
            const count = (list, id) => list.filter((h) => h.id === id).length;
            const kept =
                was && joined && was.id === joined.from
                    ? {
                          id: joined.to,
                          n:
                              was.n +
                              count(hits, joined.to) -
                              count(state.hits, joined.from),
                      }
                    : was;
            const at = kept
                ? hits.findIndex((h) => h.id === kept.id && h.n === kept.n)
                : -1;
            // a stepped match whose row took another id (a waiting message, taken) keeps its place in the count
            const stay = Math.max(0, Math.min(state.at, hits.length - 1));
            state = { ...state, at: at < 0 ? stay : at, hits };
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
