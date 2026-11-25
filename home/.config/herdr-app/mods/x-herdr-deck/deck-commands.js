// the deck's key commands: a keys.json action `x-herdr-deck.<command>` reaches the deck's `nextCommand()` from any focus,
// so ⌘⇧K ticks here with no relay through another mod

import { orbitSections } from './orbit.js';

/**
 * the asker ⌘⇧K ticks: the one under the pointer, else the thread open on screen (FRM-620:W61, W62); the picked one alone,
 * so one with nothing left to take ticks nobody else's asks. none while the deck is hidden, since he could not see them go
 * @param {{ pid: number, sid: string, takes: number }[]} rows
 * @param {{ hovered: string | null, isShown: boolean, openPid: number | null }} at
 * @returns {string | null}
 */
export function tickAsker(rows, { hovered, isShown, openPid }) {
    if (!isShown) return null;
    const asker = rows.find((r) =>
        hovered ? r.sid === hovered : r.pid === openPid,
    );
    return asker && asker.takes > 0 ? asker.sid : null;
}

/**
 * the open thread's pid: the focused one's; with no thread focused, the one the chat shows, while the chat is on screen,
 * since a hidden chat's word is kept from before he went to Terminal view. the pid is antenna's alone: the chat names its
 * new thread at once, its pid only once ps answers
 * @param {{ address: string | null, chatAddress: string | null, isChatShown: boolean, pids: Record<string, number> | null }} at
 */
export function openThreadPid({ address, chatAddress, isChatShown, pids }) {
    const open = address ?? (isChatShown ? chatAddress : null);
    return open ? (pids?.[open] ?? null) : null;
}

/**
 * the hovered asker, while its asks still draw as a group and ⌘E toggled no deck since: herdr tells no leave of an element
 * that went, so it would come back hovered with the pointer elsewhere
 * @param {{ asks: import('./orbit.js').Ask[], name: string, pid: number, sid: string }[]} rows
 * @param {{ at: number, sid: string } | null} hover @param {unknown} toggledAt
 */
export function hoverKept(rows, hover, toggledAt) {
    if (!hover || (typeof toggledAt === 'number' && hover.at <= toggledAt))
        return null;
    const isDrawn = orbitSections(rows, null, 'top').some(
        (s) => s.kind === 'thread' && s.row.sid === hover.sid,
    );
    return isDrawn ? hover : null;
}

/**
 * whether a mod's block is on screen: no hidden node above it, and in a stack under the child shown
 * @param {any} root herdr's `layout()` @param {(content: any) => boolean} isMine
 */
function isBlockShown(root, isMine) {
    /** @param {any} node @returns {boolean} */
    const walk = (node) => {
        if (!node || typeof node !== 'object' || node.hidden) return false;
        if (node.content && isMine(node.content)) return true;
        const children = /** @type {any[]} */ (node.children ?? []);
        if (node.type !== 'stack') return children.some(walk);
        const live = children.filter((c) => !c?.hidden);
        return walk(live.find((c) => c.id === node.active) ?? live[0]);
    };
    return walk(root?.root ?? root);
}

/** the deck's own block (the copy with no `view`); ⌘E hides it @param {any} root herdr's `layout()` */
export const isDeckShown = (root) =>
    isBlockShown(root, (c) => c.mod === 'x-herdr-deck' && !c.props?.view);

/** the chat, whose stack's other child is Terminal view @param {any} root herdr's `layout()` */
export const isChatShown = (root) =>
    isBlockShown(root, (c) => c.mod === 'x-herdr-chat');

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
