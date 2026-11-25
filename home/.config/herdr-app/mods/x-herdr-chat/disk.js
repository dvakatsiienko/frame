// which paths are on disk. herdr's own fs reads only under his home and throws at once for any other path
// (`~/.config/herdr-app/AGENTS.md`, reads), so the shell is asked, once for a whole list

import { exec } from 'herdr';

const EACH =
    'for p in "$@"; do if [ -e "$p" ]; then echo 1; else echo 0; fi; done';

/** @param {readonly string[]} paths @returns {Promise<boolean[]>} in their order; a look that failed reads as not there */
export async function onDisk(paths) {
    if (!paths.length) return [];
    const r = await exec('/bin/sh', ['-c', EACH, 'sh', ...paths]).catch(
        /** @returns {null} */ () => null,
    );
    const said = r?.code === 0 ? r.stdout.split('\n') : [];
    return paths.map((_path, i) => said[i] === '1');
}

/** @param {string} path */
export const isOnDisk = async (path) => (await onDisk([path]))[0] === true;
