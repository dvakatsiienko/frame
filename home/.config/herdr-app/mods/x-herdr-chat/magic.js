// the magic send's marks (FRM-564): a click on send marks the quill's words to join the thread's turn, the running one
// or its next. the words stay in the quill, as one row in the thread's join file (joins.js), until a turn takes them;
// a second click takes the mark off; what he types on rides the same row. one mark per thread, held by the quill
// (quill.js) with its words. it holds no herdr call: the view hands it the join file's doors and does what each
// answer says.

import {
    appendJoin,
    joinStatus,
    pushReason,
    retextJoin,
    takeBackJoin,
} from './joins.js';

/** @typedef {import('./joins.js').JoinIo} JoinIo */
/** @typedef {import('./joins.js').Joins & { taken?: string[] }} Joins what the thread's state lists of its joins */
/** @typedef {import('./quill.js').Mark} Mark */
/** @typedef {{ act: 'marked' | 'unmarked' | 'push' | 'none', note: string | null }} Clicked */
/** @typedef {{ id: string, note: string | null }} Settled a mark that settled: shown in the chat, or not taken */

/** a turn has the row: taking it, or done with it @param {Joins | null | undefined} joins @param {string} id */
const isTaken = (joins, id) =>
    Boolean(joins?.taken?.includes(id) || joins?.joined?.includes(id));

/** words typed under a mark reach its join row once his keys rest this long */
export const RETEXT_MS = 400;

/** an emptied quill unmarks at once, so 🍕 goes the moment the words do (dima, 15:34); words wait for his keys to rest @param {string} text */
export const retextWait = (text) => (text.trim() ? RETEXT_MS : 0);

/**
 * @param {object} doors
 * @param {JoinIo} doors.io
 * @param {string} doors.dir the join files' folder
 * @param {ReturnType<typeof import('./quill.js').createQuills>} doors.quills the quills, which hold each thread's mark
 * @param {() => string} doors.newId
 */
