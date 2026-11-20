// the top bar with tabs hidden (FRM-618 slice A): the focused thread's name, as antenna publishes it, and its wait line,
// as the deck publishes it by pid; no focused or unnamed thread draws nothing

/**
 * @param {string | null | undefined} address the focused agent's terminal
 * @param {Record<string, string> | null | undefined} names address → thread name
 * @param {Record<string, number> | null | undefined} pids address → pid
 * @param {unknown} deck what the deck publishes under `x-herdr-deck.threads`
 * @returns {{ name: string, wait: string | null } | null}
 */
export function focusedLine(address, names, pids, deck) {
    const name = address ? names?.[address] : null;
    if (!name) return null;
    const pid = pids?.[address];
    const threads =
        /** @type {{ threads?: Record<string, { wait?: unknown }> } | null} */ (
            deck
        )?.threads;
    const wait = pid == null ? null : threads?.[String(pid)]?.wait;
    return { name, wait: typeof wait === 'string' && wait ? wait : null };
}
