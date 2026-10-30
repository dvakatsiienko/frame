// the 10-29 rename's retired forms, refused in staged text until the guard sees 14 green days (spec o66)
export const retiredForms = [
    'cclio',
    'ccrow',
    'ccli',
    'crew-coder',
    'crew-verifier',
    'crew-composer',
    'mcp-x-cw',
    'x-cw',
    'x-coder-cc',
    'x-cclio-cc',
    'sync: cw',
] as const;

export const retiredPattern = retiredForms
    .map((form) => form.replace(/[-:]/g, '\\$&'))
    .join('|');

const formPattern = new RegExp(
    `(?<![A-Za-z0-9])(${retiredPattern})(?![A-Za-z0-9])`,
    'gi',
);

// history, caches, dima's words, build-tied probe records, app source and this guard keep the old words
const excludedPaths = [
    /^_clio\/gazette\//,
    /^home\/\.claude\/shelf\/(flawlog|jev|handoffs|transcripts)\//,
    /^_clio\/pocket\//,
    /^_clio\/shifts\//,
    /^_crow\/steers\.md$/,
    /^x\/fixtures\/csts\//,
    /^script\/lib\/handoff-names\.json$/,
    /^home\/\.claude\/rules-lazy\/triggers\.json$/,
    /^home\/\.claude\/plugin-x\/skills\/crew-lead\/references\/spawn-mechanics\.md$/,
    /(^|\/)(retire-)?log(-\d{4})?\.md$/,
    /^docs\/(research|adr)\//,
    /^x\/docs\/adr\//,
    /^docs\/test-drive\/(?!(helga|crow|helga-inbox-prep)\.md$)/,
    /^home\/\.claude\/plugin-x\/skills\/writing-for-humans\/references\/dima-voice\.md$/,
    /^home\/\.claude\/themes\//,
    /^apps\/[^/]+\/src\//,
    /\.jsonl$/,
    /^script\/(lib\/)?retired-names/,
];

// a line that reads history on purpose says so, a dated line is history, a «(was …)» keeps the lineage,
// and cc's own project dirs keep the old folder name
const excusedLine =
    /read-both|\b20\d\d-\d\d-\d\d\b|\(was [^)]*\)|-Users-dima-frame-cclio|-Users-dima-projects-dotfiles-cclio|-Users-dima--local-state-ccrow/;

// dima's words stay as he wrote them: a «quote» or a `>` quote line
const unquoted = (text: string) =>
    /^\s*>/.test(text) ? '' : text.replace(/«[^»]*»/g, '');

// a markdown line under a dated heading (`### round 1 · 2026-10-10`) is a dated record
const isUnderDatedHeading = (file: readonly string[], line: number) => {
    for (let n = line - 1; n >= 1; n--) {
        const text = file[n - 1] ?? '';
        if (/^#{1,6} /.test(text)) return /\b20\d\d-\d\d-\d\d\b/.test(text);
    }
    return false;
};

export const retiredHits = (
    path: string,
    lines: Iterable<AddedLine>,
    file: readonly string[] = [],
) => {
    if (excludedPaths.some((pattern) => pattern.test(path))) return [];
    const isMarkdown = path.endsWith('.md');
    const hits: Hit[] = [];
    for (const { line, text } of lines) {
        if (excusedLine.test(text)) continue;
        if (isMarkdown && isUnderDatedHeading(file, line)) continue;
        for (const [form] of unquoted(text).matchAll(formPattern))
            hits.push({ form, line, path, text });
    }
    return hits;
};

/* Types */

export interface AddedLine {
    line: number;
    text: string;
}

export interface Hit extends AddedLine {
    path: string;
    form: string;
}
