// the boots table (FRM-678): how many times each mods test file starts the host, counted from the file with no run. a host
// start reloads the whole mod, the cost that roasted the mac, so a file past its row reds at its first commit
// usage: node boots.ts [--raises]   the check, or the rows a push raises, its lines on stdin
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseSync } from 'vite';

const TABLE = 'boots.tsv';
const KIT = 'claude-code/testing';
const SHARED = 'tests/shared-boot.ts';
// a mod's whole, beside its files
const WHOLE = '*';
// what a file may take of the kit or the helper; `test` only a test file may, since it starts the host
const HARMLESS = ['Engine', 'expect', 'mock'];
// the helper's imports, exports and `test`: the one place a host starts for a whole file. a change to them is a change of cost,
// so it lands with this line
const SHARED_PIN = '8c55ebe4d62b';

// a test file's host starts, or why they cannot be counted; what is not on the list is refused, never counted as none
export function countBoots(source: string, file = 'tests/a.test.ts'): Count {
    const read = readSource(source, file);
    const why =
        read.why ?? refusedImport(read.body, file, [...HARMLESS, 'test']);
    if (why) return { why };
    const kit = new Set<string>();
    const shared = new Set<string>();
    for (const { from, specifiers } of importsOf(read.body))
        for (const s of specifiers)
            if (s.imported?.name === 'test')
                (from === KIT ? kit : shared).add(s.local.name);
    let boots = 0;
    let isShared = false;
    let odd: string | undefined;
    visit(read.body, (node, parents) => {
        const parent = parents.at(-1);
        if (node.type !== 'Identifier' || isName(node, parent)) return;
        const isKit = kit.has(node.name);
        if (!isKit && !shared.has(node.name)) return;
        if (parent?.type !== 'CallExpression' || parent.callee !== node)
            odd ??= `${node.name} is passed on, not called`;
        else if (!takesEngine(parent)) return;
        else if (!isKit) isShared = true;
        else {
            if (
                !parents
                    .slice(0, -1)
                    .every((n) => n.type === 'ExpressionStatement')
            )
                odd ??= `${node.name} with a \`$\` sits in a loop or a function`;
            boots += 1;
        }
    });
    return odd ? { why: odd } : { boots: boots + (isShared ? 1 : 0) };
}

// why a file beside the test files could start a host the table never sees
export function refusedHelper(source: string, file = 'tests/a.ts') {
    const read = readSource(source, file);
    if (read.why) return read.why;
    if (file === SHARED)
        return pinOf(read.body, source) === SHARED_PIN
            ? undefined
            : `its imports, exports or test changed: ${pinOf(read.body, source)}, the pin in boots.ts says ${SHARED_PIN}`;
    return refusedImport(read.body, file, HARMLESS);
}

function readSource(
    source: string,
    file: string,
): { body: Node[]; why?: string } {
    const { program, errors } = parseSync('a', source, {
        lang: file.endsWith('x') ? 'tsx' : 'ts',
        preserveParens: false,
    });
    const body = program.body as Node[];
    if (errors.length)
        return { body, why: `does not parse: ${errors[0]?.message}` };
    let why: string | undefined;
    visit(body, (n, parents) => {
        if (n.type === 'ImportExpression') why ??= 'loads a module late';
        if (
            n.type === 'Identifier' &&
            /^(?:require|createRequire)$/.test(n.name) &&
            !isName(n, parents.at(-1))
        )
            why ??= `names ${n.name}`;
    });
    return { body, why };
}

const importsOf = (
    body: Node[],
): { from: string; specifiers: Node[]; st: Node }[] =>
    body.flatMap((st) =>
        st.source
            ? [{ from: st.source.value, specifiers: st.specifiers ?? [], st }]
            : [],
    );

function refusedImport(body: Node[], file: string, allowed: string[]) {
    for (const { from, specifiers, st } of importsOf(body)) {
        if (/\.test\.tsx?$/.test(from)) return `imports the test file ${from}`;
        const isHelper = basename(from).startsWith('shared-boot');
        if (from !== KIT && !isHelper) continue;
        if (isHelper && join(dirname(file), from) !== SHARED)
            return `imports ${from}, which is not ${SHARED}`;
        if (st.type !== 'ImportDeclaration') return `hands ${from} on`;
        for (const s of specifiers)
            if (
                s.type !== 'ImportSpecifier' ||
                !allowed.includes(s.imported.name)
            )
                return `takes ${s.imported?.name ?? 'the whole'} of ${from}`;
    }
    return undefined;
}

