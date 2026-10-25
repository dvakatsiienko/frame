// A tile's html lines grouped into parts: consecutive lines of one size and colour share a text element.
export const groupParts = (runs) => {
    const parts = [];
    for (const line of runs) {
        const { size, color } = line[0];
        const paragraph = line
            .map((r) => r.text)
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
        if (!paragraph) continue;
        const last = parts.at(-1);
        if (last && last.size === size && last.color === color)
            last.paragraphs.push(paragraph);
        else parts.push({ size, color, paragraphs: [paragraph] });
    }
    return parts;
};

export const collapse = (s) => s.replace(/\s+/g, ' ').trim();
