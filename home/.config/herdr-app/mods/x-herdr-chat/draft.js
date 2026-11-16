// the quill's draft, kept per thread and across a reload of the mod: a thread is named by its transcript file, which
// outlives a restart of its Claude. the store is the mod's own localStorage, so the old chat's drafts are not these.

/**
 * the part of localStorage a draft needs
 * @typedef {object} DraftStore
 * @property {(key: string) => string | null} getItem
 * @property {(key: string) => void} removeItem
 * @property {(key: string, value: string) => void} setItem
 */

/** @param {string} thread */
const keyOf = (thread) => `draft:${thread}`;

/** @param {DraftStore} store */
export function createDrafts(store) {
    return {
        /**
         * what he typed is kept as he types it; an emptied quill, a sent one too, leaves no draft
         * @param {string | null} thread the thread's transcript file
         * @param {string} text
         */
        keep(thread, text) {
            if (!thread) return;
            try {
                if (text) store.setItem(keyOf(thread), text);
                else store.removeItem(keyOf(thread));
            } catch {
                // a store that refuses loses the draft, never his typing
            }
        },
        /** @param {string | null} thread @returns {string} */
        kept(thread) {
            if (!thread) return '';
            try {
                return store.getItem(keyOf(thread)) ?? '';
            } catch {
                return '';
            }
        },
    };
}
