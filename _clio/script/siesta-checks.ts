// the siesta's mechanical checks in one run before the wishkeeper spawn (FRM-496): its output joins the brief, so
// wishkeeper spends its read on judgment, never on re-running a script
// usage: node siesta-checks.ts --since <siesta-last stamp, or HH:MM today> — exits 0 when every section passes
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const OUTPUT_LINES = 40;
const RUN_TIMEOUT_MS = 60_000;
// wish-cover's own exit when the tracker read fails: an outage, never a missed wish
const NOT_CHECKED = 2;
// the same drafts and wish line wish-cover-on-write.sh checks at write time
const DRAFT_NAME = /^(spec\.md|.*proposal.*\.md|.*review.*\.md)$/;
const WISH_LINE = /^wish: *\[?(?:PK|FRM|BYT)-\d+.*$/gim;
const DAY_MS = 24 * 60 * 60 * 1000;
// under 3 runs a p90 is one run's noise: «unmeasured», never green
const MIN_RUNS = 3;
// red past budget × 1.25, and never for a step whose whole-second rows wobble by a second or two
const BUDGET_SLACK = 1.25;
const BUDGET_FLOOR_S = 2;

function main(home: string, since: string) {
    const scripts = path.join(home, 'frame/_clio/script');
    const sections: Section[] = [
        script(scripts, 'pocket-check', 'pocket-check', []),
        wishCover(home, scripts, since),
        orbitDrift(home),
        script(scripts, 'close net', 'close-net', []),
        script(scripts, 'blueprint drift', 'blueprint-drift', [
            '--since',
            since,
        ]),
        script(scripts, 'helper count', 'helper-count', ['--since', since]),
        auditCodie(home, since),
        gatesDrift(home),
        vmDown(home, since),
        gateBudget(home),
        retros(home),
    ];
    for (const s of sections)
        console.log(
            `## ${s.name} · ${s.status ?? `exit ${s.exit}`}\n${s.output.trimEnd()}\n`,
        );
    return sections.every((s) => s.exit === 0) ? 0 : 1;
}

function script(dir: string, name: string, file: string, args: string[]) {
    const out = spawnSync('node', [path.join(dir, `${file}.ts`), ...args], {
        cwd: dir,
        encoding: 'utf8',
        timeout: RUN_TIMEOUT_MS,
    });
    const lines = `${out.stdout ?? ''}${out.stderr ?? ''}`
        .trimEnd()
        .split('\n');
    const cut = lines.length - OUTPUT_LINES;
    const output = [
        ...(cut > 0
            ? [`… ${cut} lines cut, the last ${OUTPUT_LINES} follow`]
            : []),
        ...lines.slice(-OUTPUT_LINES),
    ].join('\n');
    return { exit: out.status ?? 1, name, output };
}

// a codie that skipped its contract before an edit; a verb that cannot answer reads «not checked», never red
function auditCodie(home: string, since: string) {
    const name = 'audit-codie';
    const day = new Date().toLocaleDateString('sv');
    const stamp = since.includes('T') ? since : `${day}T${since}:00`;
    const out = spawnSync(
        path.join(home, '.local/bin/x'),
        ['fleet', 'audit-codie', '--since', stamp, '--json'],
        { encoding: 'utf8', timeout: RUN_TIMEOUT_MS },
    );
    try {
        const { misses, summary } = JSON.parse(out.stdout).data;
        const lines = misses.map(
            (m: { file: string; session: string; why: string }) =>
                `🔴 ${m.session} ${m.file}: ${m.why}`,
        );
        return {
            exit: out.status === 1 ? 1 : 0,
            name,
            output: [...lines, summary].join('\n'),
        };
    } catch {
        return { exit: 0, name, output: '', status: 'not checked' };
    }
}

// every draft changed in the window that wish-cover-on-write.sh reads — a spec, a proposal or a review under frame's or
// clio's .scratch — against each ticket its wish lines name
function wishCover(home: string, scripts: string, since: string) {
    const from = sinceDate(since).getTime();
    const drafts = ['frame/.scratch', 'frame/_clio/.scratch']
        .flatMap((root) => drafted(path.join(home, root)))
        .filter((f) => statSync(f).mtimeMs > from);
    const runs = drafts.flatMap((file) => {
        const ids = [...readFileSync(file, 'utf8').matchAll(WISH_LINE)].flatMap(
            (line) => line[0].match(/\b(?:FRM|BYT|PK)-\d+\b/g) ?? [],
        );
        return [...new Set(ids)].map((id) => ({
            ...script(scripts, 'wish-cover', 'wish-cover', [id, file]),
            feature: path.relative(home, file),
        }));
    });
    const unchecked = runs.filter((r) => r.exit === NOT_CHECKED).length;
    return {
        exit: runs.some((r) => r.exit !== 0 && r.exit !== NOT_CHECKED) ? 1 : 0,
        name: 'wish-cover',
        output: runs.length
            ? [
                  ...runs.map((r) => `### ${r.feature}\n${r.output}`),
                  ...(unchecked
                      ? [`${unchecked} not checked: the tracker read failed`]
                      : []),
              ].join('\n')
            : 'no spec changed in the window',
        status:
            unchecked && unchecked === runs.length
                ? `${unchecked} not checked`
                : undefined,
    };
}

// a git hook in frame or bytes that the gates catalog never names: the page is the one list (FRM-530), fixed in place
function gatesDrift(home: string) {
    const name = 'gates drift';
    const page = readText(
        path.join(home, 'frame/docs/knowledge/gates-catalog.md'),
    );
    const named = new Set(
        [...page.matchAll(/\*\*([a-z0-9-]+)\*\*/g)].map((m) => m[1]),
    );
    const hooks = ['frame', 'projects/bytes'].flatMap((repo) =>
        hookNames(path.join(home, repo, 'lefthook.yaml')).map((hook) => ({
            hook,
            repo,
        })),
    );
    if (!page || !hooks.length)
        return { exit: 0, name, output: '', status: 'not checked' };
    const missing = hooks.filter(({ hook }) => !named.has(hook));
    return {
        exit: missing.length ? 1 : 0,
        name,
        output: missing.length
            ? missing
                  .map(
                      ({ hook, repo }) =>
                          `🔴 ${repo} hook ${hook} is missing from docs/knowledge/gates-catalog.md`,
                  )
                  .join('\n')
            : `${hooks.length} hook(s), every one on the page`,
    };
}

// a go run that fell back to the mac because vm-go-test was down: a forgotten boot start costs ~2× go cpu all day (FRM-551)
function vmDown(home: string, since: string) {
    const from = sinceDate(since).getTime();
    const down = readText(path.join(home, '.local/state/x/test-cpu-budget.log'))
        .split('\n')
        .map((row) => row.split('\t'))
        .filter((f) => f[9] === 'vm-down' && Date.parse(f[0] ?? '') > from);
    return {
        exit: down.length ? 1 : 0,
        name: 'vm down',
        output: down.length
            ? `🔴 ${down.length} go run(s) on the mac since ${since}, the vm was down: limactl start --tty=false vm-go-test`
            : 'no go run fell back to the mac',
    };
}

// a gate step whose last-24 h p90 runs past its budget (FRM-539): a slowdown named the day it starts, never felt first;
// a quiet log while commits landed is red too, since no rows reads exactly like no slowdown
function gateBudget(home: string, now = Date.now()) {
    const from = now - DAY_MS;
    const budgets = readText(
        path.join(home, 'frame/_clio/script/gate-budgets.tsv'),
    )
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('\t'))
        .map(([src = '', step = '', measure = '', budget = '']) => ({
            budget: Number(budget),
            key: `${src}\t${step}`,
            measure,
        }));
    const runs = new Map<
        string,
        { loads: number[]; values: number[]; walls: number[] }
    >();
    for (const f of readText(path.join(home, '.local/state/x/gate-steps.log'))
        .split('\n')
        .map((row) => row.split('\t'))) {
        const at = Date.parse(f[0] ?? '');
        if (!(at > from) || f[7] === 'test:twin:skipped' || f[6] !== '0')
            continue;
        const key = `${f[2]}\t${stepName(f[7] ?? '')}`;
        const run = runs.get(key) ?? { loads: [], values: [], walls: [] };
        run.loads.push(Number(f[1]));
        run.walls.push(Number(f[5]));
        run.values.push(Number(f[8]));
        runs.set(key, run);
    }
    const lines: string[] = [];
    let red = false;
    if (!runs.size && landedSince(home, from)) {
        red = true;
        lines.push(
            '🔴 logger silent: commits landed on main in the last 24 h, and gate-steps.log holds no row',
        );
    }
    for (const b of budgets) {
        const run = runs.get(b.key);
        const label = b.key.replace('\t', ' · ');
        if (!run) {
            lines.push(`⚪ ${label}: no runs in 24 h`);
            continue;
        }
        if (run.walls.length < MIN_RUNS) {
            lines.push(`⚪ ${label}: unmeasured, ${run.walls.length} run(s)`);
            continue;
        }
        const p90 = quantile(
            b.measure === 'cpu'
                ? run.values.filter(Number.isFinite)
                : run.walls,
            0.9,
        );
        const line = `${label}: p90 ${p90.toFixed(1)} s ${b.measure}, budget ${b.budget} s, median load ${quantile(run.loads, 0.5).toFixed(0)}`;
        if (
            p90 > Math.max(b.budget * BUDGET_SLACK, b.budget + BUDGET_FLOOR_S)
        ) {
            red = true;
            lines.push(`🔴 ${line}`);
        }
    }
    const known = new Set(budgets.map((b) => b.key));
    for (const [key, run] of runs)
        if (!known.has(key) && run.walls.length >= MIN_RUNS)
            lines.push(
                `🟡 ${key.replace('\t', ' · ')}: no budget, ${run.walls.length} runs, p90 ${quantile(run.walls, 0.9).toFixed(1)} s`,
            );
    return {
        exit: red ? 1 : 0,
        name: 'gate budget',
        output: lines.some((l) => !l.startsWith('⚪'))
            ? lines.join('\n')
            : `every gate step under its budget (${budgets.length} budgets)${lines.length ? `\n${lines.join('\n')}` : ''}`,
    };
}

