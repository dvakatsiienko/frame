// orbit on herdr's board, as pure steps: what the stash store holds for a session, and the ticks file herdr's board
// alone writes for it (`~/.claude/shelf/orbit-ticks/<sid>.jsonl`, one press per line), which x-mod-stash reads at the
// session's next turn (FRM-552)

/** @typedef {{ id: string | null, text: string, pick: string | null, mark: string | null, isLocked: boolean }} Ask */
/** @typedef {{ id: string, verdict: 'tick' | 'replay', steer?: string, text?: string, at: number }} Press */

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
 * the id a session's state lives under now: a `/clear` or `/resume` leaves `succ:<old id>` naming the id it went on as
 * @param {Record<string, any>} store
 * @param {string} sid
 */
export function currentSid(store, sid) {
    const seen = new Set([sid]);
    let now = sid;
    for (;;) {
        const next = store[`succ:${now}`]?.sid;
        if (typeof next !== 'string' || seen.has(next)) return now;
        seen.add(next);
        now = next;
    }
}

/**
 * the pids `ps -o pid= -p <pids>` printed, the ones still running
 * @param {string} stdout
 */
export const runningPids = (stdout) =>
    new Set(
        stdout
            .split('\n')
            .map((l) => Number(l.trim()))
            .filter((n) => n > 0),
    );

/**
 * an ask whose tick x-mod-guard reads as dima's word — a sign, a ⚠️ or merge ask, one quoting a command — never takes a
 * herdr tick, since any agent can write the ticks file (FRM-552 Decision 4); dima ticks it in the seat's own /board
 * @param {string} text
 */
export const isGuardGated = (text) =>
    /(?:^|\s)✍️ sign (?:FRM|BYT)-\d+|⚠️|^\s*(?:merge|land)\b|`[^`]+`/iu.test(
        text,
    );

/**
 * the text in Claude Code's prompt box, the last `❯` line that opens right under a rule, down to the next rule
 * @param {string} screen
 */
export function draftOf(screen) {
    const lines = screen.split('\n');
    let open = lines.length - 1;
    while (
        open > 0 &&
        !(lines[open].startsWith('❯') && lines[open - 1].startsWith('─'))
    )
        open--;
    if (open <= 0) return '';
    const draft = [lines[open].slice(1)];
    for (const l of lines.slice(open + 1)) {
        if (l.startsWith('─')) break;
        draft.push(l);
    }
    return draft
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
}

/**
 * x-mod-stash's band brackets its 🚦 while the seat's board is open
 * @param {string} screen
 */
export const isBoardOpen = (screen) => screen.includes('[ 🚦 ]');

/**
 * markdown reads `<word>` as html and drops it; a backslash keeps it, outside code spans, where a backslash would show
 * @param {string} text
 */
export const literalAngles = (text) =>
    text
        .split(/(`[^`]*`)/)
        .map((part, i) => (i % 2 ? part : part.replaceAll('<', '\\<')))
        .join('');

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
 * the ticks file after one more press: the lines the stash has not taken yet (`at` past its `herdr-read:<sid>`), then
 * the press, its `at` above every line in the file, since the stash reads only presses past the newest `at` it took;
 * JSON.stringify keeps a steer holding quotes or a newline on one line
 * @param {string | null} text
 * @param {Press} press
 * @param {number} taken
 */
export function withPress(text, press, taken) {
    let last = 0;
    const kept = (text ?? '').split('\n').filter((line) => {
        try {
            const { at, id } = JSON.parse(line);
            if (typeof at === 'number') last = Math.max(last, at);
            return typeof at === 'number' && at > taken && Boolean(id);
        } catch {
            return false;
        }
    });
    const stamped = { ...press, at: Math.max(press.at, last + 1) };
    return [...kept, JSON.stringify(stamped)]
        .map((line) => `${line}\n`)
        .join('');
}

/**
 * writes one press with herdr's compare-and-swap write: a file changed since the read is refused, read again and
 * written over its fresh text, so no press is lost; a second refusal is thrown
 * @param {{ read: (path: string) => Promise<string | null>, write: (path: string, text: string, expected: string | null) => Promise<unknown> }} io
 * @param {string} path
 * @param {Press} press
 * @param {number} taken
 */
export async function savePress(io, path, press, taken) {
    for (let tries = 2; ; tries--) {
        const text = await io.read(path);
        try {
            return await io.write(path, withPress(text, press, taken), text);
        } catch (err) {
            if (tries <= 1) throw err;
        }
    }
}
