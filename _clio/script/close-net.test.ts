import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// a stub `x` on PATH: the list and the read answer from the given tickets; none means linear is down
function run(tickets?: { id: string; comments: { body: string }[] }[]) {
    const bin = mkdtempSync(join(tmpdir(), 'close-net-'));
    const body = JSON.stringify({ data: { tickets } });
    writeFileSync(
        join(bin, 'x'),
        tickets
            ? `#!/bin/sh\ncat <<'EOF'\n${body}\nEOF\n`
            : '#!/bin/sh\nexit 1\n',
    );
    chmodSync(join(bin, 'x'), 0o755);
    return spawnSync('node', [join(import.meta.dirname, 'close-net.ts')], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
}

describe('close-net', () => {
    test('a ticket with no named wait reds and is named', () => {
        const out = run([
            { comments: [{ body: 'looks fine' }], id: 'FRM-1' },
            { comments: [{ body: '⏳ waits: his test' }], id: 'FRM-2' },
        ]);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('FRM-1');
        expect(out.stdout).not.toContain('FRM-2');
    });

    test('a named wait inside a longer comment does not count', () => {
        const out = run([
            { comments: [{ body: 'no ⏳ waits: yet' }], id: 'FRM-1' },
        ]);
        expect(out.status).toBe(1);
    });

    test('every ticket with a named wait is green', () => {
        const out = run([
            { comments: [{ body: '⏳ waits: his test' }], id: 'FRM-2' },
        ]);
        expect(out.status).toBe(0);
    });

    test('linear down is not a red', () => {
        const out = run();
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('unreachable');
    });
});
