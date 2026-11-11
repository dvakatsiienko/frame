// a message between threads: one folded line, «sender → receiver · first words · time», that opens to its whole text

const FIRST_WORDS = 72;

/**
 * a message another thread sent this one, from its transcript entry: Claude Code writes it as a meta user entry when
 * it starts a turn, or as a queued command when it lands mid-turn; both carry the sender in `origin`
 * @param {any} entry
 * @returns {{ kind: 'relay', dir: 'in', from: string, text: string, at: string | null, msgId: string | null } | null}
 */
export function relayIn(entry) {
    const origin =
        entry?.type === 'attachment' &&
        entry.attachment?.type === 'queued_command'
            ? entry.attachment.origin
            : entry?.type === 'user'
              ? entry.origin
              : null;
    if (origin?.kind !== 'peer' || typeof origin.body !== 'string') return null;
    return {
        at: entry.timestamp ?? null,
        dir: 'in',
        from: origin.name || 'another thread',
        kind: 'relay',
        msgId: origin.msg_id ?? null,
        text: origin.body.trim(),
    };
}

/**
 * the folded line: who to whom, the first words of its first line, the time
 * @param {{ from: string, to: string, text: string, at: string | null }} relay
 * @returns {string}
 */
export function relayLine({ at, from, text, to }) {
    const first = (text.split('\n').find((l) => l.trim()) ?? '').trim();
    const words =
        first.length > FIRST_WORDS
            ? `${first.slice(0, FIRST_WORDS).replace(/\s+\S*$/, '')}…`
            : first;
    const time = clockOf(at);
    return [`${from} → ${to}`, words, time].filter(Boolean).join(' · ');
}

/**
 * an iso timestamp as the local HH:MM, or '' when there is none
 * @param {string | null} at
 */
export function clockOf(at) {
    const d = at ? new Date(at) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
