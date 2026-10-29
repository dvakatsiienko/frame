// helga's bulk-replace, all or none (PK-133): every pair's anchor must match its file exactly once, or
// nothing is written; the receipt is one line per pair
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function planReplace(pairs: Pair[], root: string) {
    const bodies = new Map<string, string>();
    const misses: string[] = [];
    pairs.forEach((pair, i) => {
        const file = path.resolve(root, pair.file);
        let body: string;
        try {
            body = bodies.get(file) ?? readFileSync(file, 'utf8');
        } catch {
            misses.push(`${i + 1} ${pair.file}: no such file`);
            return;
        }
        const count = body.split(pair.old).length - 1;
        if (count !== 1) {
            misses.push(`${i + 1} ${pair.file}: anchor matches ${count} times`);
            return;
        }
        bodies.set(
            file,
            body.replace(pair.old, () => pair.new),
        );
    });
    return { bodies, misses };
}

if (import.meta.main) {
    const [list, root = process.cwd()] = process.argv.slice(2);
    if (!list) {
        console.error(
            'usage: node bulk-replace.ts <pairs.json> [root] — pairs: [{ "file", "old", "new" }]',
        );
        process.exit(2);
    }
    const pairs = JSON.parse(readFileSync(list, 'utf8')) as Pair[];
    const { bodies, misses } = planReplace(pairs, root);
    if (misses.length) {
        for (const miss of misses) console.log(`🔴 ${miss}`);
        console.log(
            `bulk-replace: nothing written, ${misses.length} of ${pairs.length} pairs missed`,
        );
        process.exit(1);
    }
    for (const [file, body] of bodies) writeFileSync(file, body);
    console.log(
        `bulk-replace: ${pairs.length} pairs, ${bodies.size} files written`,
    );
}

/* Types */

type Pair = { file: string; new: string; old: string };
