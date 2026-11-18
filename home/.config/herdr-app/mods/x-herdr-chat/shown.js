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
