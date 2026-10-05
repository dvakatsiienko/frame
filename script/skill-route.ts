// the skill router: the skills a prompt should load, from the skill-suggestion shape (v2, FRM-305)
// usage: script/op-run.sh node script/skill-route.ts '<prompt>'        → live: prints the load, logs the pick + ms
//        script/op-run.sh node script/skill-route.ts --from-log [n]  → replay the last n near-misses from route.log
//        script/op-run.sh node script/skill-route.ts --misses [n]     → replay the last n prompts cclio verdicted a miss
// live mode reads `JEV_TRANSCRIPT` (the hook's transcript_path): the roster, the last reply, the skills in play
// the labelled fixtures, four arms: script/op-run.sh node script/jev-test.ts skill-router
import { appendFileSync, mkdirSync } from 'node:fs';

import { printTable } from './lib/jev-print.ts';
import {
    missPrompts,
    nearMisses,
    routeRead,
    runsLog,
    verdictsOf,
} from './lib/jev-report.ts';
import { bold, dim } from './lib/print.ts';
import {
    loadLine,
    rosterLatest,
    routeInput,
    suggest,
} from './lib/skill-router.ts';

const logDir = `${process.env.HOME}/.claude/shelf/jev`;
mkdirSync(logDir, { recursive: true });
const [mode, countArg] = process.argv.slice(2);
if (!mode) {
    console.error(
        "usage: skill-route.ts '<prompt>' | --from-log [n] | --misses [n]",
    );
    process.exit(2);
}

if (mode !== '--from-log' && mode !== '--misses') {
    const started = performance.now();
    const { input, roster } = routeInput(mode, process.env.JEV_TRANSCRIPT);
    const { loads, tokens, top, trace } = await suggest(input, roster);
    const ms = Math.round(performance.now() - started);
    // the whole prompt, one line: a vet miss filed with `--last` is a label source
    appendFileSync(
        `${logDir}/route.log`,
        `${new Date().toISOString()}\t${top.name} ${top.p.toFixed(2)}\t${loads.map((s) => s.name).join(',') || '-'}\t${mode.replace(/\s+/g, ' ').trim()}\t${ms}\t${process.env.JEV_SESSION ?? '-'}\t${trace.join(' · ')}\n`,
    );
    const line = loadLine(loads);
    if (line) console.log(line);
    runsLog('skill-router', 1, tokens, [{ conf: top.p, name: top.name }]);
    process.exit(0);
}

// --from-log: real near-misses; --misses: the prompts cclio already called wrong
// (`jev:vet miss skill-router …`) — a confident wrong pick never enters the band.
// no transcript here: the newest coordinator listing stands in, with no reply and no memory
const count = Number(countArg ?? 10);
const prompts =
    mode === '--misses'
        ? missPrompts(verdictsOf('skill-router'), count)
        : nearMisses(routeRead(), count).map((r) => r.prompt);
const { roster } = rosterLatest();
const rows: string[][] = [];
for (const prompt of prompts) {
    const { loads, trace } = await suggest(
        { prompt, recentContext: '', seen: new Set() },
        roster,
    );
    rows.push([
        prompt.slice(0, 70),
        dim('got'),
        loads.length
            ? bold(loadLine(loads) ?? '')
            : dim(`none (${trace.join(' · ')})`),
    ]);
}
printTable(rows);