// the step as gate-budgets.tsv names it: absolute paths folded, so a worktree's run and main's share one step
function stepName(cmd: string) {
    return cmd
        .replace(/(\/Users|\/private|\/var|\/tmp)\/\S+/g, '…')
        .replace(/\s+/g, ' ')
        .slice(0, 60)
        .trim();
}

function quantile(values: number[], q: number) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const at = (sorted.length - 1) * q;
    const low = Math.floor(at);
    const high = Math.ceil(at);
    return (
        (sorted[low] ?? 0) +
        ((sorted[high] ?? 0) - (sorted[low] ?? 0)) * (at - low)
    );
}

function landedSince(home: string, from: number) {
    const out = spawnSync(
        'git',
        [
            '-C',
            path.join(home, 'frame'),
            'log',
            'main',
            '--since',
            new Date(from).toISOString(),
            '--format=%h',
        ],
        { encoding: 'utf8', timeout: RUN_TIMEOUT_MS },
    );
    return out.status === 0 && out.stdout.trim().length > 0;
}

// lefthook's two shapes: `commands:` keys (frame) and named `jobs:` entries (bytes)
function hookNames(file: string): string[] {
    if (!existsSync(file)) return [];
    const out = spawnSync('yq', ['-o', 'json', '.', file], {
        encoding: 'utf8',
        timeout: RUN_TIMEOUT_MS,
    });
    return Object.values(parsed(out.stdout ?? '')).flatMap((stage) => {
        if (!stage || typeof stage !== 'object') return [];
        const { commands, jobs } = stage as {
            commands?: Record<string, unknown>;
            jobs?: { name?: string }[];
        };
        return [
            ...Object.keys(commands ?? {}),
            ...(jobs ?? []).flatMap((j) => (j.name ? [j.name] : [])),
        ];
    });
}

