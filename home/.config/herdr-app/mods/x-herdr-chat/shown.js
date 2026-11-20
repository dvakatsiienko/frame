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
 * the session pid of the Claude in a terminal: the process whose environment names it (`ps eww -o
 * pid=,etime=,command=` over the session pids), never a process with no session file. a Claude its hooks start (crow's
 * `claude -p`) inherits the terminal id and writes a session file too: a print-mode Claude is never the terminal's own,
 * and of the rest the one up longest is
 * @param {string} address @param {string} ps @param {number[]} sessions
 * @returns {number | null}
 */
export function pidFor(address, ps, sessions) {
    let found = null;
    let longest = -1;
    for (const line of ps.split('\n')) {
        const [, pid, etime, command = ''] =
            /^\s*(\d+)\s+(\S+)\s+(.*)$/.exec(line) ?? [];
        const up = secondsUp(etime ?? '');
        if (
            sessions.includes(Number(pid)) &&
            addressIn(line) === address &&
            !isPrintMode(command) &&
            up > longest
        ) {
            found = Number(pid);
            longest = up;
        }
    }
    return found;
}

/**
 * a Claude run for one answer (`-p`, `--print`): its flags stand before the environment ps prints after the command
 * @param {string} command
 */
const isPrintMode = (command) =>
    /\s(?:-p|--print)(?:\s|$)/.test(` ${command.split(/\s\w+=/)[0]}`);

/** ps's `etime`, `[[dd-]hh:]mm:ss`, in seconds @param {string} etime */
function secondsUp(etime) {
    const [days, clock] = etime.includes('-') ? etime.split('-') : ['0', etime];
    const [s = 0, m = 0, h = 0] = (clock ?? '')
        .split(':')
        .reverse()
        .map(Number);
    return ((Number(days) * 24 + h) * 60 + m) * 60 + s;
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
 * a viewer ask from another mod (orbit's previews) opens once, on the chat on screen, while fresh
 * @param {import('./chat-asks.js').ChatView | null} ask @param {number | null} last the time of the ask opened last
 * @param {boolean} isShown @param {number} now
 */
export const isViewAsked = (ask, last, isShown, now) =>
    isShown && ask !== null && ask.time !== last && isFreshAsk(ask.time, now);

/**
 * what a draw does about the keyboard and the picker: only the chat on screen acts, so a hidden one never opens a
 * second picker on the same thread. the quill takes the keyboard when the chat comes on screen, on a thread switch
 * and on a fresh ⌘K; a fresh ⌘⇧E not acted on yet opens the picker on the effort, or applies it
 * a fresh ⌘F opens the find bar, which takes the keyboard itself, and a fresh Esc closes the viewer or find
 * @param {{ isShown: boolean, wasShown: boolean, isSwitched: boolean, quillAsk: unknown, lastQuill: unknown,
 *   effortAsk: unknown, lastEffort: unknown, findAsk: unknown, lastFind: unknown, escapeAsk: unknown,
 *   lastEscape: unknown, now: number }} at
 */
export function asksActedOn(at) {
    const isQuillAsked =
        at.quillAsk !== at.lastQuill && isFreshAsk(at.quillAsk, at.now);
    /** @param {unknown} ask @param {unknown} last */
    const isNew = (ask, last) =>
        at.isShown && ask !== last && isFreshAsk(ask, at.now);
    return {
        isEffort: isNew(at.effortAsk, at.lastEffort),
        isEscape: isNew(at.escapeAsk, at.lastEscape),
        isFind: isNew(at.findAsk, at.lastFind),
        isFocus: at.isShown && (!at.wasShown || at.isSwitched || isQuillAsked),
        // a press counts as seen only on screen: the status bar shows the chat and writes the press in one tick, so a
        // draw can see the press while the chat is still hidden
        lastEffort: at.isShown ? at.effortAsk : at.lastEffort,
        lastEscape: at.isShown ? at.escapeAsk : at.lastEscape,
        lastFind: at.isShown ? at.findAsk : at.lastFind,
        lastQuill: at.isShown ? at.quillAsk : at.lastQuill,
    };
}
