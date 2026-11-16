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
 * @param {string[]} befores the quill's last texts, newest first: the break's own change may or may not have been
 *   seen by the submit (in his window it was not, 2026-11-16: the break stayed in the message)
 * @param {{ shift?: boolean, secondary?: boolean }} keys
 * @returns {{ act: 'click' | 'push' | null, text: string | null, caret: number }} `text`: what the quill holds and
 *   sends, null to leave it as typed; `caret`: where his caret was in it
 */
export function submitted(value, befores, keys) {
    if (keys.shift) return { act: null, caret: 0, text: null };
    // Enter with the caret inside the text breaks it there: the words as they were are the message
    const before = befores.find((text) => oneBreakMoreAt(value, text) >= 0);
    const breakAt = before === undefined ? -1 : oneBreakMoreAt(value, before);
    const typed = before ?? value;
    const text = typed.trim();
    const lead = typed.length - typed.trimStart().length;
    return {
        act: text ? (keys.secondary ? 'push' : 'click') : null,
        caret:
            breakAt < 0
                ? text.length
                : Math.min(text.length, Math.max(0, breakAt - lead)),
        text,
    };
}

/**
 * where `value` holds one line break more than `before`, -1 when it is not `before` with one break typed in
 * @param {string} value
 * @param {string} before
 */
function oneBreakMoreAt(value, before) {
    if (value.length !== before.length + 1) return -1;
    let at = 0;
    while (at < before.length && value[at] === before[at]) at++;
    return value[at] === '\n' && value.slice(at + 1) === before.slice(at)
        ? at
        : -1;
}

// a held Enter repeats its submit every few ms, and one press can be seen twice: only the first sighting acts
export const SUBMIT_REST_MS = 300;