// an open orbit ask of clio's that names a pocket item already done: the board and the pocket disagree
function orbitDrift(home: string) {
    const session = readText(
        path.join(home, '.local/state/clio/main-session'),
    ).match(/^session=(\S+)/m)?.[1];
    const store = path.join(home, '.claude/plugins/store');
    const file = existsSync(store)
        ? readdirSync(store).find((f) =>
              /^x-mod-stash_inline-.*\.json$/.test(f),
          )
        : undefined;
    const kept = file ? parsed(readText(path.join(store, file))) : {};
    const items =
        (kept[`asks:${session}`] as { items?: { id: string; text: string }[] })
            ?.items ?? [];
    const pocket = path.join(home, 'frame/_clio/pocket');
    const drifted = items.flatMap((a) =>
        [...a.text.matchAll(/\bPK-(\d+)\b/gi)]
            .filter((m) => isDone(pocket, m[1] ?? ''))
            .map((m) => `${a.id}: PK-${m[1]} is done — «${a.text}»`),
    );
    return {
        exit: drifted.length ? 1 : 0,
        name: 'orbit drift',
        output: drifted.length
            ? drifted.join('\n')
            : `${items.length} open ask(s), none on a done pocket item`,
    };
}

// every retro on disk is pending: a fold trashes its files, so what is left waits for this siesta (step 2.7). pending is a
// job, never a red: while dima is afk they wait, and a red would become a high that holds the afk close
function retros(home: string) {
    const lanes = path.join(home, '.local/state/x/lanes');
    const unreadable: string[] = [];
    const pending = (
        existsSync(lanes) ? readdirSync(lanes, { withFileTypes: true }) : []
    )
        .filter((lane) => lane.isDirectory())
        .flatMap((lane) => {
            try {
                return readdirSync(path.join(lanes, lane.name))
                    .filter((f) => f.endsWith('-retro.md'))
                    .map((f) => path.join(lane.name, f));
            } catch {
                unreadable.push(`unreadable: ${lane.name}`);
                return [];
            }
        });
    return {
        exit: unreadable.length ? 1 : 0,
        name: 'retros',
        output: [...pending, ...unreadable].join('\n') || 'none pending',
        status: pending.length ? `${pending.length} pending` : undefined,
    };
}

