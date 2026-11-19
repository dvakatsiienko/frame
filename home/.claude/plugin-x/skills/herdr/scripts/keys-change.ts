import {
    existsSync,
    readFileSync,
    readdirSync,
    renameSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// a keys.json save drops every mod's `cx.bind_keys` until the mod reloads (bit 3 times by 19 Nov: the / picker's
// arrows died), so the one door writes the file and then reloads every x-herdr mod, by touching its main.js

const scopes = ['global', 'terminal'] as const;
type Scope = (typeof scopes)[number];
type Command = string | { command: string; args?: Record<string, unknown> };
type KeysChange = { command: Command | null; key: string; scope: Scope };
type Step = { kind: 'write'; text: string } | { kind: 'reload'; mod: string };

/** null: keys.json was saved elsewhere (settings' Keys page), so only the reloads run */
export function planKeysChange(
    was: string,
    change: KeysChange | null,
    mods: string[],
) {
    const text = change ? changed(was, change) : was;
    const steps: Step[] = [
        ...(change ? [{ kind: 'write', text } as const] : []),
        ...mods
            .filter((mod) => mod.startsWith('x-herdr-'))
            .sort()
            .map((mod): Step => ({ kind: 'reload', mod })),
    ];
    return { steps, text };
}

function changed(was: string, { command, key, scope }: KeysChange) {
    const keys = JSON.parse(was);
    if (command === null && !(key in (keys[scope] ?? {}))) return was;
    const bound = { ...keys[scope] };
    if (command === null) delete bound[key];
    else bound[key] = command;
    return `${JSON.stringify({ ...keys, [scope]: bound }, null, 2)}${was.endsWith('\n') ? '\n' : ''}`;
}

export function parseKeysChangeArgs(
    argv: string[],
): KeysChange | 'reload' | null {
    if (argv.length === 1 && argv[0] === 'reload') return 'reload';
    const [verb, scope, key, command, ...rest] = argv;
    if (rest.length > 0 || !key || !scopes.includes(scope as Scope))
        return null;
    if (verb === 'set' && command) {
        const parsed = commandOf(command);
        return parsed === null
            ? null
            : { command: parsed, key, scope: scope as Scope };
    }
    if (verb === 'remove' && command === undefined)
        return { command: null, key, scope: scope as Scope };
    return null;
}

/** a bare command, or a json object with its `command` and `args`, as herdr's keys.json takes it */
function commandOf(text: string): Command | null {
    if (!text.startsWith('{')) return text;
    try {
        const value = JSON.parse(text);
        return typeof value?.command === 'string' ? value : null;
    } catch {
        return null;
    }
}

if (
    process.argv[1] &&
    pathToFileURL(process.argv[1]).href === import.meta.url
) {
    const change = parseKeysChangeArgs(process.argv.slice(2));
    if (!change) {
        console.error(
            "usage: node keys-change.ts set <global|terminal> <key> <command | '{json}'> | remove <global|terminal> <key> | reload",
        );
        process.exit(2);
    }
    const root = join(homedir(), '.config/herdr-app');
    const file = join(root, 'keys.json');
    const mods = join(root, 'mods');
    const plan = planKeysChange(
        readFileSync(file, 'utf8'),
        change === 'reload' ? null : change,
        readdirSync(mods).filter((mod) =>
            existsSync(join(mods, mod, 'main.js')),
        ),
    );
    const now = new Date();
    for (const step of plan.steps) {
        // herdr reads keys.json live: a rename never shows it half a file
        if (step.kind === 'write') {
            writeFileSync(`${file}.tmp`, step.text);
            renameSync(`${file}.tmp`, file);
        } else utimesSync(join(mods, step.mod, 'main.js'), now, now);
    }
    const reloads = plan.steps.filter((s) => s.kind === 'reload').length;
    console.log(
        `${change === 'reload' ? '' : 'keys.json written; '}reloaded ${reloads} x-herdr mods`,
    );
}
