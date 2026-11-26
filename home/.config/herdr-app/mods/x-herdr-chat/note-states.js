// a note's states, and what each event makes of it: a note he writes on words he selected is a draft, then waits in the
// thread's join file, then a turn takes it and is done with it, or it goes at once as a prompt of its own. words he types
// past what a turn took are a new draft on the same words. nothing here reads a clock or a file; notes.js owns the notes
// and tells each what happened

import { gradeLine, noteLine, sentenceOf } from './note-text.js';
import { withoutPathLinks } from './path-links.js';

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
 * @property {{ id: string, kind: 'mine' | 'reply', at: string | null, head?: string }} row `id` its line's uuid, `head` its
 *   first words
 * @property {Part[]} parts in block order
 */
/** @typedef {'draft' | 'waiting' | 'taken' | 'joined' | 'sending' | 'sent'} NoteState `sending`: herdr has not answered yet */
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
 * @property {Grade | null} [grade] his thumb: the note is a grade, its words the why (FRM-630)
 * @property {boolean} [isWhole] the grade is of the whole message
 * @property {Said[]} said every line written for it, newest last, with the note in it
 * @property {boolean} isLogged its trial line is written
 * @property {boolean} [isGradeKept] a grade's raw line is in the grades file
 * @property {Said | null} [cutSend] a send a reload cut short: it may land still
 */
/** @typedef {'good' | 'bad'} Grade */
/** @typedef {{ line: string, text: string, grade?: Grade | null, isWhole?: boolean }} Said a line written, and the note it held */
/** @typedef {Pick<Said, 'text' | 'grade' | 'isWhole'>} Content what a line holds of the note */

/**
 * @typedef {(
 *   | { type: 'typed', text: string }
 *   | { type: 'queued', joinId: string, at: number, back: number }
 *   | ({ type: 'rewritten' } & Content)
 *   | { type: 'graded', grade: Grade }
 *   | { type: 'wholeSet', isWhole: boolean }
 *   | { type: 'takenBack', reason?: string }
 *   | { type: 'turnTook' }
 *   | { type: 'arrived', line?: string }
 *   | { type: 'pushed', at: number, back: number }
 *   | { type: 'landed' }
 *   | { type: 'sentFirst' }
 *   | { type: 'rowOut' }
 *   | { type: 'reloaded' }
 *   | { type: 'logged' }
 *   | { type: 'gradeKept' }
 * )} NoteEvent
 */

/** @param {Passage} passage @param {string} id @param {{ reason: string, text: string }} [past] @returns {Note} */
export const newNote = (passage, id, past) => ({
    back: 0,
    grade: null,
    id,
    isLogged: false,
    isWhole: false,
    joinId: null,
    passage,
    reason: past?.reason ?? null,
    said: [],
    state: 'draft',
    text: past?.text ?? '',
    writtenAt: 0,
});

/** a note with nothing to say: no words and no thumb @param {Note} note */
export const isEmpty = (note) => !note.text.trim() && !note.grade;

/** a note the thread has or is getting: it opens, and nothing in it changes @param {Note} note */
export const isLocked = (note) =>
    note.state !== 'draft' && note.state !== 'waiting';

/** it stands, or stood until a turn took it, in the thread's join file @param {Note} note */
export const isInFile = (note) =>
    note.state === 'waiting' || note.state === 'taken';

/** a note not yet on its way for good @param {Note} note */
export const isUnsent = (note) => !isLocked(note);

/** where it stands, in his words @param {Note} note */
export const stateWord = (note) =>
    note.state === 'taken' ? 'waiting' : note.state;

/** the line the thread gets of it @param {Note} note */
export const lineOf = (note) =>
    note.grade
        ? gradeLine({
              grade: note.grade,
              isWhole: Boolean(note.isWhole),
              parts: note.passage.parts.map((part) => part.words),
              row: note.passage.row,
              text: note.text,
          })
        : plainLine(note);

/** @param {Note} note */
const plainLine = (note) =>
    noteLine({
        back: note.back,
        parts: note.passage.parts.map((part) => part.words),
        row: note.passage.row,
        // words over two text views go as the quote of all of them: one sentence holds only the first
        sentence:
            note.passage.parts.length === 1 && note.passage.parts[0]
                ? sentenceOf(note.passage.parts[0])
                : null,
        text: note.text,
    });

const WORD_END = /[\p{L}\p{N}_]$/u;
const WORD_START = /^[\p{L}\p{N}_]/u;

/**
 * of what he typed, the words the thread has not got: those after its own, a word cut in two from its start, or all of
 * them when he changed some inside; '' when he only took words out
 * @param {string} got what the thread has @param {string} text
 */
export function pastText(got, text) {
    if (text.startsWith(got)) {
        const rest = text.slice(got.length);
        const isCut = WORD_END.test(got) && WORD_START.test(rest);
        const word = isCut ? (/\S+$/.exec(got)?.[0] ?? '') : '';
        return `${word}${rest}`.trimStart();
    }
    let head = 0;
    while (head < text.length && text[head] === got[head]) head += 1;
    let tail = 0;
    while (
        tail < text.length - head &&
        text.at(-1 - tail) === got.at(-1 - tail)
    )
        tail += 1;
    const isOnlyOut = text.length < got.length && head + tail === text.length;
    return isOnlyOut || !text.trim() ? '' : text;
}

/** @param {Note} note @returns {Content} */
export const contentOf = (note) => ({
    grade: note.grade ?? null,
    isWhole: Boolean(note.isWhole),
    text: note.text,
});

/** the note as a line held it; a line written before grades holds none @param {Content} said @returns {Content} */
const heldBy = (said) => ({
    grade: said.grade ?? null,
    isWhole: Boolean(said.isWhole),
    text: said.text,
});

