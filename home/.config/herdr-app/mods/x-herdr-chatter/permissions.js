// a copy of x-herdr-chat/picker.js's permission half: a mod cannot import a sibling's file; one goes at the swap

// Claude Code's permission modes, in the order Shift+Tab cycles them (probed 2026-11-17 00:35 on a throwaway thread,
// started in bypass): each read off the mode line at the foot of its screen. a change applies live, mid-turn too
export const PERMISSIONS = [
    {
        id: 'bypassPermissions',
        label: 'Full access',
        shows: /bypass permissions on/,
    },
    { id: 'auto', label: 'Auto', shows: /auto mode on/ },
    { id: 'default', label: 'Ask', shows: /manual mode on/ },
    { id: 'acceptEdits', label: 'Accept edits', shows: /accept edits on/ },
    { id: 'plan', label: 'Plan', shows: /plan mode on/ },
];

/** the mode the thread runs in, from the last mode line on its screen; null with none @param {string} screen */
export function permissionOf(screen) {
    const lines = screen.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const found = PERMISSIONS.find((p) => p.shows.test(lines[i] ?? ''));
        if (found) return found.id;
    }
    return null;
}

/**
 * Shift+Tab until the mode line reads `mode`, one press per redraw seen. it stops on the mode it started in once the
 * cycle comes round (a thread's cycle can lack a mode), on a screen with no mode line, on a footer that never redraws,
 * and before any press while the thread asks a question: a key there would answer it. resolves with the mode it ends at
 * @param {string} mode @param {PermissionIo} io
 * @returns {Promise<string | null>}
 */
export async function permissionIn(mode, io) {
    const start = permissionOf(await io.screen());
    let now = start;
    for (
        let i = 0;
        i < PERMISSIONS.length && now !== null && now !== mode;
        i++
    ) {
        if (io.isBlocked()) break;
        const was = now;
        await io.keys(['shift+tab']);
        for (let wait = 0; wait < REDRAW_READS && now === was; wait++) {
            await io.sleep(REDRAW_MS);
            now = permissionOf(await io.screen());
        }
        if (now === was || now === start) break;
    }
    return now;
}

const REDRAW_READS = 20;
const REDRAW_MS = 50;

/**
 * @typedef {object} PermissionIo the thread, as a mode change reaches it
 * @property {(keys: string[]) => Promise<void>} keys
 * @property {() => Promise<string>} screen
 * @property {(ms: number) => Promise<void>} sleep
 * @property {() => boolean} isBlocked
 */
