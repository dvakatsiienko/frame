// the fleet-flow done test (FRM-309): tagged flawlog lines, bare cc runs, crew-skill loads, today's x-mod-guard counts, the pr open → merge median per repo, and Reads per docs/knowledge file.
// usage: pnpm flow:report [--days 14]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

import type { MergedPr } from './lib/flow-report.ts';
import {
    flawlogCounts,
    guardDay,
    medianMinutes,
    transcriptCounts,
} from './lib/flow-report.ts';

// the one-off counts before tagging began (FRM-316), and the pr medians in minutes
const TAG_BASELINE = { '#brief': 47, '#dima-caught': 23 };
const REPOS = [
    { baseline: 36, name: 'frame' },
    { baseline: 25, name: 'bytes' },
] as const;

const { values } = parseArgs({
    options: { days: { default: '14', type: 'string' } },
});
const days = Number(values.days);
if (!Number.isInteger(days) || days < 1) {
    fail(`--days wants a whole number ≥ 1, got «${values.days}»`);
}
// flawlog files are named by local date; today counts as day 1 of the window
const start = new Date();
start.setDate(start.getDate() - (days - 1));
start.setHours(0, 0, 0, 0);
const since = start.toLocaleDateString('en-CA');
const flawlogDir = `${process.env.HOME}/.claude/shelf/flawlog`;
if (!existsSync(flawlogDir)) fail(`no flawlog dir at ${flawlogDir}`);

console.log(`flow report — last ${days} days, since ${since}`);
for (const { count, tag } of flawlogCounts(flawlogDir, since)) {
    console.log(`- ${tag}: ${count} (baseline ${TAG_BASELINE[tag]})`);
}

const knowledgeDir = new URL('../docs/knowledge/', import.meta.url);
const knowledge = readdirSync(knowledgeDir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'));
const transcripts = transcriptCounts(
    `${process.env.HOME}/.claude/projects`,
    start,
    knowledge,
);
console.log(
    `- bare runs: ${transcripts.bareRuns} over ${transcripts.bareSessions} sessions (\`claude … --safe-mode\` in a Bash call)`,
);
console.log(
    `- crew-skill loads: ${transcripts.briefLed + transcripts.falseFires} — brief-led ${transcripts.briefLed}, false fires ${transcripts.falseFires}`,
);

// x-mod-guard's per-day keys, read from its own store file the way x-mod-stash reads its events
const guardStore = `${process.env.HOME}/.claude/plugins/store`;
if (existsSync(guardStore)) {
    const today = guardDay(guardStore, new Date().toLocaleDateString('en-CA'));
    console.log(
        `- guard: ${today.refused} refusals · ${today.escaped} escapes today, ${today.sessions} sessions`,
    );
    const rules = Object.entries(today.rules)
        .sort(([, a], [, b]) => b.refused + b.escaped - a.refused - a.escaped)
        .map(([rule, n]) => `${rule} ${n.refused}/${n.escaped}`);
    if (rules.length)
        console.log(`- guard by rule, refused/escaped: ${rules.join(', ')}`);
} else {
    console.log(`- guard: no plugin store at ${guardStore}`);
}

// renovate auto-merges in seconds and is not the flow being measured
console.log('- pr open → merge median, renovate excluded:');
for (const repo of REPOS) {
    const prs = mergedPrs(repo.name);
    const median = medianMinutes(prs);
    const shown = median === undefined ? 'none' : `${Math.round(median)} min`;
    console.log(
        `  - ${repo.name}: ${shown} over ${prs.length} prs (baseline ${repo.baseline} min)`,
    );
}

console.log('- docs/knowledge Reads, most-read first:');
for (const { count, file } of transcripts.knowledgeReads) {
    console.log(`  - ${file}: ${count}`);
}

function mergedPrs(repo: string): MergedPr[] {
    try {
        return JSON.parse(
            execFileSync(
                'gh',
                [
                    'pr',
                    'list',
                    '--repo',
                    `dvakatsiienko/${repo}`,
                    '--state',
                    'merged',
                    '--search',
                    `merged:>=${since} -author:app/renovate`,
                    '--limit',
                    '500',
                    '--json',
                    'createdAt,mergedAt',
                ],
                { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
            ),
        );
    } catch (e) {
        const detail = e instanceof Error ? e.message.split('\n')[0] : e;
        return fail(`gh pr list failed for ${repo}: ${detail}`);
    }
}

function fail(message: string): never {
    console.error(message);
    process.exit(2);
}