/** @param {Content} a @param {Content} b */
const isSameContent = (a, b) =>
    a.text === b.text && a.grade === b.grade && a.isWhole === b.isWhole;

/** the note as its newest line held it @param {Note} note */
const lastHeld = (note) => {
    const said = note.said.at(-1);
    return said ? heldBy(said) : contentOf(note);
};

/** @param {Note} note @param {Content} [content] @returns {Note} the line it now says is kept beside the ones before */
const told = (note, content = contentOf(note)) => ({
    ...note,
    said: [...note.said, { ...content, line: lineOf({ ...note, ...content }) }],
});

/** its row does not carry these words or this grade @param {Note} note @param {Content} [content] */
export const isBehind = (note, content = contentOf(note)) =>
    note.said.at(-1)?.line !== lineOf({ ...note, ...content });

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
                      cutSend: note.said.at(-1) ?? note.cutSend ?? null,
                      joinId: event.joinId,
                      reason: null,
                      said: [],
                      state: 'waiting',
                      writtenAt: event.at,
                  })
                : note;
        case 'rewritten': {
            const content = heldBy(event);
            return note.state === 'waiting' && isBehind(note, content)
                ? told(note, content)
                : note;
        }
        // one thumb at a time: the lit one pressed again is none
        case 'graded':
            return isUnsent(note)
                ? {
                      ...note,
                      grade: note.grade === event.grade ? null : event.grade,
                  }
                : note;
        case 'wholeSet':
            return isUnsent(note) && Boolean(note.isWhole) !== event.isWhole
                ? { ...note, isWhole: event.isWhole }
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
                      ...lastHeld(note),
                      state: 'taken',
                  }
                : note;
        // the thread's own line wins: an edit that lost the race shows what the thread got
        case 'arrived': {
            if (note.state !== 'joined' && !isInFile(note)) return note;
            const got = note.said.find((s) => s.line === event.line);
            const content = got ? heldBy(got) : lastHeld(note);
            // its own line is the one it got: no later line of the same words is its
            const said = got ? [got] : note.said;
            return note.state === 'joined' &&
                note.said.length === said.length &&
                isSameContent(contentOf(note), content)
                ? note
                : { ...note, ...content, said, state: 'joined' };
        }
        // the send a reload cut short landed before its row joined: it went as that send, its row is yet to leave
        case 'sentFirst':
            return note.state === 'waiting' && note.cutSend
                ? {
                      ...note,
                      cutSend: null,
                      reason: null,
                      ...heldBy(note.cutSend),
                      said: [note.cutSend],
                      state: 'sent',
                  }
                : note;
        case 'pushed':
            return note.state === 'draft'
                ? told({
                      ...note,
                      back: event.back,
                      cutSend: null,
                      reason: null,
                      said: [],
                      state: 'sending',
                      writtenAt: event.at,
                  })
                : note;
        // herdr took the prompt, or its line is in the transcript; a reload may have made it his draft meanwhile
        case 'landed': {
            const isGone =
                note.state === 'sending' ||
                (note.state === 'draft' && note.said.length > 0);
            return isGone
                ? {
                      ...note,
                      ...lastHeld(note),
                      cutSend: null,
                      reason: null,
                      state: 'sent',
                  }
                : note;
        }
        case 'rowOut':
            return note.state === 'sent' ? { ...note, joinId: null } : note;
        case 'reloaded':
            return note.state === 'sending'
                ? {
                      ...note,
                      reason: 'The chat reloaded as it went: look before you send it again',
                      state: 'draft',
                  }
                : note;
        case 'logged':
            return note.isLogged ? note : { ...note, isLogged: true };
        case 'gradeKept':
            return note.isGradeKept ? note : { ...note, isGradeKept: true };
        default:
            return /** @type {never} */ (event);
    }
}

/** @typedef {Pick<Part, 'range' | 'source'>} Place */

/**
 * how far one text stands in the other: a row that grew holds the shorter at its start, one an older page joined at its
 * end; null with no such pair @param {Place} p @param {Place} q @param {boolean} isSameRow
 */
function movedBy(p, q, isSameRow) {
    if (isSameRow)
        return p.source.startsWith(q.source) || q.source.startsWith(p.source)
            ? 0
            : null;
    return q.source.endsWith(p.source) || p.source.endsWith(q.source)
        ? q.source.length - p.source.length
        : null;
}

/** two texts of one message share a character @param {Part} p @param {Part} q @param {boolean} isSameRow */
function isSharing(p, q, isSameRow) {
    // a path above the words may be a link in one of them
    for (const [a, b] of [
        [p, q],
        [
            withoutPathLinks(p.source, p.range),
            withoutPathLinks(q.source, q.range),
        ],
    ]) {
        const moved = a && b ? movedBy(a, b, isSameRow) : null;
        if (moved === null) continue;
        return a?.range && b?.range
            ? a.range.start + moved < b.range.end &&
                  b.range.start < a.range.end + moved
            : p.words === q.words;
    }
    return isSameRow && p.words === q.words;
}

/**
 * two passages share a character of one message; a row an older page joined has that page's text before its own
 * @param {Passage} a @param {Passage} b @param {(id: string) => string} [rowOf] the row that holds a message's line now
 */
export const isOverlapping = (a, b, rowOf = (id) => id) =>
    rowOf(a.row.id) === rowOf(b.row.id) &&
    a.parts.some((p) =>
        b.parts.some((q) => {
            const isSameRow = a.row.id === b.row.id;
            return (
                (!isSameRow || p.block === q.block) &&
                isSharing(p, q, isSameRow)
            );
        }),
    );
