// the tab pills' rules with no drawing in them: which pane speaks for a tab, what a pill is called, when a close asks

/** @typedef {{ pane: string, tab: string, terminal: string | null, focused: boolean, program?: { agent?: boolean } | null }} Pane */

/**
 * the pane a tab's pill speaks for: the focused one, else its agent, else the first (herdr's `terminals-bar` rule)
 * @template {Pane} P
 * @param {P[]} all @param {string} tabId @returns {P | undefined}
 */
export function leadPane(all, tabId) {
    const mine = all.filter((p) => p.tab === tabId);
    return (
        mine.find((p) => p.focused) ??
        mine.find((p) => p.program?.agent) ??
        mine[0]
    );
}

/**
 * a thread's registry name as a pill shows it: the member word after the badges dropped, «⚡ 🔧 codie: herdr | FRM-1»
 * → «⚡ 🔧 herdr | FRM-1»; the badges already say who, and a cut pill keeps what tells it apart
 * @param {string} name
 */
export function pillLabel(name) {
    const parts = /^([^\p{L}\p{N}]*[^\s\p{L}\p{N}]\s*)[^:]+:\s*(.+)$/u.exec(
        name,
    );
    return parts ? `${parts[1]}${parts[2]}` : name;
}

/**
 * what a pill is called: its thread's registry name when the tab holds a thread (the names the agents list publishes,
 * by terminal address), else the tab's own name. `full` is the hover text
 * @param {{ name: string }} tab
 * @param {(string | null | undefined)[]} terminals the tab's terminals, the speaking pane's first
 * @param {Record<string, string> | null | undefined} names
 * @returns {{ label: string, full: string, isThread: boolean }}
 */
export function pillName(tab, terminals, names) {
    const address = terminals.find((a) => a && names?.[a]);
    const session = address ? names?.[address] : undefined;
    return session
        ? { full: session, isThread: true, label: pillLabel(session) }
        : { full: tab.name, isThread: false, label: tab.name };
}

/** @typedef {{ state?: string, pid?: number, foreground?: { pid?: number } | null }} TerminalFacts as `hc get <t> --json` prints */

/**
 * whether closing this pane asks first: an agent always; a shell only while a program runs in it (its foreground
 * process is not the shell itself). an idle shell, an ended terminal and a mod pane close at once
 * @param {{ agent?: boolean } | null | undefined} program
 * @param {TerminalFacts | null | undefined} facts
 */
export function closeAsks(program, facts) {
    if (program?.agent) return true;
    if (facts?.state !== 'live' || !facts.foreground) return false;
    return facts.foreground.pid !== facts.pid;
}

/**
 * the confirm dialog's words for a tab that asks
 * @param {string} name @param {string} spaceName @param {number} agentCount
 */
export const closeWords = (name, spaceName, agentCount) => ({
    detail: `${spaceName} · ${name}. Closing the tab ends ${
        agentCount > 1
            ? `${agentCount} agents`
            : agentCount === 1
              ? 'its agent'
              : 'the program running in it'
    } and it can't be reopened here.`,
    title: `Close ${name}?`,
});
