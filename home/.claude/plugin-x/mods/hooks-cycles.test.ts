import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// a mod's hooks files import downward only: a module that imports back up the chain loads half-built, so a split
// out of register.tsx keeps every hooks folder free of import cycles (FRM-662 exit 2)
const HERE = import.meta.dirname;
const IMPORT =
    /^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/gm;

function hooksFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const path = join(dir, d.name);
        if (d.isDirectory()) return hooksFiles(path);
        return /\.tsx?$/.test(d.name) && !d.name.endsWith('.d.ts')
            ? [path]
            : [];
    });
}

function importsOf(file: string, source: string) {
    return [...source.matchAll(IMPORT)].map((m) =>
        resolve(dirname(file), m[1] ?? ''),
    );
}

// the first cycle found, as the chain of files that closes it, or undefined
function cycleIn(graph: Map<string, string[]>) {
    const state = new Map<string, 'open' | 'done'>();
    const chain: string[] = [];
    const visit = (file: string): string[] | undefined => {
        if (state.get(file) === 'done') return undefined;
        if (state.get(file) === 'open')
            return [...chain.slice(chain.indexOf(file)), file];
        state.set(file, 'open');
        chain.push(file);
        for (const next of graph.get(file) ?? []) {
            const found = visit(next);
            if (found) return found;
        }
        chain.pop();
        state.set(file, 'done');
        return undefined;
    };
    for (const file of graph.keys()) {
        const found = visit(file);
        if (found) return found;
    }
    return undefined;
}

const mods = readdirSync(HERE).filter((n) => n.startsWith('x-mod-'));

describe('a mod imports downward only', () => {
    it('finds a cycle a pair of files makes', () => {
        const graph = new Map([
            ['/a.ts', ['/b.ts']],
            ['/b.ts', ['/a.ts']],
        ]);
        expect(cycleIn(graph)).toEqual(['/a.ts', '/b.ts', '/a.ts']);
    });

    it('reads import and export-from lines, never a string in code', () => {
        const source = [
            "import { a } from './a.ts';",
            "import type { B } from '../b.ts';",
            "export { c } from './c.ts';",
            "const s = 'from ./d.ts';",
        ].join('\n');
        expect(importsOf('/m/hooks/x.ts', source)).toEqual([
            '/m/hooks/a.ts',
            '/m/b.ts',
            '/m/hooks/c.ts',
        ]);
    });

    for (const mod of mods)
        it(`${mod}: its hooks hold no import cycle`, () => {
            const graph = new Map(
                hooksFiles(join(HERE, mod, 'hooks')).map((file) => [
                    file,
                    importsOf(file, readFileSync(file, 'utf8')),
                ]),
            );
            expect(
                cycleIn(graph)?.map((f) => relative(HERE, f)),
                'a module imports one above it: lift the call into the hook wiring',
            ).toBeUndefined();
        });
});
