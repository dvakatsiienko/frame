// checkup naming-entity-first: names that lead with a verb where the entity should lead (root CLAUDE.md
// § naming, FRM-219). prints `<kind> · <name>` per breach, exit 1 on any; the allow lists are dima's calls.
// the verb families shape-* and author-* stay on purpose (FRM-219, o105): neither verb is in the list
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';

const verbs = new Set([
    'add',
    'apply',
    'build',
    'check',
    'clean',
    'create',
    'delete',

    'draw',
    'fetch',
    'find',
    'fold',
    'gather',
    'get',
    'ingest',
    'install',
    'list',
    'make',
    'move',
    'open',
    'prune',
    'publish',
    'read',
    'remove',
    'rename',
    'render',
    'run',
    'scan',
    'seed',
    'send',
    'set',
    'show',
    'start',
    'stop',
    'sync',
    'update',
    'verify',

    'write',
]);

// package.json loop and service verbs take `:` variants by convention (x:guide-conventions package-json.md)
const scriptFamilyAllow = new Set([
    'build',
    'check',
    'dev',
    'format',
    'lint',
    'preview',
    'serve',
    'start',
    'test',
    'typecheck',
]);
// singles that never grow siblings (FRM-219 pass 1, the SINGLE-OK list)
const singleAllow = new Set([
    'bulk-replace',
    'remind',
    'seed',
    'step-by-step',
    'watch-once',
]);

export function isVerbFirst(name: string, separator: '-' | ':'): boolean {
    const head = name.split(separator)[0] ?? '';
    if (singleAllow.has(name)) return false;
    if (separator === ':' && scriptFamilyAllow.has(head)) return false;
    return verbs.has(head);
}

export function breaches(names: Name[]): string[] {
    return names
        .filter(({ name, separator }) => isVerbFirst(name, separator))
        .map(({ kind, name }) => `${kind} · ${name}`);
}

function main() {
    const home = homedir();
    const frame = join(home, 'frame');
    const names: Name[] = [
        ...dirs(join(frame, 'home/.claude/plugin-x/skills')).map(
            skill('skill x'),
        ),
        ...dirs(join(frame, '_clio/plugin-clio/skills')).map(
            skill('skill cclio'),
        ),
        ...dirs(join(frame, 'recipes')).map(skill('recipe')),
        ...entries(join(frame, 'script')).map(file('script')),
        ...entries(join(frame, '_clio/script')).map(file('cclio script')),
        ...entries(join(frame, 'home/.claude/shelf/hooks')).map(file('hook')),
        ...entries(join(frame, '_clio/.claude/hooks')).map(file('cclio hook')),
        ...scriptKeys(join(frame, 'package.json'), 'frame script'),
        ...scriptKeys(
            join(home, 'projects/bytes/package.json'),
            'bytes script',
        ),
    ];
    const found = breaches(names);
    for (const line of found) console.log(line);
    console.log(
        `naming-entity-first: ${names.length} names, ${found.length} lead with a verb`,
    );
    process.exit(found.length ? 1 : 0);
}

function dirs(path: string) {
    return readdirSync(path).filter(
        (entry) =>
            !entry.startsWith('.') && statSync(join(path, entry)).isDirectory(),
    );
}

function entries(path: string) {
    return readdirSync(path).filter(
        (entry) =>
            !entry.startsWith('.') &&
            statSync(join(path, entry)).isFile() &&
            !entry.includes('.test.'),
    );
}

function skill(kind: string) {
    return (name: string): Name => ({ kind, name, separator: '-' });
}

function file(kind: string) {
    return (entry: string): Name => ({
        kind,
        name: basename(entry, extname(entry)),
        separator: '-',
    });
}

function scriptKeys(path: string, kind: string): Name[] {
    const scripts = JSON.parse(readFileSync(path, 'utf8')).scripts ?? {};
    return Object.keys(scripts).map((name) => ({ kind, name, separator: ':' }));
}

if (import.meta.main) main();

/* Types */

export interface Name {
    kind: string;
    name: string;
    separator: '-' | ':';
}
