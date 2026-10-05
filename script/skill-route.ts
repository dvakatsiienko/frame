// the skill router: at most one skill a prompt should load, from the skill-suggestion shape
// usage: script/op-run.sh node script/skill-route.ts '<prompt>'        → live: prints the load, logs the pick + ms
//        script/op-run.sh node script/skill-route.ts --from-log [n]  → replay the last n near-misses from route.log
//        script/op-run.sh node script/skill-route.ts --misses [n]     → replay the last n prompts cclio verdicted a miss
// the labelled fixtures, old shape beside new: script/op-run.sh node script/jev-test.ts skill-router
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
import { loadLine, suggest } from './lib/skill-router.ts';

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
    const { loads, tokens, top } = await suggest(mode);
    const ms = Math.round(performance.now() - started);
    appendFileSync(
        `${logDir}/route.log`,
        `${new Date().toISOString()}\t${top.name} ${top.p.toFixed(2)}\t${loads.map((s) => s.name).join(',') || '-'}\t${mode.slice(0, 80).replace(/\s+/g, ' ')}\t${ms}\t${process.env.JEV_SESSION ?? '-'}\n`,
    );
    const line = loadLine(loads);
    if (line) console.log(line);
    runsLog('skill-router', 1, tokens, [{ conf: top.p, name: top.name }]);
    process.exit(0);
}

// --from-log: real near-misses; --misses: the prompts cclio already called wrong
// (`jev:vet miss skill-router …`) — a confident wrong pick never enters the band
const count = Number(countArg ?? 10);
const prompts =
    mode === '--misses'
        ? missPrompts(verdictsOf('skill-router'), count)
        : nearMisses(routeRead(), count).map((r) => r.prompt);
const rows: string[][] = [];
for (const prompt of prompts) {
    const { loads, top } = await suggest(prompt);
    rows.push([
        prompt.slice(0, 70),
        dim('got'),
        loads.length
            ? bold(loadLine(loads) ?? '')
            : dim(`none (${top.name} ${top.p.toFixed(2)})`),
    ]);
}
printTable(rows);
