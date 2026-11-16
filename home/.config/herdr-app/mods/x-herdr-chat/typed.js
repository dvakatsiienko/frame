// his message as markdown that draws it exactly as typed: punctuation escaped, every line break kept

/** @param {string} text */
export function typedMarkdown(text) {
    return text
        .replace(/\r/g, '')
        .split(/\n\s*\n/)
        .map((paragraph) =>
            paragraph
                .replace(/[\\`*_{}[\]()<>#+\-.!|~&]/g, '\\$&')
                .replace(/\n/g, '\\\n'),
        )
        .join('\n\n');
}
