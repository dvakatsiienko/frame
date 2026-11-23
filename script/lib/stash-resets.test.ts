import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// the test rows of one file share one host boot (FRM-678), so a module variable kept past a session's quit leaks into the
// next row: each owner resets its own in an exported `reset…` function, and session-end.ts calls every one of them
// here, beside code-size.test.ts: a root file under mods/ makes the commit hook run every mod's host suite
const HOOKS = join(
    import.meta.dirname,
    '../../home/.claude/plugin-x/mods/x-mod-stash/hooks',
);
// a module not reset yet; each reset commit deletes its row, the last empties this
const PENDING = [
    'fields.ts',
    'held.ts',
    'joins.ts',
    'keep-warm.ts',
    'lanes.ts',
    'orbit-store.ts',
    'override.ts',
    'parked-wake.ts',
    'quiet-gate.ts',
    'rows.ts',
    'session-identity.ts',
    'session-record.ts',
    'session-start.ts',
    'settings-store.ts',
    'turn-notes.ts',
    'usage.ts',
    'view.ts',
    'wind-run.ts',
];

// a line at column 0 opens a module-level statement; a comment line never reads as one
function codeOf(source: string) {
    return source.replace(/(^|\s)\/\/.*$/gm, '$1');
}

// the module variables of one file: a `let`, a Map or Set born empty, a serial lock, an array or object the file changes
function variablesOf(code: string) {
    const found = new Set<string>();
    for (const [, name] of code.matchAll(/^(?:export )?let (\w+)/gm))
        found.add(name ?? '');
    for (const [, name, init] of code.matchAll(
        /^(?:export )?const (\w+)\b[^=]*=\s*(new (?:Map|Set|WeakMap)\b[^;]*;|serial\(\)|\[\s*\]|\{)/gm,
    )) {
        if (!name || !init) continue;
        const isChanged = new RegExp(
            `\\b${name}\\.\\w+ (?:=|\\+=|-=)|Object\\.assign\\(${name}\\b|\\bdelete ${name}\\[|\\b${name}\\.(?:push|splice|pop|shift)\\(`,
        ).test(code);
        if (init === 'serial()' || /^new .*\(\s*\)\s*;$/s.test(init))
            found.add(name);
        else if (init === '[' || init.startsWith('[') || init === '{') {
            if (isChanged) found.add(name);
        }
    }
    return [...found];
}

// the names an exported `reset…` function gives back its load value
function resetIn(code: string) {
    const bodies = [
        ...code.matchAll(/^export function (reset\w+)\(\) \{([\s\S]*?)^\}/gm),
    ];
    return {
        names: bodies.map(([, name]) => name ?? ''),
        text: bodies.map(([, , body]) => body).join('\n'),
    };
}

const isReset = (name: string, text: string) =>
    new RegExp(
        `\\b${name} = |\\b${name}\\.clear\\(\\)|Object\\.assign\\(${name}\\b`,
    ).test(text);

function unresetIn(source: string) {
    const code = codeOf(source);
    const { text } = resetIn(code);
    return variablesOf(code).filter((name) => !isReset(name, text));
}

function hooksFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const path = join(dir, d.name);
        if (d.isDirectory()) return hooksFiles(path);
        return /\.tsx?$/.test(d.name) ? [path] : [];
    });
}

const files = hooksFiles(HOOKS).map((path) => ({
    name: relative(HOOKS, path),
    source: readFileSync(path, 'utf8'),
}));

describe('x-mod-stash: each module variable is reset at a quit', () => {
    it('a file with an unreset variable is named', () => {
        const unreset = files.filter((f) => unresetIn(f.source).length);
        expect(unreset.map((f) => f.name).sort()).toEqual(PENDING);
    });

    it('session-end.ts calls every reset function', () => {
        const end = files.find((f) => f.name === 'session-end.ts')?.source;
        const named = files
            .filter((f) => f.name !== 'session-end.ts')
            .flatMap((f) => resetIn(codeOf(f.source)).names);
        expect(named.filter((n) => !end?.includes(`${n}();`))).toEqual([]);
    });

    it('reads a let, an empty map, a lock and a changed object, never a fixed one', () => {
        const source = `
let a = 0;
export let b: string | undefined;
const c = new Map<string, number>();
const fixedSet = new Set(['x']);
const lock = serial();
const kept = { on: false };
const table = { on: false };
const list: string[] = [];
const fixedList = ['x'];
const bump = () => {
    let local = 1;
    kept.on = true;
    list.push('y');
};
`;
        expect(variablesOf(source).sort()).toEqual([
            'a',
            'b',
            'c',
            'kept',
            'list',
            'lock',
        ]);
    });

    it('a variable its reset gives back is no finding, a missed one is', () => {
        const source = `
let a = 0;
let b = 0;
export function resetOne() {
    a = 0;
}
`;
        expect(unresetIn(source)).toEqual(['b']);
    });
});
