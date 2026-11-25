// an ask's card in three parts (FRM-620 slice 7), as pure steps: its title, its body as small markdown, the ➡️ line, and
// the room the title has before the id pill

import { cardKind, wordsOf } from './orbit.js';

// the card's own padding, and where the id pill sits over its top right corner
export const CARD_PAD = 12;
export const PILL = { gap: 8, padX: 6, right: 10, top: 10 };
// how long a copied id's ✓ stays
export const COPIED_MS = 1500;

/** the title as drawn: its own emoji first, a look's or a test's 👀 or 🧪 before it, once @param {{ text: string, title: string | null }} ask */
export function askTitle({ text, title }) {
    const words = (title ?? '').replace(/\s+/g, ' ').trim();
    const kind = cardKind(text);
    if (!kind) return words;
    return `${kind === 'look' ? '👀' : '🧪'} ${wordsOf(words)}`;
}

/** the pick as drawn: grey words behind one ➡️ @param {string} pick */
export const askPick = (pick) => `➡️ ${pick.replace(/^\s*➡️?\s*/u, '')}`;

/** the room on a title's right that the pill takes, the card's padding counted @param {number} pillW */
export const titleInset = (pillW) =>
    Math.max(0, pillW + PILL.right - CARD_PAD + PILL.gap);

/** the title's markdown: bold, every sign of it literal @param {string} title */
export const titleMarkdown = (title) =>
    `**${[...title].map(literal).join('')}**`;

const PUNCTUATION = /[!-/:-@[-`{-~]/;
const literal = (/** @type {string} */ c) =>
    PUNCTUATION.test(c) ? `\\${c}` : c;
const TOKEN = /(?<!`)`[^`]+`(?!`)|\*\*|[\s\S]/gu;
// what markdown takes as the edge of a word, beside which a `**` opens or closes
const isEdge = (/** @type {string | undefined} */ c) =>
    c === undefined || /[\s\p{P}]/u.test(c) || PUNCTUATION.test(c);
const isWord = (/** @type {string | undefined} */ c) =>
    c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** one line: its backtick spans and its closed **bold** kept, every other sign literal @param {string} line */
function inline(line) {
    const tokens = line.match(TOKEN) ?? [];
    /** @type {Set<number>} */
    const marks = new Set();
    const opens = (/** @type {number} */ i) => {
        const before = tokens[i - 1]?.at(-1);
        const after = tokens[i + 1]?.[0];
        return (
            after !== undefined &&
            !/\s/.test(after) &&
            (isWord(after) || isEdge(before))
        );
    };
    const closes = (/** @type {number} */ i) => {
        const before = tokens[i - 1]?.at(-1);
        const after = tokens[i + 1]?.[0];
        return (
            before !== undefined &&
            !/\s/.test(before) &&
            (isWord(before) || isEdge(after))
        );
    };
    let open = -1;
    tokens.forEach((token, i) => {
        if (token !== '**') return;
        if (open >= 0 && i > open + 1 && closes(i)) {
            marks.add(open).add(i);
            open = -1;
        } else if (open < 0 && opens(i)) open = i;
    });
    return tokens
        .map((token, i) =>
            token.length > 2 && token[0] === '`'
                ? token
                : marks.has(i)
                  ? token
                  : [...token].map(literal).join(''),
        )
        .join('');
}

const ITEM = /^(-|\d{1,9}\.)[ \t]+(\S.*)$/;

/**
 * a body as the markdown herdr's text view draws: `**bold**`, backticks, `- ` and `1.` lists, a line per line; any other
 * sign (a heading, a link, an image, a table) reads as typed
 * @param {string} text
 */
export function askMarkdown(text) {
    let out = '';
    /** @type {'bullets' | 'numbers' | 'words' | null} */
    let last = null;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) {
            last = null;
            continue;
        }
        const [, mark, words] = ITEM.exec(line) ?? [];
        const kind = !mark ? 'words' : mark === '-' ? 'bullets' : 'numbers';
        // a new kind of line, or one after a blank line, is a block of its own; words after words break the line
        if (out)
            out += kind !== last ? '\n\n' : kind === 'words' ? '\\\n' : '\n';
        out += mark ? `${mark} ${inline(words ?? '')}` : inline(line);
        last = kind;
    }
    return out;
}
