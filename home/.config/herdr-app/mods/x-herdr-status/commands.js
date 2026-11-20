// x-herdr's keys (FRM-577) as herdr hands them to the status bar, the one mod always placed: each command does its
// one thing in whatever view is shown

import { exec, layout, nextCommand, openOverlay, run, setShared } from 'herdr';

import { deckToggleId } from './blocks.js';
import { chatSelectArgs, settingsOverlay } from './chat-asks.js';

/** whether a window, dialog or popup sits over the layout: no mod api lists them, the window's status does */
async function isOverlayOpen() {
    const status = await exec('herdr-app', ['status']).catch(() => null);
    try {
        return JSON.parse(status?.stdout ?? '').overlays?.length > 0;
    } catch {
        return false;
    }
}

const shownTree = () => /** @type {any} */ (layout())?.root ?? layout();

/** every x-herdr key's command, for the mod's life */
export async function takeCommands() {
    for (;;) {
        const command = await nextCommand();
        // ⌘F over an open window or dialog does nothing: find opens only on the chat in view (dima, 18:28)
        if (command === 'find' && (await isOverlayOpen())) continue;
        // ⌘F from any focus opens the chat's find; a terminal keeps its own ⌘F (keys.json's terminal section)
        if (command === 'quill' || command === 'effort' || command === 'find') {
            const chat = chatSelectArgs(layout());
            if (chat) run('layout.select', chat);
            setShared(`chat.${command}`, Date.now());
        } else if (command === 'escape') {
            // the chat on screen closes its viewer or find; no view is switched for it
            setShared('chat.escape', Date.now());
        } else if (command === 'settings') {
            // ⌘⇧, opens the settings (x-herdr-settings) on its first page; the window's key keeps one open. no
            // «anything open?» gate: after a herdr restart it kept ⌘⇧, dead until settings opened once (dima, 19:11)
            openOverlay(settingsOverlay('general'));
        } else if (command === 'deck') {
            const id = deckToggleId(shownTree());
            if (id) run('layout.toggle', { id });
        }
    }
}
