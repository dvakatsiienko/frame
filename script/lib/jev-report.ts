/**
 * ? jev report — one block per flow, the shape dima approved (2026-09-21): glyph + window in the
 * ? header, fixed sub-labels one fact each, then a session line and a health line. pure: the files
 * ? are read by `script/jev-report.ts`, this renders.
 */

/* Core */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Registry, Verdict } from './jev-vet.ts';
/* Instruments */
import { VET_DIR, cleanDays } from './jev-vet.ts';

const RUNS_LOG = join(VET_DIR, 'runs.log');
const ROUTE_LOG = join(VET_DIR, 'route.log');
/** the router's kill switch: the file exists → `skill-route.sh` exits before any jev call */
export const ROUTER_OFF = join(VET_DIR, 'router.off');
export const isRouterOff = (path = ROUTER_OFF) => existsSync(path);
// a pick inside the band is a near-miss: neither confident nor rejected (verdictBand's numbers)
const BAND = { high: 0.7, low: 0.3 } as const;

/** every jev caller appends one line per run: `ts · flow · items · tokens · picks` */
export const runsLog = (
    flow: string,
    items: number,
    tokens: number,
    picks: Pick[],
) =>
    appendFileSync(
        RUNS_LOG,
        `${new Date().toISOString()}\t${flow}\t${items}\t${tokens}\t${picks.map((p) => `${p.name}:${p.conf.toFixed(2)}`).join(',') || '-'}\n`,
    );

const dayOf = (line: string) => line.slice(0, 10);

/**
 * route.log: `ts · top pick+conf · loads · prompt[ · ms]` — the trailing ms column arrived
 * 2026-09-22, older lines have four columns and no latency
 */
export const routeParse = (text: string, today?: string): RouteRow[] =>
    text
        .split('\n')
        .filter((l) => l && (!today || dayOf(l) === today))
        .map((l) => {
            const [ts = '', top = '', loads = '-', prompt = '', ms] =
                l.split('\t');
            const at = top.lastIndexOf(' ');
            return {
                conf: Number(top.slice(at + 1)),
                loads: loads === '-' ? [] : loads.split(','),
                ms: ms === undefined ? undefined : Number(ms),
                prompt,
                top: top.slice(0, at),
                ts,
            };
        });

export const routeRead = (today?: string, path = ROUTE_LOG) =>
    routeParse(existsSync(path) ? readFileSync(path, 'utf8') : '', today);

export const latencyStats = (rows: RouteRow[]): Latency | undefined => {
    const ms = rows
        .flatMap((r) => (r.ms === undefined ? [] : [r.ms]))
        .sort((a, b) => a - b);
    if (!ms.length) return undefined;
    return {
        avg: Math.round(ms.reduce((n, x) => n + x, 0) / ms.length),
        p95: ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)] ?? 0,
        runs: ms.length,
    };
};

export const routerHealth = (isOff: boolean, stats: Latency | undefined) =>
    isOff
        ? 'router: OFF'
        : stats
          ? `router: on · avg ${stats.avg} ms · p95 ${stats.p95} ms (today)`
          : 'router: on · no runs today';

/** the last n prompts whose top pick sat in the band — the probes worth replaying */
export const nearMisses = (rows: RouteRow[], n: number) =>
    rows.filter((r) => r.conf >= BAND.low && r.conf < BAND.high).slice(-n);

export const runsRead = (today: string, path = RUNS_LOG): Run[] =>
    (existsSync(path) ? readFileSync(path, 'utf8') : '')
        .split('\n')
        .filter((l) => dayOf(l) === today)
        .map((l) => {
            const [, flow = '', items = '0', tokens = '0', picks = '-'] =
                l.split('\t');
            return {
                flow,
                items: Number(items),
                picks:
                    picks === '-'
                        ? []
                        : picks.split(',').map((p) => {
                              const at = p.lastIndexOf(':');
                              return {
                                  conf: Number(p.slice(at + 1)),
                                  name: p.slice(0, at),
                              };
                          }),
                tokens: Number(tokens),
            };
        });

/**
 * a flow's verdict log: `ts · verdict · note · prompt` — the prompt column arrived 2026-09-22,
 * so every line written before it has three columns and none
 */
export const verdictParse = (text: string): VerdictLine[] =>
    text
        .split('\n')
        .filter(Boolean)
        .map((l) => {
            const [ts = '', verdict = 'ok', note = '-', prompt] = l.split('\t');
            return { note, prompt, ts, verdict: verdict as Verdict };
        });

export const verdictsOf = (flow: string, dir = VET_DIR) => {
    const path = join(dir, `${flow}.log`);
    return verdictParse(existsSync(path) ? readFileSync(path, 'utf8') : '');
};

/** the last n prompts a miss recorded — what `jev:route --misses` replays */
export const missPrompts = (rows: readonly VerdictLine[], n: number) =>
    rows
        .flatMap((row) =>
            row.verdict === 'miss' && row.prompt ? [row.prompt] : [],
        )
        .slice(-n);

