import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// two mods share code only by copy (an import never leaves a mod's folder); each copy sits between a
// `// twin <name> — …` line and `// twin end`, and every copy of a name must read the same
const HERE = import.meta.dirname;
const TWIN = /^\/\/ twin (\S+) — .*\n([\s\S]*?)^\/\/ twin end$/gm;

function sources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const path = join(dir, d.name);
        if (d.isDirectory()) return d.name === 'types' ? [] : sources(path);
        return /\.tsx?$/.test(d.name) && !d.name.endsWith('.d.ts')
            ? [path]
            : [];
    });
}

const twins = new Map<string, { file: string; body: string }[]>();
for (const mod of readdirSync(HERE).filter((n) => n.startsWith('x-mod-')))
    for (const file of sources(join(HERE, mod, 'hooks')))
        for (const m of readFileSync(file, 'utf8').matchAll(TWIN)) {
            const [, name = '', body = ''] = m;
            twins.set(name, [
                ...(twins.get(name) ?? []),
                { body, file: file.slice(HERE.length + 1) },
            ]);
        }

describe('twin blocks across mods', () => {
    it('finds the twins', () => {
        expect([...twins.keys()].sort()).toEqual([
            'dirname',
            'holder-gone',
            'proc-of',
            'real-path',
        ]);
    });
    for (const [name, copies] of twins)
        it(`${name} reads the same in every copy`, () => {
            expect(copies.length).toBeGreaterThan(1);
            for (const c of copies.slice(1))
                expect({ body: c.body, file: c.file }).toEqual({
                    body: copies[0]?.body,
                    file: c.file,
                });
        });
});
