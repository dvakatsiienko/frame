// lanes every line of a flawlog file through jev before the halt flush reads it.
// usage: pnpm jev:flawlog [<flawlog path>]   (default: the newest file in the shelf)
import { readFileSync, readdirSync } from 'node:fs';

import { JevBudgetError, judge } from './lib/jev.ts';
import { laneCells, printTable, tailLine } from './lib/jev-print.ts';
import { flawlogQuestions } from './lib/jev-questions.ts';
import type { Pick } from './lib/jev-report.ts';
import { runsLog } from './lib/jev-report.ts';

const dir = `${process.env.HOME}/.claude/shelf/flawlog`;
const path =
    process.argv[2] ??
    `${dir}/${readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .at(-1)}`;

const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));

let tokens = 0;
const rows: string[][] = [];
const picks: Pick[] = [];
for (const line of lines) {
    // over the budget or a 402: the line stays unlaned, the flush places it by hand
    const res = await judge(
        { line, log: path.split('/').at(-1) },
        flawlogQuestions,
    ).catch((e: unknown) => {
        if (e instanceof JevBudgetError) return undefined;
        throw e;
    });
    if (!res) {
        rows.push(['unlaned', '', '', line]);
        continue;
    }
    tokens += res.usage.input_tokens;
    const { lane } = res.answers;
    picks.push({ conf: lane.confidence, name: lane.choice });
    rows.push(
        laneCells(lane.choice, lane.confidence, lane.probabilities, line),
    );
}
printTable(rows);
console.log(tailLine(lines.length, 'lines', tokens));
runsLog('flawlog-lanes', lines.length, tokens, picks);
