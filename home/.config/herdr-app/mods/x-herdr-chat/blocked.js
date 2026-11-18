// a blocked thread's ask as its screen shows it (FRM-638 slice 7): the chat draws it with the keys that answer it

/**
 * the part of a blocked thread's screen that holds its ask: from the rule above the first option down, no blank rows
 * (80 rows: a long question with context and four described options is taller than 40)
 * @param {string} stdout
 */
export function screenTail(stdout) {
    const lines = stdout.replace(/\r/g, '').split('\n');
    let start = Math.max(0, lines.length - 80);
    let first = lines.length - 1;
    while (first > start && !/^\s*(❯\s*)?1\.\s/.test(lines[first] ?? ''))
        first--;
    if (first === start) first = lines.length - 3;
    // not the last rule: a question has another one lower down, above «Chat about this»
    for (let i = first; i > start; i--)
        if (/^\s*[─━]{20,}/.test(lines[i] ?? '')) {
            start = i + 1;
            break;
        }
    return lines
        .slice(start)
        .filter((l) => l.trim())
        .join('\n');
}