// the source of every import and export line and of `test`, hashed; a host start anywhere else in the helper reads as none
function pinOf(body: Node[], source: string) {
    const isPinned = (st: Node) => /^(?:Import|Export)/.test(st.type);
    const hosts = new Set(
        importsOf(body).flatMap(({ from, specifiers }) =>
            from === KIT
                ? specifiers
                      .filter((s) => s.imported?.name === 'test')
                      .map((s) => s.local.name)
                : [],
        ),
    );
    let isLoose = false;
    visit(
        body.filter((st) => !isPinned(st)),
        (n) => {
            if (n.type === 'Identifier' && hosts.has(n.name)) isLoose = true;
        },
    );
    if (isLoose) return 'a host start outside test';
    const text = body
        .filter(isPinned)
        .map((st) => source.slice(st.start, st.end))
        .join('\n');
    return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function visit(
    n: unknown,
    at: (node: Node, parents: Node[]) => void,
    parents: Node[] = [],
) {
    if (Array.isArray(n)) for (const x of n) visit(x, at, parents);
    else if (n && typeof n === 'object') {
        const node = n as Node;
        if (node.type) at(node, parents);
        const under = node.type ? [...parents, node] : parents;
        for (const v of Object.values(node)) visit(v, at, under);
    }
}
// a declared, imported or property name is no use of the kit's test
const isName = (n: Node, parent: Node | undefined) =>
    parent?.type === 'ImportSpecifier' ||
    (parent?.type === 'MemberExpression' &&
        parent.property === n &&
        !parent.computed) ||
    (parent?.type === 'Property' && parent.key === n && !parent.shorthand);
// a row that takes no `$` starts no host; only an arrow written in place shows it, since a function reads `arguments`
function takesEngine(call: Node) {
    const body = call.arguments.at(-1);
    return body?.type !== 'ArrowFunctionExpression' || body.params.length > 0;
}

// every test file's count, and each file that could start a host the table never sees; the kit runs a test file anywhere in a mod
export function countMods(root: string) {
    const counts: Row[] = [];
    const red: string[] = [];
    const mods = readdirSync(root).filter((n) =>
        existsSync(join(root, n, '.claude-plugin')),
    );
    for (const mod of mods) {
        const files = readdirSync(join(root, mod), { recursive: true })
            .map(String)
            .filter(
                (f) =>
                    /\.[cm]?[jt]sx?$/.test(f) &&
                    !/(?:^|\/)node_modules\/|^\.claude-plugin\//.test(f),
            )
            .sort();
        for (const file of files) {
            const source = readFileSync(join(root, mod, file), 'utf8');
            if (/\.test\.tsx?$/.test(file)) {
                const { boots, why } = countBoots(source, file);
                if (why !== undefined)
                    red.push(
                        `${mod}/${file}: ${why}; import test from the mod's ${SHARED}`,
                    );
                else counts.push({ boots, file, mod });
                continue;
            }
            const why = refusedHelper(source, file);
            if (why) red.push(`${mod}/${file}: ${why}`);
        }
    }
    return { counts, red };
}

export function readTable(text: string): Row[] {
    return text
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
            const [mod = '', file = '', boots = '', tick] = l.split('\t');
            return {
                boots: /^\d+$/.test(boots) ? Number(boots) : Number.NaN,
                file,
                mod,
                tick,
            };
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

// the files and mods past their row, each with no row, and each row that says no one number
export function pastTheTable(counts: Row[], table: Row[]) {
    const rows = new Map(table.map((r) => [keyOf(r), r]));
    const all = [...counts, ...wholesOf(counts)];
    const known = new Set(all.map(keyOf));
    return [
        ...all.flatMap((c) => {
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
        ...table.flatMap((r, i) => {
            if (!known.has(keyOf(r)))
                return [`${nameOf(r)}: a row for a file that is gone`];
            if (Number.isNaN(r.boots))
                return [`${nameOf(r)}: its row holds no whole number`];
            return table.findIndex((x) => keyOf(x) === keyOf(r)) < i
                ? [`${nameOf(r)}: a second row`]
                : [];
        }),
    ];
}

// the rows that went up, a new file's past its one shared start included
export function raised(table: Row[], base: Row[]) {
    const was = new Map(base.map((r) => [keyOf(r), r.boots]));
    return table.flatMap((r) => {
        const from = was.get(keyOf(r)) ?? (r.file === WHOLE ? 0 : 1);
        return r.boots <= from ? [] : [{ ...r, from }];
    });
}

// the one pick a tick raises a row by; he accepts it as it stands, with no steer beside it
const raisePick = (r: Row) => `raise ${nameOf(r)} to ${r.boots}`;

export function unticked(raises: (Row & { from: number })[], ticks: Tick[]) {
    return raises
        .filter(
            (r) =>
                !ticks.some(
                    (t) =>
                        t.verdict === 'tick' &&
                        String(t.at) === r.tick &&
                        t.pick?.trim() === raisePick(r) &&
                        !t.steer,
                ),
        )
        .map(
            (r) =>
                `${nameOf(r)}: raised ${r.from} → ${r.boots} with no tick of dima's (its row says ${r.tick || 'none'}). a raise is an orbit ask whose pick is «${raisePick(r)}», ticked in herdr's orbit, and committed with that line's \`at\` from ~/.claude/shelf/orbit-ticks before his next press in that thread, which drops the line`,
        );
}

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
    if (process.argv.includes('--raises')) {
        // git's pre-push lines: a worktree's push runs from the main checkout, so HEAD there is the wrong commit
        for (const line of readFileSync(0, 'utf8').split('\n')) {
            const [, head = '', , remote = ''] = line.split(' ');
            if (!/[1-9a-f]/.test(head)) continue;
            const base = tableAt(
                root,
                /[1-9a-f]/.test(remote) ? remote : 'origin/main',
            );
            for (const r of base ? raised(tableAt(root, head) ?? [], base) : [])
                console.log(
                    `⚠️ boots raised: ${nameOf(r)} ${r.from} → ${r.boots}, on tick ${r.tick}`,
                );
        }
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
    steer?: string | null;
    text?: string;
    verdict?: string;
};
