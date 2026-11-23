import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseSync } from 'vite';
import { describe, expect, it } from 'vitest';

// the test rows of one file share one host boot (FRM-678), so a module variable kept past a session's quit leaks into the
// next row: each owner gives its own back in an exported `reset…` function, and resetModules calls every one of them.
// an allow-list: a top-level name is fixed by a shape named below, or a reset gives it back, or it reds here
// beside code-size.test.ts, a check over one tree's shape
const HOOKS = join(
    import.meta.dirname,
    '../../home/.claude/plugin-x/mods/x-mod-stash/hooks',
);
// a value no shape below names and no code changes, with why
const FIXED = new Map([
    [
        'orbit-store.ts · EMPTY_ORBIT',
        'every orbit change builds a new object (orbit.ts)',
    ],
    ['pace.ts · PACE_KEYS', 'a list of keys, read alone'],
    ['pace.ts · defaults', 'spread into a new object, never written'],
    ['settings-store.ts · NUMBERS', 'a table of settings, read alone'],
]);
// a name not reset yet; each reset commit deletes its rows, the last empties this
const PENDING: string[] = [];

// the top-level names of each file, the imports, the resets, the writes to a name that is not a variable
function readFile(name: string, source: string): File {
    const { program, errors } = parseSync(name, source, {
        lang: name.endsWith('x') ? 'tsx' : 'ts',
        preserveParens: false,
    });
    if (errors.length) throw new Error(`${name}: ${errors[0]?.message}`);
    const textOf = (n?: Node | null) =>
        n
            ? source
                  .slice(n.start, n.end)
                  .replace(/\s+/g, ' ')
                  .replace(/,(?= [}\]])/g, '')
            : undefined;
    const file: File = {
        functions: new Set(),
        imports: new Map(),
        name,
        others: [],
        program: program as never,
        resets: new Map(),
        textOf,
        values: new Map(),
    };
    for (const outer of file.program.body) {
        const isExported = outer.type === 'ExportNamedDeclaration';
        const st = isExported ? (outer.declaration ?? outer) : outer;
        if (st.type === 'ImportDeclaration')
            for (const s of st.specifiers)
                file.imports.set(s.local.name, {
                    from: basename(String(st.source.value)),
                    name: s.imported?.name ?? '',
                });
        else if (st.type === 'FunctionDeclaration') {
            file.functions.add(st.id.name);
            if (
                isExported &&
                /^reset[A-Z]/.test(st.id.name) &&
                !st.params.length
            )
                file.resets.set(st.id.name, st);
        } else if (st.type === 'VariableDeclaration')
            for (const d of st.declarations)
                file.values.set(textOf(nameNode(d.id)) ?? '', {
                    decl: d,
                    isConst: st.kind === 'const',
                    isExported,
                });
        else if (!isTypeOnly(st, isExported)) file.others.push(st.type);
    }
    return file;
}
// a destructured name keeps its pattern's text: no shape fixes one and no reset gives one back
const nameNode = (id: Node) =>
    id.type === 'Identifier'
        ? { ...id, end: id.start + String(id.name).length }
        : id;
const isTypeOnly = (st: Node, isExported: boolean) =>
    st.type === 'TSTypeAliasDeclaration' ||
    st.type === 'TSInterfaceDeclaration' ||
    (isExported && st.type === 'ExportNamedDeclaration');

