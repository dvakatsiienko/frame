// the top tabs' status tile (the program's icon with its state dot): his «general › tab status» row in x-herdr-settings
// (the band's 🎛️ or ⌘⇧,, FRM-664:W6); the window writes the one settings file, the pills read it from here

// x-herdr-settings' file (x-herdr-chat settings-store.js), under the home folder
export const SETTINGS_DIR = '.claude/shelf/herdr-settings';
export const SETTINGS_FILE = `${SETTINGS_DIR}/settings.json`;
export const TAB_STATUS_ROW = 'tabs.status';

/** @typedef {'visible' | 'hidden'} TabStatus */

/**
 * his choice from the settings file's text: anything but a stored «hidden» shows the tile, as before the setting
 * @param {string | null} text @returns {TabStatus}
 */
export function tabStatusIn(text) {
    try {
        return JSON.parse(text ?? '')?.rows?.[TAB_STATUS_ROW] === 'hidden'
            ? 'hidden'
            : 'visible';
    } catch {
        return 'visible';
    }
}

/**
 * the next change to the settings folder: a folder not made yet, or a watch herdr refuses, waits instead, so the read
 * loop asks again later and never stops for the mod's life
 * @param {() => Promise<unknown>} watch @param {() => Promise<unknown>} wait
 */
export const nextChange = (watch, wait) => watch().catch(() => wait());
