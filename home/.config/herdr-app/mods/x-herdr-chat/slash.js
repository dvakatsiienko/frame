// the / menu (FRM-638 slice 6): the «/word» the caret is in, the names it matches, and the pick. one owner for the
// menu's state; the quill hands each edit and key here and draws what `shown` says.

import COMMANDS from './commands.js';
import { menuMatches } from './skills.js';

/** @typedef {{ text: string, start: number, end: number, q: string }} Slash the «/word» being typed */

/**
 * the caret from an edit: the quill cannot say where it is, so it is the end of what changed between two values
 * @param {string} was @param {string} now
 */
export function caretAfter(was, now) {
    let a = 0;
    while (a < was.length && a < now.length && was[a] === now[a]) a++;
    let b = 0;
    while (
        b < was.length - a &&
        b < now.length - a &&
        was[was.length - 1 - b] === now[now.length - 1 - b]
    )
        b++;
    return now.length - b;
}

/**
 * the «/word» the caret is in, when its «/» starts the quill or follows a space or a line break
 * @param {string} text @param {number} caret @returns {Slash | null}
 */
export function slashAt(text, caret) {
    let start = caret;
    while (start > 0 && /[\w:-]/.test(text[start - 1] ?? '')) start--;
    if (text[start - 1] !== '/') return null;
    start--;
    if (start > 0 && !/\s/.test(text[start - 1] ?? '')) return null;
    let end = caret;
    while (end < text.length && /[\w:-]/.test(text[end] ?? '')) end++;
    return { end, q: text.slice(start + 1, end), start, text };
}

/**
 * Claude Code's commands, then the thread's own skills, then its plugins' skills, each name once
 * @param {Map<string, string>} skills from the transcript's listing @param {Map<string, string>} plugins
 * @returns {[string, string][]}
 */
export function menuNames(skills, plugins) {
    /** @type {Map<string, string>} */
    const all = new Map(/** @type {[string, string][]} */ (COMMANDS));
    for (const source of [skills, plugins])
        for (const [name, about] of source)
            if (!all.has(name)) all.set(name, about);
    return [...all];
}

/** a skill listing's lines, «- name: what it does» @param {unknown} content @returns {[string, string][]} */
export function listedSkills(content) {
    return String(content ?? '')
        .split('\n')
        .flatMap((line) => {
            const m = /^- ([\w:-]+): (.*)/.exec(line);
            return m
                ? [/** @type {[string, string]} */ ([m[1] ?? '', m[2] ?? ''])]
                : [];
        });
}

export function createSlashMenu() {
    /** @type {Slash | null} */
    let slash = null;
    let at = 0;
    let isOff = false;
    return {
        clear() {
            slash = null;
            at = 0;
            isOff = false;
        },
        /** the quill with the picked name in place of the word, a space after, and where the caret goes @param {string} name */
        fill(name) {
            if (!slash) return null;
            const { text, start, end } = slash;
            const rest = text.slice(end);
            const head = `${text.slice(0, start)}/${name}${rest.startsWith(' ') ? '' : ' '}`;
            slash = null;
            return { caret: head.length, text: head + rest };
        },
        /** what the menu shows over the quill @param {[string, string][]} names */
        shown(names) {
            if (!slash || isOff) return { at: 0, list: [] };
            const list = menuMatches(names, slash.q.toLowerCase());
            return { at: Math.min(at, Math.max(0, list.length - 1)), list };
        },
        /**
         * a key while the menu shows: ↑ ↓ move, Esc closes it for this word
         * @param {'up' | 'down' | 'close'} key @param {number} count
         */
        step(key, count) {
            if (key === 'close') isOff = true;
            else if (count)
                at = (at + (key === 'down' ? 1 : count - 1)) % count;
        },
        /** a new value in the quill @param {string} was @param {string} now */
        typed(was, now) {
            const next = slashAt(now, caretAfter(was, now));
            if (next?.start !== slash?.start || next?.q !== slash?.q) {
                at = 0;
                isOff = false;
            }
            slash = next;
        },
    };
}