// the names whose value a file can never change
function fixedIn(files: File[]) {
    const byName = new Map(files.map((f) => [f.name, f]));
    const isFixed = (f: File, name: string, seen: string[]): boolean => {
        const id = `${f.name} · ${name}`;
        if (FIXED.has(id)) return true;
        if (seen.includes(id)) return false;
        if (f.functions.has(name)) return true;
        const from = f.imports.get(name);
        if (from) {
            const home = byName.get(from.from);
            return !home || isFixed(home, from.name, [...seen, id]);
        }
        const value = f.values.get(name);
        if (!value?.isConst || value.decl.id.type !== 'Identifier')
            return false;
        const { id: target, init } = value.decl;
        const typed = f.textOf(target.typeAnnotation) ?? '';
        const ref = (n: Node) => isFixed(f, String(n.name), [...seen, id]);
        return isFixedInit(f, init, typed, ref);
    };
    return (f: File, name: string) => isFixed(f, name, []);
}
const PRIMITIVES = [
    'BinaryExpression',
    'TemplateLiteral',
    'UnaryExpression',
    'TaggedTemplateExpression',
    'Literal',
];
function isFixedInit(
    f: File,
    init: Node,
    typed: string,
    ref: (n: Node) => boolean,
): boolean {
    if (init.type === 'TSSatisfiesExpression')
        return isFixedInit(f, init.expression, typed, ref);
    if (init.type === 'ArrowFunctionExpression') return true;
    if (isRegex(init)) return !keepsPlace(init) || isReplaceOnly(f, init);
    if (init.type === 'TaggedTemplateExpression')
        return f.textOf(init.tag) === 'String.raw';
    if (PRIMITIVES.includes(init.type)) return true;
    // lines joined into one string
    if (
        init.type === 'CallExpression' &&
        init.callee.type === 'MemberExpression' &&
        init.callee.object.type === 'ArrayExpression' &&
        init.callee.property.name === 'join'
    )
        return true;
    // tsc refuses a plain write to these, at any depth a literal holds; writesIn names the writes it allows
    if (init.type === 'TSAsExpression')
        return (
            f.textOf(init.typeAnnotation) === 'const' &&
            isDeep(f, init.expression, ref)
        );
    if (typed.startsWith(': ReadonlySet<'))
        return (
            init.type === 'NewExpression' &&
            init.callee.name === 'Set' &&
            init.arguments[0]?.type === 'ArrayExpression' &&
            init.arguments[0].elements.every((e: Node) =>
                isDeepPlain(f, e, ref),
            )
        );
    if (/^: (?:Readonly<|readonly )/.test(typed))
        return init.type === 'Identifier' || isFlat(f, init, ref);
    return (
        (init.type === 'MemberExpression' || init.type === 'Identifier') &&
        isConstRooted(init, ref)
    );
}
const isRegex = (n: Node) =>
    (n.type === 'Literal' && Boolean(n.regex)) ||
    (n.type === 'NewExpression' && n.callee.name === 'RegExp');
// its flags, unread when they or its source come from elsewhere
function flagsOf(n: Node): string | undefined {
    if (n.regex) return n.regex.flags;
    const [source, flags] = n.arguments;
    const isText =
        (source?.type === 'Literal' && !source.regex) ||
        /^(?:TemplateLiteral|TaggedTemplateExpression)$/.test(source?.type);
    return isText ? (flags ? flags.value : '') : undefined;
}
// a `g` or `y` regex keeps its place between calls
const keepsPlace = (n: Node) => /[gy]/.test(flagsOf(n) ?? 'y');
// a `g` one is fixed while its file alone names it, each time as the text a match, a replace or a split looks for: those
// start at 0; with `y` and no `g` they go on from where it stood
function isReplaceOnly(f: File, init: Node) {
    const found = [...f.values].find(([, v]) => v.decl.init === init);
    if (!found) return false;
    const [name, { decl, isExported }] = found;
    const uses = new Set<Node>();
    const asked = new Set<Node>();
    walk(f.program, (n) => {
        if (n.type === 'Identifier' && n.name === name && n !== decl.id)
            uses.add(n);
        const isReplace =
            n.type === 'CallExpression' &&
            n.callee.type === 'MemberExpression' &&
            !n.callee.computed &&
            /^(?:match|matchAll|replace|replaceAll|split)$/.test(
                n.callee.property.name,
            );
        if (isReplace) asked.add(n.arguments[0]);
    });
    const isGlobal = flagsOf(init)?.includes('g') ?? false;
    return isGlobal && !isExported && [...uses].every((n) => asked.has(n));
}
function isConstRooted(n: Node, ref: (n: Node) => boolean): boolean {
    if (n.type === 'MemberExpression') return isConstRooted(n.object, ref);
    return n.type === 'Identifier' && ref(n);
}
// a literal all the way down: an object or a list of fixed values
function isDeep(f: File, n: Node, ref: (n: Node) => boolean): boolean {
    if (n.type === 'ObjectExpression')
        return n.properties.every((p: Node) =>
            p.type === 'SpreadElement'
                ? isDeep(f, p.argument, ref)
                : isDeep(f, p.value, ref),
        );
    if (n.type === 'ArrayExpression')
        return n.elements.every(
            (e: Node | null) =>
                e &&
                isDeep(f, e.type === 'SpreadElement' ? e.argument : e, ref),
        );
    if (n.type === 'Identifier' && n.name === 'undefined') return true;
    if (n.type === 'MemberExpression' || n.type === 'Identifier')
        return isConstRooted(n, ref);
    return isFixedInit(f, n, '', ref);
}
const isDeepPlain = (f: File, n: Node | null, ref: (n: Node) => boolean) =>
    n && !/^(?:Object|Array)Expression$/.test(n.type) && isDeep(f, n, ref);
