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

/** @typedef {{ code?: number, stdout?: string } | null | undefined} HcReply what `hc get <t> --json` resolved with */

/**
 * whether closing this pane asks first. it closes at once only for what is proven harmless: a pane with no terminal,
 * a terminal `hc` reports ended, or a shell that is its own foreground process (idle). everything else asks: an agent,
 * a program that is no shell, a shell with a program running in it, and any reply that is not the shape expected
 * @param {{ agent?: boolean, shell?: boolean } | null | undefined} program
 * @param {string | null | undefined} terminal
 * @param {HcReply} got
 */
export function closeAsks(program, terminal, got) {
    if (!terminal) return false;
    if (program?.agent || got?.code !== 0) return true;
    /** @type {{ state?: unknown, pid?: unknown, foreground?: { pid?: unknown } | null }} */
    let facts;
    try {
        facts = JSON.parse(got.stdout ?? '');
    } catch {
        return true;
    }
    if (facts?.state === 'finished') return false;
    const isIdleShell =
        facts?.state === 'live' &&
        program?.shell === true &&
        typeof facts.pid === 'number' &&
        facts.foreground?.pid === facts.pid;
    return !isIdleShell;
}

// a control in the draggable bar keeps its own press, and the bar swallows a wheel: neither reaches the window or
// herdr's tab switch
/** @param {unknown} _e @param {{ stop_propagation(): void }} cx */
export const swallow = (_e, cx) => cx.stop_propagation();

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
