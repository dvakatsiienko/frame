/**
 * jev:test — the fixture suite of every jev flow. one jsonl per flow in `shelf/jev/fixtures/`,
 * a line = the state jev sees + the lane cclio gave. run before a criterion changes and at the
 * halt; a criterion edit that lowers a flow's precision is refused. `skill-router` runs only when
 * named: the old shape beside the new one, `RUNS` times (default 3), exit 1 when the new
 * precision is lower. usage: pnpm jev:test [flow…]
 */

/* Core */
import { readFileSync } from 'node:fs';

/* Instruments */
import { judge } from './lib/jev.ts';
import { laneCells, printTable } from './lib/jev-print.ts';
import { flawlogQuestions, inboxQuestions } from './lib/jev-questions.ts';
import { bold, dim, gb, rb } from './lib/print.ts';
import type { Suggestion } from './lib/skill-router.ts';
import { suggest, suggestNouls } from './lib/skill-router.ts';

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

// the router runs only when named: RUNS × 79 × 3 calls is minutes, too long for every halt
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
    const fixtures = readFixtures(name);
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

function readFixtures(name: string) {
    return readFileSync(new URL(`${name}.jsonl`, FIXTURES), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Fixture);
}

// the cookbook's two error rates, plus precision over every load the agent would read
async function routerTest() {
    const fixtures = readFixtures(routerFlow);
    const shapes = { new: suggest, old: suggestNouls } as const;
    console.log(
        `\n${bold(routerFlow)} ${dim(`· ${fixtures.length} fixtures · RUNS=${RUNS}`)}`,
    );
    const runs = { new: [] as RunScore[], old: [] as RunScore[] };
    const last = new Map<string, Record<keyof typeof shapes, Suggestion>>();
    for (let run = 0; run < RUNS; run++)
        for (const shape of ['old', 'new'] as const) {
            const started = performance.now();
            const got = await pool(fixtures, (fx) =>
                shapes[shape](String(fx.state.prompt)),
            );
            const ms = (performance.now() - started) / fixtures.length;
            runs[shape].push(score(fixtures, got, ms));
            got.forEach((g, i) => {
                const prompt = String(fixtures[i]?.state.prompt);
                last.set(prompt, { ...last.get(prompt), [shape]: g } as Record<
                    keyof typeof shapes,
                    Suggestion
                >);
            });
        }
    const rows = fixtures.flatMap((fx) => {
        const pair = last.get(String(fx.state.prompt));
        if (!pair) return [];
        const cell = (s: Suggestion) => {
            const isHit =
                fx.expect === 'none'
                    ? !s.loads.length
                    : s.loads[0]?.name === fx.expect;
            const got = s.loads
                .map((l) => `${l.name} ${l.p.toFixed(2)}`)
                .join(', ');
            return (isHit ? gb : rb)(
                got ||
                    `none ${dim(`${s.stage} · ${s.top.name} ${s.top.p.toFixed(2)}`)}`,
            );
        };
        return [
            [
                dim(fx.label ?? '-'),
                bold(fx.expect),
                cell(pair.old),
                cell(pair.new),
                String(fx.state.prompt).slice(0, 60),
            ],
        ];
    });
    console.log(dim('last run · label · want · old · new · prompt'));
    printTable(rows);
    const line = (shape: keyof typeof runs) => {
        const r = runs[shape];
        const avg = (f: (s: RunScore) => number) =>
            r.reduce((n, s) => n + f(s), 0) / r.length;
        const span = (f: (s: RunScore) => number) => {
            const v = r.map(f);
            return `${pct(avg(f))} ${dim(`${pct(Math.min(...v))}–${pct(Math.max(...v))}`)}`;
        };
        return {
            avg,
            text: `${shape}  wrong ${span((s) => s.wrong)}  needless ${span((s) => s.needless)}  precision ${span((s) => s.precision)}  ${dim(`${Math.round(avg((s) => s.ms))} ms/prompt wall, 4 in flight — not latency`)}`,
        };
    };
    const [old, next] = [line('old'), line('new')];
    console.log(old.text);
    console.log(next.text);
    const isKept = next.avg((s) => s.precision) >= old.avg((s) => s.precision);
    console.log(
        isKept
            ? gb(bold('new precision ≥ old'))
            : rb(bold('new precision < old — refused')),
    );
    return isKept;
}

function score(
    fixtures: readonly Fixture[],
    got: readonly Suggestion[],
    ms: number,
): RunScore {
    const pairs = fixtures.map((fx, i) => ({ fx, s: got[i] as Suggestion }));
    const covered = pairs.filter((p) => p.fx.expect !== 'none');
    const uncovered = pairs.filter((p) => p.fx.expect === 'none');
    const loads = pairs.flatMap((p) =>
        p.s.loads.map((l) => l.name === p.fx.expect),
    );
    return {
        ms,
        needless:
            uncovered.filter((p) => p.s.loads.length).length / uncovered.length,
        // a router that loads nothing has no precision to keep, and must not pass the refusal
        precision: loads.length
            ? loads.filter(Boolean).length / loads.length
            : 0,
        wrong:
            covered.filter((p) => p.s.loads[0]?.name !== p.fx.expect).length /
            covered.length,
    };
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
    note?: string;
    label?: 'observed' | 'inferred' | 'synthetic';
};
type RunScore = {
    wrong: number;
    needless: number;
    precision: number;
    ms: number;
};
