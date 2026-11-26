import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

function home(cases: object[], grades: object[]) {
    const dir = mkdtempSync(join(tmpdir(), 'comms-log-render-'));
    mkdirSync(join(dir, '.claude/shelf'), { recursive: true });
    mkdirSync(join(dir, '.local/state/x/herdr-notes'), { recursive: true });
    const lines = (rows: object[]) =>
        rows.map((r) => `${JSON.stringify(r)}\n`).join('');
    writeFileSync(join(dir, '.claude/shelf/comms-log.jsonl'), lines(cases));
    writeFileSync(
        join(dir, '.local/state/x/herdr-notes/grades.jsonl'),
        lines(grades),
    );
    return dir;
}

function unnamed(dir: string) {
    return spawnSync(
        'node',
        [join(import.meta.dirname, 'comms-log-render.ts'), '--unnamed'],
        { encoding: 'utf8', env: { ...process.env, HOME: dir } },
    );
}

const grade = (id: string) => ({
    at: '2026-11-26T16:13:54.243Z',
    grade: 'good',
    id,
    messageId: 'reply-0001',
});

describe('comms-log-render --unnamed', () => {
    test('a raw grade no case names is red, by its id', () => {
        const out = unnamed(
            home(
                [{ id: 'c1', raw: ['named-0001'] }],
                [grade('named-0001'), grade('loose-0002')],
            ),
        );
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('loose-00');
        expect(out.stdout).not.toContain('named-00');
    });

    test('every grade named by a case passes', () => {
        const out = unnamed(
            home(
                [{ id: 'c1', raw: ['named-0001'] }, { id: 'c2' }],
                [grade('named-0001')],
            ),
        );
        expect(out.status).toBe(0);
    });
});
