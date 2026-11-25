import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

describe('groomedOrUnlogged', () => {
    const day = '2020-01-02';
    const load = async () => {
        const dir = mkdtempSync(join(tmpdir(), 'prompt-log-'));
        writeFileSync(join(dir, `${day}.md`), '## 09:12\n\na prompt\n');
        vi.stubEnv('PROMPT_RAW_DIR', dir);
        vi.stubEnv('CLIO_THREAD', '');
        vi.resetModules();
        const { groomedOrUnlogged } = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        return groomedOrUnlogged;
    };

    test('a logged minute with no groom still owes one', async () => {
        expect((await load())(day, '09:12', '')).toBe(false);
    });

    test("a wing's minute, absent from the log, owes none", async () => {
        expect((await load())(day, '17:47', '')).toBe(true);
    });

    test('an orbit steer stays owed, the log never holds one', async () => {
        expect((await load())(day, 'o34', '')).toBe(false);
    });
});

describe('groomedOrUnloggedAnywhere', () => {
    const day = '2020-01-02';
    const load = async () => {
        const dir = mkdtempSync(join(tmpdir(), 'prompt-log-'));
        writeFileSync(join(dir, `${day}.md`), '## 09:12\n\na main prompt\n');
        mkdirSync(join(dir, 'wing-1'));
        writeFileSync(
            join(dir, 'wing-1', `${day}.md`),
            '## 17:47\n\na wing prompt\n',
        );
        vi.stubEnv('PROMPT_RAW_DIR', dir);
        vi.stubEnv('PROMPT_GROOM_DIR', join(dir, 'no-grooms'));
        vi.stubEnv('CLIO_THREAD', '');
        vi.resetModules();
        const { groomedOrUnloggedAnywhere } = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        return groomedOrUnloggedAnywhere;
    };

    test("a minute in a wing's log still owes a groom", async () => {
        expect((await load())(day, '17:47', '')).toBe(false);
    });

    test("a minute in main's log still owes a groom", async () => {
        expect((await load())(day, '09:12', '')).toBe(false);
    });

    test('a minute no thread logged owes none', async () => {
        expect((await load())(day, '11:30', '')).toBe(true);
    });
});

describe('a groom from another thread', () => {
    test('a wing finds a groom main made at the root', async () => {
        const root = mkdtempSync(join(tmpdir(), 'grooms-'));
        writeFileSync(
            join(root, '2026-11-09-1412.groomed.md'),
            'PK-1:W1 (2026-11-09 14:12, dima): ship it\n',
        );
        vi.stubEnv('PROMPT_GROOM_DIR', root);
        vi.stubEnv('CLIO_THREAD', 'wing-1');
        vi.resetModules();
        const groom = await import('./prompt-groom.ts');
        vi.unstubAllEnvs();
        expect(groom.groomedOnDisk('2026-11-09', '14:12', '')).toBe(true);
    });
});
