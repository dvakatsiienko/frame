// the raw line of each reply-grade (FRM-630): one a graded note, written once the thread has it, for clio to fold into
// the comms log. it holds the words he graded, so it lives outside the shelf: frame is public

import { sidOf } from './thread.js';

export const GRADES_DIR = '.local/state/x/herdr-notes';
export const GRADES_FILE = 'grades.jsonl';

/**
 * @typedef {object} GradeLine
 * @property {string} id the note's
 * @property {string} at when the thread had it
 * @property {string} sid the thread's session
 * @property {string} messageId the graded message's uuid in the transcript
 * @property {import('./note-states.js').Grade} grade
 * @property {boolean} whole the grade is of the whole message: clio reads its text by `messageId`
 * @property {string} passage the words he selected, one text view's share a part
 * @property {string} why his words, '' for none
 */

/** a graded note's line; null for a plain one @param {import('./note-states.js').Note} note @param {string} thread @param {string} at @returns {GradeLine | null} */
export const gradeOf = (note, thread, at) =>
    note.grade
        ? {
              at,
              grade: note.grade,
              id: note.id,
              messageId: note.passage.row.id,
              passage: note.passage.parts.map((p) => p.words).join(' … '),
              sid: sidOf(thread),
              whole: Boolean(note.isWhole),
              why: note.text.trim(),
          }
        : null;

/** the file with the line in, over any of the same id: a grade is in it once @param {string | null} was @param {GradeLine} line */
export function withGrade(was, line) {
    const kept = (was ?? '').split('\n').filter((row) => {
        try {
            return row.trim() && JSON.parse(row).id !== line.id;
        } catch {
            // a row he or another tool broke stays as it was
            return Boolean(row.trim());
        }
    });
    return `${[...kept, JSON.stringify(line)].join('\n')}\n`;
}
