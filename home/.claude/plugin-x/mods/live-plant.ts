// pnpm mods:live --plant <file> <anchor> <replacement>: the live frame runs a scratch copy of the file's mod with one change
// planted, so a pane test sees a known fault drawn and the tree is never written
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const MANIFEST = '.claude-plugin/plugin.json';

function modOf(file: string) {
    for (let d = dirname(file); d !== dirname(d); d = dirname(d))
        if (existsSync(join(d, MANIFEST))) return d;
    return undefined;
}

// the planted copy's mod dir and the file changed in it; throws before anything is copied unless the anchor matches once
export function plantedCopy(file: string, anchor: string, replacement: string) {
    const path = resolve(file);
    if (!existsSync(path)) throw new Error(`${path} does not exist`);
    const mod = modOf(path);
    if (!mod) throw new Error(`${path} is not inside a mod (no ${MANIFEST})`);
    const text = readFileSync(path, 'utf8');
    const matches = anchor ? text.split(anchor).length - 1 : 0;
    if (matches !== 1)
        throw new Error(
            `the anchor must match once in ${path}; it matches ${matches} times`,
        );
    const copy = join(mkdtempSync(join(tmpdir(), 'mods-live-plant-')), 'mod');
    cpSync(mod, copy, { recursive: true });
    const inCopy = join(copy, relative(mod, path));
    writeFileSync(
        inCopy,
        text.replace(anchor, () => replacement),
    );
    return { file: inCopy, mod: copy };
}
