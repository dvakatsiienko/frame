import { exists, readFile, readdir } from 'fs/promises';

/**
 * herdr keeps a mod's storage per mod name, so drafts typed while this mod was zoo's claude-chat are read from that
 * mod's store once, never over a draft typed here; returns whether one came over. a read that fails sets no flag, so
 * the next start tries again
 * @param {string} dir the old mod's data folder
 */
export async function importOldDrafts(dir) {
    let came = false;
    try {
        if (localStorage.getItem('drafts-imported')) return false;
        const names = (await exists(dir)) ? await readdir(dir) : [];
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
        return came;
    }
}
