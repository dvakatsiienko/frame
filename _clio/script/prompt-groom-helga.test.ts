import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { helgaBootPrompt } from './prompt-groom.ts';

test('helga boots with her skill, then her passport', () => {
    const prompt = helgaBootPrompt(join(import.meta.dirname, '../..'));
    expect(prompt.startsWith('you are helga')).toBe(true);
    expect(prompt).toContain("# helga — clio's editing sidecar");
});

describe('helga is up by her record (FRM-579)', () => {
    test('a thread named «🎀 helga» with no record is not helga', async () => {
        const { isCopyistLive } = await import('./prompt-groom.ts');
        expect([
            isCopyistLive([{ name: '🎀 helga' }]),
            isCopyistLive([{ name: 'any name', role: 'copyist' }]),
        ]).toEqual([false, true]);
    });
});

test('a --bg helga job maps to its own session id, never the newest file (FRM-579)', async () => {
    const { sessionOfJob } = await import('./prompt-groom.ts');
    const dir = mkdtempSync(join(tmpdir(), 'helga-jobs-'));
    writeFileSync(
        join(dir, '11.json'),
        JSON.stringify({ jobId: 'aaaa1111', sessionId: 'sid-helga' }),
    );
    writeFileSync(
        join(dir, '22.json'),
        JSON.stringify({ jobId: 'bbbb2222', sessionId: 'sid-other' }),
    );
    expect([
        sessionOfJob('aaaa1111', dir),
        sessionOfJob('cccc3333', dir),
    ]).toEqual(['sid-helga', undefined]);
    rmSync(dir, { recursive: true });
});
