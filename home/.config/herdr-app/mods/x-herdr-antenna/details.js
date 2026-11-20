// a row's details (FRM-618 slice A): idle time since its status changed, its context fill and its wait line, each
// drawn only while its knob is on and its fact was read; a fact never read draws nothing, never a zero

/** @param {number} ms */
export function duration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return '<1m';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/**
 * @param {Record<string, unknown>} settings antenna's knobs
 * @param {{ since: number, context: number | null, model: string | null, wait: string | null }} facts
 * @param {number} now
 * @returns {{ idle: string | null, context: string | null, model: string | null, wait: string | null }}
 */
export function rowDetails(settings, { context, model, since, wait }, now) {
    return {
        context:
            settings['antenna.details.context'] && typeof context === 'number'
                ? `${context}%`
                : null,
        idle:
            settings['antenna.details.idle'] && since > 0
                ? duration(now - since)
                : null,
        model: (settings['antenna.details.model'] && model) || null,
        wait: (settings['antenna.details.wait'] && wait) || null,
    };
}
