// checkup naming-family-first: a family's shared word gone last (root CLAUDE.md § naming): a name whose last word heads a
// family while its own head has none, or 3+ `-` names sharing a last word over lone heads. prints `<kind> · <name>`, exit 1 on any
// a `:` list is exempt from the second: its tail is a member, `speak:build`, and two names are no family yet
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';

const TAIL_FAMILY = 3;

export function breaches(names: Name[]): string[] {
    return Object.values(Object.groupBy(names, (n) => n.kind)).flatMap(
        (list = []) => {
            const heads = Object.groupBy(list, headOf);
            const isFamily = (word: string) => (heads[word]?.length ?? 0) > 1;
            const lone = list.filter(
                (n) => !isFamily(headOf(n)) && lastOf(n) !== headOf(n),
            );
            const tails = Object.groupBy(
                lone.filter((n) => n.separator === '-'),
                lastOf,
            );
            return lone
                .filter(
                    (n) =>
                        isFamily(lastOf(n)) ||
                        (tails[lastOf(n)]?.length ?? 0) >= TAIL_FAMILY,
                )
                .map(({ kind, name }) => `${kind} · ${name}`);
        },
    );
}

function headOf({ name, separator }: Name) {
    return (
        (separator === ':' ? name.split(':')[0] : name.split(/[-_ ]/)[0]) ?? ''
    );
}

function lastOf({ name }: Name) {
    return name.split(/[-:]/).at(-1) ?? '';
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
        ...entries(join(frame, '_clio/script')).map(file('clio script')),
        ...entries(join(frame, 'home/.claude/shelf/hooks')).map(file('hook')),
        ...entries(join(frame, '_clio/.claude/hooks')).map(file('clio hook')),
        ...scriptKeys(join(frame, 'package.json'), 'frame script'),
        ...scriptKeys(
            join(home, 'projects/bytes/package.json'),
            'bytes script',
        ),
        ...verbNames(join(frame, 'x/go/registry.json')),
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

// each x family is its own list: `lane merge-main` sorts among lane's verbs
function verbNames(path: string): Name[] {
    return [
        ...readFileSync(path, 'utf8').matchAll(/"name": "([a-z]+) ([a-z-]+)"/g),
    ].map(([, family, name]) => ({
        kind: `x ${family}`,
        name: name ?? '',
        separator: '-',
    }));
}

if (import.meta.main) main();

/* Types */

export interface Name {
    kind: string;
    name: string;
    separator: '-' | ':';
}
