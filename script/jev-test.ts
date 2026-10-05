/**
 * jev:test — the fixture suite of every jev flow. one jsonl per flow in `shelf/jev/fixtures/`,
 * a line = the state jev sees + the lane cclio gave. run before a criterion changes and at the
 * halt; a criterion edit that lowers a flow's precision is refused. `skill-router` runs only when
 * named: four jev arms (FRM-268's router, then v2's parts added one at a time) and a haiku
 * baseline, `RUNS` times (default 3), jev thresholds swept on the tune split, every rate printed
 * on the held-out split; exit 1 when v2's held precision is below FRM-268's. `REPLAY_RAW=<file>`
 * keeps the raw answers and the roster they ran on — a part the file holds is re-scored with no
 * call, a missing part is run and written back. usage: pnpm jev:test [flow…]
 */

/* Core */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/* Instruments */
import type { HaikuRaw } from './lib/haiku-router.ts';
import { haikuRoute } from './lib/haiku-router.ts';
import { judge } from './lib/jev.ts';
import { laneCells, printTable } from './lib/jev-print.ts';
import type { RouterSkill } from './lib/jev-questions.ts';
import { flawlogQuestions, inboxQuestions } from './lib/jev-questions.ts';
import { bold, dim, gb, rb } from './lib/print.ts';
import type { Metrics, RouterFixture } from './lib/router-score.ts';
import { isHeld, isVerdict, metrics, sweep } from './lib/router-score.ts';
import type { Raw, RouterArm, Suggestion } from './lib/skill-router.ts';
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
// print order lives in an array: biome sorts object keys
const armNames = [
    'frm-268',
    '+context',
    '+roster+memory',
    '+gate+need',
] as const;
// jev-1.13.0 bills input tokens only (docs.typesafe.ai/models)
const JEV_USD_PER_TOKEN = 0.042 / 1_000_000;

const flows = {
    'flawlog-lanes': { answer: 'lane', questions: flawlogQuestions },
    'inbox-lanes': { answer: 'lane', questions: inboxQuestions },
} as const;

