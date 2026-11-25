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
    isBehind,
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
 * @param {(thread: string) => Joins | null | undefined} doors.joinsOf what the thread's state lists of its joins now: null, joins are off for it; undefined, its state is not read
 * @param {(thread: string, words: string) => Promise<string[]>} doors.linesWith the lines of a transcript that hold the words
 * @param {(line: string) => void} doors.logTrial one line of the trial's record
 */
export function createNotes({
    io,
    dir,
    store,
    newId,
    joinsOf,
    linesWith,
    logTrial,
}) {
    /** @type {Map<string, Note[]>} */
    const threads = new Map();
    /** each note's file work under way: the next waits for it, so a take back never runs before its append @type {Map<string, Promise<unknown>>} */
    const work = new Map();
    /** notes looked for in their transcript now @type {Set<string>} */
    const searched = new Set();
    /** notes whose row would not take their words: asked again as the thread's state changes @type {Set<string>} */
    const refused = new Set();

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

    /** @param {string} thread @param {Note} note */
    function isTaken(thread, note) {
        const joins = joinsOf(thread);
        return Boolean(
            note.joinId &&
                (joins?.taken?.includes(note.joinId) ||
                    joins?.joined?.includes(note.joinId)),
        );
    }

    /** a waiting note's row out of the join file; not once a turn took it, before or while the file was written @param {string} thread @param {Note} note */
    async function takeRowBack(thread, note) {
        if (!note.joinId || isTaken(thread, note)) return false;
        const isOut = await takeBackJoin(io, fileOf(thread), note.joinId);
        const now = find(thread, note.id);
        return (
            isOut &&
            now?.state === 'waiting' &&
            now.joinId === note.joinId &&
            !isTaken(thread, note)
        );
    }

    /** the thread's state lists the note's row nowhere, a minute after it was written @param {string} thread @param {Note} note */
    function isLost(thread, note) {
        const now = find(thread, note.id);
        const joins = joinsOf(thread);
        // another thread is shown by now: this one's notes settle as it is opened again
        if (joins === undefined || !now?.joinId) return false;
        return (
            (now.state === 'waiting' || now.state === 'taken') &&
            !isTaken(thread, now) &&
            joinStatus(joins, now.joinId, now.writtenAt, io.now()) ===
                'not taken'
        );
    }

    return {
        /**
         * his messages the transcript just added: a note whose line is one of them has joined, or its prompt has landed.
         * one older than the note is another's with the same words
         * @param {string} thread @param {readonly { at: string | null, text: string }[]} rows
         * @returns {boolean} whether a note changed
         */
        arrived(thread, rows) {
            let isChanged = false;
            for (const note of notesOf(thread)) {
                if (note.state === 'draft') continue;
                const texts = rows
                    .filter(
                        (r) =>
                            r.at !== null && Date.parse(r.at) >= note.writtenAt,
                    )
                    .map((r) => r.text);
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
        /** @param {string} thread @param {string} id @param {number} back @returns {Promise<string | null>} why it did not join, null when it did */
        join(thread, id, back) {
            const note = find(thread, id);
            if (note?.state !== 'draft' || !note.text.trim())
                return Promise.resolve(null);
            if (pushReason(joinsOf(thread))) return Promise.resolve(JOINS_OFF);
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
        /**
         * the note on these words, or a new one: an unsent note that shares some of them comes back
         * @param {string} thread @param {Passage} passage @param {(id: string) => string} [rowOf] the row that holds a message's line now
         * @returns {Note}
         */
        open(thread, passage, rowOf) {
            // the newest, of two on the same words
            const had = [...notesOf(thread)]
                .reverse()
                .find(
                    (n) =>
                        isUnsent(n) && isOverlapping(n.passage, passage, rowOf),
                );
            if (had) return had;
            const note = newNote(passage, newId());
            keep(thread, [...notesOf(thread), note]);
            return note;
        },
        /** his × pulled a sent note out of Claude Code's queue: it is his draft again @param {string} thread @param {string} line @returns {boolean} whether one was */
        pulled(thread, line) {
            const note = notesOf(thread).find(
                (n) =>
                    n.state === 'sent' &&
                    n.said.at(-1)?.line.trim() === line.trim(),
            );
            return Boolean(
                note && tell(thread, note.id, { type: 'takenBack' }),
            );
        },
        /**
         * it goes as a prompt of its own: its waiting row leaves the file first. the caller sends the line
         * @param {string} thread @param {string} id @param {number} back
         * @returns {Promise<{ line: string } | { reason: string | null }>}
         */
        release(thread, id, back) {
            return after(id, async () => {
                const note = find(thread, id);
                if (!note || note.state === 'sent' || !note.text.trim())
                    return { reason: null };
                if (isLocked(note))
                    return { reason: 'It joined the turn first' };
                if (note.state === 'waiting') {
                    if (!(await takeRowBack(thread, note)))
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
         * @param {string} thread
         * @returns {Promise<boolean>} whether a note changed
         */
        async settle(thread) {
            let isChanged = false;
            for (const { id } of notesOf(thread)) {
                const note = find(thread, id);
                const joins = joinsOf(thread);
                if (!note?.joinId) continue;
                if (note.state !== 'waiting' && note.state !== 'taken')
                    continue;
                if (refused.delete(id)) write(thread, id);
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
        /** Enter on a waiting note takes it back @param {string} thread @param {string} id @returns {Promise<string | null>} why it stays, null when it came back */
        takeBack(thread, id) {
            return after(id, async () => {
                const note = find(thread, id);
                if (note?.state !== 'waiting') return null;
                if (!(await takeRowBack(thread, note)))
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
        /** he typed in its box: the note keeps the words at once, `write` takes them to a waiting note's row @param {string} thread @param {string} id @param {string} text @returns {boolean} whether the note took them */
        typed: (thread, id, text) => tell(thread, id, { text, type: 'typed' }),
        write,
    };

    /**
     * a waiting note's row takes the words it holds by now; an emptied one comes back
     * @param {string} thread @param {string} id @returns {Promise<boolean>} whether the row has them
     */
    function write(thread, id) {
        return after(id, async () => {
            const note = find(thread, id);
            if (note?.state !== 'waiting' || !note.joinId)
                return note?.state === 'draft';
            if (!isBehind(note)) return true;
            if (!note.text.trim())
                return (
                    (await takeRowBack(thread, note)) &&
                    tell(thread, id, { type: 'takenBack' })
                );
            const { text } = note;
            const isWritten =
                !isTaken(thread, note) &&
                (await retextJoin(
                    io,
                    fileOf(thread),
                    note.joinId,
                    lineOf(note),
                ));
            if (isWritten) tell(thread, id, { text, type: 'rewritten' });
            else refused.add(id);
            return isWritten;
        }).catch(() => {
            refused.add(id);
            return false;
        });
    }

    /** a note the state lists nowhere, looked for in its transcript @param {string} thread @param {Note} note */
    async function look(thread, note) {
        const head = `(${note.passage.row.kind === 'mine' ? 'message' : 'reply'} ${shortId(note.passage.row.id)}`;
        const lines = await linesWith(thread, head);
        const texts = lines.flatMap((line) => {
            try {
                const entry = JSON.parse(line);
                return Date.parse(entry.timestamp) >= note.writtenAt
                    ? joinedTexts(entry)
                    : [];
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
        return after(note.id, async () => {
            if (!note.joinId || !isLost(thread, note)) return false;
            await takeBackJoin(io, fileOf(thread), note.joinId);
            return (
                isLost(thread, note) &&
                tell(thread, note.id, {
                    reason: 'Not taken, still yours',
                    type: 'takenBack',
                })
            );
        });
    }
}
