// Classify the collected Bash calls and write gate-wait-transcripts.md.
// usage: node analyze.mjs   (reads calls.json from collect.mjs)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const here = process.env.GATE_SPEED_DIR;
const { sessions, calls } = JSON.parse(readFileSync(join(here, 'calls.json')));

// ---- classification: per command segment, the command words must open the segment
const PRIORITY = [
    'commit',
    'push',
    'red-proof',
    'mods-edit',
    'mods-test',
    'mutants',
    'go-test',
    'vitest/test',
    'typecheck',
];
const lead = (s, n) => s.split(/\s+/).slice(0, n).join(' ');
const RULES = {
    commit: (s) =>
        /^(x lane commit|git (-C \S+ )?commit)\b/.test(s) &&
        !/--dry|--help/.test(s),
    'go-test': (s) => /^go test\b/.test(s),
    'mods-edit': (s) => /^x mods edit\b/.test(s),
    'mods-test': (s) =>
        /\bmods:test\b/.test(lead(s, 4)) || /^claude plugin test\b/.test(s),
    mutants: (s) => /mutant|stryker/.test(lead(s, 3)),
    push: (s) => /^x lane push\b/.test(s),
    'red-proof': (s) =>
        /^(\S*\/)?red-proof\s+(--pairs|--cmd|[/.~$"'\w])/.test(s) &&
        !/^\S*red-proof\s+--help/.test(s),
    typecheck: (s) =>
        /^pnpm (-\S+ )*typecheck\b/.test(s) || /\btsc\b/.test(lead(s, 4)),
    'vitest/test': (s) =>
        /vitest/.test(lead(s, 4)) || /^pnpm (-\S+ )*test\b/.test(s),
};
const segments = (cmd) =>
    cmd.split(/&&|\|\||;|\n|\|/).map((s) =>
        s
            .trim()
            .replace(/^(\w+=\S*\s+)+/, '')
            .replace(/^(time|exec|\()\s*/, '')
            .replace(/^\{\s*/, ''),
    );
for (const c of calls) {
    const segs = segments(c.cmd);
    c.classes = PRIORITY.filter((k) => segs.some(RULES[k]));
    c.cls = c.classes[0];
    c.gq = /gate-queue/.test(c.cmd);
    c.group =
        c.dir === '-Users-dima-frame--clio'
            ? 'coordinator'
            : c.dir.includes('claude-jobs')
              ? 'probe'
              : 'coding';
    c.dur = c.end != null ? (c.end - c.t0) / 1000 : null;
}
const gates = calls.filter((c) => c.cls);

// ---- helpers
const pct = (a, p) =>
    a.length
        ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]
        : NaN;
const sorted = (a) => [...a].sort((x, y) => x - y);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'n/a');
const min = (s) => f1(s / 60);
const GROUPS = ['all', 'coding', 'coordinator', 'probe'];
const inGroup = (c, g) => g === 'all' || c.group === g;
const out = [];
const P = (s = '') => out.push(s);
const prefix = (c) => c.session.slice(0, 8);
const cmd80 = (c) => c.cmd.replace(/\s+/g, ' ').slice(0, 80);
const clock = (t) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');

function statLine(cs) {
    const d = sorted(cs.filter((c) => c.dur != null).map((c) => c.dur));
    const sum = d.reduce((a, b) => a + b, 0);
    return `n=${cs.length} (timed ${d.length}), p50 ${f1(pct(d, 50))}s, p90 ${f1(pct(d, 90))}s, max ${f1(d.at(-1))}s, sum ${min(sum)} min`;
}
function union(iv) {
    const s = [...iv].sort((a, b) => a[0] - b[0]);
    let tot = 0,
        cur = null;
    for (const [a, b] of s) {
        if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b);
        else {
            if (cur) tot += cur[1] - cur[0];
            cur = [a, b];
        }
    }
    return tot + (cur ? cur[1] - cur[0] : 0);
}

P('# Gate wait from session transcripts');
P();
P(
    `Window: transcripts under ~/.claude/projects/*/*.jsonl modified in the last 7 days (top-level session files only, subagent files excluded): ${new Set(calls.map((c) => c.session)).size} sessions with Bash calls, ${calls.length} Bash calls, ${gates.length} classified as gates.`,
);
P(
    'Groups: coordinator = project dir -Users-dima-frame--clio; probe = dirs containing claude-jobs (scratch probes); coding = everything else. Group is inferred from the project dir, not measured.',
);
P(
    `Classification (heuristic, inferred): each command is split on && || ; | newline and a class matches only when the segment opens with the command words, so prose mentions in commit messages or greps do not count. A call with several classes is counted once under the first of: ${PRIORITY.join(', ')} (red-proof is ahead of mods-edit/mods-test, because it wraps them). A compound call's whole duration lands on that one class.`,
);
P(
    'Durations: foreground = tool_result timestamp minus tool_use timestamp (includes any permission prompt wait). Background = task-notification timestamp (matched on tool-use-id, then task id) minus tool_use timestamp. Calls with no end are untimed.',
);
P();

// ---- pairing summary
P('## Pairing');
for (const g of GROUPS) {
    const cs = gates.filter((c) => inGroup(c, g));
    const bg = cs.filter((c) => c.bg);
    P(
        `- ${g}: ${cs.length} gate calls; foreground ${cs.length - bg.length} (untimed ${cs.filter((c) => !c.bg && c.dur == null).length}); background ${bg.length}, paired to a notification ${bg.filter((c) => c.kind === 'bg').length}, not paired ${bg.filter((c) => c.kind !== 'bg').length}`,
    );
}
P();

// ---- 1
P('## 1. Per class (foreground and background together)');
for (const g of GROUPS) {
    P(`### ${g}`);
    for (const k of PRIORITY) {
        const cs = gates.filter((c) => c.cls === k && inGroup(c, g));
        if (!cs.length) continue;
        const fg = cs.filter((c) => !c.bg),
            bg = cs.filter((c) => c.bg);
        P(`- ${k}: ${statLine(cs)}`);
        if (bg.length)
            P(
                `  - of which foreground ${fg.length} (${statLine(fg)}); background ${bg.length} (${statLine(bg)})`,
            );
    }
}
P();

// ---- gate-queue
P('## Gate queue');
for (const g of GROUPS) {
    const cs = gates.filter((c) => inGroup(c, g));
    const q = cs.filter((c) => c.wait != null);
    const w = sorted(q.map((c) => c.wait));
    P(
        `- ${g}: ${cs.filter((c) => c.gq).length} of ${cs.length} gate commands name gate-queue in the command; ${cs.filter((c) => c.queueText).length} show a gate-queue line in the result; ${q.length} show a wait (sum ${min(w.reduce((a, b) => a + b, 0))} min, p50 ${f1(pct(w, 50))}s, max ${f1(w.at(-1))}s)`,
    );
}
const allQ = calls.filter((c) => c.wait != null);
P(
    `- all Bash calls, any class: ${calls.filter((c) => c.gq).length} name gate-queue, ${allQ.length} show a wait; wait seconds: ${sorted(allQ.map((c) => c.wait)).join(', ') || 'none'}`,
);
P(
    '- Background results are not in the transcript (the output sits in a task file), so a queue wait inside a background call is invisible here: the wait count is a floor.',
);
P();

// ---- 2
for (const k of ['commit', 'red-proof']) {
    P(`## 2. 15 longest ${k}s (all groups)`);
    const top = gates
        .filter((c) => c.cls === k && c.dur != null)
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 15);
    for (const c of top)
        P(
            `- ${prefix(c)} ${clock(c.t0)}Z ${c.dur.toFixed(0)}s ${c.bg ? 'bg' : 'fg'} [${c.group}] ${cmd80(c)}`,
        );
    P();
}

