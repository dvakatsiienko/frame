// one quiet row under a message for each note the thread has: the list's item click opens the note (a press handler in a
// list row blanks the list, herdr-app#894). a note still his, a draft or waiting for a turn, draws none: its words are
// highlighted and a click on them opens it (dima, 26 Nov 15:37, FRM-585:W73: «i do not need this»)

import { stateWord } from './note-states.js';

/** @typedef {import('./note-states.js').Note} Note */
/** @typedef {import('./row-model.js').Row} Row */

const NOTE_ROW = /#note-(.+)$/;

/** the thread has it, or herdr is sending it @param {Note} note */
const isOnItsWay = (note) =>
    note.state === 'joined' ||
    note.state === 'sending' ||
    note.state === 'sent';

/** the note a row stands for, null for any other @param {string} id */
export const noteIdOf = (id) => NOTE_ROW.exec(id)?.[1] ?? null;

/**
 * the rows of a message's notes the thread has or is getting, in the order he made them; one still his keeps its row
 * while its words show no mark, its only door (the 🔎's round 1 on 574c7f3c)
 * @param {Row} row @param {readonly Note[]} notes @param {(note: Note) => boolean} [isMarked] its words are painted
 * @returns {Row[]}
 */
export const noteRows = (row, notes, isMarked = () => true) =>
    notes
        .filter(
            (note) => (isOnItsWay(note) || !isMarked(note)) && note.text.trim(),
        )
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