const isFlat = (f: File, n: Node, ref: (n: Node) => boolean) =>
    n.type === 'ObjectExpression' &&
    n.properties.every(
        (p: Node) => p.type === 'Property' && isDeepPlain(f, p.value, ref),
    );

// the variables a reset gives back whole: a plain function of give-backs alone, each name once, each by the one statement
// its declaration allows
function givenBackBy(f: File, reset: Node) {
    const given = new Set<string>();
    if (reset.async || reset.generator) return given;
    for (const st of reset.body.body) {
        if (st.type !== 'ExpressionStatement') return new Set<string>();
        const x = st.expression;
        const name = f.textOf(
            x.type === 'AssignmentExpression'
                ? x.left
                : x.callee?.type === 'MemberExpression'
                  ? x.callee.object
                  : x.arguments?.[0],
        );
        const value = f.values.get(name ?? '');
        const expected = value && statementFor(f, name ?? '', value);
        if (!name || !expected || f.textOf(x) !== expected || given.has(name))
            return new Set<string>();
        given.add(name);
    }
    return given;
}
function statementFor(f: File, name: string, { decl, isConst }: Value) {
    const init = f.textOf(decl.init);
    if (!isConst) return `${name} = ${init ?? 'undefined'}`;
    if (init === 'loaded()' && isLoader(f))
        return `resetObject(${name}, loaded())`;
    if (init === 'serial()') return `${name}.reset()`;
    const isEmpty =
        decl.init.type === 'NewExpression' && !decl.init.arguments.length;
    return isEmpty && /^(?:Map|Set)$/.test(f.textOf(decl.init.callee) ?? '')
        ? `${name}.clear()`
        : undefined;
}
// `loaded` builds a new object each call, so nothing inside it outlives a reset
function isLoader(f: File) {
    const init = f.values.get('loaded')?.decl.init;
    return (
        init?.type === 'ArrowFunctionExpression' &&
        !init.params.length &&
        init.body.type === 'ObjectExpression'
    );
}

function unresetIn(files: File[]) {
    const isFixed = fixedIn(files);
    return files
        .flatMap((f) => {
            const given = new Set(
                [...f.resets.values()].flatMap((r) => [...givenBackBy(f, r)]),
            );
            return [
                ...[...f.values.keys()].filter(
                    (n) => !isFixed(f, n) && !given.has(n),
                ),
                ...f.others,
                ...writesIn(f, (n) => isFixed(f, n)),
            ].map((n) => `${f.name} · ${n}`);
        })
        .sort();
}

// a write into a fixed value or an import that tsc allows (a cast, `Object.assign`) and no reset sees
function writesIn(f: File, isFixed: (name: string) => boolean) {
    const found = new Set<string>();
    walk(f.program, (n) => {
        const isCall =
            n.type === 'CallExpression' &&
            /^(?:Object\.(?:assign|definePropert(?:y|ies)|setPrototypeOf)|Reflect\.(?:set|defineProperty|deleteProperty))$/.test(
                f.textOf(n.callee) ?? '',
            );
        const target = isCall
            ? n.arguments[0]
            : n.type === 'AssignmentExpression'
              ? n.left
              : n.type === 'UpdateExpression' ||
                  (n.type === 'UnaryExpression' && n.operator === 'delete')
                ? n.argument
                : undefined;
        const name = String(rootOf(target)?.name ?? '');
        if (!name || (!isCall && target.type === 'Identifier')) return;
        const isKnown =
            f.functions.has(name) || f.imports.has(name) || f.values.has(name);
        if (isKnown && (f.imports.has(name) || isFixed(name)))
            found.add(`${name} written`);
    });
    return [...found];
}
function rootOf(n: Node): Node {
    if (n?.type === 'MemberExpression') return rootOf(n.object);
    return /^TS\w+Expression$/.test(n?.type) ? rootOf(n.expression) : n;
}
function walk(n: unknown, visit: (n: Node) => void) {
    if (Array.isArray(n)) for (const x of n) walk(x, visit);
    else if (n && typeof n === 'object') {
        if ('type' in n) visit(n as Node);
        for (const v of Object.values(n)) walk(v, visit);
    }
}

