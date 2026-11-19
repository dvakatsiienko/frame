// the quill of each thread and its one owner: the words it holds and where they stand, typed → marked → shown in the
// chat → cleared. every change of the text or the mark is one event through `next`, and the screen, the draft and the
// mark follow from that one place: three owners on three clocks brought back taken words (dima, 11-18 12:22).
// a thread is named by its transcript file, which outlives a restart of its Claude; the store is the mod's own
// localStorage, so the old chat's drafts are not these.

/**
 * the part of localStorage the quills need
 * @typedef {object} QuillStore
 * @property {(key: string) => string | null} getItem
 * @property {(key: string) => void} removeItem
 * @property {(key: string, value: string) => void} setItem
 */
/**
 * words marked to join the thread's turn (FRM-564)
 * @typedef {object} Mark
 * @property {string} id the row's id in the join file
 * @property {string} sid the thread's session, which names its join file
 * @property {string} thread the thread's transcript file
 * @property {string} said the quill's words the row carries
 * @property {string[]} [files] the paths the row carries after the words
 * @property {number} at when it was marked
 * @property {'pending' | 'joined'} state `joined`: a turn took it and it shows in the chat, for a moment
 */
/** @typedef {{ text: string, mark: Mark | null }} Quill */
/**
 * @typedef {{ type: 'typed', text: string }
 *   | { type: 'marked', mark: Mark }
 *   | { type: 'retexted', id: string, said: string, files?: string[] }
 *   | { type: 'shown', id: string, said?: string }
 *   | { type: 'unmarked', id: string }
 *   | { type: 'sent', said: string }
 *   | { type: 'returned', said: string }} QuillEvent
 */
/** @typedef {{ set_value: (text: string) => unknown, value: () => string }} Box */

/** @type {Quill} */
export const EMPTY = Object.freeze({ mark: null, text: '' });

const MARKS = 'joins:marks';

/** @param {string} thread */
const draftKey = (thread) => `draft:${thread}`;

/** what the quill holds after the words that left it, or null when it no longer starts with them @param {string} text @param {string} said */
function after(text, said) {
    const typed = text.trim();
    return typed.startsWith(said) ? typed.slice(said.length).trimStart() : null;
}

/** a new event type turns this call red at typecheck @param {never} event @returns {never} */
const unhandled = (event) => event;

/**
 * one step of a quill: an answer about a mark the quill no longer holds changes nothing
 * @param {Quill} quill @param {QuillEvent} event
 * @returns {Quill}
 */
export function next(quill, event) {
    const { mark } = quill;
    switch (event.type) {
        case 'typed':
            return event.text === quill.text
                ? quill
                : { ...quill, text: event.text };
        case 'marked':
            return { ...quill, mark: event.mark };
        case 'retexted':
            return mark?.id === event.id && mark.state === 'pending'
                ? {
                      ...quill,
                      mark: {
                          ...mark,
                          files: event.files ?? mark.files,
                          said: event.said,
                      },
                  }
                : quill;
        case 'shown':
            return mark?.id === event.id && mark.state === 'pending'
                ? {
                      mark: { ...mark, state: 'joined' },
                      text:
                          after(quill.text, event.said ?? mark.said) ??
                          quill.text,
                  }
                : quill;
        case 'unmarked':
            return mark?.id === event.id ? { ...quill, mark: null } : quill;
        case 'sent':
            return {
                ...quill,
                text: after(quill.text, event.said) ?? quill.text.trim(),
            };
        case 'returned':
            // a send of files alone gives back no words: what he typed since stays as it is
            if (!event.said) return quill;
            return {
                ...quill,
                text: quill.text
                    ? `${event.said}\n\n${quill.text}`
                    : event.said,
            };
        default:
            return unhandled(event);
    }
}

/**
 * every thread's quill, kept across a reload; the shown thread's is on screen the moment it changes
 * @param {QuillStore} store
 * @param {(text: string) => void} [onWrite] told each text written to the screen from code: a box tells no change for it
 */
export function createQuills(store, onWrite = () => {}) {
    /** a thread's quill; the null key is the quill shown with no thread, never kept @type {Map<string | null, Quill>} */
    const quills = new Map();
    /** @type {{ thread: string | null, box: Box } | null} */
    let shown = null;

    try {
        const kept = JSON.parse(store.getItem(MARKS) ?? '[]');
        for (const mark of Array.isArray(kept) ? kept : [])
            if (typeof mark?.id === 'string' && typeof mark.thread === 'string')
                quills.set(mark.thread, {
                    mark: { ...mark, state: 'pending' },
                    text: readDraft(mark.thread),
                });
    } catch {
        // marks that cannot be read are marks lost: their rows are taken or time out on their own
    }

    /** @param {string} thread */
    function readDraft(thread) {
        try {
            return store.getItem(draftKey(thread)) ?? '';
        } catch {
            return '';
        }
    }

    /** @param {string} thread @param {string} text */
    function keepDraft(thread, text) {
        try {
            if (text) store.setItem(draftKey(thread), text);
            else store.removeItem(draftKey(thread));
        } catch {
            // a store that refuses loses the draft, never his typing
        }
    }

    function keepMarks() {
        const pending = [...quills.values()]
            .map((quill) => quill.mark)
            .filter((mark) => mark?.state === 'pending');
        try {
            if (pending.length) store.setItem(MARKS, JSON.stringify(pending));
            else store.removeItem(MARKS);
        } catch {
            // a store that refuses loses the mark across a reload, never now
        }
    }

    /** @param {string} text */
    function write(text) {
        if (!shown || shown.box.value() === text) return;
        // told first: the box's change for this write must read as ours, never as a paste of his
        onWrite(text);
        shown.box.set_value(text);
    }

    /** @param {string | null} thread @returns {Quill} */
    function get(thread) {
        const had = quills.get(thread);
        if (had) return had;
        if (thread === null) return EMPTY;
        const quill = { mark: null, text: readDraft(thread) };
        quills.set(thread, quill);
        return quill;
    }

    return {
        /**
         * one event on a thread's quill; the draft, the kept marks and the screen follow
         * @param {string | null} thread the thread's transcript file; null: the quill shown with no thread
         * @param {QuillEvent} event
         * @returns {Quill}
         */
        apply(thread, event) {
            const before = get(thread);
            const now = next(before, event);
            if (now !== before) {
                quills.set(thread, now);
                if (thread !== null && now.text !== before.text)
                    keepDraft(thread, now.text);
                if (thread !== null && now.mark !== before.mark) keepMarks();
            }
            // against the box itself, never the quill before: a submit can beat the change of Enter's line break
            if (shown?.thread === thread) write(now.text);
            return now;
        },
        get,
        /** @param {string | null} thread @returns {Mark | null} */
        markOf: (thread) => (thread === null ? null : get(thread).mark),
        /**
         * the box shows this thread's quill from now on; no thread starts an empty one
         * @param {string | null} thread @param {Box} box
         * @returns {string} the text it shows
         */
        show(thread, box) {
            if (thread === null) quills.delete(null);
            shown = { box, thread };
            const { text } = get(thread);
            onWrite(text);
            if (box.value() !== text) box.set_value(text);
            return text;
        },
    };
}
