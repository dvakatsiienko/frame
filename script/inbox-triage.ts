// dry run: lanes every inbox item through jev and prints them next to the expected lane.
// usage: script/op-run.sh node script/inbox-triage.ts
import { readFileSync } from 'node:fs';

import { JevBudgetError, judge } from './lib/jev.ts';
import { laneCells, printTable, tailLine } from './lib/jev-print.ts';
import { inboxQuestions, verdictBand } from './lib/jev-questions.ts';
import type { Pick } from './lib/jev-report.ts';
import { runsLog } from './lib/jev-report.ts';
import { dim } from './lib/print.ts';

const inboxPath = `${process.env.HOME}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Dima's Vault/_hq/inbox.md`;

// an item is a `**title**` block under a `## section` header; the section is context, not a lane
function parseInbox(md: string) {
    const items: { section: string; title: string; text: string }[] = [];
    let section = '';
    let current: (typeof items)[number] | null = null;
    for (const line of md.split('\n')) {
        const header = line.match(/^## (.+)/)?.[1];
        if (header) {
            section = header.trim();
            current = null;
            continue;
        }
        const title = line.match(/^\s*\*\*(.+?)\*\*\s*$/)?.[1];
        if (title) {
            current = { section, text: '', title };
            items.push(current);
            continue;
        }
        if (current && !line.startsWith('>') && line.trim() !== '---')
            current.text += `${line}\n`;
    }
    return items.map((i) => ({ ...i, text: i.text.trim() }));
}

const runs = Number(process.env.RUNS ?? 1);
const items = parseInbox(readFileSync(inboxPath, 'utf8'));
let tokens = 0;
const rows: string[][] = [];
const picks: Pick[] = [];
for (const item of items) {
    for (let run = 0; run < runs; run++) {
        // over the budget or a 402: the item stays unlaned, cclio lanes it by hand
        const res = await judge(
            { item: `${item.title}: ${item.text}`, section: item.section },
            inboxQuestions,
        ).catch((e: unknown) => {
            if (e instanceof JevBudgetError) return undefined;
            throw e;
        });
        if (!res) {
            rows.push(['unlaned', '', '', item.title]);
            break;
        }
        tokens += res.usage.input_tokens;
        const { lane, needsVerdict } = res.answers;
        picks.push({ conf: lane.confidence, name: lane.choice });
        const band =
            needsVerdict.noul > verdictBand.high
                ? '⏳ dima'
                : needsVerdict.noul < verdictBand.low
                  ? 'agent'
                  : '~ unsure';
        rows.push(
            laneCells(
                lane.choice,
                lane.confidence,
                lane.probabilities,
                `${item.title}  ${dim(`verdict ${needsVerdict.noul.toFixed(2)} ${band}`)}`,
                120,
            ),
        );
    }
}
printTable(rows);
console.log(tailLine(items.length, 'items', tokens));
runsLog('inbox-lanes', items.length, tokens, picks);
