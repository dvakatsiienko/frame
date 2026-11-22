// the files each steer box carries until its steer is sent or cleared (FRM-676 slice B): dropped or pasted, each once,
// kept in the copy's store so a reload keeps them; a sent steer names each by its absolute path on its own line, so the
// stash's steer path carries them with no change of its own

import { withFiles } from './attach-files.js';
import { keep, kept } from './orbit.js';

/** @param {import('./orbit.js').KeptStore} store */
export function createSteerFiles(store) {
    /** @param {string} key */
    const storeKey = (key) => `steer-files:${key}`;

    // the store is the one owner, read each time: herdr fills a copy's store after its first render, so a copy kept
    // here read empty for good (his 19:15 shot)
    /** @param {string} key @returns {string[]} */
    function of(key) {
        try {
            const parsed = JSON.parse(kept(store, storeKey(key)) ?? '[]');
            return Array.isArray(parsed)
                ? parsed.filter((p) => typeof p === 'string')
                : [];
        } catch {
            return [];
        }
    }

    /** @param {string} key @param {string[]} next */
    function set(key, next) {
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