// the resets resetModules calls: its body is calls alone, each to the import of that owner's reset
function calledBy(files: File[]) {
    const home = files.find((f) => f.resets.has('resetModules'));
    return (home?.resets.get('resetModules')?.body.body ?? []).map(
        (st: Node) => {
            const from = home?.imports.get(st.expression?.callee?.name ?? '');
            return from ? `${from.from} · ${from.name}` : home?.textOf(st);
        },
    );
}

// the quit's own hook: resetModules runs once, in the finally of the try that awaits endSession
function quitWiring(f: File | undefined) {
    let count = 0;
    let isInFinally = false;
    walk(f?.program, (n) => {
        if (n.type === 'CallExpression' && n.callee.name === 'resetModules')
            count += 1;
        if (n.type !== 'TryStatement') return;
        isInFinally ||=
            /\bawait endSession\(/.test(f?.textOf(n.block) ?? '') &&
            f?.textOf(n.finalizer) === '{ if (!isLeft) resetModules(); }';
    });
    return { count, isInFinally };
}

const files = readdirSync(HOOKS, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.tsx?$/.test(d.name))
    .map((d) =>
        readFile(d.name, readFileSync(join(d.parentPath, d.name), 'utf8')),
    );
const of = (source: string) => unresetIn([readFile('a.ts', source)]);

describe('x-mod-stash: each module variable is reset at a quit', () => {
    it('a variable with no reset is named', () => {
        expect(unresetIn(files)).toEqual(PENDING);
    });

    it('resetModules calls every reset, and nothing else', () => {
        const named = files.flatMap((f) =>
            [...f.resets.keys()]
                .filter((n) => n !== 'resetModules')
                .map((n) => `${f.name} · ${n}`),
        );
        expect(calledBy(files).sort()).toEqual(named.sort());
    });

    it("the quit's hook runs it once, whatever its own work throws", () => {
        const wiring = quitWiring(files.find((f) => f.name === 'register.tsx'));
        expect(wiring).toEqual({ count: 1, isInFinally: true });
    });

    it.each([
        'let z = 0;',
        'var z = 0;',
        'let [z] = [0];',
        'const { z } = { z: [] };',
        'const z: Map<string, () => void> = new Map();',
        'const z = new Map<string, { a: 1; b: 2 }>();',
        "const z = new Set(['x']);",
        'const z = new WeakSet();',
        'const z = make();',
        'const z = (() => ({}))();',
        'const z = { n: 0 };',
        'const z = [0];',
        'const z = { m: new Map() } as const;',
        'const z: Readonly<{ l: string[] }> = { l: [] };',
        'const y = [0]; const z = { y } as const;',
        'const f = () => 1; f.n = 1;',
        'function f() {} f.n += 1;',
        "import { other } from './b.ts'; const f = () => { other.n++; };",
        'const z = /a/g; const f = (s: string) => z.test(s);',
        "const z = /a/g; const f = (s: string) => z['test'](s);",
        'const z = /a/g; const f = () => go(z);',
        'export const z = /a/g;',
        'const z = /a/y; const f = (s: string) => s.match(z);',
        "const z = /a/y; const f = (s: string) => s.replace(z, '');",
        "const z = new RegExp('a', FLAGS); const f = (s: string) => z.test(s);",
        'const z = new RegExp(/a/g); const f = (s: string) => z.test(s);',
        'const z = { r: /a/g } as const;',
        'const z: Readonly<Record<string, RegExp>> = { r: /a/g };',
        "const z: ReadonlyMap<string, string[]> = new Map([['a', []]]);",
        'const z: ReadonlySet<string[]> = new Set([[]]);',
        'const z = { n: 0 } as const; const f = () => { Object.assign(z, { n: 1 }); };',
        'const z: Readonly<{ n: number }> = { n: 0 }; const f = () => { (z as any).n = 1; };',
        'const f = () => 1; Object.assign(f, { n: 1 });',
        'class Z { static n = 0; }',
        'enum Z { A }',
        'globalThis.z = 1;',
        'if (a) b();',
    ])('names %s', (source) => {
        expect(of(source)).not.toEqual([]);
    });

    it.each([
        'const z = 1;',
        "const z = 'a' + 'b';",
        "const z = ['a', 'b'].join(' ');",
        'const z = (n: number) => n;',
        'const z = /a/;',
        "const z = /a/g; const f = (s: string) => s.replace(z, '');",
        "const z = { a: ['b'], c: { d: undefined } } as const;",
        'const z = { a: 1 } as const satisfies Record<string, number>;',
        "const z: ReadonlySet<string> = new Set(['a']);",
        "const z: Readonly<Record<string, string>> = { a: 'b' };",
        'const z = { a: { b: 1 } } as const; const y = z.a;',
        'type Z = 1; interface Y { a: 1 }',
    ])('passes %s', (source) => {
        expect(of(source)).toEqual([]);
    });

    it.each([
        ['let z = 0;', 'z = 0;'],
        ['let z: string | undefined;', 'z = undefined;'],
        ['const z = new Map<string, { a: 1; b: 2 }>();', 'z.clear();'],
        [
            "import { serial } from './util.ts'; const z = serial();",
            'z.reset();',
        ],
        [
            'const loaded = () => ({ a: [] }); const z = loaded();',
            'resetObject(z, loaded());',
        ],
    ])('%s is given back by %s', (declared, reset) => {
        expect(of(`${declared} export function resetA() { ${reset} }`)).toEqual(
            [],
        );
    });

    it.each([
        ['let z = 0;', ''],
        ['let z = 0;', '// z = 0;\n'],
        ['let z = 0;', 'z = 1;'],
        ['let z = 0;', 'z += 1;'],
        ['let z = 0;', 'other.z = 0;'],
        ['let z = 0;', 'const z = 0;'],
        ['let z = 0;', 'if (a) z = 0;'],
        ['let z = 0;', 'return; z = 0;'],
        ['let z = 0;', '} export function resetB(z: number) { z = 0;'],
        ['const z = { a: 1, b: 2 };', 'Object.assign(z, { a: 1 });'],
        [
            'const loaded = () => ({ a: [] }); const z = loaded();',
            'Object.assign(z, loaded());',
        ],
        [
            'const kept = {}; const loaded = () => kept; const z = loaded();',
            'resetObject(z, loaded());',
        ],
        ["const z = new Set(['x']);", 'z.clear();'],
        ['let z = 0;', 'z = 0; z = 1;'],
        ['let z = 0;', 'z = 0; z++;'],
        ['let z = 0;', 'z = 0; z = 0;'],
        ['let z = 0;', 'mayThrow(); z = 0;'],
    ])('%s is not given back by «%s»', (declared, reset) => {
        expect(
            of(`${declared} export function resetA() { ${reset} }`),
        ).toContain('a.ts · z');
    });

    it.each(['async function', 'function*'])(
        'a reset that is an %s gives nothing back',
        (kind) => {
            expect(
                of(`let z = 0; export ${kind} resetA() { z = 0; }`),
            ).toContain('a.ts · z');
        },
    );
});

/* Types */
// biome-ignore lint/suspicious/noExplicitAny: a parsed node's fields depend on its type
type Node = any;
type Value = { decl: Node; isConst: boolean; isExported: boolean };
type File = {
    functions: Set<string>;
    imports: Map<string, { from: string; name: string }>;
    name: string;
    // the top-level statements that are neither an import, a type, a function nor a variable
    others: string[];
    program: Node;
    resets: Map<string, Node>;
    textOf: (n?: Node | null) => string | undefined;
    values: Map<string, Value>;
};
