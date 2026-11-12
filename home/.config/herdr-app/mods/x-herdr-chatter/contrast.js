// a chat background his text can be read on: a theme may paint the terminal background in its text colour (win98:
// black under black), and the chat draws on that background by default

/** WCAG's relative luminance of a 6-digit hex colour, null for anything else @param {string} hex */
function luminance(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b */
export function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    if (la == null || lb == null) return null;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// WCAG's floor for large text and ui parts; below it the chat moves to the first fallback that clears it
const MIN_RATIO = 3;

/** @param {string} bg @param {string} fg @param {string[]} fallbacks */
export function readableBackground(bg, fg, fallbacks) {
    const ratio = contrastRatio(bg, fg);
    if (ratio == null || ratio >= MIN_RATIO) return bg;
    return (
        fallbacks.find((c) => (contrastRatio(c, fg) ?? 0) >= MIN_RATIO) ?? bg
    );
}
