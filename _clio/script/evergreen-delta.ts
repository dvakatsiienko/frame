// usage: node script/evergreen-delta.ts [--since YYYY-MM-DD] [--day YYYY-MM-DD] — the evergreen delta: every package that moved since the last run, `name from -> to`, by lane, for the read's researcher cards
// --since defaults to the oldest `markedAt` in evergreen/sources.json (the last run, before this run marks); --day names the run's log dir, ~/.local/state/clio/evergreen/<day>/ (brew-upgrade.log, pnpm-g-outdated.json, uv-outdated.txt)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const depFields = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
] as const;

function bare(version: string) {
    return version.replace(/^[~^>=v]+/, '');
}

// one manifest pair → the deps whose pinned version changed; added or removed deps are not moves
export function manifestMoves(before: string, after: string): Move[] {
    const read = (text: string): Record<string, string> => {
        const json = JSON.parse(text) as Record<string, Record<string, string>>;
        return Object.assign(
            {},
            ...depFields.map((field) => json[field] ?? {}),
        );
    };
    const [old, now] = [read(before), read(after)];
    return Object.entries(now).flatMap(([name, to]) => {
        const from = old[name];
        return from === undefined ||
            to.startsWith('workspace:') ||
            bare(from) === bare(to)
            ? []
            : [{ from: bare(from), name, to: bare(to) }];
    });
}

// a regex match of «name from to» groups → a move
function moveOf([, name = '', from = '', to = '']: RegExpMatchArray): Move {
    return { from, name, to };
}

// a go.mod pair → the required modules whose version changed
export function goModMoves(before: string, after: string): Move[] {
    const read = (text: string) =>
        new Map(
            [
                ...text.matchAll(
                    /^\s*(?:require\s+)?([\w./-]+\.[\w./-]+)\s+(v[\w.+-]+)/gm,
                ),
            ].map(([, name = '', version = '']) => [name, version] as const),
        );
    const [old, now] = [read(before), read(after)];
    return [...now]
        .filter(([name, to]) => old.has(name) && old.get(name) !== to)
        .map(([name, to]) => ({ from: old.get(name) ?? '', name, to }));
}

// `brew upgrade` prints «name  1.2.3  -> 1.2.4  (size)» per package
export function brewMoves(log: string): Move[] {
    // the log lists each package twice: the plan up top, then the pour
    const moves = [...log.matchAll(/^([\w@.+/-]+)\s+(\S+)\s+->\s+(\S+)/gm)].map(
        moveOf,
    );
    return [...new Map(moves.map((move) => [move.name, move])).values()];
}

// `uv tool list --outdated` prints «name v1.2.3 [latest: 1.3.0]»
export function uvMoves(text: string): Move[] {
    return [...text.matchAll(/^(\S+) v?(\S+) \[latest: v?([^\]]+)\]/gm)].map(
        moveOf,
    );
}

// `pnpm outdated -g --json`: { name: { current, latest } }
export function pnpmGlobalMoves(json: string): Move[] {
    const rows = JSON.parse(json) as Record<
        string,
        { current: string; latest: string }
    >;
    return Object.entries(rows).map(([name, row]) => ({
        from: row.current,
        name,
        to: row.latest,
    }));
}

function git(dir: string, ...args: string[]) {
    return execFileSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        maxBuffer: 64 << 20,
    });
}

function show(dir: string, rev: string, file: string) {
    try {
        return git(dir, 'show', `${rev}:${file}`);
    } catch {
        return undefined;
    }
}

function repoMoves(
    dir: string,
    since: string,
    pattern: RegExp,
    parse: (before: string, after: string) => Move[],
) {
    const base = git(
        dir,
        'rev-list',
        '-1',
        `--before=${since}T00:00`,
        'origin/main',
    ).trim();
    if (!base) return [];
    const files = git(dir, 'diff', '--name-only', base, 'origin/main')
        .split('\n')
        .filter((file) => pattern.test(file) && !file.includes('node_modules'));
    const seen = new Map<string, Move>();
    for (const file of files) {
        const before = show(dir, base, file);
        const after = show(dir, 'origin/main', file);
        if (!before || !after) continue;
        for (const move of parse(before, after)) seen.set(move.name, move);
    }
    return [...seen.values()];
}

function print(title: string, moves: Move[]) {
    console.log(`## ${title} — ${moves.length}`);
    for (const m of moves.toSorted((a, b) => a.name.localeCompare(b.name)))
        console.log(`${m.name} ${m.from} -> ${m.to}`);
    console.log('');
}

if (import.meta.main) {
    const { values } = parseArgs({
        options: { day: { type: 'string' }, since: { type: 'string' } },
    });
    const home = homedir();
    const sources = JSON.parse(
        readFileSync(
            path.join(home, 'frame/_clio/evergreen/sources.json'),
            'utf8',
        ),
    ) as { markedAt: string }[];
    const since =
        values.since ??
        sources.map((source) => source.markedAt).toSorted()[0] ??
        '';
    const day = values.day ?? new Date().toISOString().slice(0, 10);
    const logs = path.join(home, '.local/state/clio/evergreen', day);
    const frame = path.join(home, 'frame');
    const bytes = path.join(home, 'projects/bytes');
    for (const dir of [frame, bytes]) git(dir, 'fetch', '-q', 'origin');

    console.log(`# evergreen delta since ${since} (logs: ${logs})\n`);
    const manifest = /(^|\/)package\.json$/;
    print('pnpm · frame', repoMoves(frame, since, manifest, manifestMoves));
    print('pnpm · bytes', repoMoves(bytes, since, manifest, manifestMoves));
    print('go · frame', repoMoves(frame, since, /(^|\/)go\.mod$/, goModMoves));
    const lanes = [
        ['brew', 'brew-upgrade.log', brewMoves],
        ['pnpm -g', 'pnpm-g-outdated.json', pnpmGlobalMoves],
        ['uv tools', 'uv-outdated.txt', uvMoves],
    ] as const;
    for (const [title, file, parse] of lanes) {
        const full = path.join(logs, file);
        if (existsSync(full)) print(title, parse(readFileSync(full, 'utf8')));
        else
            console.log(
                `## ${title} — ⚠️ no ${full}: save it before the upgrade runs\n`,
            );
    }
}

/* Types */

export type Move = { from: string; name: string; to: string };
