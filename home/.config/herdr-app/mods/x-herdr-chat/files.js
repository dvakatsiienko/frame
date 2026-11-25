// the files a reply names, each to open in one click from a row under it (FRM-587)

import { fileLinks, isPicture } from './file-links.js';

/** @typedef {import('./row-model.js').Row} Row */

/** the files his message sent, a row of their own under it @param {string} id */
export const isSentRow = (id) => id.endsWith(SENT_ROW);
const SENT_ROW = '#sent';

/** the × under a message still in Claude Code's queue, its own row so the list's item click takes it back @param {string} id */
export const isUnsendRow = (id) => id.endsWith(UNSEND_ROW);
const UNSEND_ROW = '#unsend';

/**
 * his message's pictures and files as their own row, so a click on them opens the viewer and a click on his words
 * selects them; it carries his delivery line, drawn under the squares
 * @param {Row} row @param {Map<string, { version: number, files: Row[] }>} cache @returns {Row}
 */
function sentRow(row, cache) {
    const id = `${row.id}${SENT_ROW}`;
    const had = cache.get(id);
    const [kept] = had?.version === row.version ? had.files : [];
    if (kept) return kept;
    /** @type {Row} */
    const made = {
        ...row,
        id,
        kind: 'file',
        text: '',
        tools: [],
    };
    cache.set(id, { files: [made], version: row.version });
    return made;
}

/** a waiting message's × row, kept while its row's version holds @param {Row} row @param {Map<string, { version: number, files: Row[] }>} cache @returns {Row} */
function unsendRow(row, cache) {
    const id = `${row.id}${UNSEND_ROW}`;
    const had = cache.get(id);
    const [kept] = had?.version === row.version ? had.files : [];
    if (kept) return kept;
    /** @type {Row} */
    const made = {
        ...row,
        files: [],
        id,
        kind: 'file',
        pictures: [],
        text: '',
        tools: [],
    };
    cache.set(id, { files: [made], version: row.version });
    return made;
}

/**
 * the rows with each reply's files after it, one row a file: a click inside a list row blanks the list
 * (herdr-app#894), so a file is its own item and the list's item click opens it. a file row keeps its object while
 * its reply's version holds, so its measured height is kept
 * @param {readonly Row[]} rows
 * @param {string} home his home, for a `~` path
 * @param {Map<string, { version: number, files: Row[] }>} cache the file rows made so far, by reply
 * @returns {Row[]}
 */
export function withFileRows(rows, home, cache) {
    /** @type {Row[]} */
    const out = [];
    for (const row of rows) {
        out.push(row);
        if (row.kind === 'mine') {
            if (row.pictures.length || row.files.length)
                out.push(sentRow(row, cache));
            if (row.isWaiting) out.push(unsendRow(row, cache));
            continue;
        }
        if (row.kind !== 'reply') continue;
        let had = cache.get(row.id);
        if (had?.version !== row.version) {
            const links = fileLinks(row.text, home).map((file, i) => ({
                ...file,
                id: `${row.id}#file-${i}`,
            }));
            const pictures = links.filter((f) => isPicture(f.path));
            /** @param {string} id @param {string} text @param {string | null} path @returns {Row} */
            const fileRow = (id, text, path) => ({
                at: row.at,
                delivery: null,
                files: [],
                id,
                isTurnStart: false,
                isWaiting: false,
                kind: 'file',
                ...(path ? { path } : {}),
                pictures: path
                    ? []
                    : pictures.map((f) => ({
                          data: null,
                          id: f.id,
                          media: null,
                          path: f.path,
                      })),
                replyId: null,
                text,
                tools: [],
                version: row.version,
            });
            // a reply's pictures draw together as squares under it, the way his own do; any other file is its own row
            had = {
                files: [
                    ...(pictures.length
                        ? [
                              fileRow(
                                  `${row.id}#pictures`,
                                  pictures.map((f) => f.label).join(', '),
                                  null,
                              ),
                          ]
                        : []),
                    ...links
                        .filter((f) => !isPicture(f.path))
                        .map((f) => fileRow(f.id, f.label, f.path)),
                ],
                version: row.version,
            };
            cache.set(row.id, had);
        }
        out.push(...had.files);
    }
    return out;
}

/**
 * the file a list click names, by the key the list reported: a cut half's key carries a suffix
 * @param {readonly Row[]} rows @param {string} key
 * @returns {string | null}
 */
export function fileAt(rows, key) {
    const id = key.replace(/#(?:above|below)$/, '');
    const row = rows.find((r) => r.id === id);
    return row?.kind === 'file' ? (row.path ?? null) : null;
}

/** the row a saved reading place names: a file row's or a tool call's place is found through its own row @param {string} id */
export const replyIdOf = (id) => id.replace(/#(?:file|call)-\d+$/, '');
