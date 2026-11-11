// one row per wishkeeper run since a date: its requests, cache reads and writes by ttl, output, the first request's warm share, and its cost at opus 5.5 prices
// usage: node docs/test-drive/wishkeeper-cache/measure.ts <since YYYY-MM-DDTHH:MM, local time> [card]; rows print at_utc
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// $ per million tokens, crew-lead references/model-cards.md (opus 5.5, vendor)
const PRICE = { out: 20, read: 0.2, write1h: 8, write5m: 5 };

const [since = '', card = 'wishkeeper'] = process.argv.slice(2);
const from = new Date(since);
if (Number.isNaN(from.getTime())) {
    console.error('usage: measure.ts <since YYYY-MM-DDTHH:MM> [card]');
    process.exit(2);
}

const projects = path.join(homedir(), '.claude/projects');
const dirsIn = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
const rows = dirsIn(projects).flatMap((project) =>
    dirsIn(path.join(projects, project)).flatMap((session) => {
        const dir = path.join(projects, project, session, 'subagents');
        if (!existsSync(dir)) return [];
        return readdirSync(dir)
            .filter((f) => f.endsWith('.meta.json'))
            .flatMap((meta) => runOf(dir, meta));
    }),
);

function runOf(dir: string, meta: string) {
    const kind = JSON.parse(readFileSync(path.join(dir, meta), 'utf8')) as {
        agentType?: string;
    };
    const log = path.join(dir, meta.replace('.meta.json', '.jsonl'));
    if (kind.agentType !== card || !existsSync(log)) return [];
    if (statSync(log).mtime < from) return [];
    const usages = readFileSync(log, 'utf8')
        .split('\n')
        .flatMap((line) => {
            try {
                const row = JSON.parse(line) as {
                    message?: { usage?: Usage };
                    timestamp?: string;
                };
                return row.message?.usage
                    ? [{ at: row.timestamp ?? '', ...row.message.usage }]
                    : [];
            } catch {
                return [];
            }
        });
    const first = usages[0];
    if (!first || new Date(first.at) < from) return [];
    const sum = (pick: (u: Usage) => number | undefined) =>
        usages.reduce((n, u) => n + (pick(u) ?? 0), 0);
    const read = sum((u) => u.cache_read_input_tokens);
    const write5m = sum((u) => u.cache_creation?.ephemeral_5m_input_tokens);
    const write1h = sum((u) => u.cache_creation?.ephemeral_1h_input_tokens);
    const out = sum((u) => u.output_tokens);
    const firstIn =
        (first.cache_read_input_tokens ?? 0) +
        (first.cache_creation_input_tokens ?? 0) +
        (first.input_tokens ?? 0);
    const cost =
        (read * PRICE.read +
            write5m * PRICE.write5m +
            write1h * PRICE.write1h +
            out * PRICE.out) /
        1e6;
    return [
        {
            at_utc: first.at.slice(0, 16),
            cost: Number(cost.toFixed(3)),
            first_warm: firstIn
                ? Number(
                      ((first.cache_read_input_tokens ?? 0) / firstIn).toFixed(
                          2,
                      ),
                  )
                : 0,
            out,
            read,
            requests: usages.length,
            run: path.basename(log, '.jsonl'),
            // the arm is read off the run's own cache writes, never off a date: a 1 h write anywhere makes it the 1 h arm
            ttl: write1h > 0 ? (write5m > 0 ? 'mixed' : '1h') : '5m',
            write1h,
            write5m,
        },
    ];
}

rows.sort((a, b) => a.at_utc.localeCompare(b.at_utc));
for (const row of rows) console.log(JSON.stringify(row));
for (const ttl of ['5m', '1h', 'mixed']) {
    const arm = rows.filter((r) => r.ttl === ttl);
    if (!arm.length) continue;
    const total = arm.reduce((n, r) => n + r.cost, 0);
    console.log(
        JSON.stringify({
            cost_per_run: Number((total / arm.length).toFixed(3)),
            first_warm_median: median(arm.map((r) => r.first_warm)),
            runs: arm.length,
            ttl,
        }),
    );
}

function median(values: number[]) {
    const s = [...values].sort((a, b) => a - b);
    return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0;
}

/* Types */

type Usage = {
    cache_creation?: {
        ephemeral_1h_input_tokens?: number;
        ephemeral_5m_input_tokens?: number;
    };
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
};
