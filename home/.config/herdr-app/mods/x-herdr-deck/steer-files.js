// the files each steer box carries until its steer is sent or cleared (FRM-676 slice B): dropped or pasted, each once,
// kept in the copy's store so a reload keeps them; a sent steer names each by its absolute path on its own line, so the
// stash's steer path carries them with no change of its own

import { withFiles } from './attach-files.js';
import { keep, kept } from './orbit.js';

/** @param {import('./orbit.js').KeptStore} store */
export function createSteerFiles(store) {
    /** @type {Map<string, string[]>} */
    const boxes = new Map();
    /** @param {string} key */
    const storeKey = (key) => `steer-files:${key}`;

    /** @param {string} key @returns {string[]} */
    function of(key) {
        const had = boxes.get(key);
        if (had) return had;
        /** @type {string[]} */
        let loaded = [];
        try {
            const parsed = JSON.parse(kept(store, storeKey(key)) ?? '[]');
            if (Array.isArray(parsed))
                loaded = parsed.filter((p) => typeof p === 'string');
        } catch {}
        boxes.set(key, loaded);
        return loaded;
    }

    /** @param {string} key @param {string[]} next */
    function set(key, next) {
        boxes.set(key, next);
        keep(store, storeKey(key), next.length ? JSON.stringify(next) : '');
    }

    return {
        /** dropped or pasted files, each once: whether any was new @param {string} key @param {string[]} paths */
        add(key, paths) {
            const had = of(key);
            const next = withFiles(had, paths);
            if (next.length === had.length) return false;
            set(key, next);
            return true;
        },
        /** a sent or cleared steer takes its files with it @param {string} key */
        clear(key) {
            if (of(key).length) set(key, []);
        },
        /** the steer as it leaves: the words, then each file's path on its own line @param {string} key @param {string} text */
        joined(key, text) {
            return [text.trim(), ...of(key)].filter(Boolean).join('\n');
        },
        of,
        /** × on one file @param {string} key @param {string} path */
        remove(key, path) {
            set(
                key,
                of(key).filter((p) => p !== path),
            );
        },
    };
}
