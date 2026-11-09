// orbit on herdr's board, as pure steps: what the stash store holds for a session, and the ticks file herdr's board
// alone writes for it (`~/.claude/shelf/orbit-ticks/<sid>.jsonl`, one press per line), which x-mod-stash reads at the
// session's next turn (FRM-552)

/** @typedef {{ id: string | null, text: string, pick: string | null, mark: string | null, isLocked: boolean }} Ask */
/** @typedef {{ id: string, verdict: 'tick' | 'replay', steer?: string, at: number }} Press */

/**
 * the open asks the stash keeps for a session; an entry stored before items carried ids has text alone and cannot be
 * pressed
 * @param {Record<string, any>} store
 * @param {string} sid
 * @returns {Ask[]}
 */
export function asksOf(store, sid) {
    const entry = store[`asks:${sid}`];
    if (Array.isArray(entry?.items))
        return entry.items
            .filter(
                (/** @type {any} */ a) =>
                    typeof a?.id === 'string' && typeof a.text === 'string',
            )
            .map(
                (/** @type {any} */ a) =>
                    /** @type {Ask} */ ({
                        id: a.id,
                        isLocked: a.isLocked === true,
                        mark: a.mark ?? null,
                        pick: a.pick ?? null,
                        text: a.text,
                    }),
            );
    return (entry?.asks ?? [])
        .filter((/** @type {unknown} */ t) => typeof t === 'string')
        .map(
            (/** @type {string} */ text) =>
                /** @type {Ask} */ ({
                    id: null,
                    isLocked: false,
                    mark: null,
                    pick: null,
                    text,
                }),
        );
}

/**
 * the session's phases, as its stash kept them
 * @param {Record<string, any>} store
 * @param {string} sid
 * @returns {string[]}
 */
export function phasesOf(store, sid) {
    const lines = store[`kept:${sid}`]?.orbit?.plan?.lines;
    return Array.isArray(lines)
        ? lines.filter((l) => typeof l === 'string')
        : [];
}

/**
 * the ticks file after one more press: its lines for asks still open, then the press; JSON.stringify keeps a steer
 * holding quotes or a newline on one line
 * @param {string | null} text
 * @param {Press} press
 * @param {string[]} openIds
 */
export function withPress(text, press, openIds) {
    const kept = (text ?? '').split('\n').filter((line) => {
        try {
            return openIds.includes(JSON.parse(line).id);
        } catch {
            return false;
        }
    });
    return [...kept, JSON.stringify(press)].map((line) => `${line}\n`).join('');
}

/**
 * writes one press with herdr's compare-and-swap write: a file changed since the read is refused, read again and
 * written over its fresh text, so no press is lost; a second refusal is thrown
 * @param {{ read: (path: string) => Promise<string | null>, write: (path: string, text: string, expected: string | null) => Promise<unknown> }} io
 * @param {string} path
 * @param {Press} press
 * @param {string[]} openIds
 */
export async function savePress(io, path, press, openIds) {
    for (let tries = 2; ; tries--) {
        const text = await io.read(path);
        try {
            return await io.write(path, withPress(text, press, openIds), text);
        } catch (err) {
            if (tries <= 1) throw err;
        }
    }
}