function drafted(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return drafted(full);
        return DRAFT_NAME.test(e.name) ? [full] : [];
    });
}

function isDone(pocket: string, n: string) {
    const tasks = path.join(pocket, 'tasks');
    const live = existsSync(tasks)
        ? readdirSync(tasks).find((f) => f.toLowerCase().startsWith(`pk-${n} `))
        : undefined;
    if (live)
        return /^status:\s*done\b/im.test(readText(path.join(tasks, live)));
    return elsewhere(pocket, `pk-${n} `);
}

// an item no longer in tasks/ was filed: completed, archive, or any folder beside them
function elsewhere(dir: string, prefix: string): boolean {
    if (!existsSync(dir)) return false;
    return readdirSync(dir, { withFileTypes: true }).some((e) =>
        e.isDirectory()
            ? elsewhere(path.join(dir, e.name), prefix)
            : e.name.toLowerCase().startsWith(prefix),
    );
}

// a full stamp is its own moment; a bare HH:MM is today's
function sinceDate(since: string) {
    if (since.includes('T')) return new Date(since);
    const [h = '0', m = '0'] = since.split(':');
    const at = new Date();
    at.setHours(Number(h), Number(m), 0, 0);
    return at;
}

function readText(file: string) {
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function parsed(text: string): Record<string, unknown> {
    try {
        const value = JSON.parse(text) as unknown;
        return value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

if (import.meta.main) {
    const at = process.argv.indexOf('--since');
    const since = at > 0 ? process.argv[at + 1] : undefined;
    if (!since || !/^(\d{4}-\d\d-\d\dT)?\d{1,2}:\d{2}(:\d{2})?$/.test(since)) {
        console.error(
            'usage: node siesta-checks.ts --since <siesta-last stamp, or HH:MM today>',
        );
        process.exit(2);
    }
    process.exitCode = main(process.env.HOME ?? '', since);
}

/* Types */

type Section = { exit: number; name: string; output: string; status?: string };
