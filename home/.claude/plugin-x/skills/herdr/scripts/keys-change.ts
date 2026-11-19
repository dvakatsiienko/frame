import { readFileSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// a keys.json save drops every mod's `cx.bind_keys` until the mod reloads (bit 3 times by 19 Nov: the / picker's
// arrows died), so the one door writes the file and then reloads every x-herdr mod, by touching its main.js

const scopes = ['global', 'terminal'] as const;
type Scope = (typeof scopes)[number];
type KeysChange = { command: string | null; key: string; scope: Scope };
type Step = { kind: 'write'; text: string } | { kind: 'reload'; mod: string };

export function planKeysChange(
    was: string,
    { command, key, scope }: KeysChange,
    mods: string[],
) {
    const keys = JSON.parse(was);
    const bound = { ...keys[scope] };
    if (command === null) delete bound[key];
    else bound[key] = command;
    const text = `${JSON.stringify({ ...keys, [scope]: bound }, null, 2)}${was.endsWith('\n') ? '\n' : ''}`;
    const steps: Step[] = [
        { kind: 'write', text },
        ...mods
            .filter((mod) => mod.startsWith('x-herdr-'))
            .sort()
            .map((mod): Step => ({ kind: 'reload', mod })),
    ];
    return { steps, text };
}

export function parseKeysChangeArgs(argv: string[]): KeysChange | null {
    const [verb, scope, key, command, ...rest] = argv;
    if (rest.length > 0 || !key || !scopes.includes(scope as Scope))
        return null;
    if (verb === 'set' && command)
        return { command, key, scope: scope as Scope };
    if (verb === 'remove' && command === undefined)
        return { command: null, key, scope: scope as Scope };
    return null;
}

if (
    process.argv[1] &&
    pathToFileURL(process.argv[1]).href === import.meta.url
) {
    const change = parseKeysChangeArgs(process.argv.slice(2));
    if (!change) {
        console.error(
            'usage: node keys-change.ts set <global|terminal> <key> <command> | remove <global|terminal> <key>',
        );
        process.exit(2);
    }
    const root = join(homedir(), '.config/herdr-app');
    const file = join(root, 'keys.json');
    const plan = planKeysChange(
        readFileSync(file, 'utf8'),
        change,
        readdirSync(join(root, 'mods')),
    );
    const now = new Date();
    for (const step of plan.steps) {
        if (step.kind === 'write') writeFileSync(file, step.text);
        else utimesSync(join(root, 'mods', step.mod, 'main.js'), now, now);
    }
    console.log(
        `keys.json written; reloaded ${plan.steps.length - 1} x-herdr mods`,
    );
}
