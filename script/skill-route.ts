// probe: can jev pick the x:* skill a prompt needs, from the skills' own descriptions?
// usage: script/op-run.sh node script/skill-route.ts                → the probe set
//        script/op-run.sh node script/skill-route.ts --from-log [n]  → replay the last n near-misses from route.log
//        script/op-run.sh node script/skill-route.ts --misses [n]     → replay the last n prompts cclio verdicted a miss
//        script/op-run.sh node script/skill-route.ts '<prompt>'      → live: prints the loads, logs the pick + ms
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

import type { Question } from './lib/jev.ts';
import { judge } from './lib/jev.ts';
import { printTable } from './lib/jev-print.ts';
import {
    missPrompts,
    nearMisses,
    routeRead,
    runsLog,
    verdictsOf,
} from './lib/jev-report.ts';
import { bb, bold, dim, gb, rb } from './lib/print.ts';

// frontmatter description is one line, or a `>-` folded block of indented lines
function readDescription(md: string) {
    const lines = md.split('\n');
    const at = lines.findIndex((l) => l.startsWith('description:'));
    if (at < 0) return undefined;
    const first = lines[at]?.slice('description:'.length).trim() ?? '';
    if (!first.startsWith('>')) return first;
    const folded: string[] = [];
    for (const l of lines.slice(at + 1)) {
        if (!l.startsWith(' ')) break;
        folded.push(l.trim());
    }
    return folded.join(' ');
}

const routeThreshold = 0.6;
// a pick of these never auto-trusts, green router or not (memory/sys-jev.md)
const sideEffectSkills: ReadonlySet<string> = new Set([
    'cclio:evergreen',
    'cclio:halt',
    'x:cmt',
    'x:handoff',
]);
const logPath = `${process.env.HOME}/.claude/shelf/jev/route.log`;
mkdirSync(`${process.env.HOME}/.claude/shelf/jev`, { recursive: true });

const pluginDirs = {
    cclio: `${process.env.HOME}/frame/cclio/plugin-cclio/skills`,
    x: `${process.env.HOME}/frame/home/.claude/plugin-x/skills`,
};

const skills = Object.entries(pluginDirs).flatMap(([prefix, dir]) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (!entry.isDirectory()) return [];
        const md = readFileSync(`${dir}/${entry.name}/SKILL.md`, 'utf8');
        // a user-only skill cannot be loaded by the model, so routing it is noise
        if (/^disable-model-invocation:\s*true\s*$/m.test(md)) return [];
        const description = readDescription(md);
        return description
            ? [{ description, name: `${prefix}:${entry.name}` }]
            : [];
    }),
);

const questions = Object.fromEntries(
    skills.map((s) => [
        s.name,
        {
            criteria: {
                false: 'The prompt asks for none of that.',
                true: s.description,
            },
            instructions: `Should the skill \`${s.name}\` be loaded before acting on \`prompt\`?`,
            type: 'noul',
        },
    ]),
) as Record<string, Question>;

const probes = [
    ['commit this and slay', 'x:cmt'],
    ['walk me through the rubric on real inbox lines', 'x:walkthrough'],
    ['read BYT-41 and fold today’s state into the body', 'x:pm'],
    ['does the chart render at mobile width?', 'x:browser-headless'],
    ['what entry options do i have in 1p?', '—'],
    ['append to inbox: try windscribe as the vpn fallback', 'x:notes'],
    ['1. flawlog flush, four lines ➡️ yes', 'cclio:flawlog'],
    ['park the rule for the week, then checkpoint', 'cclio:checkpoint'],
    ['sup, where are we', 'cclio:report'],
] as const;

const isFromLog = process.argv[2] === '--from-log';
const isMisses = process.argv[2] === '--misses';
const live = isFromLog || isMisses ? undefined : process.argv[2];
if (live) {
    const started = performance.now();
    const res = await judge({ prompt: live }, questions);
    const ms = Math.round(performance.now() - started);
    const ranked = Object.entries(res.answers)
        .map(([name, a]) => [name, 'noul' in a ? a.noul : 0] as const)
        .sort((a, b) => b[1] - a[1]);
    const loads = ranked.filter(([, p]) => p >= routeThreshold);
    const top = ranked[0];
    appendFileSync(
        logPath,
        `${new Date().toISOString()}\t${top?.[0]} ${top?.[1].toFixed(2)}\t${loads.map(([n]) => n).join(',') || '-'}\t${live.slice(0, 80).replace(/\s+/g, ' ')}\t${ms}\t${process.env.JEV_SESSION ?? '-'}\n`,
    );
    if (loads.length)
        console.log(
            `skills (jev router): ${loads.map(([n, p]) => `${n} ${p.toFixed(2)}${sideEffectSkills.has(n) ? ' ⚠ read first' : ''}`).join(', ')}`,
        );
    // the top pick only — a whole prompt's 59 nouls would drown the report
    runsLog(
        'skill-router',
        1,
        res.usage.input_tokens,
        top ? [{ conf: top[1], name: top[0] }] : [],
    );
    process.exit(0);
}

// --from-log: yesterday's real near-misses replace the hand-written probes; dima fills `want`.
// --misses: the prompts cclio already called wrong (`jev:vet miss skill-router --last …`) — a
// confident wrong pick never enters the band, so those are exactly what --from-log cannot see.
const count = Number(process.argv[3] ?? 10);
const replay = isMisses
    ? missPrompts(verdictsOf('skill-router'), count).map(
          (prompt) => [prompt, '?'] as const,
      )
    : isFromLog
      ? nearMisses(routeRead(), count).map((r) => [r.prompt, '?'] as const)
      : probes;
const describe = (name: string) =>
    skills.find((s) => s.name === name)?.description.slice(0, 100) ?? '';

const rows: string[][] = [];
const hints: string[] = [];
for (const [prompt, expected] of replay) {
    const res = await judge({ prompt }, questions);
    const ranked = Object.entries(res.answers)
        .map(([name, a]) => [name, 'noul' in a ? a.noul : 0] as const)
        .sort((a, b) => b[1] - a[1]);
    const hit =
        ranked[0]?.[0] === expected ||
        (expected === '—' && (ranked[0]?.[1] ?? 0) < 0.5);
    const first = ranked[0];
    if (first && first[1] < routeThreshold)
        hints.push(
            `${bold(first[0])} ${first[1].toFixed(2)} ← «${prompt.slice(0, 50)}» · description now: ${dim(describe(first[0]))}`,
        );
    const top = ranked
        .slice(0, 3)
        .map(([n, p], i) =>
            i === 0
                ? `${(hit ? gb : rb)(bold(n))} ${bold(p.toFixed(2))}`
                : dim(`${n} ${p.toFixed(2)}`),
        );
    rows.push([
        expected === '?' ? '❓' : hit ? '✅' : '❌',
        prompt,
        dim('want'),
        bb(expected),
        dim('got'),
        top.join('  '),
    ]);
}
printTable(rows);
if (hints.length) {
    console.log(
        dim(
            '\nlow-confidence top picks — a miss here is usually a description to reword:',
        ),
    );
    for (const h of hints) console.log(`  ${h}`);
}
console.log(dim(`\n${skills.length} skills as nouls per request`));