// the router runs only when named: RUNS × 5 arms × ~220 prompts is minutes, too long for every halt
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
    const prompts = fixtures.map((fx) => fx.state.prompt);
    const inputOf = (fx: RouterFixture) => ({
        prompt: fx.state.prompt,
        recentContext: fx.state.recent_context ?? '',
        seen: new Set(fx.seen),
    });

    // raws sit by fixture index, and arms 3–5 ran on one roster: a file made from other fixtures
    // would score the wrong prompts, one made before the roster was pinned cannot say which ran
    const saved = process.env.REPLAY_RAW;
    const file =
        saved && existsSync(saved)
            ? (JSON.parse(readFileSync(saved, 'utf8')) as Partial<SavedReplay>)
            : undefined;
    if (file && JSON.stringify(file.prompts) !== JSON.stringify(prompts)) {
        console.error(
            `REPLAY_RAW ${saved} was made from other fixtures — delete it or point at a new file`,
        );
        process.exit(2);
    }
    if (file && !file.roster) {
        console.error(
            `REPLAY_RAW ${saved} holds no roster — made before rosters were pinned; point at a new file`,
        );
        process.exit(2);
    }
    const latest = file?.roster
        ? { path: file.rosterPath ?? '-', roster: file.roster }
        : rosterLatest();

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
    } satisfies Record<ArmName, RouterArm>;
    console.log(
        `\n${bold(routerFlow)} ${dim(`· ${fixtures.length} fixtures, ${fixtures.filter((f) => isHeld(f.state.prompt)).length} held out · RUNS=${RUNS} · roster ${treeRoster.length} → ${latest.roster.length} (${latest.path.split('/').at(-1)})`)}`,
    );

    // raws[arm][run][fixture], haiku[run][fixture]
    const raws = file?.raws ?? (await replayJev());
    const haiku = file?.haiku ?? (await replayHaiku());
    if (saved && (!file?.raws || !file.haiku))
        writeFileSync(
            saved,
            JSON.stringify({
                haiku,
                prompts,
                raws,
                roster: [...latest.roster],
                rosterPath: latest.path,
            } satisfies SavedReplay),
        );

    async function replayJev() {
        const out = {} as Record<ArmName, Raw[][]>;
        for (const arm of armNames) out[arm] = [];
        for (let run = 0; run < RUNS; run++)
            for (const arm of armNames)
                out[arm].push(
                    await pool(fixtures, (fx) => score(inputOf(fx), arms[arm])),
                );
        return out;
    }

    async function replayHaiku() {
        const out: HaikuRaw[][] = [];
        for (let run = 0; run < RUNS; run++)
            out.push(
                await pool(fixtures, (fx) =>
                    haikuRoute(inputOf(fx), latest.roster),
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
            at((fx) => isHeld(fx.state.prompt) && isVerdict(fx)),
        ],
        [
            'held · substantive',
            at((fx) => isHeld(fx.state.prompt) && !isVerdict(fx)),
        ],
        // 132 of 221 lines are synthetic: this row is the one no description-written prompt reaches
        [
            'held · real prompts',
            at((fx) => isHeld(fx.state.prompt) && fx.label !== 'synthetic'),
        ],
        [
            'all · single-skill',
            at((fx) => [fx.expect].flat().length === 1 && fx.expect !== 'none'),
        ],
        ['all · multi-skill', at((fx) => [fx.expect].flat().length > 1)],
        ['all', fixtures.map((_, i) => i)],
    ];

    // every jev arm swept on the same tune split; FRM-268 also printed at the thresholds it
    // shipped with; haiku has no threshold to sweep
    const jevLine = (arm: ArmName, label: string, t = defaultThresholds) => ({
        cost: (run: number, i: number) =>
            (raws[arm][run]?.[i]?.tokens ?? 0) * JEV_USD_PER_TOKEN,
        hasMemory: arms[arm].hasMemory,
        label,
        ms: raws[arm].flat().map((r) => r.ms),
        runs: raws[arm].map((run) => run.map((r) => decide(r, t))),
        t: `fits ${t.fits} · margin ${t.margin} · need ${t.need} · gate ${t.gate}`,
    });
    const lines: Line[] = [
        jevLine('frm-268', 'frm-268 shipped'),
        ...armNames.map((arm) =>
            jevLine(
                arm,
                arm,
                sweep(
                    tune.map((i) => ({
                        fx: fixtures[i] as RouterFixture,
                        raws: raws[arm].map((run) => run[i] as Raw),
                    })),
                    arms[arm],
                ),
            ),
        ),
        {
            cost: (run, i) => haiku[run]?.[i]?.cost ?? 0,
            hasMemory: true,
            label: 'haiku 4.5',
            ms: haiku.flat().map((h) => h.ms),
            runs: haiku.map((run) =>
                run.map(
                    (h): Suggestion => ({
                        loads: h.loads.map((name) => ({ name, p: 1 })),
                        tokens: 0,
                        top: { name: h.loads[0] ?? '-', p: 1 },
                        trace: ['haiku'],
                    }),
                ),
            ),
            t: 'claude -p, schema, full roster + context + memory',
        },
    ];

    const avgOver = (line: Line, idx: readonly number[]) => {
        const per = line.runs.map((run) =>
            metrics(
                idx.map((i) => ({
                    fx: fixtures[i] as RouterFixture,
                    s: run[i] as Suggestion,
                })),
                line.hasMemory,
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
        `\n${bold('latency and cost per prompt')} ${dim('· 4 in flight · jev: both calls, no node start or transcript read · haiku: the whole `claude -p` process')}`,
    );
    printTable(
        lines.map((line) => {
            const ms = [...line.ms].sort((a, b) => a - b);
            const q = (p: number) =>
                ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] ?? 0;
            const usd =
                line.runs
                    .flatMap((run, r) => run.map((_, i) => line.cost(r, i)))
                    .reduce((n, c) => n + c, 0) /
                (line.runs.length * fixtures.length);
            return [
                bold(line.label),
                `p50 ${q(0.5)} ms`,
                `p95 ${q(0.95)} ms`,
                `$${(usd * 1000).toFixed(2)} / 1k prompts`,
                dim(line.t),
            ];
        }),
    );

    // the v2 misses on the last run, each with the reason every stage gave
    const v2 = lines[armNames.length] as Line;
    const misses = fixtures.flatMap((fx, i) => {
        const s = v2.runs.at(-1)?.[i] as Suggestion;
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
        `\n${bold(`${v2.label} misses, last run`)} ${dim(`· ${misses.length} · want · got · trace · prompt`)}`,
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
type ArmName = (typeof armNames)[number];
type SavedReplay = {
    prompts: string[];
    roster: RouterSkill[];
    rosterPath: string;
    raws: Record<ArmName, Raw[][]>;
    haiku: HaikuRaw[][];
};
type Fixture = {
    state: Record<string, string>;
    expect: string;
};
/** one printed row: its suggestions per run, and what each prompt cost */
type Line = {
    label: string;
    hasMemory: boolean;
    runs: Suggestion[][];
    ms: number[];
    cost: (run: number, i: number) => number;
    t: string;
};
