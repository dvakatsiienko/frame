// the magic send's marks (FRM-564): a click on send marks the quill's words to join the thread's turn, the running one
// or its next. the words stay in the quill, as one row in the thread's join file (joins.js), until a turn takes them;
// a second click takes the mark off; what he types on rides the same row. one mark per thread, kept across a reload.
// it holds no herdr call: the view hands it the join file's doors and does what each answer says.

import {
    appendJoin,
    joinStatus,
    pushReason,
    retextJoin,
    takeBackJoin,
} from './joins.js';

/** @typedef {import('./joins.js').JoinIo} JoinIo */
/** @typedef {import('./joins.js').Joins & { taken?: string[] }} Joins what the thread's state lists of its joins */
/**
 * @typedef {object} Mark
 * @property {string} id the row's id in the join file
 * @property {string} sid the thread's session, which names its join file
 * @property {string} thread the thread's transcript file
 * @property {string} said the quill's words the row carries
 * @property {number} at when it was marked
 * @property {'pending' | 'joined'} state `joined`: a turn took it, shown for a moment
 */
/** @typedef {{ act: 'marked' | 'unmarked' | 'push' | 'none', note: string | null }} Clicked */

const KEPT = 'joins:marks';

/**
 * @param {object} doors
 * @param {JoinIo} doors.io
 * @param {string} doors.dir the join files' folder
 * @param {import('./draft.js').DraftStore} doors.store
 * @param {() => string} doors.newId
 */
export function createMagic({ io, dir, store, newId }) {
    /** @type {Map<string, Mark>} */
    const marks = new Map();
    /** each row's write, so a take-back never runs before the append it undoes @type {Map<string, Promise<boolean>>} */
    const written = new Map();
    try {
        const kept = JSON.parse(store.getItem(KEPT) ?? '[]');
        for (const mark of Array.isArray(kept) ? kept : [])
            if (typeof mark?.id === 'string' && typeof mark.thread === 'string')
                marks.set(mark.thread, { ...mark, state: 'pending' });
    } catch {
        // marks that cannot be read are marks lost: their rows are taken or time out on their own
    }

    function keep() {
        const pending = [...marks.values()].filter(
            (mark) => mark.state === 'pending',
        );
        try {
            if (pending.length) store.setItem(KEPT, JSON.stringify(pending));
            else store.removeItem(KEPT);
        } catch {
            // a store that refuses loses the mark across a reload, never now
        }
    }

    /** @param {Mark} mark */
    function set(mark) {
        marks.set(mark.thread, mark);
        keep();
    }

    /** by id: a late answer never drops the mark that replaced it @param {string} id */
    function drop(id) {
        for (const [thread, mark] of marks)
            if (mark.id === id) marks.delete(thread);
        written.delete(id);
        keep();
    }

    /** @param {Mark} mark */
    const fileOf = (mark) => `${dir}/${mark.sid}.jsonl`;

    /** @param {Mark} mark @returns {Promise<boolean>} whether its row left the join file */
    async function takeBack(mark) {
        await written.get(mark.id);
        return takeBackJoin(io, fileOf(mark), mark.id);
    }

    /** @param {Mark} mark @param {Joins | null | undefined} joins @returns {Promise<Clicked>} */
    async function unmark(mark, joins) {
        if (joins?.taken?.includes(mark.id))
            return { act: 'none', note: 'It joined the turn first' };
        drop(mark.id);
        if (await takeBack(mark)) return { act: 'unmarked', note: null };
        if (!marks.has(mark.thread)) set(mark);
        return { act: 'none', note: 'Still joining, try again' };
    }

    return {
        /**
         * a click on send. the mark is set, or taken off, before the first wait: draw at once, then await the answer
         * @param {string} thread the thread's transcript file
         * @param {string | null} sid its session
         * @param {string} text the quill's words
         * @param {Joins | null | undefined} joins what the thread's state lists
         * @returns {Promise<Clicked>} `push`: nothing was marked, the words go as a plain send, `note` says why
         */
        async click(thread, sid, text, joins) {
            const had = marks.get(thread);
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
            drop(mark.id);
            return { act: 'none', note: 'Not joined, still in the box' };
        },
        /** the «joined» mark has been shown long enough @param {string} id */
        forget: drop,
        /** @param {string | null} thread @returns {Mark | null} */
        markOf(thread) {
            return (thread && marks.get(thread)) || null;
        },
        /**
         * before a push: words still marked to join leave the join file first, so they never go twice
         * @param {string} thread
         * @returns {Promise<string | null>} null: push; else why not
         */
        async release(thread) {
            const mark = marks.get(thread);
            if (mark?.state !== 'pending') return null;
            if (!(await takeBack(mark))) return 'It joined the turn first';
            drop(mark.id);
            return null;
        },
        /**
         * where the thread's mark stands, from its state: a turn took it, or none did in a minute
         * @param {string} thread
         * @param {Joins | null | undefined} joins
         * @param {string} quill what the quill holds
         * @returns {{ id: string, quill: string | null, note: string | null } | null} null: nothing changed. `quill`:
         *   what the quill holds now, the taken words gone and what he typed after them kept; null to leave it
         */
        settle(thread, joins, quill) {
            const mark = marks.get(thread);
            if (mark?.state !== 'pending') return null;
            const state = joinStatus(joins, mark.id, mark.at, io.now());
            if (state === 'joined' || joins?.taken?.includes(mark.id)) {
                set({ ...mark, state: 'joined' });
                const typed = quill.trim();
                return {
                    id: mark.id,
                    note: null,
                    quill: typed.startsWith(mark.said)
                        ? typed.slice(mark.said.length).trimStart()
                        : null,
                };
            }
            if (state !== 'not taken') return null;
            drop(mark.id);
            // its row leaves the file too, so a stash that comes back never hands it in late
            takeBackJoin(io, fileOf(mark), mark.id).catch(() => {});
            return {
                id: mark.id,
                note: 'Not taken, still in the box',
                quill: null,
            };
        },
        /**
         * he typed on under a mark: the same row carries the quill's words now; an emptied quill takes the mark off
         * @param {string} thread
         * @param {string} text the quill's words
         * @param {Joins | null | undefined} joins
         * @returns {Promise<boolean>} whether the mark changed
         */
        async typed(thread, text, joins) {
            const mark = marks.get(thread);
            if (mark?.state !== 'pending' || text === mark.said) return false;
            if (joins?.taken?.includes(mark.id)) return false;
            if (!text) return (await unmark(mark, joins)).act === 'unmarked';
            await written.get(mark.id);
            if (!(await retextJoin(io, fileOf(mark), mark.id, text)))
                return false;
            const now = marks.get(thread);
            if (now?.id !== mark.id) return false;
            set({ ...now, said: text });
            return true;
        },
    };
}
