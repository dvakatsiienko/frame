// text copied from the chat carries its markdown source; pasted into the box it reads plain, its lists alone keep their
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
 * the box's value with only the pasted stretch made plain: what was typed before stays as it was
 * @param {string} was the value before the paste
 * @param {string} now the value after it
 */
export function withPlainPaste(was, now) {
    let start = 0;
    while (start < was.length && was[start] === now[start]) start++;
    let end = 0;
    while (
        end < was.length - start &&
        was[was.length - 1 - end] === now[now.length - 1 - end]
    )
        end++;
    const pasted = now.slice(start, now.length - end);
    return (
        now.slice(0, start) + plainPaste(pasted) + now.slice(now.length - end)
    );
}
