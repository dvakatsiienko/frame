// the settings window's page kept by its overlay: a Keys save reloads this chat, the mod that draws the window, and
// the window comes back on the page he was on, never the one it was opened with

/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} PageStore */

/** @param {string} overlay */
const pageKey = (overlay) => `x-herdr-settings.page:${overlay}`;

/** @param {PageStore} store @param {string} overlay @param {string} page */
export function keepPage(store, overlay, page) {
    store.setItem(pageKey(overlay), page);
}

/** overlay ids restart with herdr: a closed window's page must never open a later window that took its id @param {PageStore & { removeItem: (key: string) => void }} store @param {string} overlay */
export function forgetPage(store, overlay) {
    store.removeItem(pageKey(overlay));
}

/** @param {PageStore} store @param {string} overlay @param {string} asked the page the window was opened on */
export function pageOnOpen(store, overlay, asked) {
    return store.getItem(pageKey(overlay)) ?? asked;
}
