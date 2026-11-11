// the herdr and desktop leaves share one `##` heading list in one order, so a line's home in one names its home in the other.
// run from the repo root (the pre-commit gate runs it on the index copy); exit 1 names the first drift.
import { existsSync, readFileSync } from 'node:fs';

const leaves = [
    '_clio/memory/surface-herdr-desktop.md',
    '_clio/memory/surface-claude-desktop.md',
] as const;

const missing = leaves.filter((path) => !existsSync(path));
if (missing.length > 0) {
    fail(`missing leaf: ${missing.join(', ')}`);
}

const herdr = headings(leaves[0]);
const desktop = headings(leaves[1]);
const length = Math.max(herdr.length, desktop.length);
for (let index = 0; index < length; index++) {
    if (herdr[index] !== desktop[index]) {
        fail(
            `heading ${index + 1} drifts: ${leaves[0]} has ${quote(herdr[index])}, ${leaves[1]} has ${quote(desktop[index])}`,
        );
    }
}

function headings(path: string) {
    return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('## '))
        .map((line) => line.slice(3).trim());
}

function quote(heading: string | undefined) {
    return heading === undefined ? 'nothing' : `«${heading}»`;
}

function fail(message: string): never {
    console.error(`surface-mirror-check: ${message}`);
    process.exit(1);
}
