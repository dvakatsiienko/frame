// one quiet row under a message for each note he wrote on it: the list's item click opens the note (a press handler in a
// list row blanks the list, herdr-app#894)

import { stateWord } from './note-states.js';

/** @typedef {import('./note-states.js').Note} Note */
/** @typedef {import('./row-model.js').Row} Row */

const NOTE_ROW = /#note-(.+)$/;

/** the note a row stands for, null for any other @param {string} id */
export const noteIdOf = (id) => NOTE_ROW.exec(id)?.[1] ?? null;

/**
 * the rows of a message's notes, in the order he made them; one he has not typed yet has none
 * @param {Row} row @param {readonly Note[]} notes @returns {Row[]}
 */
export const noteRows = (row, notes) =>
    notes
        .filter((note) => note.text.trim())
        .map((note) => ({
            at: row.at,
            delivery: null,
            files: [],
            id: `${row.id}#note-${note.id}`,
            isTurnStart: false,
            isWaiting: false,
            kind: 'note',
            note: { isMine: row.kind === 'mine', word: stateWord(note) },
            pictures: [],
            replyId: null,
            text: note.text.replace(/\s+/g, ' ').trim(),
            tools: [],
            // one line, whatever it says: its height is its first
            version: 1,
        }));

/** how many note rows stand before a row, -1 when it is not there @param {readonly Row[]} rows @param {string} id */
export function notesBefore(rows, id) {
    const at = rows.findIndex((row) => row.id === id);
    return at < 0
        ? -1
        : rows.slice(0, at).filter((row) => row.kind === 'note').length;
}

/**
 * his notes by the row they stand on now, kept while neither they nor the rows change: every row of every draw asks
 * @param {(id: string) => string} rowOf the row that holds a message's line now
 */
export function createNotesByRow(rowOf) {
    const had = {
        first: /** @type {string | undefined} */ (undefined),
        length: 0,
        notes: /** @type {readonly Note[]} */ ([]),
    };
    /** @type {Map<string, Note[]>} */
    const under = new Map();
    /** @param {string} id @param {readonly Note[]} notes @param {readonly Pick<Row, 'id'>[]} rows */
    return (id, notes, rows) => {
        const first = rows[0]?.id;
        if (
            notes !== had.notes ||
            rows.length !== had.length ||
            first !== had.first
        ) {
            Object.assign(had, { first, length: rows.length, notes });
            under.clear();
            for (const note of notes) {
                const row = rowOf(note.passage.row.id);
                under.set(row, [...(under.get(row) ?? []), note]);
            }
        }
        return under.get(id) ?? [];
    };
}
