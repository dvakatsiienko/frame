import { readFile, readdir } from 'fs/promises';

/**
 * herdr keeps a mod's storage per mod name, so drafts typed while this mod was zoo's claude-chat are read from that
 * mod's store once, never over a draft typed here; returns whether one came over
 * @param {string} dir the old mod's data folder
 */
export async function importOldDrafts(dir) {
    try {
        if (localStorage.getItem('drafts-imported')) return false;
        let came = false;
        const names = await readdir(dir).catch(
            () => /** @type {string[]} */ ([]),
        );
        for (const name of names) {
            if (!/^store.*\.json$/.test(name)) continue;
            const kept = JSON.parse(await readFile(`${dir}/${name}`, 'utf8'));
            for (const [key, text] of Object.entries(kept)) {
                if (!key.startsWith('draft:') || localStorage.getItem(key))
                    continue;
                localStorage.setItem(key, String(text));
                came = true;
            }
        }
        localStorage.setItem('drafts-imported', '1');
        return came;
    } catch {
        return false;
    }
}
