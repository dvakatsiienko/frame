import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

type Ticket = {
    id: string;
    labels?: string[];
    relations?: { type: string; state: string }[];
};
type Lane = {
    endedAt?: number;
    items: { ticket?: string; isDone: boolean }[];
    members?: Record<string, unknown>;
};

// a stub `x` on PATH: the list and the read answer from the given tickets; none means linear is down.
// HOME is a fixture dir holding the given glide lanes.
function run(tickets?: Ticket[], lanes: Lane[] = []) {
    const dir = mkdtempSync(join(tmpdir(), 'close-net-'));
    const home = join(dir, 'home');
    mkdirSync(join(home, '.claude/shelf'), { recursive: true });
    writeFileSync(
        join(home, '.claude/shelf/lanes.json'),
        JSON.stringify({ lanes }),
    );
    const body = JSON.stringify({ data: { tickets } });
    writeFileSync(
        join(dir, 'x'),
        tickets
            ? `#!/bin/sh\ncat <<'EOF'\n${body}\nEOF\n`
            : '#!/bin/sh\nexit 1\n',
    );
    chmodSync(join(dir, 'x'), 0o755);
    return spawnSync('node', [join(import.meta.dirname, 'close-net.ts')], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home, PATH: `${dir}:${process.env.PATH}` },
    });
}

describe('close-net', () => {
    test('the label needs human passes', () => {
        const out = run([{ id: 'FRM-1', labels: ['needs human'] }]);
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: needs human');
    });

    test('an open blocked-by passes', () => {
        const out = run([
            {
                id: 'FRM-1',
                relations: [{ state: 'In Progress', type: 'blocked by' }],
            },
        ]);
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: blocked by');
    });

    test('an open step on a running glide card passes', () => {
        const out = run(
            [{ id: 'FRM-1' }],
            [{ items: [{ isDone: false, ticket: 'FRM-1' }] }],
        );
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('FRM-1: a glide step');
    });

    test('with no member on a card, only its current step passes', () => {
        const items = [
            { isDone: false, ticket: 'FRM-1' },
            { isDone: false, ticket: 'FRM-2' },
        ];
        const out = run([{ id: 'FRM-1' }, { id: 'FRM-2' }], [{ items }]);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('🔴 FRM-2');
        expect(out.stdout).not.toContain('🔴 FRM-1');
    });

    test('a linked member passes every open step', () => {
        const items = [
            { isDone: false, ticket: 'FRM-1' },
            { isDone: false, ticket: 'FRM-2' },
        ];
        const out = run(
            [{ id: 'FRM-1' }, { id: 'FRM-2' }],
            [{ items, members: { codie: {} } }],
        );
        expect(out.status).toBe(0);
    });

    test('a ticket with no door reds and is named', () => {
        const out = run([
            { id: 'FRM-1', labels: ['agent'] },
            { id: 'FRM-2', labels: ['needs human'] },
        ]);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain(
            '🔴 FRM-1: close it, or give it a door (needs human, blocked by, a glide step)',
        );
        expect(out.stdout).not.toContain('🔴 FRM-2');
    });

    test('a closed blocker, a done step and an ended lane do not pass', () => {
        const out = run(
            [
                {
                    id: 'FRM-1',
                    relations: [{ state: 'Done', type: 'blocked by' }],
                },
                { id: 'FRM-2' },
                { id: 'FRM-3' },
            ],
            [
                {
                    items: [
                        { isDone: true, ticket: 'FRM-2' },
                        { isDone: false, ticket: 'FRM-4' },
                    ],
                },
                { endedAt: 1, items: [{ isDone: false, ticket: 'FRM-3' }] },
            ],
        );
        expect(out.status).toBe(1);
        for (const id of ['FRM-1', 'FRM-2', 'FRM-3'])
            expect(out.stdout).toContain(`🔴 ${id}`);
    });

    test('linear down is not a red', () => {
        const out = run();
        expect(out.status).toBe(0);
        expect(out.stdout).toContain('unreachable');
    });
});
