// which mapped boards a day's commits touched: a board's sources (cclio/blueprints/AGENTS.md § the mapped areas) against git
// usage: node blueprint-drift.ts [--since <git date, default midnight>]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const frame = path.resolve(import.meta.dirname, '../..');
const sinceAt = process.argv.indexOf('--since');
const since =
    sinceAt > 0 ? (process.argv[sinceAt + 1] ?? 'midnight') : 'midnight';

const agents = readFileSync(
    path.join(frame, 'cclio/blueprints/AGENTS.md'),
    'utf8',
);
const boards = [
    ...agents.matchAll(/^- (.+?) · (https:\S+) · sources: (.+)$/gm),
].map(([, name, url, sources]) => ({
    name,
    sources: (sources ?? '').split(', ').map((s) => s.trim()),
    url,
}));
if (boards.length === 0) {
    console.error('no mapped areas found in cclio/blueprints/AGENTS.md');
    process.exit(1);
}

const changed = execFileSync(
    'git',
    ['-C', frame, 'log', `--since=${since}`, '--name-only', '--format='],
    { encoding: 'utf8' },
)
    .split('\n')
    .filter(Boolean);

let stale = 0;
for (const board of boards) {
    const hits = [
        ...new Set(
            changed.filter((file) =>
                board.sources.some((src) =>
                    src.endsWith('/') ? file.startsWith(src) : file === src,
                ),
            ),
        ),
    ];
    if (hits.length === 0) continue;
    stale++;
    console.log(`🟡 ${board.name} · ${board.url}`);
    for (const file of hits) console.log(`   ${file}`);
}
console.log(
    stale
        ? `${stale} board(s) to re-check against today's changes`
        : `🟢 no mapped board's sources changed since ${since}`,
);
