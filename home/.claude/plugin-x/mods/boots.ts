// the boots table (FRM-678): how many times each mods test file starts the host, counted from the file with no run. a host
// start reloads the whole mod, the cost that roasted the mac, so a file past its row reds at its first commit
// usage: node boots.ts [--raises <base>]   the check, or the rows raised since <base>
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { parseSync } from 'vite';

const TABLE = 'boots.tsv';
const KIT = 'claude-code/testing';
const SHARED = './shared-boot.ts';
// a mod's whole, beside its files
const WHOLE = '*';
// a test file's host starts, or why they cannot be counted
export function countBoots(source: string): Count {
    const { program, errors } = parseSync('a.test.tsx', source, {
        lang: 'tsx',
        preserveParens: false,
    });
    if (errors.length) return { why: `does not parse: ${errors[0]?.message}` };
    const kit = new Set<string>();
    const shared = new Set<string>();
    for (const st of program.body as Node[]) {
        if (st.type !== 'ImportDeclaration') continue;
        const from = st.source.value;
        if (from !== KIT && from !== SHARED) continue;
        for (const s of st.specifiers) {
            if (s.type !== 'ImportSpecifier' && st.importKind !== 'type')
                return { why: `imports ${from} whole` };
            if (s.imported?.name !== 'test') continue;
            (from === KIT ? kit : shared).add(s.local.name);
        }
    }
    let boots = 0;
    let isShared = false;
    let why: string | undefined;
    const visit = (n: unknown, parents: Node[]) => {
        if (Array.isArray(n)) for (const x of n) visit(x, parents);
        else if (n && typeof n === 'object') {
            const node = n as Node;
            const parent = parents.at(-1);
            if (
                node.type === 'Identifier' &&
                kit.has(node.name) &&
                !isName(node, parent)
            ) {
                if (parent?.type !== 'CallExpression' || parent.callee !== node)
                    why ??= `${node.name} is passed on, not called`;
                else if (takesEngine(parent)) {
                    if (!isTopLevel(parents.slice(0, -1)))
                        why ??= `${node.name} with a \`$\` sits in a loop or a function`;
                    boots += 1;
                }
            }
            if (
                node.type === 'CallExpression' &&
                shared.has(node.callee.name) &&
                takesEngine(node)
            )
                isShared = true;
            if (isLateLoad(node, parent)) why ??= `loads ${KIT} late`;
            const under = node.type ? [...parents, node] : parents;
            for (const v of Object.values(node)) visit(v, under);
        }
    };
    visit(program.body, []);
    return why ? { why } : { boots: boots + (isShared ? 1 : 0) };
}
// the kit named anywhere but in an import or export line: a dynamic import
const isLateLoad = (n: Node, parent: Node | undefined) =>
    n.type === 'Literal' &&
    n.value === KIT &&
    !/^(?:Import|Export)\w*Declaration$/.test(parent?.type);
// a declared, imported or property name is no use of the kit's test
const isName = (n: Node, parent: Node | undefined) =>
    parent?.type === 'ImportSpecifier' ||
    (parent?.type === 'MemberExpression' &&
        parent.property === n &&
        !parent.computed) ||
    (parent?.type === 'Property' && parent.key === n && !parent.shorthand);
// a row that takes no `$` starts no host; one whose body is not written in place may take it
function takesEngine(call: Node) {
    const body = call.arguments.at(-1);
    return (
        !/^(?:ArrowFunction|Function)Expression$/.test(body?.type) ||
        body.params.length > 0
    );
}
// a call at the file's top, or in a describe's own body, runs once
function isTopLevel(parents: Node[]) {
    return parents.every((n, i) => {
        if (
            /^(?:ExpressionStatement|CallExpression|BlockStatement)$/.test(
                n.type,
            )
        )
            return n.type !== 'CallExpression' || n.callee.name === 'describe';
        return (
            /^(?:ArrowFunction|Function)Expression$/.test(n.type) &&
            parents[i - 1]?.callee?.name === 'describe'
        );
    });
}

// a helper may hand on what starts no host; anything else of the kit in one would start hosts the table never sees
const HARMLESS = new Set(['Engine', 'expect', 'mock']);

export function helperStartsHosts(source: string) {
    const { program } = parseSync('a.ts', source, { lang: 'tsx' });
    const hasLateLoad = (n: unknown, parent?: Node): boolean =>
        Array.isArray(n)
            ? n.some((x) => hasLateLoad(x, parent))
            : !!n &&
              typeof n === 'object' &&
              (isLateLoad(n as Node, parent) ||
                  Object.values(n).some((v) => hasLateLoad(v, n as Node)));
    if (hasLateLoad(program.body)) return true;
    return (program.body as Node[]).some((st) => {
        if (st.source?.value !== KIT || st.importKind === 'type') return false;
        return (
            st.type === 'ExportAllDeclaration' ||
            !st.specifiers.length ||
            st.specifiers.some(
                (s: Node) =>
                    !HARMLESS.has(s.imported?.name ?? s.local?.name) ||
                    s.type === 'ImportNamespaceSpecifier',
            )
        );
    });
}

// every test file's count, and each helper that starts a host of its own; the kit runs a test file anywhere in a mod
export function countMods(root: string) {
    const counts: Row[] = [];
    const red: string[] = [];
    for (const mod of readdirSync(root).filter((n) => n.startsWith('x-mod-'))) {
        const files = readdirSync(join(root, mod), { recursive: true })
            .map(String)
            .filter(
                (f) =>
                    /\.tsx?$/.test(f) && !/(?:^|\/)(?:node_modules|\.)/.test(f),
            )
            .sort();
        for (const file of files) {
            const source = readFileSync(join(root, mod, file), 'utf8');
            const path = `${mod}/${file}`;
            if (!/\.test\.tsx?$/.test(file)) {
                if (
                    path !== `${mod}/tests/${basename(SHARED)}` &&
                    source.includes(KIT) &&
                    helperStartsHosts(source)
                )
                    red.push(
                        `${path}: a helper starts no host, import test from ${SHARED} in the test file`,
                    );
                continue;
            }
            const count = countBoots(source);
            if (count.why !== undefined)
                red.push(`${path}: ${count.why}; import test from ${SHARED}`);
            else counts.push({ boots: count.boots, file, mod });
        }
    }
    return { counts, red };
}

