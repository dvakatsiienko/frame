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
 * @param {boolean} [hasFiles] files wait over the quill: they go with no words too
 * @returns {{ act: 'click' | 'push' | null, text: string | null, caret: number }} `text`: what the quill holds and
 *   sends, null to leave it as typed; `caret`: where his caret was in it
 */
export function submitted(value, befores, keys, hasFiles = false) {
    if (keys.shift) return { act: null, caret: 0, text: null };
    // Enter with the caret inside the text breaks it there: the words as they were are the message
    const before = befores.find((text) => oneBreakMoreAt(value, text) >= 0);
    const breakAt = before === undefined ? -1 : oneBreakMoreAt(value, before);
    const typed = before ?? value;
    const text = typed.trim();
    const lead = typed.length - typed.trimStart().length;
    return {
        act: text || hasFiles ? (keys.secondary ? 'push' : 'click') : null,
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

/**
 * why a send must wait: a pick typing its keys into the thread would get his words mixed into Claude Code's picker
 * @param {string} address the thread's terminal @param {Set<string>} typingInto the terminals a pick types into
 * @returns {string | null}
 */
export const sendBlocked = (address, typingInto) =>
    typingInto.has(address)
        ? 'A switch is typing into this thread: send again in a moment'
        : null;

// a slash command never joins a running turn: Claude Code queues it until the turn ends
export const SLASH_WAITS = 'runs after this turn';

/**
 * the note under the quill once a message went: a / command sent while the thread is in a turn (working, or blocked on
 * an ask) says it waits; an idle thread runs it now; plain words keep the note their send gave
 * @param {string} message @param {string | null} note @param {boolean} isInTurn
 * @returns {string | null}
 */
export const sentNote = (message, note, isInTurn) =>
    message.startsWith('/') && isInTurn ? `a / command ${SLASH_WAITS}` : note;

/**
 * whether a thread is in a turn by herdr's status: working, or blocked on an ask mid-turn; a / command waits for its end
 * @param {string | null | undefined} status
 */
export const inTurn = (status) => status === 'working' || status === 'blocked';
