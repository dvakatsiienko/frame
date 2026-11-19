// how another mod reaches the chat on screen: it writes a press's time under an ask key, the chat on screen acts on
// a fresh one; the chat writes back which thread it shows under `chat.shown`

export const CHAT_ASK = /** @type {const} */ ({
    effort: 'chat.effort',
    escape: 'chat.escape',
    find: 'chat.find',
    quill: 'chat.quill',
});

export const CHAT_SHOWN = 'chat.shown';

/** @typedef {{ pid: number | null, address: string | null, isFindOpen: boolean }} ChatShown */

/** what the chat says it shows, read safely from herdr's shared value @param {unknown} value @returns {ChatShown} */
export function chatShownOf(value) {
    const v = /** @type {Partial<ChatShown> | null} */ (
        value && typeof value === 'object' ? value : null
    );
    return {
        address: typeof v?.address === 'string' ? v.address : null,
        isFindOpen: v?.isFindOpen === true,
        pid: typeof v?.pid === 'number' ? v.pid : null,
    };
}

/**
 * the settings window: herdr's middle, the card the chat draws. a window, since herdr closes a dialog on Esc before
 * the mod sees it and the Keys page's Esc must cancel a rebind first (probe, 19 Nov 19:43); its key keeps one open
 * @param {string} page
 */
export const settingsOverlay = (page) => ({
    frame: /** @type {const} */ ('none'),
    height: 0.92,
    key: 'x-herdr-settings',
    kind: /** @type {const} */ ('window'),
    mod: 'x-herdr-chat',
    props: { settingsWindow: page },
    width: 860,
});
