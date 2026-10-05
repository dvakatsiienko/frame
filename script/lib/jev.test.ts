import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { cycleSpend, cycleStart } from './jev.ts';

const log = (lines: string[]) => {
    const path = join(mkdtempSync(join(tmpdir(), 'jev-spend-')), 'spend.log');
    writeFileSync(path, lines.join('\n'));
    return path;
};

describe('cycleStart', () => {
    test('a day before the 18th belongs to last month’s cycle', () => {
        expect(cycleStart(new Date(2026, 9, 5))).toEqual(new Date(2026, 8, 18));
    });

    test('the 18th opens a new cycle', () => {
        expect(cycleStart(new Date(2026, 9, 18))).toEqual(
            new Date(2026, 9, 18),
        );
    });
});

describe('cycleSpend', () => {
    test('spend before the cycle opened does not count', () => {
        const path = log([
            `${new Date(2026, 9, 17, 12).toISOString()}\t1\t4.000000`,
            `${new Date(2026, 9, 18, 12).toISOString()}\t1\t0.100000`,
        ]);
        expect(cycleSpend(new Date(2026, 9, 19), path)).toBeCloseTo(0.1);
    });
});

describe('judge', () => {
    const ok = {
        answers: {},
        model: 'jev-1.13.0',
        usage: { input_tokens: 1_000_000, output_tokens: 0 },
    };
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv('TYPESAFE_API_KEY', 'test');
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test('over the cap, no request leaves', async () => {
        vi.stubEnv(
            'JEV_SPEND_LOG',
            log([`${new Date().toISOString()}\t1\t4.000000`]),
        );
        const { judge, JevBudgetError } = await import('./jev.ts');
        await expect(judge({}, {})).rejects.toBeInstanceOf(JevBudgetError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('an amount that is not a number keeps the gate shut', async () => {
        const now = new Date().toISOString();
        vi.stubEnv(
            'JEV_SPEND_LOG',
            log([`${now}\t1\t0.100000`, `${now}\t1\tx`]),
        );
        const { judge, JevBudgetError } = await import('./jev.ts');
        await expect(judge({}, {})).rejects.toBeInstanceOf(JevBudgetError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('a 402 refuses as a budget error', async () => {
        vi.stubEnv('JEV_SPEND_LOG', log([]));
        fetchMock.mockResolvedValue(
            new Response('billing_error', { status: 402 }),
        );
        const { judge, JevBudgetError } = await import('./jev.ts');
        await expect(judge({}, {})).rejects.toBeInstanceOf(JevBudgetError);
    });

    test('after a 402, a later call sends nothing', async () => {
        vi.stubEnv('JEV_SPEND_LOG', log([]));
        fetchMock.mockResolvedValue(
            new Response('billing_error', { status: 402 }),
        );
        const { judge } = await import('./jev.ts');
        await judge({}, {}).catch(() => undefined);
        await judge({}, {}).catch(() => undefined);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a paid call adds its cost to the spend log', async () => {
        const path = log([]);
        vi.stubEnv('JEV_SPEND_LOG', path);
        fetchMock.mockResolvedValue(Response.json(ok));
        const { judge } = await import('./jev.ts');
        await judge({}, {});
        expect(readFileSync(path, 'utf8')).toMatch(/\t1000000\t0\.042000\n$/);
    });

    test('an unwritable spend log keeps the paid answer', async () => {
        // a log path under a regular file: mkdir fails with ENOTDIR
        vi.stubEnv('JEV_SPEND_LOG', join(log([]), 'spend.log'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fetchMock.mockResolvedValue(Response.json(ok));
        const { judge } = await import('./jev.ts');
        await expect(judge({}, {})).resolves.toMatchObject(ok);
    });

    test('after an unwritable spend log, a later call sends nothing', async () => {
        vi.stubEnv('JEV_SPEND_LOG', join(log([]), 'spend.log'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fetchMock.mockResolvedValue(Response.json(ok));
        const { judge } = await import('./jev.ts');
        await judge({}, {});
        await judge({}, {}).catch(() => undefined);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a paid call counts toward the cap within the same run', async () => {
        vi.stubEnv(
            'JEV_SPEND_LOG',
            log([`${new Date().toISOString()}\t1\t3.980000`]),
        );
        fetchMock.mockResolvedValue(Response.json(ok));
        const { judge } = await import('./jev.ts');
        await judge({}, {});
        await judge({}, {}).catch(() => undefined);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