// ---- 3
const bySession = new Map();
for (const s of sessions) bySession.set(`${s.dir}/${s.session}`, s);
const per = new Map();
for (const c of gates) {
    if (c.dur == null) continue;
    const key = `${c.dir}/${c.session}`;
    const e = per.get(key) ?? { bg: [], c, fg: [] };
    (c.bg ? e.bg : e.fg).push([c.t0, c.end]);
    per.set(key, e);
}
const spanOf = (s) =>
    (s.stamps[1] - s.stamps[0] - s.gaps.reduce((a, b) => a + b, 0)) / 1000;
const rows = [...per.entries()]
    .map(([key, e]) => {
        const s = bySession.get(key);
        const span = spanOf(s);
        const fg = union(e.fg) / 1000,
            bg = union(e.bg) / 1000;
        return { bg, e, fg, key, span, tot: union([...e.fg, ...e.bg]) / 1000 };
    })
    .sort((a, b) => b.tot - a.tot);
P('## 3. Ten sessions with the most gate time');
P(
    'Span = first to last message timestamp minus every gap longer than 30 min. Gate minutes = union of call intervals (parallel calls counted once). fg = the agent was blocked; bg = it could work on. A background interval may cross a removed gap, so percent can pass 100.',
);
for (const r of rows.slice(0, 10)) {
    P(
        `- ${prefix(r.e.c)} [${r.e.c.group}] span ${min(r.span)} min; fg gates ${min(r.fg)} min (${f1((100 * r.fg) / r.span)}%); bg gates ${min(r.bg)} min (${f1((100 * r.bg) / r.span)}%)`,
    );
}
const codingRows = rows.filter(
    (r) => r.e.c.group === 'coding' && r.span >= 1800,
);
const sf = codingRows.reduce((a, r) => a + r.fg, 0),
    sb = codingRows.reduce((a, r) => a + r.bg, 0),
    ss = codingRows.reduce((a, r) => a + r.span, 0);
