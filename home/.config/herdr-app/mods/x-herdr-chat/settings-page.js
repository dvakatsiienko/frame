// the settings window's page kept through a reload of this chat: a Keys save reloads x-herdr-chat, the mod that
// draws the window, and the window comes back on the page he was on. overlay ids restart with herdr and herdr's own
// Esc closes the window past any hook of ours, so a kept page lives only as long as a reload takes

/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} PageStore */

export const KEPT_PAGE_MS = 10 * 1000;

/** @param {string} overlay */
const pageKey = (overlay) => `x-herdr-settings.page:${overlay}`;

/** @param {PageStore} store @param {string} overlay @param {string} page @param {number} now */
export function keepPage(store, overlay, page, now) {
    store.setItem(pageKey(overlay), JSON.stringify({ at: now, page }));
}

/**
 * @param {PageStore} store @param {string} overlay @param {string} asked the page the window was opened on
 * @param {number} now
 */
export function pageOnOpen(store, overlay, asked, now) {
    try {
        const kept = JSON.parse(store.getItem(pageKey(overlay)) ?? 'null');
        return typeof kept?.page === 'string' && now - kept.at <= KEPT_PAGE_MS
            ? kept.page
            : asked;
    } catch {
        return asked;
    }
}
