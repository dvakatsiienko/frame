import { execFileSync } from 'node:child_process';
import path from 'node:path';

// a head names the subcommand for these, so `gh pr` and `gh api` count apart
const subcommandTools = new Set([
    'brew',
    'claude',
    'gh',
    'git',
    'go',
    'linear',
    'npm',
    'npx',
    'op',
    'pnpm',
    'x',
]);
const interpreters = new Set([
    'bash',
    'node',
    'python',
    'python3',
    'sh',
    'zsh',
]);
const wrappers = new Set(['command', 'env', 'exec', 'time']);
const setup = new Set(['cd', 'export', 'pushd', 'set', 'source']);
// the admission rule can never make these a verb, and they would fill the top 20
export const shellBasics = new Set([
    'awk',
    'cat',
    'chmod',
    'cp',
    'cut',
    'date',
    'diff',
    'echo',
    'find',
    'for',
    'grep',
    'head',
    'if',
    'jq',
    'ls',
    'mkdir',
    'mv',
    'printf',
    'rg',
    'sd',
    'sed',
    'sleep',
    'sort',
    'tail',
    'tee',
    'test',
    'touch',
    'tr',
    'trash',
    'uniq',
    'wc',
    'while',
    'xargs',
]);

export function bashCommands(projects: string, days: number) {
    const glob = path.join(projects, '*', '*.jsonl').replaceAll("'", "''");
    const sql = `
        select c->'input'->>'command' as command
        from (
            select (j->>'timestamp')::timestamptz as ts,
                unnest(from_json(j->'message'->'content', '["json"]')) as c
            from read_ndjson_objects('${glob}', ignore_errors = true) t(j)
            where (j->>'type') = 'assistant'
        )
        where (c->>'type') = 'tool_use' and (c->>'name') = 'Bash'
            and ts >= now() - to_days(${Math.trunc(days)})`;
    const out = execFileSync('duckdb', ['-json', '-c', sql], {
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
    });
    const rows: { command: string | null }[] = out.trim()
        ? JSON.parse(out)
        : [];
    return rows.flatMap((row) => (row.command ? [row.command] : []));
}

// the first segment that runs something: leading `cd`, assignments and wrappers are noise
export function commandHead(command: string) {
    for (const segment of command.split(/&&|\|\||;|\n/)) {
        const words = segment.trim().split(/\s+/).filter(Boolean);
        while (words.length) {
            const word = words[0] ?? '';
            if (/^[A-Za-z_]\w*=/.test(word) || wrappers.has(word))
                words.shift();
            else if (word === 'timeout') words.splice(0, 2);
            else break;
        }
        const first = words[0];
        if (!first || first.startsWith('#') || setup.has(first)) continue;
        const tool = path.basename(first);
        const rest = words.slice(1).filter((word) => !word.startsWith('-'));
        if (subcommandTools.has(tool)) {
            const sub = rest.find((word) => /^[a-z][\w:-]*$/.test(word));
            return sub ? `${tool} ${sub}` : tool;
        }
        if (interpreters.has(tool)) {
            const script = rest[0]?.match(
                /^[\w./~-]+\.(?:js|mjs|py|sh|ts)$/,
            )?.[0];
            return script ? `${tool} ${path.basename(script)}` : tool;
        }
        return tool;
    }
    return undefined;
}

// covered: an x call, a raw door's tool (`x linear api` covers `linear api`), or a call to
// a script or pnpm name some verb `replaces:`
export function isCovered(command: string, head: string, cover: Cover) {
    if (head === 'x' || head.startsWith('x ')) return true;
    if (cover.rawDoors.some((door) => head === door.replace(/^x /, '')))
        return true;
    return cover.replaces.some((old) =>
        old.includes('/') ? command.includes(old) : head === `pnpm ${old}`,
    );
}

export function rawHeads(
    commands: string[],
    cover: Cover,
    { minRuns = 5, top = 20 } = {},
) {
    const runs = new Map<string, number>();
    for (const command of commands) {
        const head = commandHead(command);
        if (!head || shellBasics.has(head) || isCovered(command, head, cover))
            continue;
        runs.set(head, (runs.get(head) ?? 0) + 1);
    }
    return [...runs]
        .filter(([, count]) => count >= minRuns)
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .slice(0, top)
        .map(([head, count]) => ({ head, runs: count }));
}

/* Types */

export interface Cover {
    rawDoors: string[];
    replaces: string[];
}
