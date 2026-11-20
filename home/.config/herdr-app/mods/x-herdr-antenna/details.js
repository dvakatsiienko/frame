// a row's details (FRM-618 slice A): its time as waiting or idle (slice D, from the state file), its context fill and its wait line, each
// drawn only while its knob is on and its fact was read; a fact never read draws nothing, never a zero

/** @param {number} ms */
export function duration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return '<1m';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/** @typedef {{ state: 'working' | 'waiting' | 'idle', since: number }} Activity */

/**
 * a row's dot and time, from the thread's state file (FRM-618 slice D): working breathes with no time, waiting and idle
 * say since when; a thread with no live file draws idle; herdr's own status speaks only for a permission prompt
 * @param {string} status herdr's status for the terminal
 * @param {Activity | null} activity the deck's fact, read from the state file
 * @param {number} now
 * @returns {{ dot: 'working' | 'waiting' | 'idle' | 'blocked', time: string | null }}
 */
export function activityShown(status, activity, now) {
    if (status === 'blocked') return { dot: 'blocked', time: null };
    const state = activity?.state ?? 'idle';
    return {
        dot: state,
        time:
            state === 'working' || !activity
                ? null
                : `${state} ${duration(now - activity.since)}`,
    };
}

/**
 * @param {Record<string, unknown>} settings antenna's knobs
 * @param {{ time: string | null, context: number | null, model: string | null, wait: string | null }} facts
 * @returns {{ idle: string | null, context: string | null, model: string | null, wait: string | null }}
 */
export function rowDetails(settings, { context, model, time, wait }) {
    return {
        context:
            settings['antenna.details.context'] && typeof context === 'number'
                ? `${context}%`
                : null,
        idle: (settings['antenna.details.idle'] && time) || null,
        model: (settings['antenna.details.model'] && model) || null,
        wait: (settings['antenna.details.wait'] && wait) || null,
    };
}

/**
 * a wait line's runs, its `**bold**` marks read: antenna draws them as plain text, never a selectable text view
 * @param {string} wait @returns {{ isBold: boolean, text: string }[]}
 */
export function waitRuns(wait) {
    return wait
        .split(/\*\*(.+?)\*\*/)
        .map((text, i) => ({ isBold: i % 2 === 1, text }))
        .filter((run) => run.text);
}
