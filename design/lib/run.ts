import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function runScript(script: string, args: string[]) {
    const result = spawnSync(
        process.execPath,
        [join(import.meta.dirname, '..', `${script}.ts`), ...args],
        {
            encoding: 'utf8',
        },
    );
    return { status: result.status, stdout: result.stdout };
}

export function writeTemp(name: string, content: string | Uint8Array): string {
    const path = join(mkdtempSync(join(tmpdir(), 'design-')), name);
    writeFileSync(path, content);
    return path;
}

export function colorTokens(
    roles: Record<string, Record<string, string>>,
): string {
    const color = Object.fromEntries(
        Object.entries(roles).map(([group, tokens]) => [
            group,
            Object.fromEntries(
                Object.entries(tokens).map(([name, value]) => [
                    name,
                    { $value: value },
                ]),
            ),
        ]),
    );
    return JSON.stringify({ color: { $type: 'color', ...color } });
}
