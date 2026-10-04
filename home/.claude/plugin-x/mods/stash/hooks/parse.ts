const HEADER = /⏳\s*waiting on your word/i;

// The asks of a reply's ⏳ block, in order; null when the reply carries no block.
export function parseAsks(reply: string): string[] | null {
    const start = reply.search(HEADER);
    if (start < 0) return null;
    const fence = reply.indexOf('```', start);
    if (fence < 0) return null;
    const end = reply.indexOf('```', fence + 3);
    const body = reply.slice(
        reply.indexOf('\n', fence) + 1,
        end < 0 ? undefined : end,
    );
    const asks: string[] = [];
    for (const line of body.split('\n')) {
        if (/^\s*wispr adds\s*$/i.test(line)) break;
        const m = line.match(/^\s*\d+\.\s+(.+?)\s*$/);
        if (m?.[1]) asks.push(m[1]);
    }
    return asks;
}
