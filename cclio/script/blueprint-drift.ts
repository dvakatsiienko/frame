// which mapped boards a day's commits touched: a board's sources (cclio/blueprints/AGENTS.md § the mapped areas) against git
// usage: node blueprint-drift.ts [--since <git date, default: each board file's last commit>]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const frame = path.resolve(import.meta.dirname, '../..');

export function mappedBoards() {
    const agents = readFileSync(
        path.join(frame, 'cclio/blueprints/AGENTS.md'),
        'utf8',
    );
    // a line: `- <name> · <where: a board file in backticks and/or a url> · sources: <a, b, …>`
    return [...agents.matchAll(/^- (.+?) · (.+?) · sources: (.+)$/gm)].map(
        ([, name, where = '', sources]) => {
            const file = where.match(/`([^`]+\.(?:drawio|excalidraw))`/)?.[1];
            return {
                file: file ? `cclio/blueprints/${file}` : undefined,
                name: name ?? '',
                sources: (sources ?? '').split(', ').map((s) => s.trim()),
                url: file ?? where.match(/https:[^\s,)]+/)?.[0] ?? where,
            };
        },
    );
}

function lastCommit(file: string) {
    return execFileSync(
        'git',
        ['-C', frame, 'log', '-1', '--format=%cI', '--', file],
        {
            encoding: 'utf8',
        },
    ).trim();
}

// a source ending in «/» maps its whole dir; any other maps one file, both relative to ~/frame
export function boardMaps(sources: string[], file: string) {
    return sources.some((src) =>
        src.endsWith('/') ? file.startsWith(src) : file === src,
    );
}

if (import.meta.main) {
    // default window: each board's own last commit, so a tile gone stale before today still shows
    const sinceAt = process.argv.indexOf('--since');
    const sinceArg = sinceAt > 0 ? process.argv[sinceAt + 1] : undefined;

    const boards = mappedBoards();
    if (boards.length === 0) {
        console.error('no mapped areas found in cclio/blueprints/AGENTS.md');
        process.exit(1);
    }

    let stale = 0;
    for (const board of boards) {
        const since =
            sinceArg ?? (board.file && lastCommit(board.file)) ?? 'midnight';
        const changed = execFileSync(
            'git',
            [
                '-C',
                frame,
                'log',
                `--since=${since}`,
                '--name-only',
                '--format=',
            ],
            { encoding: 'utf8' },
        )
            .split('\n')
            .filter(Boolean);
        const hits = [
            ...new Set(
                changed.filter((file) => boardMaps(board.sources, file)),
            ),
        ];
        if (hits.length === 0) continue;
        stale++;
        console.log(`🟡 ${board.name} · ${board.url} · since ${since}`);
        for (const file of hits) console.log(`   ${file}`);
    }
    console.log(
        stale
            ? `${stale} of ${boards.length} board(s) to re-check: sources changed after the board`
            : `🟢 ${boards.length} board(s), no source changed after its board`,
    );
}
