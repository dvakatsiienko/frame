// usage: node script/evergreen-renovate.ts [--json] — one line per open renovate pr in frame and bytes: tier, age in days, ci, the package moves; a major adds the peer-range verdict of its dependants and the previous major's release date
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const repos = [
    { dir: path.join(homedir(), 'frame'), name: 'frame' },
    { dir: path.join(homedir(), 'projects', 'bytes'), name: 'bytes' },
] as const;

const dayMs = 86_400_000;

// «renovate/<pkg>-<major>.x» is a major; a grouped pr says patch or minor in its title
export function tierOf(branch: string, title: string): Tier {
    if (/^renovate\/.+-\d+\.x$/.test(branch)) return 'major';
    const grouped = /\((patch|minor|major)\)\s*$/.exec(title)?.[1];
    return grouped === 'patch' || grouped === 'minor' || grouped === 'major'
        ? grouped
        : 'unknown';
}

// no checks at all is none, never green; red beats pending beats green
export function ciState(rollup: Check[]): CiState {
    if (rollup.length === 0) return 'none';
    const states = rollup.map((check) =>
        check.__typename === 'StatusContext'
            ? (check.state ?? '')
            : check.status === 'COMPLETED'
              ? (check.conclusion ?? '')
              : 'PENDING',
    );
    if (
        states.some((state) =>
            [
                'FAILURE',
                'ERROR',
                'TIMED_OUT',
                'CANCELLED',
                'ACTION_REQUIRED',
                'STARTUP_FAILURE',
            ].includes(state),
        )
    )
        return 'red';
    if (states.some((state) => ['PENDING', 'EXPECTED', ''].includes(state)))
        return 'pending';
    // all skipped, neutral or stale means nothing ran
    return states.includes('SUCCESS') ? 'green' : 'none';
}

export function ageDays(createdAt: string, now: Date) {
    return Math.floor((now.getTime() - Date.parse(createdAt)) / dayMs);
}

// the «| [pkg](url) … | [`from` → `to`](url) | …» rows of renovate's body table
export function changesOf(body: string) {
    return [
        ...body.matchAll(
            /^\| (?:\[([^\]]+)\]|([^\s|]+))[^|]*\| \[?`([^`]+)` → `([^`]+)`/gm,
        ),
    ].map(
        ([, linked, bare, from = '', to = '']): Change => ({
            from,
            pkg: linked ?? bare ?? '',
            to,
        }),
    );
}

export function majorOf(version: string) {
    return Number.parseInt(version.replace(/^\D*/, ''), 10);
}

// whether a peer range admits a major, read at major granularity: «^4 || ^5», «>=4 <6», «4.x», «*»
export function admitsMajor(range: string, major: number) {
    return range.split('||').some((alt) =>
        alt
            .trim()
            // «16.8.0 - 18» is «>=16.8.0 <=18»; «>= 8» is «>=8»
            .replace(/^(\S+)\s+-\s+(\S+)$/, '>=$1 <=$2')
            .replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1')
            .split(/\s+/)
            .filter(Boolean)
            .every((part) => {
                const match = /^(\^|~|>=|<=|>|<|=)?v?(\d+|\*|x)(\.\d)?/i.exec(
                    part,
                );
                if (!match) return true;
                const [, op = '', value = '', minor] = match;
                if (value === '*' || value.toLowerCase() === 'x') return true;
                const bound = Number(value);
                // «>4» is «>=5», while «>4.2» still admits a later 4.x
                if (op === '>') return minor ? major >= bound : major > bound;
                if (op === '>=') return major >= bound;
                if (op === '<') return minor ? major <= bound : major < bound;
                if (op === '<=') return major <= bound;
                return major === bound;
            }),
    );
}

// the first dependant whose peer range for the package excludes the new major
export function peerVerdict(
    pkg: string,
    to: string,
    dependants: Dependant[],
): Peers {
    const blocker = dependants.find(
        ({ peers }) =>
            peers[pkg] !== undefined && !admitsMajor(peers[pkg], majorOf(to)),
    );
    return blocker ? `blocked by ${blocker.name}` : 'ok';
}

