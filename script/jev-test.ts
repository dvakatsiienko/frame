/**
 * jev:test — the fixture suite of every jev flow. one jsonl per flow in `shelf/jev/fixtures/`,
 * a line = the state jev sees + the lane cclio gave. run before a criterion changes and at the
 * halt; a criterion edit that lowers a flow's precision is refused. `skill-router` runs only when
 * named: four arms (FRM-268's router, then v2's parts added one at a time) `RUNS` times
 * (default 3), thresholds swept on the tune split, every rate printed on the held-out split;
 * exit 1 when v2's held precision is below FRM-268's. `REPLAY_RAW=<file>` keeps the raw jev
 * answers — a file that exists is re-scored with no call. usage: pnpm jev:test [flow…]
 */

/* Core */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/* Instruments */
import { judge } from './lib/jev.ts';
import { laneCells, printTable } from './lib/jev-print.ts';
import { flawlogQuestions, inboxQuestions } from './lib/jev-questions.ts';
import { bold, dim, gb, rb } from './lib/print.ts';
import type { Metrics, RouterFixture } from './lib/router-score.ts';
import { isHeld, isVerdict, metrics, sweep } from './lib/router-score.ts';
import type { Raw, RouterArm, Thresholds } from './lib/skill-router.ts';
import {
    decide,
    defaultThresholds,
    rosterLatest,
    score,
    treeRoster,
} from './lib/skill-router.ts';

// this tree's fixtures, so a worktree measures its own edits
const FIXTURES = new URL(
    '../home/.claude/shelf/jev/fixtures/',
    import.meta.url,
);
const RUNS = Number(process.env.RUNS ?? 3);

const flows = {
    'flawlog-lanes': { answer: 'lane', questions: flawlogQuestions },
    'inbox-lanes': { answer: 'lane', questions: inboxQuestions },
} as const;

// the router runs only when named: RUNS × 4 arms × ~220 prompts is minutes, too long for every halt
const routerFlow = 'skill-router';
const args = process.argv.slice(2);
const unknown = args.filter((a) => !(a in flows) && a !== routerFlow);
if (unknown.length) {
    console.error(
        `unknown flow: ${unknown.join(', ')} — flows: ${[...Object.keys(flows), routerFlow].join(', ')}`,
    );
    process.exit(2);
}
const isRouter = args.includes(routerFlow);
const names = (
    args.length ? args.filter((a) => a in flows) : Object.keys(flows)
) as FlowName[];

let failed = false;
for (const name of names) {
    const flow = flows[name];
    const fixtures = readFixtures<Fixture>(name);
    const byLane: Record<string, { hit: number; total: number }> = {};
    console.log(`\n${bold(name)} ${dim(`· ${fixtures.length} fixtures`)}`);
    const rows: string[][] = [];
    for (const fx of fixtures) {
        const res = await judge(fx.state, flow.questions);
        const lane = res.answers[flow.answer];
        const hit = lane.choice === fx.expect;
        const tally = byLane[fx.expect] ?? { hit: 0, total: 0 };
        byLane[fx.expect] = {
            hit: tally.hit + (hit ? 1 : 0),
            total: tally.total + 1,
        };
        const text = String(Object.values(fx.state)[0]);
        rows.push([
            hit ? '✅' : '❌',
            ...laneCells(
                lane.choice,
                lane.confidence,
                lane.probabilities,
                hit ? text : `${bold(`want ${fx.expect}`)}  ${text}`,
                70,
            ),
        ]);
    }
    printTable(rows);
    const total = Object.values(byLane).reduce((n, t) => n + t.total, 0);
    const hits = Object.values(byLane).reduce((n, t) => n + t.hit, 0);
    const perLane = Object.entries(byLane)
        .map(([l, t]) => `${l} ${t.hit}/${t.total}`)
        .join('  ');
    const paint = hits === total ? gb : rb;
    console.log(`${paint(bold(`${hits}/${total}`))}  ${dim(perLane)}`);
    if (hits < total) failed = true;
}
if (isRouter && !(await routerTest())) failed = true;
process.exit(failed ? 1 : 0);