export function readTable(text: string): Row[] {
    return text
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
            const [mod = '', file = '', boots, tick] = l.split('\t');
            return { boots: Number(boots), file, mod, tick };
        });
}

const nameOf = (r: Row) => (r.file === WHOLE ? r.mod : `${r.mod}/${r.file}`);
const keyOf = (r: Row) => `${r.mod} ${r.file}`;

const wholesOf = (counts: Row[]): Row[] =>
    [...new Set(counts.map((c) => c.mod))].map((mod) => ({
        boots: counts
            .filter((c) => c.mod === mod)
            .reduce((sum, c) => sum + c.boots, 0),
        file: WHOLE,
        mod,
    }));

// the files and mods past their row, and each with no row
export function pastTheTable(counts: Row[], table: Row[]) {
    const rows = new Map(table.map((r) => [keyOf(r), r]));
    const wholes = wholesOf(counts);
    const known = new Set([...counts, ...wholes].map(keyOf));
    return [
        ...[...counts, ...wholes].flatMap((c) => {
            const row = rows.get(keyOf(c));
            if (!row)
                return [
                    `${nameOf(c)}: ${c.boots} host starts and no row in ${TABLE}`,
                ];
            return c.boots > row.boots
                ? [
                      `${nameOf(c)}: ${c.boots} host starts, its row says ${row.boots}`,
                  ]
                : [];
        }),
        ...table
            .filter((r) => !known.has(keyOf(r)))
            .map((r) => `${nameOf(r)}: a row for a file that is gone`),
    ];
}

// the rows that went up, a new file's past its one shared start included
export function raised(table: Row[], base: Row[]) {
    const was = new Map(base.map((r) => [keyOf(r), r.boots]));
    return table.flatMap((r) => {
        const from = was.get(keyOf(r)) ?? (r.file === WHOLE ? 0 : 1);
        return r.boots > from ? [{ ...r, from }] : [];
    });
}

// a raise stands on a tick dima logged: accepted, naming the file or mod and the new number
export function unticked(raises: (Row & { from: number })[], ticks: Tick[]) {
    return raises
        .filter(
            (r) =>
                !ticks.some(
                    (t) =>
                        t.verdict === 'tick' &&
                        String(t.at) === r.tick &&
                        new RegExp(
                            `(?<![\\w/-])${escaped(nameOf(r))}(?![\\w/-])`,
                        ).test(saidIn(t)) &&
                        new RegExp(`(?<![\\w.])${r.boots}(?![\\w.])`).test(
                            saidIn(t),
                        ),
                ),
        )
        .map(
            (r) =>
                `${nameOf(r)}: raised ${r.from} → ${r.boots} with no tick of dima's naming it and ${r.boots} in the orbit tick log (its row says ${r.tick || 'none'})`,
        );
}
const saidIn = (t: Tick) => `${t.text ?? ''} ${t.pick ?? ''}`;
const escaped = (s: string) =>
    s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// each session logs to a file of its own, where an ask's id is its own
export function readTicks(dir: string): Tick[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .flatMap((f) => {
            const ticks = readFileSync(join(dir, f), 'utf8')
                .split('\n')
                .flatMap((l) => {
                    try {
                        return l ? [JSON.parse(l) as Tick] : [];
                    } catch {
                        return [];
                    }
                });
            // a tick he took back is none
            return ticks.filter(
                (t, i) =>
                    !ticks.some(
                        (later, j) =>
                            j > i &&
                            later.id === t.id &&
                            later.text === t.text &&
                            later.verdict !== 'tick',
                    ),
            );
        });
}

// the table as a commit holds it; empty only before its first commit
function tableAt(root: string, ref: string) {
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    if (!git('log', '-1', '--format=%h', ref, '--', TABLE).trim())
        return undefined;
    return readTable(git('show', `${ref}:./${TABLE}`));
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const at = process.argv.indexOf('--raises');
    if (at > 0) {
        const base = tableAt(root, process.argv[at + 1] ?? 'origin/main');
        const head = tableAt(root, 'HEAD') ?? [];
        for (const r of base ? raised(head, base) : [])
            console.log(
                `⚠️ boots raised: ${nameOf(r)} ${r.from} → ${r.boots}, on tick ${r.tick}`,
            );
        process.exit(0);
    }
    const table = readTable(readFileSync(join(root, TABLE), 'utf8'));
    const { counts, red } = countMods(root);
    const base = tableAt(root, 'HEAD');
    const ticks = readTicks(join(homedir(), '.claude/shelf/orbit-ticks'));
    const found = [
        ...red,
        ...pastTheTable(counts, table),
        ...(base ? unticked(raised(table, base), ticks) : []),
    ];
    for (const line of found) console.error(`boots: ${line}`);
    process.exit(found.length ? 1 : 0);
}

/* Types */
// biome-ignore lint/suspicious/noExplicitAny: a parsed node's fields depend on its type
type Node = any;
type Count =
    | { boots: number; why?: undefined }
    | { boots?: undefined; why: string };
type Row = { boots: number; file: string; mod: string; tick?: string };
type Tick = {
    at: number;
    id?: string;
    pick?: string;
    text?: string;
    verdict?: string;
};
