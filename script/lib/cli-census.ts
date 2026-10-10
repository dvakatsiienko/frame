// the admission rule can never make these a verb, and they would fill the top 20
export const shellBasics = new Set([
    'awk',
    'cat',
    'chmod',
    'cp',
    'cut',
    'date',
    'diff',
    'echo',
    'find',
    'for',
    'grep',
    'head',
    'if',
    'jq',
    'ls',
    'mkdir',
    'mv',
    'printf',
    'rg',
    'sd',
    'sed',
    'sleep',
    'sort',
    'tail',
    'tee',
    'test',
    'touch',
    'tr',
    'trash',
    'uniq',
    'wc',
    'while',
    'xargs',
]);

// the heads come from `x stats --outside`, x's one parser of cc transcripts; a covered head
// went around a door that exists, so only the rest can ask for a new verb
export function rawHeads(heads: Head[], { minRuns = 5, top = 20 } = {}) {
    return heads
        .filter(
            (head) =>
                !head.cover &&
                !shellBasics.has(head.name) &&
                head.calls >= minRuns,
        )
        .slice(0, top);
}

/* Types */

export interface Head {
    calls: number;
    cover?: string;
    name: string;
}
