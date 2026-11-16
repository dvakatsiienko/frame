// his message's way out of the quill: what a press of Enter sends, and which thread takes it.

/**
 * the herdr address of the thread a Claude runs in, read from its process line with its environment (`ps eww`): herdr
 * starts every thread with HC_TERMINAL_ID. the environment follows the arguments, so the last one is its own
 * @param {string} processLine
 * @returns {string | null}
 */
export function addressIn(processLine) {
    return (
        [...processLine.matchAll(/(?:^|\s)HC_TERMINAL_ID=(\S+)/g)].at(
            -1,
        )?.[1] ?? null
    );
}

/**
 * what the quill's submit does. the box has typed Enter's line break already: Shift+Enter keeps it, Enter sends the
 * text without it
 * @param {string} value the quill's text at the submit
 * @param {boolean} isShift
 * @returns {{ text: string | null, box: string | null }} the text to send, null for none; what the quill holds
 *   after, null to leave it as typed
 */
export function submitted(value, isShift) {
    if (isShift) return { box: null, text: null };
    return { box: '', text: value.trim() || null };
}
