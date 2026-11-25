// the notes he writes on words he selected, the one owner of them: each thread's kept in the mod's store, its rows in the
// thread's join file written, rewritten and taken back here. it holds no herdr call: the view hands it the doors and
// tells it what the thread's state and transcript say

import {
    appendJoin,
    joinStatus,
    joinedTexts,
    pushReason,
    retextJoin,
    takeBackJoin,
} from './joins.js';
import {
    isLocked,
    isOverlapping,
    isUnsent,
    lineOf,
    newNote,
    nextNote,
} from './note-states.js';
import { quoteOf, shortId } from './note-text.js';
import { joinedWords } from './row-model.js';
import { sidOf } from './thread.js';

/** @typedef {import('./note-states.js').Note} Note */
/** @typedef {import('./note-states.js').NoteEvent} NoteEvent */
/** @typedef {import('./note-states.js').Passage} Passage */
/** @typedef {import('./magic.js').Joins} Joins what the thread's state lists of its joins */

export const NOTES = 'notes:';
export const JOINS_OFF = 'Joins are off for this thread: ⌘Enter sends it now';

/** what the thread's row of a line holds; the reader takes the stash's «»\n«» between two for the next one's start @param {string} line */
const drawnOf = (line) => joinedWords(line.split('»\n«')[0] ?? '');

/**
 * @param {object} doors
 * @param {import('./joins.js').JoinIo} doors.io
 * @param {string} doors.dir the join files' folder
 * @param {{ getItem: (key: string) => string | null, setItem: (key: string, text: string) => void, removeItem: (key: string) => void }} doors.store
 * @param {() => string} doors.newId
 * @param {(thread: string, words: string) => Promise<string[]>} doors.linesWith the lines of a transcript that hold the words
 * @param {(line: string) => void} doors.logTrial one line of the trial's record
 */
