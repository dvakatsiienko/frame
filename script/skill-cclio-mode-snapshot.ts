/**
 * skill-cclio-mode-snapshot — compiles the coordinator's whole brain into ONE file cw can read in one call
 * (`x-cw` tool `cclio_mode`, skill `/cclio-mode`). Runs at every cclio halt via
 * `cclio/.claude/hooks/gazette-recent.sh`, and by hand: `pnpm skill:cclio-mode-snapshot`.
 *
 * Zero-maintenance by construction: the cclio layer is derived by walking the memory barrel's
 * `@` imports, exactly as cc itself loads it — a new leaf joins the snapshot the moment it joins
 * the barrel. The fleet layer is a directory glob. Only the live layer is a fixed list.
 */

/* Core */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const HOME = homedir();
const FRAME = join(HOME, 'frame');
const CLAUDE_HOME = join(FRAME, 'home/.claude');
const CCLIO = join(FRAME, 'cclio');
const OUT = join(CLAUDE_HOME, 'shelf/cclio-mode-snapshot.md');

const read = (path: string) => readFileSync(path, 'utf8');

/** Follows `@path` import lines the way cc does: relative to the importing file, depth-first. */
const importWalk = (file: string, seen = new Set<string>()): string[] => {
    if (seen.has(file)) return [];
    seen.add(file);
    const out = [file];
    for (const line of read(file).split('\n')) {
        const match = /(?:^|\s)@((?:\.\.?\/|[A-Za-z_])[^\s)]+\.md)/.exec(line);
        if (match?.[1])
            out.push(...importWalk(resolve(dirname(file), match[1]), seen));
    }
    return out;
};

const section = (title: string, path: string, body = read(path)) =>
    `\n\n---\n\n## ${title}\n<!-- ${path.replace(HOME, '~')} -->\n\n${body.trim()}`;

const preamble = `# cclio snapshot — compiled ${new Date().toISOString()}

You are **cclio** for the rest of this thread: Dima's coordinator, a role normally booted as a Claude
Code session in \`~/frame/cclio\`. This file is that session's entire resident context, compiled
into one read so a cw (Claude Desktop) thread can take the role on demand. Read it whole, then act
as cclio would — same voice, same rules, same judgment.

📌 what is different on this surface, and how to compensate:
- no shell on the mac: the \`x-cw\` mcp tools are the only doors (handoff store, pm guide, this snapshot).
  the \`linear\` cli is not here — read tickets through the Linear connector if present, else say so.
- slash commands named below (\`/cclio:*\`, \`/x:*\`) do not exist here; their skill text is included where it matters.
- this snapshot is a build, not a live feed: the board block below is as old as the compile stamp.
- Dima accepted the cost (≈30k tokens) knowingly; do not apologise for it or re-ask.
`;

const fleet = [
    join(CLAUDE_HOME, 'CLAUDE.md'),
    ...readdirSync(join(CLAUDE_HOME, 'rules'))
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => join(CLAUDE_HOME, 'rules', f)),
];
const cclio = [
    join(CCLIO, 'AGENTS.md'),
    ...importWalk(join(CCLIO, 'memory/_MEMORY.md')),
];
const live = [join(CCLIO, 'pocket.md')];

const board = (() => {
    try {
        return execFileSync(join(CCLIO, '.claude/hooks/roadmap-prefetch.sh'), {
            encoding: 'utf8',
            timeout: 30_000,
        });
    } catch {
        return '(roadmap prefetch unavailable at compile time — linear unreachable)';
    }
})();

const out = [
    preamble,
    '\n\n# layer 1 — the fleet (loads in every cc session)',
    ...fleet.map((p) => section(p.replace(`${CLAUDE_HOME}/`, ''), p)),
    '\n\n# layer 2 — cclio (the coordinator home + memory barrel, in import order)',
    ...cclio.map((p) => section(p.replace(`${CCLIO}/`, ''), p)),
    '\n\n# layer 3 — live state at compile time',
    section('the board (roadmap prefetch)', 'roadmap-prefetch.sh', board),
    ...live.map((p) => section(p.replace(`${CCLIO}/`, ''), p)),
].join('');

writeFileSync(OUT, out);
console.log(
    `${OUT.replace(HOME, '~')} · ${(out.length / 1024).toFixed(0)} kB · ${fleet.length + cclio.length + live.length + 1} parts`,
);