P(
    `- Coding sessions with a gate and span >= 30 min (${codingRows.length}): fg gate ${min(sf)} min of ${min(ss)} min span = ${f1((100 * sf) / ss)}%; bg gate ${min(sb)} min = ${f1((100 * sb) / ss)}%`,
);
const sd = sorted(codingRows.map((r) => (100 * r.fg) / r.span));
P(
    `  - per-session fg percent: p50 ${f1(pct(sd, 50))}, p90 ${f1(pct(sd, 90))}, max ${f1(sd.at(-1))}`,
);
P();

// ---- 4
P('## 4. Red-proof runs');
const rp = gates.filter((c) => c.cls === 'red-proof' && c.dur != null);
const invocations = (c) => segments(c.cmd).filter(RULES['red-proof']).length;
const testFile = (c) => c.cmd.match(/[\w./-]+\.(?:test|spec)\.[tj]sx?/)?.[0];
const single = rp.filter(
    (c) => invocations(c) === 1 && !c.cmd.includes('--pairs'),
);
P(
    `- timed red-proof calls: ${rp.length} (${rp.filter((c) => c.bg).length} background); single plain invocations ${single.length}; with --pairs ${rp.filter((c) => c.cmd.includes('--pairs')).length}; compound (more than one red-proof invocation) ${rp.filter((c) => invocations(c) > 1).length}`,
);
const withFile = single.filter(testFile);
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
P(
    `- single invocations naming a test file: ${withFile.length}, mean ${f1(meanOf(withFile.map((c) => c.dur)))}s, p50 ${f1(pct(sorted(withFile.map((c) => c.dur)), 50))}s, p90 ${f1(pct(sorted(withFile.map((c) => c.dur)), 90))}s`,
);
const byFile = new Map();
for (const c of withFile)
    byFile.set(testFile(c), [...(byFile.get(testFile(c)) ?? []), c.dur]);
for (const [f, d] of [...byFile.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8))
    P(
        `  - ${f.split('/').slice(-2).join('/')}: ${d.length} runs, mean ${f1(meanOf(d))}s`,
    );
