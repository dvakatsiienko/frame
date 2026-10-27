// which mapped boards a day's commits touched: a board's sources (cclio/blueprints/AGENTS.md § the mapped areas) against git
// usage: node blueprint-drift.ts [--since <git date, default: each board file's last commit, a url board's `drawn:` date>]
// exits 1 when any board is stale
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const frame = path.resolve(import.meta.dirname, '../..');

// a board's version, bumped by its builder (cclio/blueprints/board_version.py); keyed by the board's dir name
export function versionOf(url: string): string {
    const file = path.join(frame, 'cclio/blueprints/versions.json');
    const key = path.basename(path.dirname(url));
    try {
        const entry = JSON.parse(readFileSync(file, 'utf8'))[key] as
            | { version: number; at: string }
            | undefined;
        return entry ? ` · v${entry.version} (${entry.at})` : '';
    } catch {
        return '';
    }
}

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
                drawn: where.match(/drawn: (\d{4}-\d{2}-\d{2})/)?.[1],
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
        ['-C', frame, 'log', '-1', '--format=%H', '--', file],
        {
            encoding: 'utf8',
        },
    ).trim();
}

// where a board's drift window opens: --since wins; a board file's last commit; a url board's `drawn:` date.
// no date to start from is a stale verdict («never drawn», «no drawn date»), never a quiet green
export function drawnSince(
    board: { drawn?: string; file?: string },
    commit: string,
    sinceArg?: string,
): { since: string } | { stale: string } {
    if (sinceArg) return { since: sinceArg };
    if (board.file) {
        return commit ? { since: commit } : { stale: 'never drawn' };
    }
    return board.drawn ? { since: board.drawn } : { stale: 'no drawn date' };
}

// a board's own commit opens its window by sha, so sources committed together with the redraw do not count; a date is a --since
export const logWindow = (since: string) =>
    /^[0-9a-f]{40}$/.test(since) ? [`${since}..HEAD`] : [`--since=${since}`];

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
        const window = drawnSince(
            board,
            board.file && !sinceArg ? lastCommit(board.file) : '',
            sinceArg,
        );
        if ('stale' in window) {
            stale++;
            console.log(`🟡 ${board.name} · ${board.url} · ${window.stale}`);
            continue;
        }
        const { since } = window;
        const changed = execFileSync(
            'git',
            [
                '-C',
                frame,
                'log',
                ...logWindow(since),
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
        console.log(
            `🟡 ${board.name}${versionOf(board.url)} · ${board.url} · since ${since}`,
        );
        for (const file of hits) console.log(`   ${file}`);
    }
    console.log(
        stale
            ? `${stale} of ${boards.length} board(s) to re-check: sources changed after the board`
            : `🟢 ${boards.length} board(s), no source changed after its board`,
    );
    if (stale) process.exitCode = 1;
}
