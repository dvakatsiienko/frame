/* Core */
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

// a background session's Edit/Write is refused in the shared checkout; it edits a scratch copy and pushes it back.
// the scratch root holds the copies at their repo paths, and `.base/` the bytes each one was pulled at.
const BASE = '.base';

export type Pushed = {
    path: string;
    outcome: 'synced' | 'refused' | 'new';
    reason?: string;
};

const same = (a: string, b: string) => readFileSync(a).equals(readFileSync(b));

function copy(from: string, to: string) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
}

// Copies each repo path into the scratch root and its snapshot; a path not in the repo yet is a new file to write there.
export function pull(repo: string, scratch: string, paths: string[]) {
    return paths.map((path) => {
        const from = join(repo, path);
        if (!existsSync(from)) {
            mkdirSync(dirname(join(scratch, path)), { recursive: true });
            return { path, scratch: join(scratch, path) };
        }
        copy(from, join(scratch, path));
        copy(from, join(scratch, BASE, path));
        return { path, scratch: join(scratch, path) };
    });
}

function scratchFiles(scratch: string, dir = scratch): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory())
            return dir === scratch && entry.name === BASE
                ? []
                : scratchFiles(scratch, full);
        return [relative(scratch, full)];
    });
}

// Every scratch file whose bytes differ from its snapshot, or that has none.
export function changed(scratch: string) {
    return scratchFiles(scratch).filter((path) => {
        const base = join(scratch, BASE, path);
        return !existsSync(base) || !same(join(scratch, path), base);
    });
}

// Writes each changed scratch file back into the repo, refusing one the repo changed since its pull; a refusal writes nothing.
export function push(repo: string, scratch: string): Pushed[] {
    const plan = changed(scratch).map((path): Pushed => {
        const target = join(repo, path);
        const base = join(scratch, BASE, path);
        if (!existsSync(base))
            return existsSync(target)
                ? {
                      outcome: 'refused',
                      path,
                      reason: 'exists in the repo but was never pulled',
                  }
                : { outcome: 'new', path };
        if (!existsSync(target))
            return {
                outcome: 'refused',
                path,
                reason: 'gone from the repo since the pull',
            };
        return same(target, base)
            ? { outcome: 'synced', path }
            : {
                  outcome: 'refused',
                  path,
                  reason: 'changed in the repo since the pull — pull it again and redo the edit',
              };
    });
    if (plan.some((p) => p.outcome === 'refused')) return plan;
    for (const { path } of plan) {
        copy(join(scratch, path), join(repo, path));
        copy(join(scratch, path), join(scratch, BASE, path));
    }
    return plan;
}