// the non-workspace packages that sit directly above the package in `pnpm why --json`
export function dependantNames(why: WhyEntry[]) {
    return [
        ...new Set(
            why.flatMap(({ dependents = [] }) =>
                dependents
                    .filter(({ depField }) => depField === undefined)
                    // the installed version's peers, never the latest's
                    .map(({ name, version }) =>
                        version ? `${name}@${version}` : name,
                    ),
            ),
        ),
    ];
}

// the release date of the major before the new one: its «.0.0»
export function prevMajorDate(
    time: Record<string, string>,
    to: string,
): string {
    return time[`${majorOf(to) - 1}.0.0`]?.slice(0, 10) ?? '?';
}

export function gather(run: Runner, now: Date): Row[] {
    return repos.flatMap(({ dir, name }) => {
        const prs: Pr[] = JSON.parse(
            run('gh', [
                'pr',
                'list',
                '-R',
                `dvakatsiienko/${name}`,
                '--search',
                'author:app/x-renovate',
                '--json',
                'number,title,headRefName,createdAt,statusCheckRollup,body',
            ]),
        );
        return prs.map((pr): Row => {
            const changes = changesOf(pr.body);
            const row: Row = {
                ageDays: ageDays(pr.createdAt, now),
                changes,
                ci: ciState(pr.statusCheckRollup),
                number: pr.number,
                repo: name,
                tier: tierOf(pr.headRefName, pr.title),
            };
            const [first] = changes;
            if (row.tier !== 'major' || !first) return row;
            const why: WhyEntry[] = JSON.parse(
                run('pnpm', ['-C', dir, 'why', first.pkg, '--json']),
            );
            const dependants = dependantNames(why).map((dependant) => ({
                name: dependant,
                peers: JSON.parse(
                    run('npm', [
                        'view',
                        dependant,
                        'peerDependencies',
                        '--json',
                    ]) || '{}',
                ) as Record<string, string>,
            }));
            row.peers = peerVerdict(first.pkg, first.to, dependants);
            row.prevMajor = prevMajorDate(
                JSON.parse(run('npm', ['view', first.pkg, 'time', '--json'])),
                first.to,
            );
            return row;
        });
    });
}

export function formatRow(row: Row) {
    const moves = row.changes
        .map(({ from, pkg, to }) => `${pkg} ${from}→${to}`)
        .join(', ');
    return [
        `${row.repo}#${row.number}`,
        row.tier,
        `${row.ageDays}d`,
        `ci ${row.ci}`,
        moves,
        ...(row.peers ? [`peers ${row.peers}`] : []),
        ...(row.prevMajor ? [`prev major ${row.prevMajor}`] : []),
    ].join(' · ');
}

const defaultRun: Runner = (cmd, args) =>
    execFileSync(cmd, args, { encoding: 'utf8', timeout: 60_000 });

if (import.meta.main) {
    const rows = gather(defaultRun, new Date());
    console.log(
        process.argv.includes('--json')
            ? JSON.stringify(rows, null, 2)
            : rows.map(formatRow).join('\n'),
    );
}

/* Types */

export type Runner = (cmd: string, args: string[]) => string;

export type Tier = 'major' | 'minor' | 'patch' | 'unknown';
export type CiState = 'green' | 'red' | 'pending' | 'none';
export type Peers = 'ok' | `blocked by ${string}`;

export interface Check {
    __typename?: string;
    conclusion?: string | null;
    state?: string;
    status?: string;
}

export interface Change {
    from: string;
    pkg: string;
    to: string;
}

export interface Dependant {
    name: string;
    peers: Record<string, string>;
}

export interface WhyEntry {
    dependents?: { depField?: string; name: string; version?: string }[];
}

interface Pr {
    body: string;
    createdAt: string;
    headRefName: string;
    number: number;
    statusCheckRollup: Check[];
    title: string;
}

export interface Row {
    ageDays: number;
    changes: Change[];
    ci: CiState;
    number: number;
    peers?: Peers;
    prevMajor?: string;
    repo: string;
    tier: Tier;
}
