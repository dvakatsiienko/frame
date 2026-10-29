// pnpm mods:skew — every event a mod hooks, checked against each engine a live session runs: an engine refuses a whole
// module that hooks an event it does not know, so one new event blanks the mod in every session one engine behind
// (claude-code#91870, 10-16: `prompt.change` from 2.1.300 refused a statusline mod on 2.1.296 and 2.1.299)
// an engine's events come from the types it wrote (its first line names the version), cached per version under
// $X_STATE/mods-events (else ~/.local/state/x) so a list outlives the tmp dir; a live engine with no list is unchecked,
// said out loud
import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// every dotted key the engine declares as an event: a superset is safe, since a name it misses would only red a mod
export function eventsOf(types: string) {
    const engine = [
        ...types.matchAll(/^\s+'([a-zA-Z]+(?:\.[a-zA-Z]+)+)'\??:/gm),
    ].map((m) => m[1] as string);
    // a classic event is `classic.<hook_event_name>`, built by a mapped type rather than spelled as a key
    const classic = [...types.matchAll(/hook_event_name: '([A-Za-z]+)'/g)].map(
        (m) => `classic.${m[1]}`,
    );
    return new Set([...engine, ...classic]);
}

export const versionOf = (types: string) =>
    types.match(/^\/\/ Written by Claude Code (\d+\.\d+\.\d+)\./)?.[1];

// `claude plugin validate` prints «<module> hooks: a, b{door=x}, c»; the matcher in braces is not the event
export function hookedEvents(validate: string) {
    const out = new Set<string>();
    for (const m of validate.matchAll(/❯ \S+ hooks: (.+)$/gm))
        for (const part of (m[1] as string).split(/,\s*(?![^{]*\})/))
            out.add(part.replace(/\{.*\}$/, '').trim());
    return out;
}

const semver = (v: string) => v.split('.').map(Number);
export const byVersion = (a: string, b: string) => {
    const [x, y] = [semver(a), semver(b)];
    for (let i = 0; i < 3; i++)
        if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
};

// the desktop app ships one cc, written into its app.asar as `JSON.parse('{"version":"2.1.309","manifest"…`: a session
// born in the desktop app runs that engine, so a mod must fit it whether or not one is open now
export const APP_ARCHIVE =
    '/Applications/Claude.app/Contents/Resources/app.asar';
