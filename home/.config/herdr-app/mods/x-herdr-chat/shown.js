import { addressIn } from './send.js';

/**
 * the thread the chat shows: in the focused tab, the focused pane's Claude, else the one shown before, else the tab's
 * first; a tab with no Claude shows none (the old chat's `target()`, the window's one rule until the swap)
 * @param {Array<{ address: string, app: string | null, tab: string }>} agents
 * @param {{ agent: string | null, tab: string, terminal: string | null } | null} focus
 * @param {string | null} shown
 * @returns {string | null}
 */
export function shownThread(agents, focus, shown) {
    if (!focus) return null;
    const mine = agents.filter(
        (a) => a.app === 'claude-code' && a.tab === focus.tab,
    );
    const at = focus.agent ?? focus.terminal;
    return (
        (
            mine.find((a) => a.address === at) ??
            mine.find((a) => a.address === shown) ??
            mine[0]
        )?.address ?? null
    );
}

/**
 * the session pid of the Claude in a terminal: the process whose environment names it (`ps eww -o pid=,command=`
 * over the session pids), never a process with no session file
 * @param {string} address @param {string} ps @param {number[]} sessions
 * @returns {number | null}
 */
export function pidFor(address, ps, sessions) {
    for (const line of ps.split('\n')) {
        const pid = Number(/^\s*(\d+)\s/.exec(line)?.[1]);
        if (sessions.includes(pid) && addressIn(line) === address) return pid;
    }
    return null;
}

/**
 * whether the chat is on screen: in a layout stack, its child is the one shown (the first while none was picked); a
 * chat in no stack always is
 * @param {unknown} tree the shown layout @param {string | undefined} stack @param {string | undefined} self
 */
export function isShownIn(tree, stack, self) {
    if (!stack) return true;
    /** @param {any} node @returns {any} */
    const find = (node) =>
        node?.id === stack
            ? node
            : (node?.children ?? []).map(find).find(Boolean);
    const node = find(tree);
    return (node?.active ?? node?.children?.[0]?.id) === self;
}

// a ⌘K or ⌘⇧E press the status bar wrote this long ago is still acted on: one the chat slept through is dropped
const ASK_FRESH_MS = 2000;

/** @param {unknown} ask the press's time, as the status bar wrote it @param {number} now */
export const isFreshAsk = (ask, now) =>
    typeof ask === 'number' && now - ask < ASK_FRESH_MS;

/**
 * what a draw does about the keyboard and the picker: only the chat on screen acts, so a hidden one never opens a
 * second picker on the same thread. the quill takes the keyboard when the chat comes on screen, on a thread switch
 * and on a fresh ⌘K; a fresh ⌘⇧E not acted on yet opens the picker on the effort, or applies it
 * @param {{ isShown: boolean, wasShown: boolean, isSwitched: boolean, quillAsk: unknown, lastQuill: unknown,
 *   effortAsk: unknown, lastEffort: unknown, now: number }} at
 */
export function asksActedOn(at) {
    const isQuillAsked =
        at.quillAsk !== at.lastQuill && isFreshAsk(at.quillAsk, at.now);
    return {
        isEffort:
            at.isShown &&
            at.effortAsk !== at.lastEffort &&
            isFreshAsk(at.effortAsk, at.now),
        isFocus: at.isShown && (!at.wasShown || at.isSwitched || isQuillAsked),
    };
}