// pairs: count in the command itself (inferred): literal \t or tab in an inline printf, or lines of a readable pairs file
const pairsIn = (c) => {
    const inline = (c.cmd.match(/\\t|\t/g) ?? []).length;
    const m = c.cmd.match(/--pairs\s+(\S+)/);
    if (m && !m[1].startsWith('$') && existsSync(m[1]))
        return readFileSync(m[1], 'utf8')
            .split('\n')
            .filter((l) => l.trim() && !l.startsWith('#')).length;
    return inline;
};
const pr = rp.filter((c) => c.cmd.includes('--pairs') && invocations(c) === 1);
const withN = pr.map((c) => ({ c, n: pairsIn(c) })).filter((x) => x.n > 0);
P(
    `- --pairs single-invocation calls: ${pr.length}; pair count recoverable for ${withN.length} (inferred: tab characters in the command, or lines of the pairs file when it still exists)`,
);
if (withN.length) {
    const per1 = sorted(withN.map((x) => x.c.dur / x.n));
    const ns = sorted(withN.map((x) => x.n));
    P(
        `  - pairs per run: p50 ${pct(ns, 50)}, max ${ns.at(-1)}; mean run ${f1(meanOf(withN.map((x) => x.c.dur)))}s; seconds per pair: p50 ${f1(pct(per1, 50))}, p90 ${f1(pct(per1, 90))}`,
    );
    for (const [lo, hi] of [
        [1, 2],
        [3, 5],
        [6, 100],
    ]) {
        const b = withN.filter((x) => x.n >= lo && x.n <= hi);
        if (b.length)
            P(
                `  - ${lo}-${hi} pairs: ${b.length} runs, mean ${f1(meanOf(b.map((x) => x.c.dur)))}s, mean per pair ${f1(meanOf(b.map((x) => x.c.dur / x.n)))}s`,
            );
    }
}
P();

// ---- 5
P('## 5. Commits per active hour (coding sessions)');
const cod = rows.length
    ? [...bySession.entries()].filter(
          ([, s]) =>
              !s.dir.includes('claude-jobs') &&
              s.dir !== '-Users-dima-frame--clio',
      )
    : [];
let commits = 0,
    hours = 0;
const rates = [];
for (const [key, s] of cod) {
    const n = gates.filter(
        (c) => c.cls === 'commit' && `${c.dir}/${c.session}` === key,
    ).length;
    const h = spanOf(s) / 3600;
    if (h >= 0.5) {
        commits += n;
        hours += h;
        if (n) rates.push(n / h);
    }
}
const rs = sorted(rates);
P(
    `- coding sessions with active span >= 30 min: total ${commits} commit calls in ${f1(hours)} active hours = ${f1(commits / hours)} per hour overall`,
);
P(
    `- among those with at least one commit (${rs.length}): per-session p50 ${f1(pct(rs, 50))}, p90 ${f1(pct(rs, 90))}, max ${f1(rs.at(-1))} per hour`,
);
const cm = gates.filter(
    (c) => c.cls === 'commit' && c.group === 'coding' && c.dur != null,
);
const cmean = meanOf(cm.map((c) => c.dur));
P(
    `- operator claim check: coding commit mean ${f1(cmean)}s (p50 ${f1(pct(sorted(cm.map((c) => c.dur)), 50))}s) so 10 commits = ${f1((10 * cmean) / 60)} min measured against the claimed 30 min`,
);
P();

// ---- sanity
P('## Pairing sanity check (3 hand-picked calls)');
P(
    'Each call was re-found by grepping the raw jsonl for its tool_use id and reading the timestamps of the matching lines directly, independent of the pairing code.',
);
const picks = [
    gates.find((c) => c.cls === 'commit' && !c.bg && c.dur > 60),
    gates.find((c) => c.bg && c.kind === 'bg' && c.cls !== 'commit'),
    gates.find((c) => c.wait != null && !c.bg),
].filter(Boolean);
for (const c of picks) {
    const raw = readFileSync(
        join(homedir(), '.claude/projects', c.dir, `${c.session}.jsonl`),
        'utf8',
    )
        .split('\n')
        .filter((l) => l.includes(c.id));
    const stamps = raw.map(
        (l) =>
            `${l.match(/"type":"(\w+)"/)?.[1]}@${l.match(/"timestamp":"([^"]+)"/)?.[1]}`,
    );
    P(
        `- ${prefix(c)} ${c.cls} ${c.bg ? 'bg' : 'fg'} "${cmd80(c).slice(0, 40)}": script ${c.dur.toFixed(1)}s; raw lines with the id: ${stamps.join(', ')}`,
    );
}
writeFileSync(join(here, 'gate-wait-transcripts.md'), `${out.join('\n')}\n`);
console.log(out.length, 'lines written');
