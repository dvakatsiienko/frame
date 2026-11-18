// the files waiting over each thread's quill, one owner (FRM-638 slice 5): pasted and dropped pictures and any other
// file, sent as their paths with the next message (FRM-613). a pasted picture is a png in our shots dir, its own
// preview and his shot, kept for a reload; a dropped picture gets a scaled copy as its preview, removed with it

import { isImagePath, withFiles } from './attach.js';
import { previewCopies, waitingFiles, withWaitingFiles } from './shots.js';

/**
 * @typedef {object} Waiting
 * @property {string} path the file sent
 * @property {string | null} preview a picture's preview under the app dir; null for any other file, or while it is made
 */

/**
 * @typedef {object} AttachmentsIo
 * @property {(store: import('./shots.js').ShotStore) => void} save
 * @property {(path: string, at: number) => Promise<string | null>} makePreview a dropped picture's scaled copy
 * @property {(rels: string[]) => void} deleteCopies
 * @property {() => number} now
 */

/**
 * @param {string} home the app dir
 * @param {AttachmentsIo} io
 * @param {import('./shots.js').ShotStore} store what waited before a reload
 */
export function createAttachments(home, io, store) {
    /** @type {Map<string, Waiting[]>} */
    const threads = new Map();
    let saved = store;

    /**
     * what waited before a reload comes back: a pasted shot is its own preview, a picture from elsewhere gets its
     * preview made again; a thread he already added to since the start keeps what he added
     * @param {import('./shots.js').ShotStore} loaded @returns {Promise<boolean>} whether a preview was made
     */
    async function restore(loaded) {
        const isMerge = threads.size > 0;
        /** @type {[string, string][]} */
        const remake = [];
        for (const [thread, paths] of waitingFiles(loaded, home)) {
            if (threads.has(thread)) continue;
            threads.set(
                thread,
                paths.map((path) => {
                    const isOurs = path.startsWith(`${home}/`);
                    if (!isOurs && isImagePath(path))
                        remake.push([thread, path]);
                    return {
                        path,
                        preview: isOurs ? path.slice(home.length + 1) : null,
                    };
                }),
            );
            saved = withWaitingFiles(saved, thread, paths, home);
        }
        // files he added before the load and the loaded ones go to disk together, never his alone
        if (isMerge) io.save(saved);
        const at = io.now();
        let isMade = false;
        for (const [i, [thread, path]] of remake.entries()) {
            const preview = await io.makePreview(path, at + i);
            if (!preview) continue;
            const waiting = of(thread).find((w) => w.path === path);
            if (waiting && !waiting.preview) {
                waiting.preview = preview;
                isMade = true;
            } else io.deleteCopies([preview]);
        }
        return isMade;
    }

    /** @param {string} thread */
    const of = (thread) => threads.get(thread) ?? [];

    /** @param {string} thread @param {Waiting[]} next */
    function set(thread, next) {
        if (next.length) threads.set(thread, next);
        else threads.delete(thread);
        saved = withWaitingFiles(
            saved,
            thread,
            next.map((w) => w.path),
            home,
        );
        io.save(saved);
    }

    /** @param {Waiting[]} gone */
    const copiesOf = (gone) =>
        previewCopies(
            gone.map(({ path, preview }) => ({ path, rel: preview })),
            home,
        );

    restore(store);

    return {
        /**
         * dropped, picked or copied files, each once; a picture's preview is made after, unless it left meanwhile
         * @param {string} thread @param {string[]} paths
         */
        async add(thread, paths) {
            const had = of(thread).map((w) => w.path);
            const fresh = withFiles(had, paths).slice(had.length);
            if (!fresh.length) return;
            set(thread, [
                ...of(thread),
                ...fresh.map((path) => ({ path, preview: null })),
            ]);
            const at = io.now();
            for (const [i, path] of fresh.filter(isImagePath).entries()) {
                const preview = await io.makePreview(path, at + i);
                if (!preview) continue;
                const waiting = of(thread).find((w) => w.path === path);
                if (waiting && !waiting.preview) waiting.preview = preview;
                else io.deleteCopies([preview]);
            }
        },
        /** @param {string} thread @returns {readonly Waiting[]} */
        of,

        /** a pasted picture, saved as `rel` under the app dir @param {string} thread @param {string} rel */
        paste(thread, rel) {
            const path = `${home}/${rel}`;
            if (of(thread).some((w) => w.path === path)) return;
            set(thread, [...of(thread), { path, preview: rel }]);
        },

        /** × on one file @param {string} thread @param {string} path */
        remove(thread, path) {
            const gone = of(thread).filter((w) => w.path === path);
            set(
                thread,
                of(thread).filter((w) => w.path !== path),
            );
            io.deleteCopies(copiesOf(gone));
        },
        restore,

        /**
         * a send takes every file waiting: their paths, in the order he added them
         * @param {string} thread @returns {string[]}
         */
        take(thread) {
            const gone = of(thread);
            if (!gone.length) return [];
            set(thread, []);
            io.deleteCopies(copiesOf(gone));
            return gone.map((w) => w.path);
        },
    };
}