export function createNotes({ io, dir, store, newId, linesWith, logTrial }) {
    /** @type {Map<string, Note[]>} */
    const threads = new Map();
    /** each note's file work under way: the next waits for it, so a take back never runs before its append @type {Map<string, Promise<unknown>>} */
    const work = new Map();
    /** notes looked for in their transcript now @type {Set<string>} */
    const searched = new Set();

    /** @param {string} thread */
    function notesOf(thread) {
        const had = threads.get(thread);
        if (had) return had;
        /** @type {Note[]} */
        let read = [];
        try {
            const kept = JSON.parse(store.getItem(NOTES + thread) ?? '[]');
            if (Array.isArray(kept)) read = kept;
        } catch {
            // a store that cannot be read shows none; the next note he keeps writes it anew
        }
        threads.set(thread, read);
        return read;
    }

    /** @param {string} thread @param {Note[]} notes */
    function keep(thread, notes) {
        threads.set(thread, notes);
        // an empty draft is drawn while its box is open, and leaves no record
        const kept = notes.filter((n) => n.state !== 'draft' || n.text.trim());
        try {
            if (kept.length)
                store.setItem(NOTES + thread, JSON.stringify(kept));
            else store.removeItem(NOTES + thread);
        } catch {
            // a store that refuses loses the note across a reload, never now
        }
    }

    /** @param {string} thread @param {string} id */
    const find = (thread, id) =>
        notesOf(thread).find((note) => note.id === id) ?? null;

    /** @param {string} thread @param {string} id @param {NoteEvent} event @returns {boolean} whether the note changed */
    function tell(thread, id, event) {
        const note = find(thread, id);
        if (!note) return false;
        const now = nextNote(note, event);
        if (now === note) return false;
        keep(
            thread,
            notesOf(thread).map((n) => (n.id === id ? now : n)),
        );
        return true;
    }

    /** @param {string} thread */
    const fileOf = (thread) => `${dir}/${sidOf(thread)}.jsonl`;

    /** a note's file work, after what it has under way @template T @param {string} id @param {() => Promise<T>} run @returns {Promise<T>} */
    function after(id, run) {
        const next = (work.get(id) ?? Promise.resolve()).then(run, run);
        const held = next.catch(() => {});
        work.set(id, held);
        held.then(() => {
            if (work.get(id) === held) work.delete(id);
        });
        return next;
    }

    /** its trial line, once @param {string} thread @param {string} id */
    function log(thread, id) {
        const note = find(thread, id);
        if (!note || !tell(thread, id, { type: 'logged' })) return;
        const parts = note.passage.parts.map((p) => p.words);
        const quote = quoteOf(parts);
        const line = note.said.at(-1)?.line ?? lineOf(note);
        logTrial(
            JSON.stringify({
                at: new Date(io.now()).toISOString(),
                isCut: quote.endsWith('…') && !parts.at(-1)?.endsWith('…'),
                note: note.text,
                quote,
                short: shortId(note.passage.row.id),
                sid: sidOf(thread),
                size: line.length,
            }),
        );
    }

    /** @param {Joins | null | undefined} joins @param {Note} note */
    const isTaken = (joins, note) =>
        Boolean(
            note.joinId &&
                (joins?.taken?.includes(note.joinId) ||
                    joins?.joined?.includes(note.joinId)),
        );

    /** his note takes a waiting row out of the join file; a turn that took it first keeps it @param {string} thread @param {Note} note */
    async function takeRowBack(thread, note) {
        if (!note.joinId) return false;
        return takeBackJoin(io, fileOf(thread), note.joinId);
    }

    return {
        /**
         * his messages the transcript just added: a note whose line is one of them has joined, or its prompt has landed
         * @param {string} thread @param {readonly string[]} texts
         * @returns {boolean} whether a note changed
         */
        arrived(thread, texts) {
            let isChanged = false;
            for (const note of notesOf(thread)) {
                if (note.state === 'draft') continue;
                const said = [...note.said]
                    .reverse()
                    .find((s) => texts.includes(drawnOf(s.line)));
                if (!said) continue;
                if (note.state === 'sent') log(thread, note.id);
                else {
                    const isNew = tell(thread, note.id, {
                        line: said.line,
                        type: 'arrived',
                    });
                    isChanged = isNew || isChanged;
                    log(thread, note.id);
                }
            }
            return isChanged;
        },
        /** @param {string} thread @param {string} id @param {Joins | null | undefined} joins @param {number} back @returns {Promise<string | null>} why it did not join, null when it did */
        join(thread, id, joins, back) {
            const note = find(thread, id);
            if (note?.state !== 'draft' || !note.text.trim())
                return Promise.resolve(null);
            if (pushReason(joins)) return Promise.resolve(JOINS_OFF);
            const joinId = newId();
            tell(thread, id, { at: io.now(), back, joinId, type: 'queued' });
            const line = lineOf(/** @type {Note} */ (find(thread, id)));
            return after(id, async () => {
                if (await appendJoin(io, fileOf(thread), joinId, line))
                    return null;
                const reason = 'Not joined: its file was held, try again';
                tell(thread, id, { reason, type: 'takenBack' });
                return reason;
            });
        },
        /** the thread's notes, in the order he made them @param {string} thread @returns {readonly Note[]} */
        of: notesOf,
        /** the note on these words, or a new one: an unsent note that shares some of them comes back @param {string} thread @param {Passage} passage @returns {Note} */
        open(thread, passage) {
            const had = notesOf(thread).find(
                (n) => isUnsent(n) && isOverlapping(n.passage, passage),
            );
            if (had) return had;
            const note = newNote(passage, newId());
            keep(thread, [...notesOf(thread), note]);
            return note;
        },
        /**
         * it goes as a prompt of its own: its waiting row leaves the file first. the caller sends the line
         * @param {string} thread @param {string} id @param {Joins | null | undefined} joins @param {number} back
         * @returns {Promise<{ line: string } | { reason: string | null }>}
         */
        release(thread, id, joins, back) {
            return after(id, async () => {
                const note = find(thread, id);
                if (!note || isLocked(note) || !note.text.trim())
                    return { reason: null };
                if (note.state === 'waiting') {
                    if (
                        isTaken(joins, note) ||
                        !(await takeRowBack(thread, note))
                    )
                        return { reason: 'It joined the turn first' };
                    tell(thread, id, { type: 'takenBack' });
                }
                tell(thread, id, { at: io.now(), back, type: 'pushed' });
                const sent = find(thread, id);
                return sent ? { line: lineOf(sent) } : { reason: null };
            });
        },
        /** the send did not go, or its × pulled it back @param {string} thread @param {string} id @param {string} [reason] */
        returned: (thread, id, reason) =>
            tell(thread, id, { reason, type: 'takenBack' }),
        /**
         * where the waiting notes stand, by the thread's state; one it lists nowhere is joined if the transcript holds its
         * line, else his draft again
         * @param {string} thread @param {Joins | null | undefined} joins
         * @returns {Promise<boolean>} whether a note changed
         */
        async settle(thread, joins) {
            let isChanged = false;
            for (const { id } of notesOf(thread)) {
                const note = find(thread, id);
                if (!note?.joinId) continue;
                if (note.state !== 'waiting' && note.state !== 'taken')
                    continue;
                const state = joinStatus(
                    joins,
                    note.joinId,
                    note.writtenAt,
                    io.now(),
                );
                if (state === 'joined') {
                    isChanged =
                        tell(thread, id, { type: 'arrived' }) || isChanged;
                    log(thread, id);
                } else if (joins?.taken?.includes(note.joinId))
                    isChanged =
                        tell(thread, id, { type: 'turnTook' }) || isChanged;
                else if (state === 'not taken' && !searched.has(id)) {
                    searched.add(id);
                    try {
                        isChanged = (await look(thread, note)) || isChanged;
                    } finally {
                        searched.delete(id);
                    }
                }
            }
            return isChanged;
        },
        /** Enter on a waiting note takes it back @param {string} thread @param {string} id @param {Joins | null | undefined} joins @returns {Promise<string | null>} why it stays, null when it came back */
        takeBack(thread, id, joins) {
            return after(id, async () => {
                const note = find(thread, id);
                if (note?.state !== 'waiting') return null;
                if (isTaken(joins, note) || !(await takeRowBack(thread, note)))
                    return 'It joined the turn first';
                tell(thread, id, { type: 'takenBack' });
                return null;
            });
        },
        /** an empty draft leaves, its box closed @param {string} thread */
        tidy(thread) {
            const had = notesOf(thread);
            const kept = had.filter(
                (n) => n.state !== 'draft' || n.text.trim(),
            );
            if (kept.length !== had.length) keep(thread, kept);
        },
        /**
         * he typed in its box: a draft keeps the words, a waiting note's row carries them, an emptied one comes back
         * @param {string} thread @param {string} id @param {string} text @param {Joins | null | undefined} joins
         * @returns {Promise<boolean>} whether the note took the words
         */
        typed(thread, id, text, joins) {
            const note = find(thread, id);
            if (!note || isLocked(note)) return Promise.resolve(false);
            if (note.state === 'draft')
                return Promise.resolve(
                    tell(thread, id, { text, type: 'typed' }),
                );
            return after(id, async () => {
                const now = find(thread, id);
                if (now?.state !== 'waiting' || isTaken(joins, now))
                    return false;
                if (!text.trim()) {
                    if (!(await takeRowBack(thread, now))) return false;
                    tell(thread, id, { type: 'takenBack' });
                    return tell(thread, id, { text, type: 'typed' });
                }
                const line = lineOf({ ...now, text });
                if (
                    !now.joinId ||
                    !(await retextJoin(io, fileOf(thread), now.joinId, line))
                )
                    return false;
                return tell(thread, id, { text, type: 'rewritten' });
            });
        },
    };

    /** a note the state lists nowhere, looked for in its transcript @param {string} thread @param {Note} note */
    async function look(thread, note) {
        const head = `(${note.passage.row.kind === 'mine' ? 'message' : 'reply'} ${shortId(note.passage.row.id)}`;
        const lines = await linesWith(thread, head);
        const texts = lines.flatMap((line) => {
            try {
                return joinedTexts(JSON.parse(line));
            } catch {
                return [];
            }
        });
        const said = [...note.said]
            .reverse()
            .find((s) => texts.some((t) => drawnOf(t) === drawnOf(s.line)));
        if (said) {
            const isNew = tell(thread, note.id, {
                line: said.line,
                type: 'arrived',
            });
            log(thread, note.id);
            return isNew;
        }
        // its row leaves the file before his words are his again, so a stash that comes back never hands it in late
        await after(note.id, () => takeRowBack(thread, note));
        const now = find(thread, note.id);
        if (now?.state !== 'waiting' && now?.state !== 'taken') return false;
        return tell(thread, note.id, {
            reason: 'Not taken, still yours',
            type: 'takenBack',
        });
    }
}
