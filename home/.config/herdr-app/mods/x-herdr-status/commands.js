// x-herdr's keys (FRM-577) as herdr hands them to the status bar, the one mod always placed: each command does its
// one thing in whatever view is shown

import { exec, layout, nextCommand, openOverlay, run, setShared } from 'herdr';

import { settingsOverlay } from './chat-asks.js';

/** whether a window, dialog or popup sits over the layout: no mod api lists them, the window's status does */
async function isOverlayOpen() {
    const status = await exec('herdr-app', ['status']).catch(() => null);
    try {
        return JSON.parse(status?.stdout ?? '').overlays?.length > 0;
    } catch {
        return false;
    }
}

/** the first block of the shown layout whose content passes `test` @param {(content: any) => unknown} test */
function blockOf(test) {
    /** @param {any} node @returns {any} */
    const walk = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (test(node.content)) return node;
        for (const child of node.children ?? []) {
            const found = walk(child);
            if (found) return found;
        }
        return null;
    };
    return walk(/** @type {any} */ (layout())?.root ?? layout());
}

/** every x-herdr key's command, for the mod's life */
export async function takeCommands() {
    for (;;) {
        const command = await nextCommand();
        // ⌘F over an open window or dialog does nothing: find opens only on the chat in view (dima, 18:28)
        if (command === 'find' && (await isOverlayOpen())) continue;
        // ⌘F from any focus opens the chat's find; a terminal keeps its own ⌘F (keys.json's terminal section)
        if (command === 'quill' || command === 'effort' || command === 'find') {
            const chat = blockOf(
                (c) => c?.mod === 'x-herdr-chat' && c.props?.stack,
            );
            if (chat)
                run('layout.select', {
                    child: chat.content.props.self,
                    stack: chat.content.props.stack,
                });
            setShared(`chat.${command}`, Date.now());
        } else if (command === 'escape') {
            // the chat on screen closes its viewer or find; no view is switched for it
            setShared('chat.escape', Date.now());
        } else if (command === 'settings') {
            // ⌘⇧, opens the settings (x-herdr-settings) on its first page; one open already stays the one
            if (!(await isOverlayOpen()))
                openOverlay(settingsOverlay('general'));
        } else if (command === 'tickall') {
            setShared('deck.tickAll', Date.now());
        } else if (command === 'deck') {
            const deck = blockOf(
                (c) => c?.mod === 'x-herdr-deck' && !c.props?.view,
            );
            if (deck) run('layout.toggle', { id: deck.id });
        }
    }
}
