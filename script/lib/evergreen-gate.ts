import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GO_FORMAT =
    '{{if and .Update (not .Indirect) (not .Main)}}{{.Path}} {{.Version}} {{.Update.Version}} {{.Update.Time}}{{end}}';
const DAY_MS = 24 * 60 * 60 * 1000;

export async function evergreenGate({ exec, now, roots }: GateInput) {
    const preset = readConfig(join(roots.frame, 'renovate/default.json'));
    const frameHolds = holdsOf([
        preset,
        readConfig(join(roots.frame, 'renovate.json')),
    ]);
    const bytesHolds = holdsOf([
        preset,
        readConfig(join(roots.bytes, 'renovate.json')),
    ]);
    const minAgeMs = minAgeDays(preset) * DAY_MS;

    const sources = await Promise.all([
        npmSource('frame', roots.frame, frameHolds, exec),
        npmSource('bytes', roots.bytes, bytesHolds, exec),
        goSource('x/go', join(roots.frame, 'x/go'), frameHolds, exec),
        goSource(
            'sline',
            join(roots.frame, 'home/.claude/sline'),
            frameHolds,
            exec,
        ),
        brewSource(roots.frame, exec),
        uvSource(roots.frame, exec),
    ]);

    const report: string[] = [];
    let behind = 0;
    for (const source of sources) {
        if (source.error !== undefined) {
            report.push(`✖ ${source.error}`);
            if (!source.informsOnly) behind++;
            continue;
        }
        for (const item of source.items) {
            const verdict = await judge(item, now, minAgeMs, exec);
            if (verdict.kind === 'skip') continue;
            report.push(
                verdict.note
                    ? `${itemLine(item)}  ${verdict.note}`
                    : itemLine(item),
            );
            if (verdict.kind === 'behind') behind++;
        }
    }
    report.push(
        behind === 0
            ? 'evergreen:gate — current: nothing behind but holds, majors and fresh releases'
            : `evergreen:gate — ${behind} behind`,
    );
    return { code: behind === 0 ? 0 : 1, lines: report };
}

async function judge(
    item: Item,
    now: Date,
    minAgeMs: number,
    exec: Exec,
): Promise<Verdict> {
    if (item.kind === 'info') return { kind: 'info', note: '(informs only)' };
    const type = updateType(item.current, item.latest);
    const hold = item.holds.find((h) => isHeld(h, item, type));
    if (hold) return { kind: 'hold', note: `held: ${hold.description}` };
    if (type === 'major')
        return { kind: 'major', note: 'waiting for the major round' };
    const released =
        item.kind === 'go' ? item.released : await npmReleased(item, exec);
    if (released && now.getTime() - released.getTime() < minAgeMs)
        return { kind: 'skip' };
    return { kind: 'behind' };
}

async function npmSource(
    surface: Surface,
    root: string,
    holds: Hold[],
    exec: Exec,
): Promise<Source> {
    const out = await exec(
        'pnpm',
        ['outdated', '-r', '--format', 'json'],
        root,
    );
    const rows = parseJson<Record<string, OutdatedRow>>(out.stdout);
    if (!rows)
        return {
            error: `${surface}: pnpm outdated printed no json (exit ${out.code})`,
        };
    const items = Object.entries(rows).map(([name, row]) => ({
        current: row.current,
        holds,
        kind: 'npm' as const,
        latest: row.latest,
        name,
        surface,
    }));
    return { items };
}

async function goSource(
    surface: Surface,
    dir: string,
    holds: Hold[],
    exec: Exec,
): Promise<Source> {
    const out = await exec(
        'go',
        ['list', '-m', '-u', '-f', GO_FORMAT, 'all'],
        dir,
    );
    if (out.code !== 0)
        return { error: `${surface}: go list exited ${out.code}` };
    const items = out.stdout
        .split('\n')
        .filter(Boolean)
        .map((goLine) => {
            const [name = '', current = '', latest = '', day = '', time = ''] =
                goLine.split(' ');
            return {
                current,
                holds,
                kind: 'go' as const,
                latest,
                name,
                released: new Date(`${day}T${time}Z`),
                surface,
            };
        });
    return { items };
}

async function brewSource(cwd: string, exec: Exec): Promise<Source> {
    const out = await exec('brew', ['outdated', '--greedy', '--json=v2'], cwd);
    const brew = parseJson<{ casks: BrewRow[]; formulae: BrewRow[] }>(
        out.stdout,
    );
    if (!brew)
        return {
            error: `brew: outdated printed no json (exit ${out.code})`,
            informsOnly: true,
        };
    const items = [...brew.formulae, ...brew.casks].map((row) => ({
        current: row.installed_versions.at(-1) ?? '?',
        kind: 'info' as const,
        latest: row.current_version,
        name: row.name,
        surface: 'brew' as const,
    }));
    return { items };
}

