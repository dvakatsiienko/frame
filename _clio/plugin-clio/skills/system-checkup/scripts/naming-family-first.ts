// checkup naming-family-first: a name whose last word heads a family in its list while its own head has none, so the
// shared word went last and the family scatters (root CLAUDE.md § naming). prints `<kind> · <name>` per breach, exit 1 on any
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';

export function breaches(names: Name[]): string[] {
    return Object.values(Object.groupBy(names, (n) => n.kind)).flatMap(
        (list = []) => {
            const heads = Object.groupBy(list, (n) => headOf(n));
            const isFamily = (word: string) => (heads[word]?.length ?? 0) > 1;
            return list
                .filter((n) => {
                    const last = n.name.split(/[-:]/).at(-1) ?? '';
                    const head = headOf(n);
                    return last !== head && isFamily(last) && !isFamily(head);
                })
                .map(({ kind, name }) => `${kind} · ${name}`);
        },
    );
}

function headOf({ name, separator }: Name) {
    return name.split(separator)[0]?.split('-')[0] ?? '';
}

function main() {
    const home = homedir();
    const frame = join(home, 'frame');
    const names: Name[] = [
        ...dirs(join(frame, 'home/.claude/plugin-x/skills')).map(
            skill('skill x'),
        ),
        ...dirs(join(frame, '_clio/plugin-clio/skills')).map(
            skill('skill clio'),
        ),
        ...dirs(join(frame, 'recipes')).map(skill('recipe')),
        ...entries(join(frame, 'script')).map(file('script')),
        ...entries(join(frame, '_clio/script')).map(file('clio script')),
        ...entries(join(frame, 'home/.claude/shelf/hooks')).map(file('hook')),
        ...entries(join(frame, '_clio/.claude/hooks')).map(file('clio hook')),
        ...scriptKeys(join(frame, 'package.json'), 'frame script'),
        ...scriptKeys(
            join(home, 'projects/bytes/package.json'),
            'bytes script',
        ),
    ];
    const found = breaches(names);
    for (const line of found) console.log(line);
    console.log(
        `naming-family-first: ${names.length} names, ${found.length} scatter a family`,
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