function readFixtures<T>(name: string) {
    return readFileSync(new URL(`${name}.jsonl`, FIXTURES), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as T);
}

async function routerTest() {
    const fixtures = readFixtures<RouterFixture>(routerFlow);
    const latest = rosterLatest();
    const off = {
        hasContext: false,
        hasGate: false,
        hasMemory: false,
        hasNeed: false,
    };
    const arms = {
        '+context': { ...off, hasContext: true, roster: treeRoster },
        '+gate+need': {
            hasContext: true,
            hasGate: true,
            hasMemory: true,
            hasNeed: true,
            roster: latest.roster,
        },
        '+roster+memory': {
            ...off,
            hasContext: true,
            hasMemory: true,
            roster: latest.roster,
        },
        'frm-268': { ...off, roster: treeRoster },
    } satisfies Record<string, RouterArm>;
    type ArmName = keyof typeof arms;
    // print order lives in an array: biome sorts object keys
    const armNames = [
        'frm-268',
        '+context',
        '+roster+memory',
        '+gate+need',
    ] as const satisfies readonly ArmName[];
    console.log(
        `\n${bold(routerFlow)} ${dim(`· ${fixtures.length} fixtures, ${fixtures.filter((f) => isHeld(f.state.prompt)).length} held out · RUNS=${RUNS} · roster ${treeRoster.length} → ${latest.roster.length} (${latest.path.split('/').at(-1)})`)}`,
    );

    // raws[arm][run][fixture]
    const saved = process.env.REPLAY_RAW;
    const raws: Record<ArmName, Raw[][]> =
        saved && existsSync(saved)
            ? (JSON.parse(readFileSync(saved, 'utf8')) as Record<
                  ArmName,
                  Raw[][]
              >)
            : await replay();
    if (saved && !existsSync(saved)) writeFileSync(saved, JSON.stringify(raws));

    async function replay() {
        const out = {} as Record<ArmName, Raw[][]>;
        for (const arm of armNames) out[arm] = [];
        for (let run = 0; run < RUNS; run++)
            for (const arm of armNames)
                out[arm].push(
                    await pool(fixtures, (fx) =>
                        score(
                            {
                                prompt: fx.state.prompt,
                                recentContext: fx.state.recent_context ?? '',
                                seen: new Set(fx.seen),
                            },
                            arms[arm],
                        ),
                    ),
                );
        return out;
    }

    const at = (keep: (fx: RouterFixture) => boolean) =>
        fixtures.flatMap((fx, i) => (keep(fx) ? [i] : []));
    const tune = at((fx) => !isHeld(fx.state.prompt));
    const held = at((fx) => isHeld(fx.state.prompt));
    const slices: [string, number[]][] = [
        ['held', held],
        [
            'held · verdict',
            at((fx) => isHeld(fx.state.prompt) && isVerdict(fx.state.prompt)),
        ],
        [
            'held · substantive',
            at((fx) => isHeld(fx.state.prompt) && !isVerdict(fx.state.prompt)),
        ],
        [
            'all · single-skill',
            at((fx) => [fx.expect].flat().length === 1 && fx.expect !== 'none'),
        ],
        ['all · multi-skill', at((fx) => [fx.expect].flat().length > 1)],
        ['all', fixtures.map((_, i) => i)],
    ];

    // every arm swept on the same tune split; FRM-268 also printed at the thresholds it shipped with
    const lines = [
        { arm: 'frm-268', label: 'frm-268 shipped', t: defaultThresholds },
        ...armNames.map((arm) => ({
            arm,
            label: arm,
            t: sweep(
                tune.map((i) => ({
                    fx: fixtures[i] as RouterFixture,
                    raws: raws[arm].map((run) => run[i] as Raw),
                })),
                arms[arm],
            ),
        })),
    ] satisfies { arm: ArmName; label: string; t: Thresholds }[];

    const avgOver = (line: Line, idx: readonly number[]) => {
        const per = raws[line.arm].map((run) =>
            metrics(
                idx.map((i) => ({
                    fx: fixtures[i] as RouterFixture,
                    s: decide(run[i] as Raw, line.t),
                })),
                arms[line.arm].hasMemory,
            ),
        );
        const avg = (f: (m: Metrics) => number) =>
            per.reduce((n, m) => n + f(m), 0) / per.length;
        const span = (f: (m: Metrics) => number) => {
            const v = per.map(f);
            return `${pct(avg(f))} ${dim(`${pct(Math.min(...v))}–${pct(Math.max(...v))}`)}`;
        };
        return { avg, criticalN: per[0]?.criticalN ?? 0, span };
    };

    for (const [slice, idx] of slices) {
        console.log(`\n${bold(slice)} ${dim(`· ${idx.length} prompts`)}`);
        printTable(
            lines.map((line) => {
                const m = avgOver(line, idx);
                return [
                    bold(line.label),
                    `critical ${m.span((x) => x.critical)} ${dim(`n=${m.criticalN}`)}`,
                    `wrong ${m.span((x) => x.wrong)}`,
                    `missed ${m.span((x) => x.missed)}`,
                    `needless ${m.span((x) => x.needless)}`,
                    `precision ${m.span((x) => x.precision)}`,
                ];
            }),
        );
    }

    console.log(
        `\n${bold('latency per prompt')} ${dim('· both calls, 4 in flight, no node start or transcript read')}`,
    );
    printTable(
        lines.map(({ arm, label, t }) => {
            const ms = raws[arm]
                .flat()
                .map((r) => r.ms)
                .sort((a, b) => a - b);
            const q = (p: number) =>
                ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] ?? 0;
            return [
                bold(label),
                `p50 ${q(0.5)} ms`,
                `p95 ${q(0.95)} ms`,
                dim(
                    `fits ${t.fits} · margin ${t.margin} · need ${t.need} · gate ${t.gate}`,
                ),
            ];
        }),
    );

    // the v2 misses on the last run, each with the reason every stage gave
    const v2 = lines.at(-1) as Line;
    const misses = fixtures.flatMap((fx, i) => {
        const s = decide(raws[v2.arm].at(-1)?.[i] as Raw, v2.t);
        const m = metrics([{ fx, s }], true);
        const isMiss = m.wrong || m.missed || m.needless;
        return isMiss
            ? [
                  [
                      dim(isHeld(fx.state.prompt) ? 'held' : 'tune'),
                      bold([fx.expect].flat().join('+')),
                      rb(
                          s.loads
                              .map((l) => `${l.name} ${l.p.toFixed(2)}`)
                              .join(', ') || 'none',
                      ),
                      dim(s.trace.join(' · ')),
                      fx.state.prompt.replace(/\s+/g, ' ').slice(0, 60),
                  ],
              ]
            : [];
    });
    console.log(
        `\n${bold('+gate+need misses, last run')} ${dim(`· ${misses.length} · want · got · trace · prompt`)}`,
    );
    printTable(misses);

    const precision = (line: Line) =>
        avgOver(line, held).avg((m) => m.precision);
    const isKept = precision(v2) >= precision(lines[0] as Line);
    console.log(
        isKept
            ? gb(bold('v2 held precision ≥ frm-268 shipped'))
            : rb(bold('v2 held precision < frm-268 shipped — refused')),
    );
    return isKept;

    type Line = (typeof lines)[number];
}

// four in flight: a run stays near a minute and far under the 1,200 req/min account limit
async function pool<T, R>(items: readonly T[], f: (item: T) => Promise<R>) {
    const out: R[] = [];
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await f(items[i] as T);
        }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    return out;
}

function pct(x: number) {
    return `${Math.round(x * 1000) / 10}%`;
}

/* Types */
type FlowName = keyof typeof flows;
type Fixture = {
    state: Record<string, string>;
    expect: string;
};