async function uvSource(cwd: string, exec: Exec): Promise<Source> {
    const out = await exec('uv', ['tool', 'list', '--outdated'], cwd);
    if (out.code !== 0)
        return { error: `uv: tool list exited ${out.code}`, informsOnly: true };
    const items = out.stdout.split('\n').flatMap((uvLine) => {
        const [, name, current, latest] =
            uvLine.match(/^(\S+) v(\S+) \[latest: (\S+)\]/) ?? [];
        return name && current && latest
            ? [
                  {
                      current,
                      kind: 'info' as const,
                      latest,
                      name,
                      surface: 'uv' as const,
                  },
              ]
            : [];
    });
    return { items };
}

async function npmReleased(item: Item, exec: Exec) {
    const out = await exec(
        'pnpm',
        ['view', item.name, 'time', '--json'],
        tmpdir(),
    );
    const at = parseJson<Record<string, string>>(out.stdout)?.[item.latest];
    return at ? new Date(at) : undefined;
}

function readConfig(file: string) {
    return JSON.parse(readFileSync(file, 'utf8')) as RenovateConfig;
}

function holdsOf(configs: RenovateConfig[]): Hold[] {
    return configs
        .flatMap((config) => config.packageRules ?? [])
        .filter(
            (rule) =>
                rule.matchPackageNames &&
                (rule.enabled === false || rule.allowedVersions),
        )
        .map((rule) => ({
            allowedVersions: rule.allowedVersions,
            description: rule.description ?? 'no description',
            names: rule.matchPackageNames ?? [],
            updateTypes: rule.matchUpdateTypes,
        }));
}

function isHeld(hold: Hold, item: Item, type: UpdateType) {
    if (!hold.names.includes(item.name)) return false;
    if (hold.updateTypes && !hold.updateTypes.includes(type)) return false;
    const cap = hold.allowedVersions?.match(/^<\s*(\S+)$/)?.[1];
    if (hold.allowedVersions && cap)
        return compareVersions(item.latest, cap) >= 0;
    return true;
}

function minAgeDays(preset: RenovateConfig) {
    return Number(preset.minimumReleaseAge?.match(/^(\d+) days?$/)?.[1] ?? 0);
}

function updateType(current: string, latest: string): UpdateType {
    const [cMajor, cMinor] = parts(current);
    const [lMajor, lMinor] = parts(latest);
    if (cMajor !== lMajor) return 'major';
    return cMinor === lMinor ? 'patch' : 'minor';
}

function compareVersions(a: string, b: string) {
    const [pa, pb] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function parts(version: string) {
    return version.replace(/^v/, '').split(/[.-]/).slice(0, 3).map(Number);
}

function parseJson<T>(text: string): T | undefined {
    try {
        return JSON.parse(text) as T;
    } catch {
        return;
    }
}

function itemLine(item: Item) {
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

type Surface = 'brew' | 'bytes' | 'frame' | 'sline' | 'uv' | 'x/go';

type Item =
    | {
          current: string;
          holds: Hold[];
          kind: 'npm';
          latest: string;
          name: string;
          surface: Surface;
      }
    | {
          current: string;
          holds: Hold[];
          kind: 'go';
          latest: string;
          name: string;
          released: Date;
          surface: Surface;
      }
    | {
          current: string;
          kind: 'info';
          latest: string;
          name: string;
          surface: Surface;
      };

type Source =
    | { error: string; informsOnly?: boolean; items?: undefined }
    | { error?: undefined; items: Item[] };

type Verdict =
    | { kind: 'behind' | 'skip'; note?: undefined }
    | { kind: 'hold' | 'info' | 'major'; note: string };

type UpdateType = 'major' | 'minor' | 'patch';

type Hold = {
    allowedVersions?: string;
    description: string;
    names: string[];
    updateTypes?: string[];
};

type OutdatedRow = { current: string; latest: string };

type BrewRow = {
    current_version: string;
    installed_versions: string[];
    name: string;
};

type RenovateConfig = {
    minimumReleaseAge?: string;
    packageRules?: {
        allowedVersions?: string;
        description?: string;
        enabled?: boolean;
        matchPackageNames?: string[];
        matchUpdateTypes?: string[];
    }[];
};
