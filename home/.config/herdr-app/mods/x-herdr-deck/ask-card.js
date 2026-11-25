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
    return `${kind === 'look' ? '👀' : '🧪'} ${wordsOf(words)}`.trim();
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

const ITEM = /^(-|(0|[1-9]\d{0,8})\.)[ \t]+(\S.*)$/;

/**
 * a body as the markdown herdr's text view draws: `**bold**`, backticks, `- ` and `1.` lists, a line per line; any other
 * sign (a heading, a link, an image, a table) reads as typed, and so does every number of a list: he answers by it
 * @param {string} text
 */
export function askMarkdown(text) {
    let out = '';
    /** @type {'bullets' | 'numbers' | 'words' | null} */
    let last = null;
    let isApart = false;
    // a list counts on from its first number by itself; one that jumps starts a list of its own, which markdown tells by
    // the other sign after the number (both draw «3.»)
    let number = -1;
    let sign = '.';
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (!line) {
            isApart = true;
            continue;
        }
        const [, mark, digits, words = ''] = ITEM.exec(line) ?? [];
        const kind = !mark ? 'words' : digits ? 'numbers' : 'bullets';
        let isNext = kind === last && !isApart;
        if (digits) {
            const isOn = last === 'numbers' && Number(digits) === number + 1;
            if (last === 'numbers' && !isOn) sign = sign === '.' ? ')' : '.';
            isNext = isNext && isOn;
            number = Number(digits);
        }
        // words after words break the line; any other new kind, jump or blank line starts a block
        if (out) out += !isNext ? '\n\n' : kind === 'words' ? '\\\n' : '\n';
        out += digits
            ? `${digits}${sign} ${inline(words)}`
            : mark
              ? `- ${inline(words)}`
              : inline(line);
        last = kind;
        isApart = false;
    }
    return out;
}
