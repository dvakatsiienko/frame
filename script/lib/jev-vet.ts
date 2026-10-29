/**
 * ? jev vet — a flow earns trust by running clean for a window. every verdict clio gives on a
 * ? jev answer lands in `shelf/jev/<flow>.log`; the registry keeps each flow's window start. a miss
 * ? restarts the window from that day; `windowDays` clean days promote the flow to green, and a
 * ? green flow that misses drops back to vetting. dima's model (2026-09-20), two-week window.
 */

/* Core */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* Instruments */
import { bold, dim } from './print.ts';

export const VET_DIR = join(homedir(), '.claude', 'shelf', 'jev');
const REGISTRY = join(VET_DIR, 'vet.json');
const DAY = 86_400_000;

export const registryRead = (path = REGISTRY): Registry =>
    JSON.parse(readFileSync(path, 'utf8'));

export const registryWrite = (registry: Registry, path = REGISTRY) =>
    writeFileSync(path, `${JSON.stringify(registry, null, 4)}\n`);

export const cleanDays = (flow: Flow, today: string) =>
    Math.floor((Date.parse(today) - Date.parse(flow.since)) / DAY);

/** the verdict moves the flow; the log line is the evidence the halt loop reads back */
export const verdictApply = (
    registry: Registry,
    name: string,
    verdict: Verdict,
    today: string,
    lane?: string,
): Registry => {
    const flow = registry.flows[name];
    if (!flow)
        throw new Error(`unknown flow ${name} — add it to vet.json first`);
    const missed = verdict === 'miss';
    const since = missed ? today : flow.since;
    const state: State = missed
        ? 'vetting'
        : cleanDays({ ...flow, since }, today) >= registry.windowDays
          ? 'green'
          : flow.state;
    const tally = flow.lanes?.[lane ?? ''] ?? { hit: 0, total: 0 };
    const lanes = lane
        ? {
              ...flow.lanes,
              [lane]: {
                  hit: tally.hit + (missed ? 0 : 1),
                  total: tally.total + 1,
              },
          }
        : flow.lanes;
    return {
        ...registry,
        flows: {
            ...registry.flows,
            [name]: {
                ...flow,
                ...(lanes ? { lanes } : {}),
                misses: flow.misses + (missed ? 1 : 0),
                since,
                state,
                verdicts: flow.verdicts + 1,
            },
        },
    };
};

/** a green flow is trusted, so nobody reads it — one random live item per week keeps it honest */
export const spotCheckDue = (flow: Flow, today: string) =>
    flow.state === 'green' &&
    (!flow.spotCheckedAt ||
        Date.parse(today) - Date.parse(flow.spotCheckedAt) >= 7 * DAY);

/**
 * ? one verdict, one line: `ts · verdict · note · prompt`. the prompt is what jev was answering
 * ? when it missed, so `jev:route --misses` can replay the real thing instead of a hand-written
 * ? probe; a verdict that names no prompt keeps the three columns the log always had. a tab or a
 * ? newline inside either field would split the record, so both collapse to spaces.
 */
export const verdictLine = (
    verdict: Verdict,
    note: string,
    prompt?: string,
    at = new Date(),
) => {
    const tail = prompt ? `\t${oneLine(prompt)}` : '';

    return `${at.toISOString()}\t${verdict}\t${oneLine(note)}${tail}\n`;
};

export const verdictLog = (
    name: string,
    verdict: Verdict,
    note: string,
    prompt?: string,
) =>
    appendFileSync(
        join(VET_DIR, `${name}.log`),
        verdictLine(verdict, note, prompt),
    );

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

export const statusLines = (registry: Registry, today: string) =>
    Object.entries(registry.flows).map(([name, flow]) => {
        const days = Math.min(cleanDays(flow, today), registry.windowDays);
        const glyph = flow.state === 'green' ? '🟢' : '🟡';
        const tail =
            flow.state === 'green'
                ? `green since ${flow.since}`
                : `vetting ${days}/${registry.windowDays} d clean`;
        const perLane = Object.entries(flow.lanes ?? {})
            .map(([l, t]) => `${l} ${t.hit}/${t.total}`)
            .join('  ');
        const spot = spotCheckDue(flow, today) ? ' · 🔎 spot-check due' : '';
        return `${glyph} ${bold(name)} — ${tail} ${dim(`· ${flow.verdicts} verdicts, ${flow.misses} misses${perLane ? `  ${perLane}` : ''}`)}${spot}`;
    });

/* Types */
export type State = 'vetting' | 'green';
export type Verdict = 'ok' | 'miss';
export type Flow = {
    /** the day the current clean window started */
    since: string;
    state: State;
    verdicts: number;
    misses: number;
    /** what the flow judges, one line */
    what: string;
    /** per-lane precision, filled by verdicts that name a lane (`lane=ticket`) */
    lanes?: Record<string, { hit: number; total: number }>;
    /** the day a green flow last had a live item re-verdicted at random */
    spotCheckedAt?: string;
};
export type Registry = { windowDays: number; flows: Record<string, Flow> };
