// the deck's key commands: a keys.json action `x-herdr-deck.<command>` reaches the deck's `nextCommand()` from any focus,
// so ⌘⇧K ticks here with no relay through another mod

import { orbitSections, tickAllThread } from './orbit.js';

/**
 * the asker ⌘⇧K ticks: none while the deck is hidden, since he could not see the asks go; else `tickAllThread`'s pick
 * among the threads with something to take, the open thread the focused one, whose phases the deck shows:
 * the chat's word is kept from before he went to Terminal view
 * @param {{ pid: number, sid: string, takes: number }[]} rows
 * @param {{ focusedPid: number | null, hovered: string | null, isShown: boolean, shownPid: number | null }} at
 * @returns {string | null}
 */
export function tickAsker(rows, { focusedPid, hovered, isShown, shownPid }) {
    if (!isShown) return null;
    const openPid = focusedPid ?? shownPid;
    return tickAllThread(
        rows.filter((r) => r.takes > 0).map((r) => r.sid),
        {
            hovered,
            shown: rows.find((r) => r.pid === openPid)?.sid ?? null,
        },
    );
}

/**
 * the hovered asker, while its asks still draw as a group: herdr tells no leave of one that went, so it would come back
 * hovered with the pointer elsewhere
 * @param {{ asks: import('./orbit.js').Ask[], name: string, pid: number, sid: string }[]} rows @param {string | null} sid
 */
export function hoverKept(rows, sid) {
    const isDrawn = orbitSections(rows, null, 'top').some(
        (s) => s.kind === 'thread' && s.row.sid === sid,
    );
    return isDrawn ? sid : null;
}

/**
 * whether the deck's own block (the copy with no `view`) is in the shown layout and not hidden; ⌘E hides it
 * @param {any} root herdr's `layout()`
 */
export function isDeckShown(root) {
    /** @param {any} node @returns {boolean} */
    const walk = (node) => {
        if (!node || typeof node !== 'object' || node.hidden) return false;
        if (node.content?.mod === 'x-herdr-deck' && !node.content.props?.view)
            return true;
        return (node.children ?? []).some(walk);
    };
    return walk(root?.root ?? root);
}

/**
 * every key command for the copy's life, each to its one handler
 * @param {() => Promise<string>} next herdr's `nextCommand`
 * @param {Record<string, () => void>} handlers
 */
export async function takeCommands(next, handlers) {
    for (;;) {
        const command = await next();
        handlers[command]?.();
    }
}
