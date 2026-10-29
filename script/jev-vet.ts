/**
 * jev:vet — the trial period of every jev flow. `pnpm jev:vet` prints each flow's streak;
 * `pnpm jev:vet ok|miss <flow> <note>` records clio's verdict on one jev answer (the halt loop
 * calls it per disagreement, and once per clean day). `--prompt "<text>"` — or `--last`, which
 * takes the prompt off the newest route.log line — files the prompt beside the verdict, so
 * `pnpm jev:route --misses` can replay a real miss. logic and the registry shape live in
 * `script/lib/jev-vet.ts`.
 */

/* Instruments */
import { lastVerdictDay, routeRead } from './lib/jev-report.ts';
import {
    registryRead,
    registryWrite,
    statusLines,
    verdictApply,
    verdictLog,
} from './lib/jev-vet.ts';

const argv = process.argv.slice(2);
const promptAt = argv.indexOf('--prompt');
const prompt =
    promptAt === -1
        ? argv.includes('--last')
            ? routeRead().at(-1)?.prompt
            : undefined
        : argv[promptAt + 1];
// the flag and the text behind it leave, so what is left is still `verdict flow …note`
const [verdict, flow, ...noteWords] = argv.filter(
    (word, at) =>
        word !== '--last' &&
        word !== '--prompt' &&
        (promptAt === -1 || at !== promptAt + 1),
);
const today = new Date().toISOString().slice(0, 10);
const registry = registryRead();

// `lane=<x>` anywhere in the note credits that lane's precision; `spot` marks a spot-check
if (verdict === 'ok' || verdict === 'miss') {
    if (!flow)
        throw new Error(
            'usage: jev:vet ok|miss <flow> [lane=<x>] [spot] [--prompt <text>|--last] <note>',
        );
    const lane = noteWords.find((w) => w.startsWith('lane='))?.slice(5);
    const isSpot = noteWords.includes('spot');
    const note = noteWords.join(' ') || '-';
    const next = verdictApply(registry, flow, verdict, today, lane);
    const flowNext = next.flows[flow];
    registryWrite(
        isSpot && flowNext
            ? {
                  ...next,
                  flows: {
                      ...next.flows,
                      [flow]: { ...flowNext, spotCheckedAt: today },
                  },
              }
            : next,
    );
    verdictLog(flow, verdict, note, prompt);
    console.log(
        `${verdict} recorded for ${flow}${lane ? ` (lane ${lane})` : ''}${prompt ? ` · prompt: ${prompt.slice(0, 60)}` : ''}`,
    );
}

const current = registryRead();
for (const line of statusLines(current, today)) console.log(line);
for (const name of Object.keys(current.flows)) {
    const last = lastVerdictDay(name);
    if (last !== today)
        console.log(`   ${name}: no verdict since ${last ?? 'ever'}`);
}
