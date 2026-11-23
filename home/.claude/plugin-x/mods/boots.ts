// the boots table (FRM-678): how many times each mods test file starts the host, counted from the file with no run. a host
// start reloads the whole mod, the cost that roasted the mac, so a file past its row reds at its first commit
// the cpu caps beside it (script/test-cpu-budget.tsv) rise by the same door: a raised row with no tick of dima's reds
// usage: node boots.ts [--raises]   the check, or the rows a push raises, its lines on stdin
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseSync } from 'vite';

const TABLE = 'boots.tsv';
const CAPS = 'test-cpu-budget.tsv';
const KIT = 'claude-code/testing';
const SHARED = 'tests/shared-boot.ts';
// a mod's whole, beside its files
const WHOLE = '*';
// what a file may take of the kit or the helper; `test` only a test file may, since it starts the host
const HARMLESS = ['Engine', 'expect', 'mock'];
// the mod of the pin's row: the hash of the helper's imports, exports and `test`, the one place a host starts for a whole file.
// a change to them is a change of cost, so the pin moves as a row rises, on dima's tick
const EVERY = '*';

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
        else if (!isCounted(parent, isKit))
            odd ??= `${node.name} takes its \`$\` where it cannot be counted`;
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
export function refusedHelper(
    source: string,
    file = 'tests/a.ts',
    pin: string | undefined = undefined,
) {
    const read = readSource(source, file);
    if (read.why) return read.why;
    if (file !== SHARED) return refusedImport(read.body, file, HARMLESS);
    const now = pinOf(read.body, source);
    return now === pin
        ? undefined
        : `its imports, exports or test read ${now}, the pin in ${TABLE} says ${pin ?? 'none'}; ${raiseDoor(pinPick(now))}`;
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

// the helper boots once for the rows whose body shows its `$` as a first parameter; any other body it hands to the kit, which
// boots for each. a body written elsewhere is one start of the kit's own
function isCounted(call: Node, isKit: boolean) {
    const body = call.arguments.at(-1);
    if (!/^(?:ArrowFunction|Function)Expression$/.test(body?.type))
        return isKit;
    return /^(?:Identifier|ObjectPattern)$/.test(body.params[0]?.type);
}

// every test file's count, and each file that could start a host the table never sees; the kit runs a test file anywhere in a mod
export function countMods(root: string, pin?: string) {
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
            const why = refusedHelper(source, file, pin);
            if (why) red.push(`${mod}/${file}: ${why}`);
        }
    }
    return { counts, red };
}

export function readTable(text: string): Row[] {
    return text
        .split('\n')
        .filter((l) => l && !l.startsWith('#') && !isPin(l))
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

const isPin = (line: string) => line.startsWith(`${EVERY}\t`);

// the helper's pin; two of them are none
export function readPin(text: string): Pin {
    const [line, ...more] = text.split('\n').filter(isPin);
    const [, file, hash, tick] = line?.split('\t') ?? [];
    return file === SHARED && !more.length ? { hash, tick } : {};
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

// the one pick a tick raises a row or moves the pin by; he accepts it as it stands, with no steer beside it
const raisePick = (r: Row) => `raise ${nameOf(r)} to ${r.boots}`;
const pinPick = (hash: string) => `change the mods shared boot to ${hash}`;
const isTicked = (pick: string, at: string | undefined, ticks: Tick[]) =>
    ticks.some(
        (t) =>
            t.verdict === 'tick' &&
            String(t.at) === at &&
            t.pick?.trim() === pick &&
            !t.steer,
    );
const raiseDoor = (pick: string) =>
    `it is an orbit ask whose pick is «${pick}», ticked in herdr's orbit, and committed with that line's \`at\` from ~/.claude/shelf/orbit-ticks in its row before his next press in that thread, which drops the line`;

export function unticked(raises: (Row & { from: number })[], ticks: Tick[]) {
    return raises
        .filter((r) => !isTicked(raisePick(r), r.tick, ticks))
        .map(
            (r) =>
                `${nameOf(r)}: raised ${r.from} → ${r.boots} with no tick of dima's (its row says ${r.tick || 'none'}). ${raiseDoor(raisePick(r))}`,
        );
}

// a suite's cpu cap, and the `at` of the tick its last raise stands on, the row's fifth column
export function readCaps(text: string): Cap[] {
    return text
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
            const [suite = '', cpu = '', , , tick] = l.split('\t');
            return { cpu, suite, tick };
        });
}

