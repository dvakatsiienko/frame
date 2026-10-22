// which mapped boards a day's commits touched: a board's sources (cclio/blueprints/AGENTS.md § the mapped areas) against git
// usage: node blueprint-drift.ts [--since <git date, default midnight>]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const frame = path.resolve(import.meta.dirname, '../..');

export function mappedBoards() {
    const agents = readFileSync(
        path.join(frame, 'cclio/blueprints/AGENTS.md'),
        'utf8',
    );
    return [
        ...agents.matchAll(/^- (.+?) · (https:\S+) · sources: (.+)$/gm),
    ].map(([, name, url, sources]) => ({
        name: name ?? '',
        sources: (sources ?? '').split(', ').map((s) => s.trim()),
        url: url ?? '',
    }));
}

// a source ending in «/» maps its whole dir; any other maps one file, both relative to ~/frame
export function boardMaps(sources: string[], file: string) {
    return sources.some((src) =>
        src.endsWith('/') ? file.startsWith(src) : file === src,
    );
}

if (import.meta.main) {
    const sinceAt = process.argv.indexOf('--since');
    const since =
        sinceAt > 0 ? (process.argv[sinceAt + 1] ?? 'midnight') : 'midnight';

    const boards = mappedBoards();
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
                changed.filter((file) => boardMaps(board.sources, file)),
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
}
