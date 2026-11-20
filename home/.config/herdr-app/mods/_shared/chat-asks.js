// how another mod reaches the chat on screen: it writes a press's time under an ask key, the chat on screen acts on
// a fresh one; the chat writes back which thread it shows under `chat.shown`

export const CHAT_ASK = /** @type {const} */ ({
    effort: 'chat.effort',
    escape: 'chat.escape',
    find: 'chat.find',
    quill: 'chat.quill',
});

export const CHAT_SHOWN = 'chat.shown';

// a picture another mod asks the chat's viewer to open (orbit's previews, FRM-676): a `ChatView`, its time the press's
export const CHAT_VIEW = 'chat.view';

/** @typedef {{ files: string[], at: number, isDesktop: boolean, time: number }} ChatView */

/** a viewer ask, read safely from herdr's shared value: null when it names no picture to open @returns {ChatView | null} */
export function chatViewOf(/** @type {unknown} */ value) {
    const v = /** @type {Partial<ChatView> | null} */ (
        value && typeof value === 'object' ? value : null
    );
    const files = Array.isArray(v?.files)
        ? v.files.filter((f) => typeof f === 'string')
        : [];
    const at = typeof v?.at === 'number' ? v.at : -1;
    if (!files[at] || typeof v?.time !== 'number') return null;
    return { at, files, isDesktop: v.isDesktop === true, time: v.time };
}

/**
 * what `layout.select` takes to bring the chat into view: its block's child in its stack, or null with none stacked
 * @param {any} tree the shown layout
 * @returns {{ child: string, stack: string } | null}
 */
export function chatSelectArgs(tree) {
    /** @param {any} node @returns {{ child: string, stack: string } | null} */
    const find = (node) => {
        if (!node || typeof node !== 'object') return null;
        const props =
            node.content?.mod === 'x-herdr-chat' && node.content.props;
        if (props?.stack) return { child: props.self, stack: props.stack };
        for (const child of node.children ?? []) {
            const found = find(child);
            if (found) return found;
        }
        return null;
    };
    return find(tree?.root ?? tree);
}

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