export const verdictsRead = (
    registry: Registry,
    today: string,
    dir = VET_DIR,
): VerdictRow[] =>
    Object.keys(registry.flows).flatMap((flow) =>
        verdictsOf(flow, dir)
            .filter((row) => dayOf(row.ts) === today)
            .map((row) => ({ flow, note: row.note, verdict: row.verdict })),
    );

/** the day a flow last heard a verdict, or undefined — the boot prints «no verdict since» off it */
export const lastVerdictDay = (flow: string, dir = VET_DIR) => {
    const path = join(dir, `${flow}.log`);
    if (!existsSync(path)) return undefined;
    return readFileSync(path, 'utf8').trim().split('\n').at(-1)?.slice(0, 10);
};

export const reportLines = (
    registry: Registry,
    runs: Run[],
    verdicts: VerdictRow[],
    today: string,
    health: Health = {
        api: true,
        fixture: true,
        key: true,
        router: 'router: on · no runs today',
    },
) => {
    const lines: string[] = [];
    for (const [name, flow] of Object.entries(registry.flows)) {
        const mine = runs.filter((r) => r.flow === name);
        const said = verdicts.filter((v) => v.flow === name);
        const misses = said.filter((v) => v.verdict === 'miss');
        const isGreen = flow.state === 'green';
        const glyph = misses.length
            ? '🔴'
            : !mine.length && !said.length
              ? '⚪'
              : isGreen
                ? '🟢'
                : '🟡';
        const days = Math.min(cleanDays(flow, today), registry.windowDays);
        const window =
            flow.since === today && misses.length ? 'restarted today' : 'clean';
        lines.push(
            isGreen
                ? `${glyph} **${name}**`
                : `${glyph} **${name}** — 🧪 ${days}/${registry.windowDays} ${window}`,
        );
        if (!mine.length && !said.length) {
            lines.push('- today — no runs');
            continue;
        }
        const items = mine.reduce((n, r) => n + r.items, 0);
        const picks = mine.flatMap((r) => r.picks);
        const loads = picks.filter((p) => p.conf >= BAND.high).length;
        const near = picks.filter(
            (p) => p.conf >= BAND.low && p.conf < BAND.high,
        );
        lines.push(
            `- today — **${items}** prompts, **${loads}** loads, **${misses.length}** false`,
        );
        for (const m of misses) lines.push(`- miss — ${m.note}`);
        if (!misses.length && near.length)
            lines.push(
                `- watch — ${near.map((p) => `${p.name} ${p.conf.toFixed(2)}`).join(', ')}`,
            );
        const sharpened = said.filter((v) => /reword|sharpen/i.test(v.note));
        for (const s of sharpened) lines.push(`- sharpened — ${s.note}`);
        if (!isGreen)
            lines.push(
                `- verdicts — ${flow.verdicts - flow.misses} ok, ${flow.misses} misses`,
            );
    }
    const perFlow = Object.keys(registry.flows)
        .map(
            (f) =>
                [
                    f,
                    runs
                        .filter((r) => r.flow === f)
                        .reduce((n, r) => n + r.items, 0),
                ] as const,
        )
        .filter(([, n]) => n > 0);
    const items = perFlow.reduce((n, [, c]) => n + c, 0);
    const tokens = runs.reduce((n, r) => n + r.tokens, 0);
    lines.push(
        `📊 **session** — ${perFlow.length} flows, **${items}** items, **~${Math.round(tokens / 1000)}k** tokens (${perFlow.map(([f, n]) => `${f} ${n}`).join(', ')})`,
    );
    const missing = perFlow
        .map(([f]) => f)
        .filter((f) => !verdicts.some((v) => v.flow === f));
    const ok = (isOk: boolean) => (isOk ? 'ok' : 'FAIL');
    const probe = health.budget
        ? `${health.budget} (api not probed)`
        : `api ${ok(health.api)}, key ${ok(health.key)}, fixture probe ${ok(health.fixture)}`;
    lines.push(
        `🚦 **health** — ${probe}, verdicts missing: ${missing.join(', ') || 'none'}, ${health.router}`,
    );
    return lines;
};

/* Types */
export type Pick = { name: string; conf: number };
export type Run = {
    flow: string;
    items: number;
    tokens: number;
    picks: Pick[];
};
export type VerdictRow = { flow: string; verdict: Verdict; note: string };
export type VerdictLine = {
    ts: string;
    verdict: Verdict;
    note: string;
    prompt: string | undefined;
};
export type Health = {
    api: boolean;
    key: boolean;
    fixture: boolean;
    router: string;
    /** the spend gate refused the probe: the api went unasked, which is not a failure */
    budget?: string;
};
export type RouteRow = {
    ts: string;
    top: string;
    conf: number;
    loads: string[];
    prompt: string;
    ms: number | undefined;
};
export type Latency = { avg: number; p95: number; runs: number };
