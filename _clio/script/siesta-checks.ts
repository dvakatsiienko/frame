// the siesta's mechanical checks in one run before the wishkeeper spawn (FRM-496): its output joins the brief, so
// wishkeeper spends its read on judgment, never on re-running a script
// usage: node siesta-checks.ts --since <siesta-last stamp, or HH:MM today> — exits 0 when every section passes
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const OUTPUT_LINES = 40;
const RUN_TIMEOUT_MS = 60_000;
// wish-cover's own exit when the tracker read fails: an outage, never a missed wish
const NOT_CHECKED = 2;

function main(home: string, since: string) {
    const scripts = path.join(home, 'frame/_clio/script');
    const sections = [
        script(scripts, 'pocket-check', 'pocket-check', []),
        wishCover(home, scripts, since),
        orbitDrift(home),
        script(scripts, 'blueprint drift', 'blueprint-drift', [
            '--since',
            since,
        ]),
        script(scripts, 'helper count', 'helper-count', ['--since', since]),
    ];
    for (const s of sections)
        console.log(`## ${s.name} · exit ${s.exit}\n${s.output.trimEnd()}\n`);
    return sections.every((s) => s.exit === 0) ? 0 : 1;
}

function script(dir: string, name: string, file: string, args: string[]) {
    const out = spawnSync('node', [path.join(dir, `${file}.ts`), ...args], {
        cwd: dir,
        encoding: 'utf8',
        timeout: RUN_TIMEOUT_MS,
    });
    const lines = `${out.stdout ?? ''}${out.stderr ?? ''}`
        .trimEnd()
        .split('\n');
    const cut = lines.length - OUTPUT_LINES;
    const output = [
        ...(cut > 0
            ? [`… ${cut} lines cut, the last ${OUTPUT_LINES} follow`]
            : []),
        ...lines.slice(-OUTPUT_LINES),
    ].join('\n');
    return { exit: out.status ?? 1, name, output };
}

// every spec changed in the window, read against each ticket its `wish:` lines name
function wishCover(home: string, scripts: string, since: string) {
    const root = path.join(home, 'frame/.scratch');
    const from = sinceDate(since).getTime();
    const specs = existsSync(root)
        ? readdirSync(root)
              .map((d) => path.join(root, d, 'spec.md'))
              .filter((f) => existsSync(f) && statSync(f).mtimeMs > from)
        : [];
    const runs = specs.flatMap((file) => {
        const ids = [
            ...readFileSync(file, 'utf8').matchAll(/^wish: .*$/gm),
        ].flatMap((line) => line[0].match(/\b(?:FRM|BYT|PK)-\d+\b/g) ?? []);
        return [...new Set(ids)].map((id) => ({
            ...script(scripts, 'wish-cover', 'wish-cover', [id, file]),
            feature: path.basename(path.dirname(file)),
        }));
    });
    const unchecked = runs.filter((r) => r.exit === NOT_CHECKED).length;
    return {
        exit: runs.some((r) => r.exit !== 0 && r.exit !== NOT_CHECKED) ? 1 : 0,
        name: 'wish-cover',
        output: runs.length
            ? [
                  ...runs.map((r) => `### ${r.feature}\n${r.output}`),
                  ...(unchecked
                      ? [`${unchecked} not checked: the tracker read failed`]
                      : []),
              ].join('\n')
            : 'no spec changed in the window',
    };
}

// an open orbit ask of clio's that names a pocket item already done: the board and the pocket disagree
function orbitDrift(home: string) {
    const session = readText(
        path.join(home, '.local/state/clio/main-session'),
    ).match(/^session=(\S+)/m)?.[1];
    const store = path.join(home, '.claude/plugins/store');
    const file = existsSync(store)
        ? readdirSync(store).find((f) =>
              /^x-mod-stash_inline-.*\.json$/.test(f),
          )
        : undefined;
    const kept = file ? parsed(readText(path.join(store, file))) : {};
    const items =
        (kept[`asks:${session}`] as { items?: { id: string; text: string }[] })
            ?.items ?? [];
    const pocket = path.join(home, 'frame/_clio/pocket');
    const drifted = items.flatMap((a) =>
        [...a.text.matchAll(/\bPK-(\d+)\b/gi)]
            .filter((m) => isDone(pocket, m[1] ?? ''))
            .map((m) => `${a.id}: PK-${m[1]} is done — «${a.text}»`),
    );
    return {
        exit: drifted.length ? 1 : 0,
        name: 'orbit drift',
        output: drifted.length
            ? drifted.join('\n')
            : `${items.length} open ask(s), none on a done pocket item`,
    };
}

function isDone(pocket: string, n: string) {
    const tasks = path.join(pocket, 'tasks');
    const live = existsSync(tasks)
        ? readdirSync(tasks).find((f) => f.toLowerCase().startsWith(`pk-${n} `))
        : undefined;
    if (live)
        return /^status:\s*done\b/im.test(readText(path.join(tasks, live)));
    return elsewhere(pocket, `pk-${n} `);
}

// an item no longer in tasks/ was filed: completed, archive, or any folder beside them
function elsewhere(dir: string, prefix: string): boolean {
    if (!existsSync(dir)) return false;
    return readdirSync(dir, { withFileTypes: true }).some((e) =>
        e.isDirectory()
            ? elsewhere(path.join(dir, e.name), prefix)
            : e.name.toLowerCase().startsWith(prefix),
    );
}

// a full stamp is its own moment; a bare HH:MM is today's
function sinceDate(since: string) {
    if (since.includes('T')) return new Date(since);
    const [h = '0', m = '0'] = since.split(':');
    const at = new Date();
    at.setHours(Number(h), Number(m), 0, 0);
    return at;
}

function readText(file: string) {
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function parsed(text: string): Record<string, unknown> {
    try {
        const value = JSON.parse(text) as unknown;
        return value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

if (import.meta.main) {
    const at = process.argv.indexOf('--since');
    const since = at > 0 ? process.argv[at + 1] : undefined;
    if (!since || !/^(\d{4}-\d\d-\d\dT)?\d{1,2}:\d{2}(:\d{2})?$/.test(since)) {
        console.error(
            'usage: node siesta-checks.ts --since <siesta-last stamp, or HH:MM today>',
        );
        process.exit(2);
    }
    process.exitCode = main(process.env.HOME ?? '', since);
}
