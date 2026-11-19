// text copied from the chat carries its markdown source; pasted into the quill it reads plain, its lists alone keep their
// markers (his 17:54 and 18:09 shots: «i want only lists rich format pasted»). a fence stays as pasted

/**
 * one stretch of markdown as its drawn text reads: a link its label, emphasis, strike and code marks gone
 * @param {string} text
 */
export const plainText = (text) =>
    text
        .replace(/!?\[([^\]\n]*)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, '$1')
        .replace(/(\*\*|__|~~|`)/g, '')
        .replace(/(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/gm, '$1$2');

/**
 * pasted text made plain outside its fences; list markers stay, since they are no inline mark
 * @param {string} text
 */
export function plainPaste(text) {
    return text
        .split(/(```[\s\S]*?(?:```|$))/)
        .map((part, i) => (i % 2 ? part : plainText(part)))
        .join('');
}

/**
 * where a change put its new text: the length of what it kept before it and after it
 * @param {string} was the value before the change
 * @param {string} now the value after it
 */
export function insertOf(was, now) {
    let start = 0;
    while (
        start < was.length &&
        start < now.length &&
        was[start] === now[start]
    )
        start++;
    let end = 0;
    while (
        end < was.length - start &&
        end < now.length - start &&
        was[was.length - 1 - end] === now[now.length - 1 - end]
    )
        end++;
    return { end, start, text: now.slice(start, now.length - end) };
}

/**
 * the quill's value with only the pasted stretch made plain: what was typed before stays as it was
 * @param {string} was the value before the paste
 * @param {string} now the value after it
 */
export function withPlainPaste(was, now) {
    const { end, start, text } = insertOf(was, now);
    return now.slice(0, start) + plainPaste(text) + now.slice(now.length - end);
}
