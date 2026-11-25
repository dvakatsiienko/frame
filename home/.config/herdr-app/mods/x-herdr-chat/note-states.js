// a note's states, and what each event makes of it: a note he writes on words he selected is a draft, then waits in the
// thread's join file, then a turn takes it and is done with it, or it goes at once as a prompt of its own. nothing here
// reads a clock or a file; notes.js owns the notes and tells each what happened

import { noteLine } from './note-text.js';

/**
 * one text view's share of the words he selected
 * @typedef {object} Part
 * @property {number} block its text view's place in the message
 * @property {{ start: number, end: number } | null} range the characters herdr reported, null with none
 * @property {string} source the markdown that text view drew
 * @property {string} words the words, as drawn
 */
/**
 * the words he selected, and the message they stand in
 * @typedef {object} Passage
 * @property {{ id: string, kind: 'mine' | 'reply', at: string | null }} row `id` its line's uuid
 * @property {Part[]} parts in block order
 */
/** @typedef {'draft' | 'waiting' | 'taken' | 'joined' | 'sent'} NoteState */
/**
 * @typedef {object} Note
 * @property {string} id
 * @property {Passage} passage
 * @property {string} text his note as he last typed it, the thread's once it has it
 * @property {NoteState} state
 * @property {string | null} reason a draft's: why it came back
 * @property {number} back the replies below the message when it was joined or sent
 * @property {string | null} joinId its row in the join file
 * @property {number} writtenAt when that row was written, or the prompt sent
 * @property {{ line: string, text: string }[]} said every line written for it, newest last, with the note in it
 * @property {boolean} isLogged its trial line is written
 */

/**
 * @typedef {(
 *   | { type: 'typed', text: string }
 *   | { type: 'queued', joinId: string, at: number, back: number }
 *   | { type: 'rewritten', text: string }
 *   | { type: 'takenBack', reason?: string }
 *   | { type: 'turnTook' }
 *   | { type: 'arrived', line?: string }
 *   | { type: 'pushed', at: number, back: number }
 *   | { type: 'logged' }
 * )} NoteEvent
 */

/** @param {Passage} passage @param {string} id @returns {Note} */
export const newNote = (passage, id) => ({
    back: 0,
    id,
    isLogged: false,
    joinId: null,
    passage,
    reason: null,
    said: [],
    state: 'draft',
    text: '',
    writtenAt: 0,
});

/** a note the thread has or is getting: it opens, and nothing in it changes @param {Note} note */
export const isLocked = (note) =>
    note.state === 'taken' || note.state === 'joined' || note.state === 'sent';

/** a note not yet on its way for good @param {Note} note */
export const isUnsent = (note) => !isLocked(note);

/** the line the thread gets of it @param {Note} note */
export const lineOf = (note) =>
    noteLine({
        back: note.back,
        parts: note.passage.parts.map((part) => part.words),
        row: note.passage.row,
        text: note.text,
    });

/** @param {Note} note @returns {Note} the line it now says is kept beside the ones before */
const told = (note, text = note.text) => ({
    ...note,
    said: [...note.said, { line: lineOf({ ...note, text }), text }],
});

/** its row does not carry these words @param {Note} note */
export const isBehind = (note, text = note.text) =>
    note.said.at(-1)?.text !== text;

/**
 * @param {Note} note @param {NoteEvent} event
 * @returns {Note} the same object when the event changes nothing
 */
export function nextNote(note, event) {
    switch (event.type) {
        case 'typed':
            return isUnsent(note) && note.text !== event.text
                ? { ...note, reason: null, text: event.text }
                : note;
        case 'queued':
            return note.state === 'draft'
                ? told({
                      ...note,
                      back: event.back,
                      joinId: event.joinId,
                      reason: null,
                      state: 'waiting',
                      writtenAt: event.at,
                  })
                : note;
        case 'rewritten':
            return note.state === 'waiting' && isBehind(note, event.text)
                ? told(note, event.text)
                : note;
        // off the join file, never taken, or a send that did not go: his words are his again
        case 'takenBack':
            return note.state === 'draft' || note.state === 'joined'
                ? note
                : {
                      ...note,
                      joinId: null,
                      reason: event.reason ?? null,
                      said: [],
                      state: 'draft',
                      writtenAt: 0,
                  };
        // what he typed and the row never carried is not the thread's
        case 'turnTook':
            return note.state === 'waiting'
                ? {
                      ...note,
                      state: 'taken',
                      text: note.said.at(-1)?.text ?? note.text,
                  }
                : note;
        // the thread's own line wins: an edit that lost the race shows what the thread got
        case 'arrived': {
            if (note.state === 'draft' || note.state === 'sent') return note;
            const got = note.said.find((s) => s.line === event.line);
            const text = (got ?? note.said.at(-1))?.text ?? note.text;
            return note.state === 'joined' && note.text === text
                ? note
                : { ...note, state: 'joined', text };
        }
        case 'pushed':
            return note.state === 'draft'
                ? told({
                      ...note,
                      back: event.back,
                      reason: null,
                      state: 'sent',
                      writtenAt: event.at,
                  })
                : note;
        case 'logged':
            return note.isLogged ? note : { ...note, isLogged: true };
        default:
            return /** @type {never} */ (event);
    }
}

/** how far one text stands in the other that ends with it, null with no such pair @param {Part} p @param {Part} q */
const movedBy = (p, q) =>
    q.source.endsWith(p.source) || p.source.endsWith(q.source)
        ? q.source.length - p.source.length
        : null;

/**
 * two passages share a character of one message; a row an older page joined has that page's text before its own
 * @param {Passage} a @param {Passage} b @param {(id: string) => string} [rowOf] the row that holds a message's line now
 */
export const isOverlapping = (a, b, rowOf = (id) => id) =>
    rowOf(a.row.id) === rowOf(b.row.id) &&
    a.parts.some((p) =>
        b.parts.some((q) => {
            const isSameRow = a.row.id === b.row.id;
            const moved = isSameRow ? 0 : movedBy(p, q);
            if (moved === null || (isSameRow && p.block !== q.block))
                return false;
            return p.range && q.range
                ? p.range.start + moved < q.range.end &&
                      q.range.start < p.range.end + moved
                : p.words === q.words;
        }),
    );
