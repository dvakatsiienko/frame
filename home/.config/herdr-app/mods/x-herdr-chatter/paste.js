// text copied from the chat carries its markdown source; pasted into the box, a link reads as its label and inline code
// as its words (his 17:54 shot: «undo rich text formatting … for links and backticks, keep the lists»). a fence stays

/**
 * a link's label, code's words; list markers, fences and everything else as pasted
 * @param {string} text
 */
export function plainPaste(text) {
    return text
        .split(/(```[\s\S]*?(?:```|$))/)
        .map((part, i) =>
            i % 2
                ? part
                : part
                      .replace(
                          /\[([^\]\n]+)\]\((?:[^()\s]|\([^()\s]*\))+\)/g,
                          '$1',
                      )
                      .replace(/(?<!`)`([^`\n]+)`(?!`)/g, '$1'),
        )
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
