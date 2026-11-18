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
 * Shift+Tab until the mode line reads `mode`, at most one round of the cycle; resolves with the mode it ends at
 * @param {string} mode @param {PermissionIo} io
 * @returns {Promise<string | null>}
 */
export async function permissionIn(mode, io) {
    let now = permissionOf(await io.screen());
    for (let i = 0; i <= PERMISSIONS.length && now !== mode; i++) {
        await io.keys(['shift+tab']);
        await io.sleep(250);
        now = permissionOf(await io.screen());
    }
    return now;
}

/**
 * @typedef {object} PermissionIo the thread, as a mode change reaches it
 * @property {(keys: string[]) => Promise<void>} keys
 * @property {() => Promise<string>} screen
 * @property {(ms: number) => Promise<void>} sleep
 */
