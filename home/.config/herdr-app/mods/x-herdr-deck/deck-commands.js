// the deck's key commands: a keys.json action `x-herdr-deck.<command>` reaches the deck's `nextCommand()` from any focus,
// so ⌘⇧K ticks here with no relay through another mod

import { tickAllThread } from './orbit.js';

/**
 * the asker ⌘⇧K ticks: none while the deck is hidden, since he could not see the asks go; else `tickAllThread`'s pick
 * among the threads with something to take, the chat's thread found by its pid
 * @param {{ pid: number, sid: string, takes: number }[]} rows
 * @param {{ isShown: boolean, hovered: string | null, picked: string | null, pid: number | undefined }} at
 * @returns {string | null}
 */
export function tickAsker(rows, { isShown, hovered, picked, pid }) {
    if (!isShown) return null;
    return tickAllThread(
        rows.filter((r) => r.takes > 0).map((r) => r.sid),
        {
            hovered,
            picked,
            shown: rows.find((r) => r.pid === pid)?.sid ?? null,
        },
    );
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
