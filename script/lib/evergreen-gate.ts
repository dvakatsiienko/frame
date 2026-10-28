import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const GO_FORMAT =
    '{{if and .Update (not .Indirect) (not .Main)}}{{.Path}} {{.Version}} {{.Update.Version}} {{.Update.Time}}{{end}}';

export async function evergreenGate({ exec, now, roots }: GateInput) {
    const holds = readHolds(roots);
    const sources = await Promise.all([
        npmItems('frame', roots.frame, exec),
        npmItems('bytes', roots.bytes, exec),
        goItems('x/go', join(roots.frame, 'x/go'), exec),
        goItems('sline', join(roots.frame, 'home/.claude/sline'), exec),
        brewItems(roots.frame, exec),
        uvItems(roots.frame, exec),
    ]);

    const lines: string[] = [];
    let failing = 0;
    for (const source of sources) {
        if ('error' in source) {
            lines.push(`✖ ${source.error}`);
            failing++;
            continue;
        }
        for (const item of source.items) {
            const verdict = await judge(item, holds, now, exec);
            if (verdict.kind === 'skip') continue;
            lines.push(
                `${line(item)}${verdict.note ? `  ${verdict.note}` : ''}`,
            );
            if (verdict.kind === 'behind') failing++;
        }
    }
    lines.push(
        failing === 0
            ? 'evergreen:gate — current: nothing behind but holds, majors and fresh releases'
            : `evergreen:gate — ${failing} behind`,
    );
    return { code: failing === 0 ? 0 : 1, lines };
}

async function judge(
    item: Item,
    holds: Hold[],
    now: Date,
    exec: Exec,
): Promise<Verdict> {
    if (item.kind === 'info') return { kind: 'info', note: '(informs only)' };
    const hold = holds.find((h) => h.names.includes(item.name));
    if (hold) return { kind: 'hold', note: `held: ${hold.description}` };
    if (isMajor(item.current, item.latest))
        return { kind: 'major', note: 'waiting for the major round' };
    const released = item.released ?? (await npmReleased(item, exec));
    if (released && now.getTime() - released.getTime() < MIN_AGE_MS)
        return { kind: 'skip' };
    return { kind: 'behind' };
}

async function npmItems(surface: string, root: string, exec: Exec) {
    const out = await exec(
        'pnpm',
        ['outdated', '-r', '--format', 'json'],
        root,
    );
    try {
        const rows = JSON.parse(out.stdout) as Record<string, OutdatedRow>;
        const items: Item[] = Object.entries(rows).map(([name, r]) => ({
            current: r.current,
            kind: 'npm',
            latest: r.latest,
            name,
            surface,
        }));
        return { items };
    } catch {
        return {
            error: `${surface}: pnpm outdated printed no json (exit ${out.code})`,
        };
    }
}

async function goItems(surface: string, dir: string, exec: Exec) {
    const out = await exec(
        'go',
        ['list', '-m', '-u', '-f', GO_FORMAT, 'all'],
        dir,
    );
    if (out.code !== 0)
        return { error: `${surface}: go list exited ${out.code}` };
    const items: Item[] = out.stdout
        .split('\n')
        .filter(Boolean)
        .map((l) => {
            const [name = '', current = '', latest = '', ...time] =
                l.split(' ');
            return {
                current,
                kind: 'go',
                latest,
                name,
                released: new Date(`${time.slice(0, 2).join('T')}Z`),
                surface,
            };
        });
    return { items };
}

async function brewItems(cwd: string, exec: Exec) {
    const out = await exec('brew', ['outdated', '--greedy', '--json=v2'], cwd);
    try {
        const { casks, formulae } = JSON.parse(out.stdout) as {
            casks: BrewRow[];
            formulae: BrewRow[];
        };
        const items: Item[] = [...formulae, ...casks].map((r) => ({
            current: r.installed_versions.at(-1) ?? '?',
            kind: 'info',
            latest: r.current_version,
            name: r.name,
            surface: 'brew',
        }));
        return { items };
    } catch {
        return { error: `brew: outdated printed no json (exit ${out.code})` };
    }
}

async function uvItems(cwd: string, exec: Exec) {
    const out = await exec('uv', ['tool', 'list', '--outdated'], cwd);
    if (out.code !== 0) return { error: `uv: tool list exited ${out.code}` };
    const items: Item[] = [];
    for (const l of out.stdout.split('\n')) {
        const m = l.match(/^(\S+) v(\S+) \[latest: (\S+)\]/);
        if (m)
            items.push({
                current: m[2] ?? '',
                kind: 'info',
                latest: m[3] ?? '',
                name: m[1] ?? '',
                surface: 'uv',
            });
    }
    return { items };
}

async function npmReleased(item: Item, exec: Exec) {
    const out = await exec(
        'pnpm',
        ['view', item.name, 'time', '--json'],
        tmpdir(),
    );
    try {
        const time = JSON.parse(out.stdout) as Record<string, string>;
        const at = time[item.latest];
        return at ? new Date(at) : undefined;
    } catch {
        return undefined;
    }
}

function readHolds(roots: Roots): Hold[] {
    const files = [
        join(roots.frame, 'renovate/default.json'),
        join(roots.frame, 'renovate.json'),
        join(roots.bytes, 'renovate.json'),
    ];
    return files.flatMap((file) => {
        const config = JSON.parse(readFileSync(file, 'utf8')) as {
            packageRules?: RenovateRule[];
        };
        return (config.packageRules ?? [])
            .filter(
                (r) =>
                    r.matchPackageNames &&
                    (r.enabled === false || r.allowedVersions !== undefined),
            )
            .map((r) => ({
                description: r.description ?? 'no description',
                names: r.matchPackageNames ?? [],
            }));
    });
}

function isMajor(current: string, latest: string) {
    const major = (v: string) => v.replace(/^v/, '').split('.')[0];
    return major(current) !== major(latest);
}

function line(item: Item) {
    return `${item.surface}  ${item.name}  ${item.current} → ${item.latest}`;
}

/* Types */

export type Exec = (
    cmd: string,
    args: string[],
    cwd: string,
) => Promise<{ code: number; stdout: string }>;

type Roots = { bytes: string; frame: string };

type GateInput = { exec: Exec; now: Date; roots: Roots };

type Item = {
    current: string;
    kind: 'go' | 'info' | 'npm';
    latest: string;
    name: string;
    released?: Date;
    surface: string;
};

type Verdict =
    | { kind: 'behind'; note?: undefined }
    | { kind: 'hold' | 'info' | 'major'; note: string }
    | { kind: 'skip'; note?: undefined };

type Hold = { description: string; names: string[] };

type OutdatedRow = { current: string; latest: string };

type BrewRow = {
    current_version: string;
    installed_versions: string[];
    name: string;
};

type RenovateRule = {
    allowedVersions?: string;
    description?: string;
    enabled?: boolean;
    matchPackageNames?: string[];
};
