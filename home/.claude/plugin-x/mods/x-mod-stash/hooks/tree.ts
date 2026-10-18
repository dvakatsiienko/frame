// a Text's string may hold a newline and no other control character, or the engine refuses the whole tree: one control
// character in one data row blanked every tab of a production mod (claude-code#91870, 10-16); a tab becomes a space
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is this regex's job
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const clean = (s: string) => s.replace(/\t/g, ' ').replace(CONTROL, '');

// every string in a render tree, children and props alike, with its control characters gone
export function cleanTree<T>(node: T): T {
    if (typeof node === 'string') return clean(node) as T;
    if (Array.isArray(node)) return node.map(cleanTree) as T;
    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node)) out[k] = cleanTree(v);
        return out as T;
    }
    return node;
}
