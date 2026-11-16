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
 * what the quill's submit does. the box has typed Enter's line break already, at the caret: Shift+Enter keeps it; Enter
 * acts on the text as it was before the break, cmd+Enter sending it now and Enter alone being a click on send
 * @param {string} value the quill's text at the submit
 * @param {string} before the quill's text one change earlier
 * @param {{ shift?: boolean, secondary?: boolean }} keys
 * @returns {{ act: 'click' | 'push' | null, text: string | null }} `text`: what the quill holds and sends, null to
 *   leave it as typed
 */
export function submitted(value, before, keys) {
    if (keys.shift) return { act: null, text: null };
    // Enter with the caret inside the text breaks it there: the words as they were are the message
    const typed = isOneBreakMore(value, before) ? before : value;
    const text = typed.trim();
    return { act: text ? (keys.secondary ? 'push' : 'click') : null, text };
}

/** `value` is `before` with one line break typed into it @param {string} value @param {string} before */
function isOneBreakMore(value, before) {
    if (value.length !== before.length + 1) return false;
    let at = 0;
    while (at < before.length && value[at] === before[at]) at++;
    return value[at] === '\n' && value.slice(at + 1) === before.slice(at);
}