export const bundledVersion = (archive: string) =>
    archive.match(
        /JSON\.parse\('\{"version":"(\d+\.\d+\.\d+)","manifest"/,
    )?.[1];

export function bundleOf(path: string): Bundle {
    if (!existsSync(path)) return { error: `no Claude.app archive at ${path}` };
    try {
        const version = bundledVersion(readFileSync(path, 'latin1'));
        return version
            ? { version }
            : { error: `${path} names no bundled cc version` };
    } catch (err) {
        return { error: `${path} could not be read: ${String(err)}` };
    }
}

// the oldest checked engine that knows every event a mod hooks
export const floorOf = (
    events: Set<string>,
    engines: Record<string, Set<string> | undefined>,
) =>
    Object.keys(engines)
        .filter((v) => [...events].every((e) => engines[v]?.has(e)))
        .sort(byVersion)[0];

export function verdict(
    hooked: Record<string, Set<string>>,
    engines: Record<string, Set<string> | undefined>,
    bundle?: Bundle,
) {
    const lines: string[] = [];
    let isRed = false;
    const versions = Object.keys(engines).sort(byVersion);
    const checked = versions.filter((v) => engines[v]);
    if (bundle && 'error' in bundle) {
        isRed = true;
        lines.push(`mods:skew: ${bundle.error}, the desktop cc is unnamed`);
    } else if (bundle) {
        lines.push(`mods:skew: the desktop app bundles cc ${bundle.version}`);
        if (engines[bundle.version]) {
            const floors = Object.values(hooked)
                .map((events) => floorOf(events, engines))
                .filter((f): f is string => !!f)
                .sort(byVersion);
            const top = floors.at(-1);
            if (top) lines.push(`mods:skew: the mods need cc ${top} or newer`);
            for (const [mod, events] of Object.entries(hooked)) {
                const floor = floorOf(events, engines);
                if (floor && byVersion(floor, bundle.version) > 0) {
                    isRed = true;
                    lines.push(
                        `mods:skew: ${mod} needs cc ${floor} or newer, the desktop app bundles ${bundle.version}`,
                    );
                }
            }
        } else {
            isRed = true;
            lines.push(
                `mods:skew: the desktop cc ${bundle.version} has no types on disk, unchecked: open a session on it once`,
            );
        }
    }
    for (const v of checked)
        for (const [mod, events] of Object.entries(hooked)) {
            const unknown = [...events].filter((e) => !engines[v]?.has(e));
            if (unknown.length) {
                isRed = true;
                lines.push(
                    `mods:skew: ${mod} hooks ${unknown.join(', ')}, unknown to ${v}: a session on ${v} refuses the whole mod`,
                );
            }
        }
    const unchecked = versions.filter((v) => !engines[v]);
    const tail = unchecked.length
        ? ` — unchecked, no types on disk: ${unchecked.join(', ')}`
        : '';
    if (!checked.length) isRed = true;
    lines.push(
        isRed
            ? `mods:skew: red${checked.length ? '' : ', no live engine checked'}${tail}`
            : `mods:skew: ${Object.keys(hooked).length} mods fit ${checked.join(', ')}${tail}`,
    );
    return { isRed, lines };
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const home = homedir();
    const cache = join(
        process.env.X_STATE || join(home, '.local/state/x'),
        'mods-events',
    );
    mkdirSync(cache, { recursive: true });
    const tmp = join(
        '/private/tmp',
        `claude-${process.getuid?.()}`,
        'bundled-skills',
    );
    // the engine writes types beside the live mods; the commit hook runs this from a copy that holds none
    const liveMods = join(home, 'frame/home/.claude/plugin-x/mods');
    const typeFiles = [
        ...[root, liveMods].flatMap((dir) =>
            existsSync(dir)
                ? readdirSync(dir).map((m) =>
                      join(
                          dir,
                          m,
                          '.claude-plugin/types/claude-code/index.d.ts',
                      ),
                  )
                : [],
        ),
        ...(existsSync(tmp)
            ? readdirSync(tmp).flatMap((v) =>
                  readdirSync(join(tmp, v)).map((h) =>
                      join(
                          tmp,
                          v,
                          h,
                          'plugin-authoring/types/claude-code.d.ts',
                      ),
                  ),
              )
            : []),
    ].filter((f) => existsSync(f));
    for (const f of typeFiles) {
        const text = readFileSync(f, 'utf8');
        const v = versionOf(text);
        if (v)
            writeFileSync(
                join(cache, `${v}.json`),
                JSON.stringify([...eventsOf(text)].sort()),
            );
    }
    const sessions = join(home, '.claude/sessions');
    const live = new Set(
        readdirSync(sessions)
            .filter((f) => f.endsWith('.json'))
            .map((f) => {
                try {
                    return JSON.parse(readFileSync(join(sessions, f), 'utf8'))
                        .version as string | undefined;
                } catch {
                    return undefined;
                }
            })
            .filter((v): v is string => !!v),
    );
    const engines: Record<string, Set<string> | undefined> = {};
    const bundle = bundleOf(process.env.X_CLAUDE_APP || APP_ARCHIVE);
    if ('version' in bundle) live.add(bundle.version);
    for (const v of live) {
        const f = join(cache, `${v}.json`);
        engines[v] = existsSync(f)
            ? new Set(JSON.parse(readFileSync(f, 'utf8')) as string[])
            : undefined;
    }
    const hooked: Record<string, Set<string>> = {};
    for (const mod of readdirSync(root).sort()) {
        if (!existsSync(join(root, mod, '.claude-plugin/plugin.json')))
            continue;
        const r = spawnSync('claude', ['plugin', 'validate', join(root, mod)], {
            encoding: 'utf8',
        });
        hooked[mod] = hookedEvents(`${r.stdout}${r.stderr}`);
    }
    const { isRed, lines } = verdict(hooked, engines, bundle);
    console.log(lines.join('\n'));
    process.exit(isRed ? 1 : 0);
}

/* Types */

type Bundle = { version: string } | { error: string };