// the caps that went up, a new suite's and one that reads as no number included
export function capsRaised(caps: Cap[], base: Cap[]) {
    const was = new Map(base.map((c) => [c.suite, c.cpu]));
    return caps.flatMap((c) => {
        const from = was.get(c.suite) ?? '0';
        return c.cpu === from || Number(c.cpu) <= Number(from)
            ? []
            : [{ ...c, from }];
    });
}

const capPick = (c: Cap) => `raise the ${c.suite} cpu cap to ${c.cpu}`;

export function untickedCaps(
    raises: (Cap & { from: string })[],
    ticks: Tick[],
) {
    return raises
        .filter((c) => !isTicked(capPick(c), c.tick, ticks))
        .map(
            (c) =>
                `${CAPS}: ${c.suite} raised ${c.from} → ${c.cpu} cpu-s with no tick of dima's (its row says ${c.tick || 'none'}). ${raiseDoor(capPick(c))}`,
        );
}

// a pin moved with no tick; a table with none yet takes its first
export function unpinned(pin: Pin, base: Pin, ticks: Tick[]) {
    if (!base.hash || pin.hash === base.hash) return [];
    const pick = pinPick(pin.hash ?? 'none');
    return isTicked(pick, pin.tick, ticks)
        ? []
        : [
              `${SHARED}: its pin moved ${base.hash} → ${pin.hash ?? 'none'} with no tick of dima's. ${raiseDoor(pick)}`,
          ];
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
function tableAt(root: string, ref: string, table = TABLE) {
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    if (!git('log', '-1', '--format=%h', ref, '--', table).trim())
        return undefined;
    return git('show', `${ref}:./${table}`);
}

// the table a push replaces; a new branch, or a remote commit this clone never fetched, reads against origin/main
function baseTable(root: string, remote: string, table = TABLE) {
    try {
        return tableAt(
            root,
            /[1-9a-f]/.test(remote) ? remote : 'origin/main',
            table,
        );
    } catch {
        return tableAt(root, 'origin/main', table);
    }
}

if (import.meta.main) {
    const root = import.meta.dirname;
    const script = join(root, '../../../../script');
    if (process.argv.includes('--raises')) {
        // git's pre-push lines: a worktree's push runs from the main checkout, so HEAD there is the wrong commit
        const pushed = process.stdin.isTTY ? '' : readFileSync(0, 'utf8');
        for (const line of pushed.split('\n')) {
            const [, head = '', , remote = ''] = line.split(' ');
            if (!/[1-9a-f]/.test(head)) continue;
            const caps = tableAt(script, head, CAPS);
            const capsBase = baseTable(script, remote, CAPS);
            if (caps && capsBase)
                for (const c of capsRaised(readCaps(caps), readCaps(capsBase)))
                    console.log(
                        `⚠️ cpu cap raised: ${c.suite} ${c.from} → ${c.cpu} cpu-s, on tick ${c.tick}`,
                    );
            const base = baseTable(root, remote);
            const now = tableAt(root, head);
            if (!base || !now) continue;
            for (const r of raised(readTable(now), readTable(base)))
                console.log(
                    `⚠️ boots raised: ${nameOf(r)} ${r.from} → ${r.boots}, on tick ${r.tick}`,
                );
            const [pin, was] = [readPin(now), readPin(base)];
            if (was.hash && pin.hash !== was.hash)
                console.log(
                    `⚠️ the mods shared boot changed: ${was.hash} → ${pin.hash}, on tick ${pin.tick}`,
                );
        }
        process.exit(0);
    }
    const text = readFileSync(join(root, TABLE), 'utf8');
    const table = readTable(text);
    const pin = readPin(text);
    const { counts, red } = countMods(root, pin.hash);
    const base = tableAt(root, 'HEAD');
    const ticks = readTicks(join(homedir(), '.claude/shelf/orbit-ticks'));
    const capsBase = tableAt(script, 'HEAD', CAPS);
    const found = [
        ...(capsBase
            ? untickedCaps(
                  capsRaised(
                      readCaps(readFileSync(join(script, CAPS), 'utf8')),
                      readCaps(capsBase),
                  ),
                  ticks,
              )
            : []),
        ...red,
        ...pastTheTable(counts, table),
        ...(base
            ? [
                  ...unticked(raised(table, readTable(base)), ticks),
                  ...unpinned(pin, readPin(base), ticks),
              ]
            : []),
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
type Cap = { cpu: string; suite: string; tick?: string };
type Pin = { hash?: string; tick?: string };
type Row = { boots: number; file: string; mod: string; tick?: string };
type Tick = {
    at: number;
    id?: string;
    pick?: string;
    steer?: string | null;
    text?: string;
    verdict?: string;
};