export function createMagic({ io, dir, quills, newId }) {
    /** each row's write, so a take-back never runs before the append it undoes @type {Map<string, Promise<boolean>>} */
    const written = new Map();

    /** @param {Mark} mark */
    const set = (mark) => quills.apply(mark.thread, { mark, type: 'marked' });

    /** by id: a late answer never drops the mark that replaced it @param {Mark} mark */
    function drop(mark) {
        quills.apply(mark.thread, { id: mark.id, type: 'unmarked' });
        written.delete(mark.id);
    }

    /** @param {Mark} mark */
    const fileOf = (mark) => `${dir}/${mark.sid}.jsonl`;

    /** @param {Mark} mark @param {Joins | null | undefined} joins @returns {Promise<Clicked>} */
    async function unmark(mark, joins) {
        if (isTaken(joins, mark.id))
            return { act: 'none', note: 'It joined the turn first' };
        // the row's write is read before the mark goes, which forgets it: the take-back waits for the append it undoes
        const write = written.get(mark.id);
        drop(mark);
        // an append that never landed left no row to take back
        if ((await write) === false) return { act: 'unmarked', note: null };
        if (await takeBackJoin(io, fileOf(mark), mark.id))
            return { act: 'unmarked', note: null };
        if (!quills.markOf(mark.thread)) {
            set(mark);
            if (write) written.set(mark.id, write);
        }
        return { act: 'none', note: 'Still joining, try again' };
    }

    /** a turn took the mark: it shows as taken, the quill keeps only what he typed after its words @param {Mark} mark @returns {Settled} */
    function taken(mark) {
        quills.apply(mark.thread, { id: mark.id, type: 'shown' });
        return { id: mark.id, note: null };
    }

    return {
        /**
         * his marked words just arrived in the chat as his message: the mark settles in that same draw, so the words
         * leave the quill the moment they show above it, never on the stash's later state write (dima, 12:20)
         * @param {string} thread
         * @param {{ at: string | null, text: string }[]} arrived his messages the transcript just added, with their times:
         *   only one written after the mark counts, so an older message with the same words (a re-read after a thread
         *   switch brings them all back) never settles it
         * @returns {Settled | null}
         */
        arrived(thread, arrived) {
            const mark = quills.markOf(thread);
            if (mark?.state !== 'pending') return null;
            const isHis = arrived.some(
                (row) =>
                    row.text.trim() === mark.said &&
                    row.at !== null &&
                    Date.parse(row.at) >= mark.at,
            );
            return isHis ? taken(mark) : null;
        },
        /**
         * a click on send. the mark is set, or taken off, before the first wait: draw at once, then await the answer
         * @param {string} thread the thread's transcript file
         * @param {string | null} sid its session
         * @param {string} text the quill's words
         * @param {Joins | null | undefined} joins what the thread's state lists
         * @returns {Promise<Clicked>} `push`: nothing was marked, the words go as a plain send, `note` says why
         */
        async click(thread, sid, text, joins) {
            const had = quills.markOf(thread);
            if (had?.state === 'pending') return unmark(had, joins);
            const why = pushReason(text, sid ? joins : null);
            if (why || !sid) return { act: 'push', note: why };
            /** @type {Mark} */
            const mark = {
                at: io.now(),
                id: newId(),
                said: text,
                sid,
                state: 'pending',
                thread,
            };
            set(mark);
            const write = appendJoin(io, fileOf(mark), mark.id, text);
            written.set(mark.id, write);
            if (await write) return { act: 'marked', note: null };
            drop(mark);
            return { act: 'none', note: 'Not joined, still in the box' };
        },
        /** the «joined» mark has been shown long enough @param {string} thread @param {string} id */
        forget(thread, id) {
            quills.apply(thread, { id, type: 'unmarked' });
            written.delete(id);
        },
        markOf: quills.markOf,
        /**
         * before a push: words still marked to join leave the join file first, so they never go twice
         * @param {string} thread
         * @param {Joins | null | undefined} joins what the thread's state lists
         * @returns {Promise<string | null>} null: push; else why not
         */
        async release(thread, joins) {
            const mark = quills.markOf(thread);
            if (mark?.state !== 'pending') return null;
            // a row a turn took stays in the join file while the thread lives: only the state says it was taken
            if (isTaken(joins, mark.id)) return 'It joined the turn first';
            await written.get(mark.id);
            if (!(await takeBackJoin(io, fileOf(mark), mark.id)))
                return 'It joined the turn first';
            drop(mark);
            return null;
        },
        /**
         * where the thread's mark stands, from its state: a turn took it, or none did in a minute
         * @param {string} thread
         * @param {Joins | null | undefined} joins
         * @returns {Settled | null} null: nothing changed
         */
        settle(thread, joins) {
            const mark = quills.markOf(thread);
            if (mark?.state !== 'pending') return null;
            const state = joinStatus(joins, mark.id, mark.at, io.now());
            if (state === 'joined' || joins?.taken?.includes(mark.id))
                return taken(mark);
            if (state !== 'not taken') return null;
            drop(mark);
            // its row leaves the file too, so a stash that comes back never hands it in late
            takeBackJoin(io, fileOf(mark), mark.id).catch(() => {});
            return { id: mark.id, note: 'Not taken, still in the box' };
        },
        /**
         * he typed on under a mark: the same row carries the quill's words now; an emptied quill takes the mark off
         * @param {string} thread
         * @param {string} text the quill's words
         * @param {Joins | null | undefined} joins
         * @returns {Promise<boolean>} whether the mark changed
         */
        async typed(thread, text, joins) {
            const mark = quills.markOf(thread);
            if (mark?.state !== 'pending' || text === mark.said) return false;
            if (isTaken(joins, mark.id)) return false;
            if (!text) return (await unmark(mark, joins)).act === 'unmarked';
            await written.get(mark.id);
            if (!(await retextJoin(io, fileOf(mark), mark.id, text)))
                return false;
            return (
                quills.apply(thread, {
                    id: mark.id,
                    said: text,
                    type: 'retexted',
                }).mark?.said === text
            );
        },
    };
}
